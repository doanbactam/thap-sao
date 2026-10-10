// V2 build/decision UI screenshots (inventory drag preview, choice cards with deltas + lock/banish, shop services, event stakes).
// Usage: npx vite build --outDir work/dist_build_v2 && node tools/build-shots.mjs  → out/build_v2/*.png
import { serve, launch, root } from './browser.mjs';
import path from 'node:path'; import fs from 'node:fs';
const OUT = path.join(root, 'out/build_v2'); fs.mkdirSync(OUT, { recursive: true });
const DIST = path.join(root, process.env.SHOTS_DIST ?? 'work/dist_build_v2');
const { srv, url } = await serve(DIST); const browser = await launch(); const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${url}/?debug=1`); await page.waitForFunction(() => window.__TS && window.__TS.scenes().includes('Hub'), null, { timeout: 90000 });
const ev = (fn, a) => page.evaluate(fn, a); const sleep = (ms) => page.waitForTimeout(ms);
const shot = async (n) => { await page.screenshot({ path: path.join(OUT, `${n}.png`) }); console.log('shot', n); };
const clickBtn = async (id) => { const b = (await ev(() => window.__TS.buttons())).filter((x) => x.id === id).pop(); if (b) { await page.mouse.click(b.x, b.y); await sleep(600); } return !!b; };
const toPage = (x, y) => ev(([x, y]) => window.__TS.toPage(x, y), [x, y]);
await ev(() => window.__TS.startRun(77)); await page.waitForFunction(() => window.__TS.scenes().includes('Run'), null, { timeout: 60000 }); await sleep(1500);
await ev(() => { const T = window.__TS; T.godMode(true); T.clearBag(); T.placeItem('g_frost_shard', 1, 1); T.placeItem('gd_iron_helm', 2, 0); T.placeItem('t_gamble', 3, 1); T.placeItem('e_ember_coal', 4, 1); T.placeItem('g_snow_charm', 0, 3); T.addCurrency('money', 900); T.addCurrency('dice', 2); });
const ONLY = process.env.ONLY ?? 'all';
if (ONLY === 'all' || ONLY === 'inv') {
// inventory + drag a tablet onto the frost shard's left
await page.keyboard.press('Tab'); await sleep(900); await shot('01_inventory_disabled');
let p = await toPage(90 + 3 * 76 + 38, 130 + 1 * 76 + 38); await page.mouse.move(p.x, p.y); await page.mouse.down(); await sleep(200);
p = await toPage(90 + 0 * 76 + 38, 130 + 1 * 76 + 38); await page.mouse.move(p.x, p.y, { steps: 6 }); await sleep(400); await shot('02_drag_tablet_preview');
p = await toPage(90 + 2 * 76 + 38, 130 + 1 * 76 + 38); await page.mouse.move(p.x, p.y, { steps: 4 }); await sleep(400); await shot('03_drag_tablet_disable_preview');
p = await toPage(90 + 3 * 76 + 38, 130 + 1 * 76 + 38); await page.mouse.move(p.x, p.y, { steps: 4 }); await page.mouse.up(); await sleep(300);
// drag the snow charm next to the frost shard (combo progress)
p = await toPage(90 + 0 * 76 + 38, 130 + 3 * 76 + 38); await page.mouse.move(p.x, p.y); await page.mouse.down(); await sleep(200);
p = await toPage(90 + 0 * 76 + 38, 130 + 2 * 76 + 38); await page.mouse.move(p.x, p.y, { steps: 6 }); await sleep(400); await shot('04_drag_artifact_combo_preview');
p = await toPage(90 + 0 * 76 + 38, 130 + 3 * 76 + 38); await page.mouse.move(p.x, p.y, { steps: 4 }); await page.mouse.up(); await sleep(300);
await page.keyboard.press('Tab'); await sleep(500);
}
if (ONLY === 'all' || ONLY === 'choice') {
// choice
await ev(() => { const r = window.__TS.G.run; r.choice = { kind: 'artifact', options: ['g_cold_mittens', 'gd_turtle_shell', 'cu_witch_candle'], source: 'shots', locked: 1 }; window.__game.scene.getScene('Run').openChoice(); });
await sleep(1200); await shot('05_choice_deltas_lock');
await clickBtn('skip');
}
if (ONLY === 'all' || ONLY === 'shop') {
// shop
await ev(() => { const r = window.__TS.G.run; r.hp = 20; r.shop = { items: [{ id: 'gd_thorn_vest', kind: 'artifact', price: 220, sold: false }, { id: 's_copper_coil', kind: 'artifact', price: 99, sold: false }, { id: 't_twin_side', kind: 'tablet', price: 110, sold: false }, { id: 't_cross', kind: 'tablet', price: 253, sold: false }, { id: 'heal', kind: 'potion', price: 52, sold: false }], discount: 0, rerolls: 1 }; r.dice = 0; window.__game.scene.getScene('Run').openShop(); });
await sleep(1200); await shot('06_shop_services');
const cb = (await ev(() => window.__TS.buttons())).filter((b) => b.id === 'close').pop(); console.log('close btn', JSON.stringify(cb)); await page.mouse.click(cb.x, cb.y); await sleep(800); console.log('scenes', JSON.stringify(await ev(() => window.__TS.scenes())));
}
if (ONLY === 'all' || ONLY === 'event')
for (const e of ['blood', 'obelisk']) {
  await ev((e) => { const rs = window.__game.scene.getScene('Run'); rs.scene.pause(); rs.scene.launch('Event', { event: e, from: 'Run', fountain: 'red' }); }, e);
  await sleep(1000); await shot(`07_event_${e}`); await clickBtn('ev_leave');
}
console.log('errors', JSON.stringify(errors));
await browser.close(); srv.close();
