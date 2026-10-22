#!/usr/bin/env python3
"""
tools/mix_audio.py — Renders the offline soundtrack WAV (44.1 kHz, 16-bit stereo) from window.__vc.audioLog
recorded during virtual-clock gameplay capture. Uses the real Ludo.ai .ogg files in LUMEN/game/audio/
and audio/manifest.json volume/loop/duck rules, so the soundtrack matches the exact virtual millisecond
of every SFX, music change, and dialogue/ledger ducking.

Usage:
  python3 tools/mix_audio.py <audio_log.json> <output.wav> [duration_sec=120] [game_dir=.]
"""
import json
import os
import subprocess
import sys
import numpy as np
from scipy.io import wavfile

SR = 44100

def decode_ogg(path):
    """Decode an .ogg file to float32 stereo numpy array at SR using ffmpeg."""
    if not os.path.exists(path):
        return None
    cmd = [
        "ffmpeg", "-v", "error", "-i", path,
        "-f", "f32le", "-acodec", "pcm_f32le", "-ac", "2", "-ar", str(SR), "-"
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0 or len(res.stdout) == 0:
        return None
    arr = np.frombuffer(res.stdout, dtype=np.float32).reshape(-1, 2)
    return arr

def resample_pitch(arr, pitch):
    if abs(pitch - 1.0) < 0.01 or len(arr) < 16:
        return arr
    new_len = max(1, int(len(arr) / pitch))
    idx = np.linspace(0, len(arr) - 1, new_len)
    i0 = np.floor(idx).astype(np.int32)
    i1 = np.minimum(i0 + 1, len(arr) - 1)
    frac = (idx - i0)[:, None]
    return arr[i0] * (1.0 - frac) + arr[i1] * frac

def main():
    log_path = sys.argv[1]
    out_wav = sys.argv[2]
    dur_sec = float(sys.argv[3]) if len(sys.argv) > 3 else 120.0
    game_dir = sys.argv[4] if len(sys.argv) > 4 else "."

    with open(os.path.join(game_dir, "audio", "manifest.json"), "r") as f:
        manifest = json.load(f)
    with open(log_path, "r") as f:
        data = json.load(f)

    events = data.get("audioLog", data) if isinstance(data, dict) else data
    t_start = float(data.get("tStart", events[0]["t"] if events else 0.0)) if isinstance(data, dict) else (events[0]["t"] if events else 0.0)

    total_samples = int(round(dur_sec * SR))
    sfx_bus = np.zeros((total_samples, 2), dtype=np.float32)
    music_bus = np.zeros((total_samples, 2), dtype=np.float32)

    cache = {}
    def get_buf(kind, item_id):
        key = (kind, item_id)
        if key in cache:
            return cache[key]
        d = manifest.get(kind, {}).get(item_id)
        if not d or not d.get("file"):
            cache[key] = None
            return None
        p = os.path.join(game_dir, "audio", d["file"])
        buf = decode_ogg(p)
        cache[key] = buf
        return buf

    # Build ducking envelope & volume envelope
    duck_env = np.ones(total_samples, dtype=np.float32)
    cur_duck = False
    last_duck_sample = 0

    # Track music segments: list of (start_sample, end_sample, music_id, music_vol)
    music_segs = []
    cur_music = data.get("initialMusic", "title") if isinstance(data, dict) else "title"
    cur_music_start = 0
    cur_music_vol = 0.6
    cur_sfx_vol = 0.8

    for ev in events:
        rel_ms = float(ev.get("t", t_start)) - t_start
        samp = max(0, min(total_samples, int(round((rel_ms / 1000.0) * SR))))
        vol = ev.get("vol") or {}
        if "sfx" in vol:
            cur_sfx_vol = float(vol["sfx"])
        if "music" in vol:
            cur_music_vol = float(vol["music"])

        k = ev.get("kind")
        if k == "duck":
            new_duck = bool(ev.get("on"))
            if new_duck != cur_duck:
                duck_env[last_duck_sample:samp] = 0.35 if cur_duck else 1.0
                cur_duck = new_duck
                last_duck_sample = samp
        elif k == "music":
            m_id = ev.get("id")
            if m_id != cur_music:
                if cur_music and samp > cur_music_start:
                    music_segs.append((cur_music_start, samp, cur_music, cur_music_vol))
                cur_music = m_id
                cur_music_start = samp
        elif k == "stop":
            if cur_music and samp > cur_music_start:
                music_segs.append((cur_music_start, samp, cur_music, cur_music_vol))
            cur_music = None
            cur_music_start = samp
        elif k == "sfx":
            s_id = ev.get("id")
            buf = get_buf("sfx", s_id)
            if buf is not None and samp < total_samples:
                d = manifest.get("sfx", {}).get(s_id, {})
                m_vol = float(d.get("vol", 1.0)) * float(ev.get("v", 1.0)) * cur_sfx_vol
                pv = float(d.get("pitchVar", 0.0))
                pitch = float(ev.get("p", 1.0))
                if pv > 0:
                    # deterministic pitch variation from sample index
                    r = ((samp * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
                    pitch *= (1.0 + (r * 2.0 - 1.0) * pv)
                clip = resample_pitch(buf, pitch)
                end_s = min(total_samples, samp + len(clip))
                n = end_s - samp
                if n > 0:
                    sfx_bus[samp:end_s] += clip[:n] * m_vol

    duck_env[last_duck_sample:] = 0.35 if cur_duck else 1.0
    if cur_music and total_samples > cur_music_start:
        music_segs.append((cur_music_start, total_samples, cur_music, cur_music_vol))

    # Smooth duck_env with a 150ms moving average so transitions are smooth
    win = max(1, int(0.15 * SR))
    kernel = np.ones(win, dtype=np.float32) / win
    duck_env = np.convolve(duck_env, kernel, mode="same")

    # Render music segments with crossfade
    fade_len = int(0.35 * SR)
    for (s0, s1, m_id, u_vol) in music_segs:
        buf = get_buf("music", m_id)
        if buf is None or s1 <= s0:
            continue
        d = manifest.get("music", {}).get(m_id, {})
        m_vol = float(d.get("vol", 0.55)) * u_vol
        loop = d.get("loop", True)
        seg_len = s1 - s0
        seg = np.zeros((seg_len, 2), dtype=np.float32)
        pos = 0
        while pos < seg_len:
            take = min(len(buf), seg_len - pos)
            seg[pos:pos + take] = buf[:take]
            pos += take
            if not loop:
                break
        # Apply short fade-in and fade-out at segment boundaries
        fi = min(fade_len, seg_len // 2)
        if fi > 0:
            seg[:fi] *= np.linspace(0.0, 1.0, fi, dtype=np.float32)[:, None]
            seg[-fi:] *= np.linspace(1.0, 0.0, fi, dtype=np.float32)[:, None]
        music_bus[s0:s1] += seg * m_vol

    # Add subtle ambient island water lap during gameplay
    water_buf = get_buf("sfx", "water_lap")
    if water_buf is not None:
        pos = 0
        while pos < total_samples:
            take = min(len(water_buf), total_samples - pos)
            sfx_bus[pos:pos + take] += water_buf[:take] * 0.10
            pos += take

    mix = sfx_bus + music_bus * duck_env[:, None]
    # Soft limiter (tanh saturation above 0.85) so coins + music never clip harshly
    mix = np.tanh(mix * 0.95) * 0.92
    pcm16 = np.clip(mix * 32767.0, -32768, 32767).astype(np.int16)
    wavfile.write(out_wav, SR, pcm16)
    print(f"MIX OK: {out_wav} ({dur_sec:.1f}s, {len(events)} audio events, {len(music_segs)} music segments)")

if __name__ == "__main__":
    main()
