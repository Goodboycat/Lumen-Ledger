// src/systems/novelties/nightMarket.js — 43B S3 novelty. From `at` to season end: key/hemi → NIGHT.light over NIGHT.ramp s,
// lanterns (landmarks / stall signs) emissive gold, customers spend ×1.3 (cust.spendMult), till spill above cap ×2 (till.setSpillMult(2)),
// HUD chip "NIGHT MARKET — collect your tills" (bus hud:chip). end() restores lights / mults / chip. Never hides the tills (lanterns light each counter).
export const NIGHT = { light: 0.35, ramp: 3.0, spend: 1.3, spill: 2, lanternEmissive: 0xffc24a, maxLanterns: 4 };
export function createNightMarket() {
  const N = { id: 'nightMarket', base: null, t: 0, lanterns: [], chipOn: false };
  N.start = (sb, season) => {
    const L = sb.game.lights; N.base = { key: L?.key?.intensity ?? 1.6, hemi: L?.hemi?.intensity ?? 0.75, spend: sb.cust?.spendMult ?? 1, spill: sb.till?.spillMult ?? 1 }; N.t = 0;
    if (sb.cust) sb.cust.spendMult = NIGHT.spend;
    sb.till?.setSpillMult?.(NIGHT.spill);
    sb.game.bus.emit('hud:chip', { id: 'night', text: 'NIGHT MARKET — collect your tills', on: true }); N.chipOn = true;
    sb.game.bus.emit('story:bark', { speaker: 'owl', text: sb.storyData?.barks?.seasonNovelty?.nightMarket?.[0]?.text || sb.storyData?.barks?.seasonNovelty?.nightMarket?.[0] || 'Lanterns up. Tills fill fast tonight.', anchor: 'owl', ttl: 3 });
    // P2 lanterns: stall sign meshes (≤ 4) glow gold — emissive only, no new meshes
    if (!sb.headless) for (const e of sb.build?.placed?.values?.() || []) { const s = e.group?.userData?.slots?.sign; const m = s?.material; if (m && 'emissive' in m && N.lanterns.length < NIGHT.maxLanterns) { N.lanterns.push({ m, c: m.emissive.getHex(), i: m.emissiveIntensity }); m.emissive.setHex(NIGHT.lanternEmissive); m.emissiveIntensity = 0.9; } }
  };
  N.update = (sb, dt) => {
    if (!N.base) return; N.t = Math.min(NIGHT.ramp, N.t + dt); const k = N.t / NIGHT.ramp; const L = sb.game.lights;
    if (sb.storm && sb.storm.intensity > 0.05) return;                      // storm vfx owns the lights while active
    if (L?.key) L.key.intensity = N.base.key + (NIGHT.light - N.base.key) * k;
    if (L?.hemi) L.hemi.intensity = N.base.hemi + (Math.min(N.base.hemi, NIGHT.light) - N.base.hemi) * k;
  };
  N.end = (sb) => {
    const L = sb.game.lights; if (N.base) { if (L?.key) L.key.intensity = N.base.key; if (L?.hemi) L.hemi.intensity = N.base.hemi; if (sb.cust) sb.cust.spendMult = N.base.spend; sb.till?.setSpillMult?.(N.base.spill); }
    for (const l of N.lanterns) { l.m.emissive.setHex(l.c); l.m.emissiveIntensity = l.i; } N.lanterns = [];
    if (N.chipOn) { sb.game.bus.emit('hud:chip', { id: 'night', on: false }); N.chipOn = false; }
  };
  N.dispose = () => { N.base = null; };
  return N;
}
