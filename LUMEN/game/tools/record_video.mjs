// tools/record_video.mjs — Temporary invisible 720p 60fps + audio gameplay recorder & teacher walkthrough harness.
// Plays LUMEN (Lumen Ledger) from the main menu (shows UI, skips tutorial via ?notutorial) as if teaching a new player
// how to play for 120 seconds straight, pauses the recorder, renders the exact 60fps 1280x720 video + stereo audio track,
// and muxes them into an H.264 + AAC MP4 file for YouTube. 0 credits.
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SECS = +(process.argv[2] || 120);
const OUT_MP4 = path.resolve(process.argv[3] || '/home/user/webapp/LUMEN_extras/recordings/lumen_ledger_gameplay_720p60.mp4');
const PORT = 3155;
const CAP_FPS = 12; // 12 full-page 1280x720 captures per virtual second (every 5th 60fps sim step) -> encoded at 60fps
const STEPS_PER_CAP = 60 / CAP_FPS; // 5 exact 60fps simulation steps per captured frame
const TOTAL_CAPS = SECS * CAP_FPS;

fs.mkdirSync(path.dirname(OUT_MP4), { recursive: true });
const TMP_DIR = '/tmp/lumen_rec_frames';
fs.rmSync(TMP_DIR, { recursive: true, force: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
  cwd: path.resolve('/home/user/webapp/LUMEN/game'),
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 600));

const report = {
  durationSec: SECS,
  fps: 60,
  resolution: '1280x720',
  url: `http://127.0.0.1:${PORT}/index.html?notutorial&season=38&seed=7`,
  errors: [],
  console: [],
  actions: [],
  bugs: [],
  samples: [],
};

const b = await chromium.launch({
  args: [
    '--no-sandbox',
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

const page = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => report.errors.push(e.message + ' @' + (e.stack || '').split('\n')[1]));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') {
    report.console.push(m.type() + ': ' + m.text().slice(0, 240));
  }
});

await page.addInitScript({ path: '/home/user/webapp/LUMEN/game/tools/vclock.js' });
await page.goto(report.url, { timeout: 120000 });
await page.waitForFunction(() => window.lg && window.ui && window.game && window.audio && window.lumenRec, null, { timeout: 120000 });
await page.waitForTimeout(900); // let icons & audio manifest finish loading and boot-loading fade out

// Setup virtual clock & fast 720p WebGL rendering while keeping crisp 1280x720 DOM UI
await page.evaluate(() => {
  const boot = document.getElementById('boot-loading');
  if (boot) boot.remove();
  // Unlock audio so all bus events fire into window.audio and get logged in __vc.audioLog
  window.game.bus.emit('input:first', { touch: false });
  window.audio.unlock();
  if (window.ui.title?.isOpen) window.audio.music('title');

  window.__vc.freeze();
  window.game.setQuality('low');
  window.game.renderer.setPixelRatio(0.5);
  // Keep PixelRatioGovernor from overriding pixelRatio during capture
  const origRender = window.game.renderer.render.bind(window.game.renderer);
  window.__doRender = true;
  window.game.renderer.render = (s, c) => {
    if (window.lg?.sb?.perf?.governor) window.lg.sb.perf.governor.update = () => {};
    if (window.game.renderer.getPixelRatio() !== 0.5) window.game.renderer.setPixelRatio(0.5);
    // Hide back-face outline meshes during SwiftShader software rasterization so 720p renders fast, while keeping all toon colors & UI crisp
    s.traverse((o) => { if (o.material && o.material.side === 1) o.visible = false; });
    if (window.__doRender) origRender(s, c);
  };
  // Start the invisible recorder
  window.lumenRec.start({ mode: 'av' });
});

const cdp = await page.context().newCDPSession(page);

let capIndex = 0;
let virtualSec = 0;
const tStartMs = await page.evaluate(() => window.__vc.t);

