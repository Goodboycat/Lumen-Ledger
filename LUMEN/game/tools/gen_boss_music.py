#!/usr/bin/env python3
"""S74: procedural BOSS FIGHT stem for Baron Gilt (no external assets, deterministic).
   python3 tools/gen_boss_music.py            -> audio/music/boss_fight.ogg (C, 84 bpm) + boss_fight_endless.ogg (D, 96 bpm)
It is a LAYER: Audio.js plays it on top of island_day / island_endless (same tempo + key family) while Baron Gilt is on the island.
8 bars, seamless loop (tails are folded back onto the start). Drums (kick / clap / hats / taiko fill), a minor-mode bass ostinato,
detuned-saw brass stabs, a ticking clock hat (money-clock motif). Peak -3 dB, stereo."""
import subprocess, sys, os
import numpy as np

SR = 44100
rng = np.random.default_rng(74)


def env(n, a=0.005, d=0.1, s=0.0, r=0.05):
    e = np.ones(n)
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, max(1, na))
    if nd:
        seg = np.linspace(1, s, nd)
        e[na:na + nd] = seg[: max(0, min(nd, n - na))]
        e[na + nd:] = s
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def kick(dur=0.32):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 48 + 120 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9) * 1.0


def clap(dur=0.28):
    n = int(dur * SR); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # bandpass-ish: difference of one-pole lows
    def lp(x, a):
        y = np.zeros_like(x); acc = 0.0
        for i in range(len(x)):
            acc += a * (x[i] - acc); y[i] = acc
        return y
    b = lp(noise, 0.55) - lp(noise, 0.08)
    e = np.exp(-t * 16) * (1 + 0.8 * (np.sin(2 * np.pi * 95 * t) > 0))
    return b * e * 1.6


def hat(dur=0.06, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    hp = noise - np.concatenate([[0], noise[:-1]])
    return hp * np.exp(-t * 70) * 0.35 * bright


def tom(f0, dur=0.4):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f0 * (1 + 0.7 * np.exp(-t * 18))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7) * 0.9


def saw(f, n, detune=(0.994, 1.0, 1.006)):
    t = np.arange(n) / SR
    y = np.zeros(n)
    for d in detune:
        y += 2 * ((t * f * d) % 1.0) - 1
    return y / len(detune)


def lowpass(x, cutoff):
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x); acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc); y[i] = acc
    return y


def bass(f, dur):
    n = int(dur * SR)
    y = lowpass(saw(f, n, (1.0, 1.003)), 420) + 0.6 * np.sin(2 * np.pi * f * np.arange(n) / SR)
    return y * env(n, 0.004, 0.12, 0.55, 0.04)


def brass(freqs, dur):
    n = int(dur * SR)
    y = sum(saw(f, n) for f in freqs) / len(freqs)
    y = lowpass(y, 1700) * env(n, 0.012, 0.16, 0.45, 0.06)
    return y


def hz(root, semis):
    return root * 2 ** (semis / 12)


def render(root_c4, bpm, name, out_dir):
    beat = 60 / bpm
    bars = 8
    total = bars * 4 * beat
    N = int(total * SR)
    tail = int(1.2 * SR)
    L = np.zeros(N + tail); R = np.zeros(N + tail)

    def put(buf_l, buf_r, sig, t, gain=1.0, pan=0.0):
        i = int(t * SR)
        if i >= N:
            return
        m = min(len(sig), N + tail - i)
        gl = gain * (1 - max(0, pan)); gr = gain * (1 + min(0, pan))
        buf_l[i:i + m] += sig[:m] * gl; buf_r[i:i + m] += sig[:m] * gr

    K, C, H, Hb = kick(), clap(), hat(), hat(0.05, 1.6)
    T1, T2, T3 = tom(hz(root_c4, -24)), tom(hz(root_c4, -17)), tom(hz(root_c4, -12))
    # ---- drums
    for bar in range(bars):
        b0 = bar * 4 * beat
        for k in (0, 2):
            put(L, R, K, b0 + k * beat, 1.0)
        if bar % 2 == 1:                       # push on the "and" of 3 every other bar
            put(L, R, K, b0 + 2.5 * beat, 0.8)
        for k in (1, 3):
            put(L, R, C, b0 + k * beat, 0.7, pan=0.1)
        for e in range(8):                     # 8th hats, accent the off-beats (the ticking clock)
            put(L, R, H if e % 2 == 0 else Hb, b0 + e * 0.5 * beat, 0.5 if e % 2 == 0 else 0.8, pan=-0.2 if e % 2 else 0.2)
        if bar == 3:                           # little tom roll into bar 5
            for j, tm in enumerate((T3, T2, T2, T1)):
                put(L, R, tm, b0 + (3 + j * 0.25) * beat, 0.8)
        if bar == 7:                           # bigger fill into the loop point
            for j in range(8):
                put(L, R, (T3, T3, T2, T2, T1, T1, T1, K)[j], b0 + (2 + j * 0.25) * beat, 0.7 + 0.04 * j)
    # ---- bass ostinato (C minor-ish villain walk). semitone offsets from root-24
    pats = [
        [0, 0, None, 0, 3, None, 0, -2],       # C C . C Eb . C Bb
        [0, 0, None, 0, 5, None, 3, 2],        # C C . C F . Eb D
        [-4, -4, None, -4, -1, None, -4, -6],  # Ab Ab . Ab C . Ab Gb-ish
        [-2, -2, None, -2, 1, None, 2, 3],     # Bb Bb . Bb Db . D Eb
    ]
    for bar in range(bars):
        p = pats[bar % 4]
        for e, s in enumerate(p):
            if s is None:
                continue
            f = hz(root_c4, s - 24)
            put(L, R, bass(f, 0.5 * beat * 0.92), bar * 4 * beat + e * 0.5 * beat, 0.62)
    # ---- brass stabs: chords on the 'and of 2' + 4 (da-DAH) every bar, move with the bass
    chords = [[0, 3, 7], [0, 3, 8], [-4, 0, 3], [-2, 2, 5]]
    for bar in range(bars):
        ch = chords[bar % 4]
        fr = [hz(root_c4, s - 12) for s in ch]
        put(L, R, brass(fr, 0.34 * beat * 2), bar * 4 * beat + 1.5 * beat, 0.34, pan=-0.25)
        put(L, R, brass(fr, 0.34 * beat * 2), bar * 4 * beat + 3.0 * beat, 0.42, pan=0.25)
    # fold the tail onto the start -> seamless loop
    L[:tail] += L[N:]; R[:tail] += R[N:]
    L, R = L[:N], R[:N]
    # gentle stereo widen via short delay on R
    d = int(0.011 * SR); R = np.concatenate([np.zeros(d), R[:-d]]) * 0.97
    peak = max(np.abs(L).max(), np.abs(R).max(), 1e-6)
    g = 0.708 / peak                           # -3 dBFS
    L, R = np.tanh(L * g * 1.1) / np.tanh(1.1), np.tanh(R * g * 1.1) / np.tanh(1.1)
    st = np.stack([L, R], 1).astype(np.float32)
    raw = st.tobytes()
    path = os.path.join(out_dir, name + '.ogg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'libvorbis', '-q:a', '4', path], input=raw, check=True)
    print(f'{path}: {total:.2f}s {bpm} bpm, {os.path.getsize(path) // 1024} KB')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'audio', 'music')
    render(261.63, 84, 'boss_fight', out)           # island_day: C, 84 bpm
    render(293.66, 96, 'boss_fight_endless', out)   # island_endless: D, 96 bpm
