// Headless perf probe: heavy combat room (30 enemies + ~100 projectiles + constant hits / damage numbers).
// Usage: node tools/perf.mjs [distDir=dist] [label] [seconds=10]
// Reports main-thread cost per frame (game.step wall time = update + render submit), RunScene.update time,
// rAF frame interval, CDP ScriptDuration per frame and JS heap churn. Swiftshader = CPU rasterisation, so the
// frame interval is dominated by the software GPU; the step / script times are the JS-side numbers that matter
// for a mid-range phone (where the GPU is real but the CPU is slow).
import { serve, launch, root } from './browser.mjs'; import path from 'node:path'; import fs from 'node:fs';
const dist = path.resolve(root, process.argv[2] ?? 'dist'); const label = process.argv[3] ?? path.basename(path.dirname(dist));
const SECS = +(process.argv[4] ?? 10);
const { srv, url } = await serve(dist);
const b = await launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { localStorage.clear(); });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(url + '/?debug=1');
await p.waitForFunction(() => window.__TS && window.__TS.scenes().includes('Hub'), null, { timeout: 90000 });
await p.evaluate(() => { window.__TS.G.meta.settings.mute = true; window.__TS.startRun(4242); window.__TS.godMode(true); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('Run'); return s && s.ready; }, null, { timeout: 60000 });
await p.evaluate(() => window.__TS.setWeapon('crossbow'));
await p.waitForTimeout(1200);
// populate: 30 high-hp chapter-1 enemies (chaser / ring / charger / shooter) via the normal wave spawner
await p.evaluate(() => {
  const rs = window.__game.scene.getScene('Run'); const ids = ['slime_moss', 'mushroom_spore', 'beetle_charger', 'sprout_archer'];
  rs.waves = [Array.from({ length: 30 }, (_, i) => ids[i % ids.length])]; rs.waveIdx = 0; rs.miniBoss = undefined; rs.spawnWave();
  for (const e of rs.enemies) if (!e.dummy) { e.hp = e.maxHp = 1e9; }
  rs.px = 640; rs.py = 600; window.__perf = {};
});
await p.evaluate(() => {
  const rs = window.__game.scene.getScene('Run'); const game = window.__game;
  const P = window.__perf; P.steps = []; P.upd = []; P.raf = []; P.on = false;
  let a0 = 0, u0 = 0;
  game.events.on('prestep', () => { a0 = performance.now(); }); game.events.on('postrender', () => { if (P.on && a0) P.steps.push(performance.now() - a0); });
  P.created = 0; P.links = 0; { const R = game.renderer; const cp = R.createProgram?.bind(R); if (cp) R.createProgram = function (...a) { if (P.on) { P.links++; P.linkStack = P.linkStack || new Error().stack; } return cp(...a); }; } rs.events.on('addedtoscene', () => { if (P.on) P.created++; });
  rs.events.on('update', () => { u0 = performance.now(); }); rs.events.on('postupdate', () => { if (P.on && u0) P.upd.push(performance.now() - u0); });
  let last = performance.now(); const raf = (t) => { if (P.on) P.raf.push(t - last); last = t; requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  // load generator: enemy projectile rings + player hits with damage numbers
  P.iv = setInterval(() => {
    const alive = rs.enemies.filter((e) => !e.dead); if (!alive.length) return;
    const e = alive[Math.floor(Math.random() * alive.length)];
    if (rs.projs.length < 110) for (let i = 0; i < 8; i++) rs.spawnEnemyProj(e.agent.x, e.agent.y - 14, i / 8 * Math.PI * 2, 160, 1);
    for (let i = 0; i < 3; i++) rs.hitEnemy(alive[Math.floor(Math.random() * alive.length)], { flat: 7 + Math.floor(Math.random() * 30) });
  }, 100);
  window.__TS.simulateInput({ attack: true, aim: -Math.PI / 2, move: [0, 0] }, 120000);
});
await p.waitForTimeout(+(process.env.WARM ?? 6000));
const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable');
const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
await p.evaluate(() => { window.__perf.on = true; });
if (process.env.PROFILE) await cdp.send('Profiler.enable').then(() => cdp.send('Profiler.start'));
const samples = [];
for (let i = 0; i < SECS; i++) { await p.waitForTimeout(1000); samples.push(await p.evaluate(() => { const rs = window.__game.scene.getScene('Run'); return { en: rs.enemies.filter((e) => !e.dead).length, pj: rs.projs.length, dl: rs.children.list.length, heap: performance.memory?.usedJSHeapSize ?? 0, progs: Object.keys(window.__game.renderer.shaderProgramFactory?.programs ?? {}).length }; })); }
await p.evaluate(() => { window.__perf.on = false; });
const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
if (process.env.PROFILE) { const { profile } = await cdp.send('Profiler.stop'); fs.mkdirSync(path.join(root, 'out/perf'), { recursive: true }); fs.writeFileSync(path.join(root, 'out/perf', `${label}.cpuprofile`), JSON.stringify(profile)); }
const P = await p.evaluate(() => { const P = window.__perf; return { steps: P.steps, upd: P.upd, raf: P.raf, created: P.created, links: P.links, linkStack: P.linkStack }; });
const stat = (a) => { const s = [...a].sort((x, y) => x - y); const avg = s.reduce((x, y) => x + y, 0) / (s.length || 1); return { n: s.length, avg: +avg.toFixed(2), p50: +(s[Math.floor(s.length * 0.5)] ?? 0).toFixed(2), p95: +(s[Math.floor(s.length * 0.95)] ?? 0).toFixed(2), max: +(s[s.length - 1] ?? 0).toFixed(2) }; };
const frames = P.raf.length || 1;
const res = {
  label, when: new Date().toISOString(), secs: SECS,
  step_ms: stat(P.steps), runUpdate_ms: stat(P.upd), frameInterval_ms: stat(P.raf), fps: +(1000 / (stat(P.raf).avg || 1)).toFixed(1),
  shaderLinks: P.links, linkStack: (P.linkStack || '').split('\n').slice(1, 12).map((l) => l.trim().slice(0, 90)),
  objectsCreatedPerSec: +(P.created / SECS).toFixed(1),
  scriptMsPerFrame: +(((m1.ScriptDuration - m0.ScriptDuration) * 1000) / frames).toFixed(2),
  taskMsPerFrame: +(((m1.TaskDuration - m0.TaskDuration) * 1000) / frames).toFixed(2),
  enemies: samples.map((s) => s.en), projectiles: samples.map((s) => s.pj), displayList: samples.map((s) => s.dl),
  shaderPrograms: samples.map((s) => s.progs),
  heapMB: samples.map((s) => +(s.heap / 1048576).toFixed(1)), errors: errs.slice(0, 5), load: (await import('node:os')).loadavg()[0].toFixed(2),
};
console.log(JSON.stringify(res));
fs.mkdirSync(path.join(root, 'out/perf'), { recursive: true }); fs.appendFileSync(path.join(root, 'out/perf/results.jsonl'), JSON.stringify(res) + '\n');
await b.close(); srv.close();