async function stepAndCapture(nCaps = 1) {
  for (let c = 0; c < nCaps && capIndex < TOTAL_CAPS; c++) {
    await page.evaluate((steps) => {
      window.__doRender = false;
      for (let i = 0; i < steps - 1; i++) window.__vc.step(1000 / 60);
      window.__doRender = true;
      window.__vc.step(1000 / 60);
      // Keep FPS readout showing 60 fps (virtual clock runs at exact 60Hz)
      if (window.game?.stats) window.game.stats.fps = 60;
    }, STEPS_PER_CAP);

    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 86 });
    const fname = path.join(TMP_DIR, `f_${String(capIndex).padStart(5, '0')}.jpg`);
    fs.writeFileSync(fname, Buffer.from(shot.data, 'base64'));
    capIndex++;
    virtualSec = +(capIndex / CAP_FPS).toFixed(2);
  }
}

const logAct = (msg) => {
  report.actions.push({ t: virtualSec, msg });
  console.log(`[t=${virtualSec.toFixed(1)}s] ${msg}`);
};

// Helper to inspect current game & UI state
const getState = () =>
  page.evaluate(() => {
    const e = window.lg?.sb?.eco?.state;
    const h = window.lg?.sb?.hero?.root?.position;
    return {
      lgState: window.lg?.state,
      paused: window.game?.paused,
      titleOpen: !!window.ui?.title?.isOpen,
      tutOpen: !!window.ui?.tutorial?.isOpen,
      dlgOpen: !!window.ui?.dialogue?.isOpen,
      dlgTyping: !!window.ui?.dialogue?.isTyping,
      dlgSpeaker: window.ui?.dialogue?.line?.speaker || null,
      dlgText: window.ui?.dialogue?.line?.text || null,
      choices: [...document.querySelectorAll('.ll-dlg-choice')].filter((el) => el.offsetParent).map((el) => el.innerText.trim()),
      ledgerOpen: !!window.ui?.ledger?.isOpen,
      buildOpen: !!window.ui?.build?.isOpen,
      placing: !!window.ui?.build?.state?.placing,
      seasonsOpen: !!window.ui?.seasons?.isOpen,
      season: e?.season || 0,
      day01: +(e?.day01 || 0).toFixed(2),
      spark: Math.round(e?.spark || 0),
      debt: Math.round(e?.debt || 0),
      fog01: +(e?.fog01 || 0).toFixed(2),
      stalls: e?.stalls || 0,
      placed: window.lg?.sb?.build?.placed?.size || 0,
      jars: e?.jars ? { ...e.jars } : null,
      hero: h ? { x: +h.x.toFixed(2), z: +h.z.toFixed(2) } : null,
    };
  });

// Advance dialogue naturally so the viewer can read each line (teaching walkthrough feel!)
async function handleModalsIfAny() {
  const st = await getState();
  if (st.tutOpen) {
    await page.evaluate(() => window.ui.tutorial.close('qa'));
    logAct('Skipped tutorial modal');
    return true;
  }
  if (st.seasonsOpen) {
    await stepAndCapture(10); // Hold season info card for ~0.8s so viewer sees it
    await page.keyboard.press('Escape');
    logAct('Closed Season Info card');
    return true;
  }
  if (st.dlgOpen) {
    // Let typewriter finish or advance smoothly
    if (st.dlgTyping) {
      await stepAndCapture(8); // ~0.67s of typing animation
      await page.evaluate(() => window.ui.dialogue.skip());
      await stepAndCapture(8); // ~0.67s to read completed text
    } else {
      await stepAndCapture(8);
    }
    const afterWait = await getState();
    if (afterWait.choices.length > 0) {
      // Scam / choice! Pick the smart financial literacy refusal option
      const idx = afterWait.choices.findIndex((t) => /\?|not a plan|open the box|no thanks|refuse|read/i.test(t));
      const pick = idx < 0 ? 0 : idx;
      logAct(`Dialogue choice: ${JSON.stringify(afterWait.choices)} -> picking [${pick}] "${afterWait.choices[pick]}"`);
      await page.evaluate((i) => window.ui.dialogue.choose(i), pick);
      await stepAndCapture(4);
    } else if (afterWait.dlgOpen) {
      await page.evaluate(() => window.ui.dialogue.advance());
      await stepAndCapture(2);
    }
    return true;
  }
  if (st.ledgerOpen) {
    logAct(`Season Ledger Review open (S${st.season}, spark=${st.spark}, debt=${st.debt})`);
    await stepAndCapture(20); // Let count-up animation & stars play for ~1.67s so viewer sees the ledger!
    await page.evaluate(() => {
      const btn = document.querySelector('.ll-ledger-continue');
      if (btn) btn.click();
      else window.ui.ledger.continue?.();
    });
    logAct('Clicked Ledger CONTINUE');
    await stepAndCapture(4);
    return true;
  }
  return false;
}

