// Frame-by-frame contact sheet of hero poses per weapon (readability check for src/game/heroAnim.ts).
// The game loop is put to sleep and stepped manually at a fixed 1/60 s, so every crop is an exact frame.
// Usage: node tools/anim-shots.mjs [distDir=dist] [weapons=a,b] → out/anim/<weapon>.json, then python3 tools/anim-sheet.py
import { serve, launch, root } from './browser.mjs'; import path from 'node:path'; import fs from 'node:fs';
const dist = path.resolve(root, process.argv[2] ?? 'dist'); const out = path.join(root, 'out/anim'); fs.mkdirSync(out, { recursive: true });
const weapons = (process.argv[3] ?? 'swordshield,greatsword,dagger,katana,crossbow,staff').split(',');
const STEP = +(process.env.STEP ?? 3); // game frames between crops
const { srv, url } = await serve(dist); const b = await launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url + '/?debug=1'); await p.waitForFunction(() => window.__TS && window.__TS.scenes().includes('Hub'), null, { timeout: 90000 });
await p.evaluate(() => { window.__TS.G.meta.settings.mute = true; window.__TS.startRun(7); window.__TS.godMode(true); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('Run'); return s && s.ready; }, null, { timeout: 60000 });
await p.evaluate(() => { const g = window.__game; g.loop.sleep(); window.__t = performance.now(); window.__stepN = (n) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } }; });
const crop = async () => { const c = await p.evaluate(() => { const rs = window.__game.scene.getScene('Run'); return window.__TS.toPage(rs.px, rs.py - 20); }); return (await p.screenshot({ clip: { x: c.x - 60, y: c.y - 50, width: 120, height: 90 } })).toString('base64'); };
for (const w of weapons) {
  await p.evaluate((w) => { window.__TS.setWeapon(w); const rs = window.__game.scene.getScene('Run'); rs.px = 640; rs.py = 520; window.__stepN(20); }, w);
  const frames = [];
  // a 3-hit chain: tap attack (2 frames held) every 16 frames
  for (let k = 0; k < 18; k++) {
    await p.evaluate(([k, S]) => { if (k % 6 === 0) window.__TS.simulateInput({ attack: true, aim: 0, move: [0, 0] }, 40); else window.__TS.simulateInput({ attack: false, aim: 0, move: [0, 0] }, 2000); window.__stepN(S); }, [k, STEP]);
    frames.push(await crop());
  }
  // dash left, then a hit taken
  await p.evaluate(() => { window.__TS.simulateInput({ move: [-1, 0], aim: Math.PI }, 2000); window.__TS.press('dash'); window.__stepN(2); });
  for (let k = 0; k < 4; k++) { frames.push(await crop()); await p.evaluate(() => window.__stepN(3)); }
  await p.evaluate(() => { window.__TS.godMode(false); const rs = window.__game.scene.getScene('Run'); rs.iframes = 0; rs.dashT = 0; rs.cs.sinceDash = 99; rs.hurtPlayer(1, rs.px + 40, rs.py); window.__TS.godMode(true); window.__stepN(2); });
  for (let k = 0; k < 2; k++) { frames.push(await crop()); await p.evaluate(() => window.__stepN(4)); }
  fs.writeFileSync(path.join(out, `${w}.json`), JSON.stringify(frames));
  console.log(w, frames.length);
}
console.log('errors', errs);
await b.close(); srv.close();