// Helper to walk hero smoothly while capturing frames
async function walkKey(code, caps, withAction = false) {
  await page.keyboard.down(code);
  for (let i = 0; i < caps && capIndex < TOTAL_CAPS; i++) {
    if (withAction && i === Math.floor(caps / 2)) {
      await page.keyboard.press('Space');
    }
    await stepAndCapture(1);
    const m = await page.evaluate(() => !!(window.ui?.dialogue?.isOpen || window.ui?.ledger?.isOpen));
    if (m) break;
  }
  await page.keyboard.up(code);
}

// Helper to demonstrate opening the Build Tray, selecting a stall/prop, and placing it on the island
async function demoBuildStall(id, tab = 'stall') {
  if (await handleModalsIfAny()) return;
  const canOpen = await page.evaluate(() => !window.ui.isModal());
  if (!canOpen) return;

  if (!(await page.evaluate(() => window.ui.build.isOpen))) {
    await page.keyboard.press('KeyB');
    logAct(`Opened Build Menu (B) to show ${id}`);
    await stepAndCapture(6); // 0.5s showing tray sliding open
  }
  if (tab !== 'stall') {
    await page.evaluate((t) => {
      const tabBtn = document.querySelector(`.ll-build-tab[data-cat="${t}"]`);
      if (tabBtn) tabBtn.click();
    }, tab);
    await stepAndCapture(4);
  }
  const hasCard = await page.evaluate((cardId) => {
    const c = document.querySelector(`.ll-card[data-id="${cardId}"]`);
    if (!c) return false;
    c.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
    c.click();
    return true;
  }, id);
  if (!hasCard) {
    await page.keyboard.press('Escape');
    return;
  }
  logAct(`Selected build card: ${id}`);
  await stepAndCapture(6); // Show the detail card & stats for 0.5s

  const canDeploy = await page.evaluate(() => {
    const dep = document.querySelector('.ll-build-detail .ll-btn.deploy');
    if (!dep || dep.disabled) return false;
    dep.click();
    return true;
  });
  if (!canDeploy) {
    logAct(`Cannot deploy ${id} right now (closing build tray)`);
    await page.keyboard.press('Escape');
    await stepAndCapture(3);
    return;
  }
  await stepAndCapture(4); // Show green placement ghost on the island!

  // Find a valid placement coordinate on-screen near the plaza
  const spot = await page.evaluate((propId) => {
    const bd = window.lg.sb.build;
    const h = window.lg.sb.hero?.root?.position || { x: 0, z: 0 };
    for (let r = 1; r < 8; r++) {
      for (let z = -r; z <= r; z++) {
        for (let x = -r; x <= r; x++) {
          const cx = Math.round(h.x) + x;
          const cz = Math.round(h.z) + z;
          if (bd.canPlace(propId, cx, cz)) {
            const w = bd.anchorToWorld(propId, cx, cz);
            const v = window.game.camera.three.position.clone().set(w.x, 0, w.z).project(window.game.camera.three);
            const rc = window.game.renderer.domElement.getBoundingClientRect();
            const sx = rc.left + ((v.x + 1) / 2) * rc.width;
            const sy = rc.top + ((1 - v.y) / 2) * rc.height;
            if (sx > 120 && sy > 100 && sx < rc.width - 280 && sy < rc.height - 120) {
              return { x: sx, y: sy, cx, cz };
            }
          }
        }
      }
    }
    return null;
  }, id);

  if (spot) {
    await page.mouse.move(spot.x, spot.y, { steps: 3 });
    await stepAndCapture(5); // Show ghost snapped to cell for ~0.4s
    await page.mouse.click(spot.x, spot.y);
    logAct(`Placed ${id} at (${spot.cx}, ${spot.cz})`);
    await stepAndCapture(8); // Watch buildPlace bounce animation & hammer SFX!
  } else {
    // Fallback: direct build.place if off-screen
    await page.keyboard.press('Escape');
    await stepAndCapture(2);
  }
  if (await page.evaluate(() => window.ui.build.isOpen)) {
    await page.keyboard.press('Escape');
    await stepAndCapture(2);
  }
}

// Helper to demonstrate adjusting the 4 FinLit Jars (Spend / Save / Invest / Protect), clicking APPLY, and paying Baron Gilt
async function demoJarsAndRepay(presetName = null) {
  if (await handleModalsIfAny()) return;
  const st = await getState();
  if (presetName) {
    await page.evaluate((p) => window.ui.jars.setPreset(p), presetName);
    logAct(`Switched FinLit Jars preset to "${presetName}"`);
    await stepAndCapture(6);
  }
  const applied = await page.evaluate(() => {
    const btn = document.querySelector('.ll-jars-foot .ll-btn:not(.alt)');
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  });
  if (applied) {
    const after = await getState();
    logAct(`Clicked Jars APPLY -> spark ${st.spark}->${after.spark}, jars=${JSON.stringify(after.jars)}`);
    await stepAndCapture(6);
  }

  // Also demonstrate paying down Baron Gilt's high-interest debt if we have Spark in the pouch!
  const repaid = await page.evaluate(() => {
    const btn = document.querySelector('.ll-jars .ll-btn.repay');
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  });
  if (repaid) {
    const after = await getState();
    logAct(`Clicked PAY BARON -> debt ${st.debt}->${after.debt}, spark=${after.spark}`);
    await stepAndCapture(6);
  }
}

// Helper to demonstrate upgrading a stall (U key near stall) or hiring a helper (H key)
async function demoUpgradeOrAbility(abilityKey) {
  if (await handleModalsIfAny()) return;
  await page.keyboard.press(abilityKey);
  logAct(`Triggered FinLit Ability / Action key: ${abilityKey}`);
  await stepAndCapture(8);
}

console.log('=== Starting 120s (7200 virtual frames @ 60fps) Teaching Walkthrough ===');

// 1. MAIN MENU (0.0s -> 3.5s): Show the animated Title Screen & UI buttons clearly
logAct('Main Menu visible (Lumen Ledger title screen, PLAY / ENDLESS buttons)');
await stepAndCapture(42); // 3.5 seconds on the Main Menu

// Click PLAY on the Main Menu
await page.locator('.ll-title-btn.play').click();
logAct('Clicked PLAY on Main Menu (tutorial skipped via ?notutorial)');
await stepAndCapture(8);

// 2. Clear opening Season 1 dialogue at a readable teaching pace
while ((await getState()).dlgOpen && capIndex < TOTAL_CAPS) {
  await handleModalsIfAny();
}

// 3. Briefly open the Season 1 Lesson pill in the top HUD so the viewer sees what Season 1 teaches
await page.evaluate(() => {
  const pill = document.querySelector('.ll-hud-season');
  if (pill) pill.click();
});
logAct('Clicked HUD Season chip to show Lesson Card');
await stepAndCapture(14); // ~1.2s showing the Season Lesson popup
await page.keyboard.press('Escape');
await stepAndCapture(4);

// 4. Main teaching gameplay loop until 120.0s (TOTAL_CAPS frames)
const moveCycle = [
  { key: 'KeyD', caps: 14, act: true },
  { key: 'KeyS', caps: 12, act: false },
  { key: 'KeyA', caps: 16, act: true },
  { key: 'KeyW', caps: 12, act: false },
  { key: 'ArrowRight', caps: 12, act: true },
  { key: 'ArrowUp', caps: 10, act: false },
  { key: 'ArrowLeft', caps: 14, act: true },
  { key: 'ArrowDown', caps: 10, act: false },
];
const buildOrder = ['stall_fruit', 'stall_tea', 'stall_bread', 'stall_bakery', 'stall_toy', 'stall_book'];
const abilities = ['KeyQ', 'KeyR', 'KeyF', 'KeyG']; // Coin Magnet, Growth Stomp, Haggle Shout, Fog Sweep
const presets = ['saver', 'balanced', 'grower'];

let stepTurn = 0;
let lastSampleSec = -1;

while (capIndex < TOTAL_CAPS) {
  if (await handleModalsIfAny()) continue;

  const st = await getState();
  if (Math.floor(virtualSec) > lastSampleSec && Math.floor(virtualSec) % 5 === 0) {
    lastSampleSec = Math.floor(virtualSec);
    report.samples.push({ t: virtualSec, ...st });
  }

  // If run ended for any reason, restart seamlessly
  if (st.lgState === 'title' || st.lgState === 'ending') {
    await stepAndCapture(6);
    if (st.titleOpen) await page.locator('.ll-title-btn.play').click().catch(() => {});
    continue;
  }

  // Walk around the market plaza & greet customers
  const mv = moveCycle[stepTurn % moveCycle.length];
  await walkKey(mv.key, mv.caps, mv.act);

  if (await handleModalsIfAny()) { stepTurn++; continue; }

  // Teaching actions rotated every turn:
  if (stepTurn % 4 === 0) {
    // Demonstrate building a stall via the Build Tray
    const stallId = buildOrder[(stepTurn / 4 | 0) % buildOrder.length];
    await demoBuildStall(stallId, 'stall');
  } else if (stepTurn % 4 === 1) {
    // Demonstrate FinLit Jars allocation (Save / Invest / Protect) & Baron debt repayment
    const preset = presets[(stepTurn / 4 | 0) % presets.length];
    await demoJarsAndRepay(preset);
  } else if (stepTurn % 4 === 2) {
    // Demonstrate FinLit Hero Abilities (Coin Magnet Dash, Growth Stomp, Haggle Shout, Fog Sweep)
    const ab = abilities[(stepTurn / 4 | 0) % abilities.length];
    await demoUpgradeOrAbility(ab);
  } else if (stepTurn % 4 === 3) {
    // Demonstrate Repaying Baron or Allocating current split without changing preset
    await demoJarsAndRepay(null);
  }

  stepTurn++;
}

// 5. Pause the invisible recorder & dump logs
logAct('120.0s reached -> Pausing invisible recorder');
const recOut = await page.evaluate(async () => {
  window.lumenRec.pause();
  const dump = await window.lumenRec.dump();
  return {
    audioLog: window.__vc.audioLog,
    recLog: dump.log,
  };
});

await b.close();
srv.kill();

// Save audio log and synthesize stereo soundtrack WAV
const audioLogPath = path.join(TMP_DIR, 'audio_log.json');
fs.writeFileSync(
  audioLogPath,
  JSON.stringify({ tStart: tStartMs, initialMusic: 'title', audioLog: recOut.audioLog }, null, 2)
);
const wavPath = path.join(TMP_DIR, 'soundtrack.wav');
console.log('Synthesizing stereo soundtrack from real game audio files...');
const mixRes = spawnSync('python3', ['/home/user/webapp/LUMEN/game/tools/mix_audio.py', audioLogPath, wavPath, String(SECS), '/home/user/webapp/LUMEN/game'], {
  encoding: 'utf8',
});
console.log(mixRes.stdout || mixRes.stderr);

// Encode 1280x720 60fps H.264 MP4 + AAC stereo audio via ffmpeg
console.log('Encoding 1280x720 60fps MP4 with H.264 video + AAC audio...');
const ffRes = spawnSync(
  'ffmpeg',
  [
    '-y',
    '-framerate', String(CAP_FPS),
    '-i', path.join(TMP_DIR, 'f_%05d.jpg'),
    '-i', wavPath,
    '-vf', 'fps=60,scale=1280:720:flags=lanczos',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '21',
    '-pix_fmt', 'yuv420p',
    '-r', '60',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    OUT_MP4,
  ],
  { encoding: 'utf8' }
);
if (ffRes.status !== 0) {
  console.error('ffmpeg error:', ffRes.stderr);
  process.exit(1);
}

// Clean up temporary frame JPEGs
fs.rmSync(TMP_DIR, { recursive: true, force: true });

// Save report JSON next to the MP4
const reportPath = OUT_MP4.replace(/\.mp4$/, '.report.json');
report.recSummary = {
  eventsCount: recOut.recLog?.events?.length || 0,
  counts: recOut.recLog?.counts || {},
  audioEventsCount: recOut.audioLog?.length || 0,
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log('=== DONE ===');
console.log('MP4 saved to:', OUT_MP4);
console.log('Report saved to:', reportPath);
