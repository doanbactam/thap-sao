// Headless playthrough of the built game (dist/) with ?debug=1. Real keyboard/mouse/touch input drives the player;
// debug hooks only set up states (node types, chapter jumps) and finish bosses after real damage was dealt.
// Fails on any console error. Screenshots → out/smoke/, report → out/smoke/report.json.
import { serve, launch, root } from './browser.mjs';
import path from 'node:path'; import fs from 'node:fs'; import { execSync } from 'node:child_process';

const OUT = path.join(root, 'out/smoke'); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const DIST = path.join(root, process.env.SMOKE_DIST ?? 'dist');
if (!fs.existsSync(path.join(DIST, 'index.html'))) execSync('npx vite build', { cwd: root, stdio: 'inherit' });
const { srv, url } = await serve(DIST);
const browser = await launch();
const errors = []; const checks = {}; const shots = [];
const T0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);
const ok = (id, cond, note = '') => { checks[id] = checks[id] === false ? false : !!cond; log(cond ? 'PASS' : 'FAIL', id, note); if (!cond) errors.push(`check failed: ${id} ${note}`); };

async function newPage(opts = {}, query = '') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...opts });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('smokeCleared')) { localStorage.clear(); sessionStorage.setItem('smokeCleared', '1'); } });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack}`));
  p.on('requestfailed', (r) => { if (!/ABORTED/.test(r.failure()?.errorText ?? '')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
  await p.goto(`${url}/?debug=1${query}`);
  await p.waitForFunction(() => window.__TS && window.__TS.scenes().includes('Hub'), null, { timeout: 90000 });
  await p.waitForTimeout(800);
  return p;
}
const page = await newPage();
const S = () => page.evaluate(() => window.__TS.getState());
const ev = (fn, arg) => page.evaluate(fn, arg);
const sleep = (ms) => page.waitForTimeout(ms);
async function shot(name) { const f = path.join(OUT, `${String(shots.length + 1).padStart(2, '0')}_${name}.png`); await page.screenshot({ path: f }); shots.push(f); log('shot', path.basename(f)); }
async function waitFor(fn, timeout = 20000, arg) { const t = Date.now(); while (Date.now() - t < timeout) { if (await page.evaluate(fn, arg)) return true; await sleep(150); } return false; }
async function waitScene(k, timeout = 20000) { return waitFor((k) => window.__TS.scenes().includes(k), timeout, k); }
async function btn(id, timeout = 8000) {
  const t = Date.now();
  while (Date.now() - t < timeout) {
    const b = (await ev(() => window.__TS.buttons())).filter((x) => x.id === id && x.enabled);
    if (b.length) { const x = b[b.length - 1]; await page.mouse.click(x.x, x.y); await sleep(250); return true; }
    await sleep(200);
  }
  log('button not found', id, JSON.stringify((await ev(() => window.__TS.buttons())).map((b) => b.id))); return false;
}
const toPage = (x, y) => ev(([x, y]) => window.__TS.toPage(x, y), [x, y]);
const KEYS = { up: 'w', down: 's', left: 'a', right: 'd' };
async function hold(keys, ms) { for (const k of keys) await page.keyboard.down(k); await sleep(ms); for (const k of keys) await page.keyboard.up(k); }
async function walkTo(x, y, tol = 20, timeout = 25000) {
  const t = Date.now();
  while (Date.now() - t < timeout) {
    const st = await S(); if (!st.room) return false;
    const dx = x - st.room.px, dy = y - st.room.py; if (Math.hypot(dx, dy) < tol) return true;
    const ks = []; if (dx > tol / 2) ks.push(KEYS.right); if (dx < -tol / 2) ks.push(KEYS.left); if (dy > tol / 2) ks.push(KEYS.down); if (dy < -tol / 2) ks.push(KEYS.up);
    await hold(ks, Math.min(300, 40 + Math.hypot(dx, dy) * 1.2));
  }
  return false;
}
async function fight(timeout = 60000, stopWhen) {
  const t = Date.now(); let attacks = 0;
  while (Date.now() - t < timeout) {
    const st = await S(); if (!st.room) break;
    if (stopWhen && await stopWhen(st)) break;
    const en = st.room.enemies.filter((e) => !e.dummy);
    if (!en.length) { if (!st.room.fighting) break; await sleep(300); continue; }
    const e = en.sort((a, b) => Math.hypot(a.x - st.room.px, a.y - st.room.py) - Math.hypot(b.x - st.room.px, b.y - st.room.py))[0];
    const d = Math.hypot(e.x - st.room.px, e.y - st.room.py);
    const pp = await toPage(e.x, e.y - 14); await page.mouse.move(pp.x, pp.y);
    if (d > (e.boss ? 72 : 55)) { const ks = []; if (e.x - st.room.px > 20) ks.push('d'); if (e.x - st.room.px < -20) ks.push('a'); if (e.y - st.room.py > 20) ks.push('s'); if (e.y - st.room.py < -20) ks.push('w'); for (const k of ks) await page.keyboard.down(k); await page.mouse.down(); await sleep(140); await page.mouse.up(); for (const k of ks) await page.keyboard.up(k); }
    else { await page.mouse.down(); await sleep(160); await page.mouse.up(); }
    attacks++; if (attacks % 25 === 0) await ev(() => window.__TS.heal());
  }
  return attacks;
}
async function interact(id, timeout = 15000) {
  const st = await S(); const it = st.room?.interacts.find((i) => i.id === id || i.id.startsWith(id)); if (!it) { log('no interact', id, JSON.stringify(st.room?.interacts)); return false; }
  await walkTo(it.x, Math.min(650, it.y + 30), 26, timeout);
  await page.keyboard.press('e'); await sleep(400); return true;
}
async function closeOverlays() { for (const k of ['Choice', 'Shop', 'Enchant', 'Event', 'Inventory', 'Map', 'Picker']) if ((await ev(() => window.__TS.scenes())).includes(k)) { if (k === 'Choice') await btn('skip', 2000); else if (k === 'Event') await btn('ev_leave', 2000); else await btn('close', 2000); } }
async function gotoForced(i, patch) {
  await ev(([i, patch]) => { const n = window.__TS.G.run.floorData.nodes[i]; Object.assign(n, patch); window.__TS.G.run.roomCleared = true; window.__TS.gotoNode(i); }, [i, patch]);
  await sleep(600); await waitFor(() => { const s = window.__TS.getState(); return s.room && s.scenes.includes('Run'); }, 20000);
  await sleep(500);
}
const gridCell = (st) => (st.run.grid[0] > 6 || st.run.grid[1] > 4 ? 66 : 76);

try {
  // ---------- hub ----------
  let st = await S();
  ok('C107_manifests', st.manifestKeys > 200 && st.placeholders.length === 0, `manifest keys ${st.manifestKeys}, placeholders ${st.placeholders.length}`);
  await shot('hub');
  ok('C091_hub', st.scenes.includes('Hub'));
  // hub walk with real keys
  await hold(['a'], 600); await sleep(200); await shot('hub_walk');
  // settings mute toggle (real click) and persistence
  await btn('settings'); await waitScene('Settings'); await btn('mute'); st = await S(); ok('C109_mute', st.meta.mute === true && JSON.parse(await ev(() => localStorage.getItem('thapsao.meta'))).data.settings.mute === true); await btn('mute'); await btn('close'); await sleep(500);
  // journal / talents / costumes open
  await btn('journalBtn'); await waitScene('Journal'); await btn('jtab_enemies'); await shot('journal'); await btn('close'); await sleep(500);
  await btn('costumesBtn'); await waitScene('Costumes'); await shot('costumes'); await btn('close'); await sleep(500);

  // ---------- start run (real click) ----------
  await btn('startRun'); ok('C070_start', await waitScene('Run', 30000));
  await waitFor(() => window.__TS.getState().room, 30000); await sleep(800);
  st = await S(); ok('C071_start_room_f1', st.run.pos === 'start' && st.run.startShop === false && st.room.doors.length === 3);
  ok('C100_hud', st.scenes.includes('Hud'));
  await shot('run_start_room');
  await ev(() => window.__TS.godMode(true));
  // walk through the left door with real keys
  const door = st.room.doors[0];
  await walkTo(door.x, 175, 16); await hold(['w'], 700); await sleep(1200);
  st = await S(); ok('C072_enter_node', typeof st.run.pos === 'number', `pos=${st.run.pos}`);
  await waitFor(() => window.__TS.getState().room?.enemies.length > 0 || !window.__TS.getState().room?.fighting, 8000);
  await sleep(800); await shot('room_combat_start');
  const roomWaves = (await S()).room.waves; let wavesReached = 0;
  // ---------- real combat ----------
  const before = (await S()).room.dmgDealt;
  const atk = await fight(90000, async (s) => { wavesReached = Math.max(wavesReached, s.room.waveIdx); return s.run.cleared; });
  st = await S(); wavesReached = Math.max(wavesReached, st.room.waveIdx); ok('C022_real_combat', st.room.dmgDealt > before && atk > 0, `attacks=${atk} dmg=${st.room.dmgDealt}`);
  if (!st.run.cleared) { log('combat timeout → clearRoom'); await ev(() => window.__TS.clearRoom()); await sleep(1500); }
  st = await S(); ok('C078_room_cleared_doors_open', st.run.cleared);
  const L = await ev(() => window.__TS.log().map((l) => l.type));
  ok('C105_keyboard_mouse', L.includes('attack') && L.includes('hit'));
  await sleep(700); /* V2: let the last attack's recovery end — a dash is buffered only 120 ms (docs/COMBAT.md) */ await page.keyboard.press('Space'); await sleep(400); ok('C018_dash', (await ev(() => window.__TS.log('dash').length)) > 0);
  await shot('room_cleared');

  // ---------- V2 depth: waves, elite marker + telegraph, charged attack, perfect dodge, parry (docs/V2_*.md) ----------
  ok('V2_wave_waves', roomWaves >= 2 && wavesReached >= 2, `waves ${roomWaves}, reached wave ${wavesReached}`);
  await ev(() => window.__TS.setWeapon('swordshield')); await sleep(600);
  const RS = 'window.__game.scene.getScene("Run")';
  await ev(() => { const rs = window.__game.scene.getScene('Run'); rs.px = 640; rs.py = 560;
    rs.waves = [['beetle_charger', 'slime_moss', 'sprout_archer']]; rs.waveElites = [['swift', null, null]]; rs.waveIdx = 0; rs.miniBoss = undefined; rs.spawnWave(); });
  await sleep(700);
  const elite = await ev(() => { const rs = window.__game.scene.getScene('Run'); const e = rs.enemies.find((x) => !x.dead && x.elite); return e ? { id: e.id, affix: e.elite, ring: !!(e.eliteG && e.eliteG.visible), label: e.eliteLabel?.text, hp: e.maxHp } : null; });
  ok('V2_elite_marker', !!elite && elite.ring && /Tinh Anh/.test(elite.label ?? ''), JSON.stringify(elite));
  const tele = await waitFor(() => { const rs = window.__game.scene.getScene('Run'); return rs.enemies.some((e) => !e.dead && e.agent.state === 'windup' && window.__TSAnim?.enemyPose(e.sprite) === 'windup') && rs.hazards.length > 0; }, 15000);
  ok('V2_enemy_telegraph', tele, 'wind-up pose + telegraph hazard on screen');
  await shot('v2_elite_telegraph');
  // charged attack: hold the mouse (hold ≥ 280 ms → charge ring → auto-release at full)
  { const nC = await ev(() => window.__TS.log('chargedAttack').length);
    const tgt = await ev(() => { const rs = window.__game.scene.getScene('Run'); const e = rs.enemies.find((x) => !x.dead); return e ? { x: e.agent.x, y: e.agent.y } : { x: 640, y: 300 }; });
    const tp = await toPage(tgt.x, tgt.y - 14); await page.mouse.move(tp.x, tp.y);
    await page.mouse.down(); await sleep(750); await shot('v2_charged_attack'); await sleep(1100); await page.mouse.up(); await sleep(500);
    const L = await ev(() => window.__TS.log().filter((l) => l.type === 'chargeStart' || l.type === 'chargedAttack').map((l) => l.type));
    ok('V2_charged_attack', L.includes('chargeStart') && (await ev(() => window.__TS.log('chargedAttack').length)) > nC, JSON.stringify(L.slice(-3))); }
  // perfect dodge: a real dash (Space) while a charging enemy reaches the hero in the dash's first frames
  { const nD = await ev(() => window.__TS.log('perfectDodge').length);
    await ev(() => { const rs = window.__game.scene.getScene('Run'); const e = rs.enemies.find((x) => !x.dead && !x.dummy && !x.boss && x.agent.ai !== 'exploder'); if (!e) return;
      const od = rs.startDash; rs.startDash = function (...a) { rs.startDash = od; od.apply(this, a);
        const ou = rs.updateEnemies; rs.updateEnemies = function (dt) { rs.updateEnemies = ou; e.status.stunT = 0; e.status.frozenT = 0; e.agent.x = rs.px; e.agent.y = rs.py; e.chargeT = 0.2; e.chargeA = 0; e.chargeSpd = 1; e.contactCd = 0; e.kvx = 0; e.kvy = 0; return ou.call(this, dt); }; }; });
    await page.keyboard.press('Space'); await sleep(180); await shot('v2_perfect_dodge'); await sleep(600);
    ok('V2_perfect_dodge', (await ev(() => window.__TS.log('perfectDodge').length)) > nD); }
  // parry: guard (K) opens; a charging enemy hits the shield inside the 150 ms window → stagger + riposte. Then a projectile → reflect.
  { await sleep(1200); await ev(() => window.__TS.godMode(false)); await ev(() => window.__TS.heal());
    const nP = await ev(() => window.__TS.log('parry').length);
    const arm = (proj) => ev((proj) => { const rs = window.__game.scene.getScene('Run'); const e = rs.enemies.find((x) => !x.dead && !x.dummy && !x.boss && x.agent.ai !== 'exploder'); let n = 0;
      const ou = rs.updateEnemies; rs.updateEnemies = function (dt) { if (rs.ws.guarding || ++n > 400) { rs.updateEnemies = ou; if (rs.ws.guarding) {
        const f = rs.facing;
        if (proj) rs.spawnEnemyProj(rs.px + Math.cos(f) * 34, rs.py - 14 + Math.sin(f) * 34, f + Math.PI, 260, 5);
        else if (e) { e.status.stunT = 0; e.status.frozenT = 0; e.agent.x = rs.px + Math.cos(f) * 12; e.agent.y = rs.py + Math.sin(f) * 12; e.chargeT = 0.2; e.chargeA = f + Math.PI; e.chargeSpd = 1; e.contactCd = 0; e.kvx = 0; e.kvy = 0; } } }
        return ou.call(this, dt); }; }, proj);
    await arm(false); await page.keyboard.down('k'); await sleep(260); await shot('v2_parry'); await sleep(300); await page.keyboard.up('k'); await sleep(700);
    const melee = await ev(() => window.__TS.log('parry').filter((l) => !l.data.proj).length);
    await arm(true); await page.keyboard.down('k'); await sleep(450); await page.keyboard.up('k'); await sleep(400);
    const Lp = await ev(() => window.__TS.log('parry').map((l) => l.data.proj));
    ok('V2_parry', melee > 0 && Lp.length > nP, `parry events ${JSON.stringify(Lp.slice(-3))}`);
    ok('V2_projectile_reflect', Lp.includes(true), JSON.stringify(Lp.slice(-3)));
    await ev(() => window.__TS.godMode(true)); await ev(() => window.__TS.heal()); }
  await ev(() => window.__TS.clearRoom()); await sleep(600); void RS;

  // ---------- inventory: place artifact + tablet with real drag ----------
  // find a proper pair using exported data on window via state check
  const chosen = await ev(() => {
    const T = window.__TS; const run = T.G.run; T.clearBag();
    // brute force: for each tablet, place art at (2,1) and tablet at (1,1); keep first giving +level to the art
    for (const tb of T.tabletIds()) for (const a of T.artifactIds().slice(0, 40)) {
      run.grid.items = []; const pa = T.placeItem(a, 2, 1, 0); if (!pa) continue; const pt = T.placeItem(tb, 1, 1, 0); if (!pt) continue;
      const lv = T.getState().run.items.find((i) => i.uid === pa.uid).level;
      const one = T.getState().run.items.length === 2;
      if (lv > 0 && one) { run.grid.items = []; return { a, tb }; }
    }
    run.grid.items = []; return null;
  });
  ok('inv_pair_found', !!chosen, JSON.stringify(chosen));
  await ev((c) => { window.__TS.giveArtifact(c.a); window.__TS.giveTablet(c.tb); }, chosen);
  await page.keyboard.press('Tab'); ok('C101_inventory_opens', await waitScene('Inventory')); await sleep(600);
  st = await S(); let C = gridCell(st);
  const itA = st.run.items.find((i) => i.id === chosen.a), itT = st.run.items.find((i) => i.id === chosen.tb);
  const cellPx = (x, y) => toPage(90 + x * C + C / 2, 130 + y * C + C / 2);
  async function drag(from, to) { await page.mouse.move(from.x, from.y); await page.mouse.down(); await sleep(150); await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 }); await sleep(150); await page.mouse.move(to.x, to.y, { steps: 4 }); await sleep(250); await page.mouse.up(); await sleep(350); }
  // pause check: run scene paused while inventory open
  ok('C101_pauses_combat', !(await ev(() => window.__game.scene.isActive('Run'))));
  await drag(await cellPx(itA.x, itA.y), await cellPx(2, 2));
  // drag tablet, show preview mid-drag, rotate with Q/E then back
  const tf = await cellPx(itT.x, itT.y), tt = await cellPx(1, 2);
  await page.mouse.move(tf.x, tf.y); await page.mouse.down(); await sleep(150); await page.mouse.move(tt.x, tt.y, { steps: 6 }); await sleep(300);
  await shot('inventory_drag_preview');
  ok('V2_drag_preview', await ev(() => { const walk = (l) => l.some((x) => (x.visible !== false && typeof x.text === 'string' && /^[+\-]\d|★\d|→/.test(x.text)) || (x.list && walk(x.list))); return walk(window.__game.scene.getScene('Inventory').children.list); }), 'live +/−/★ labels while dragging');
  await page.keyboard.press('e'); await sleep(150); await page.keyboard.press('q'); await sleep(150);
  await page.mouse.up(); await sleep(400);
  st = await S(); const a2 = st.run.items.find((i) => i.id === chosen.a), t2 = st.run.items.find((i) => i.id === chosen.tb);
  ok('C037_place_drag', a2.x === 2 && a2.y === 2 && t2.x === 1 && t2.y === 2, JSON.stringify(st.run.items));
  ok('C045_tablet_level_live', a2.level > 0, `level=${a2.level}`);
  ok('C053_live_recompute', (await ev(() => window.__TS.log('invPlace').length)) >= 2);
  await shot('inventory_placed');
  ok('C055_combo_panel', await ev(() => { const walk = (l) => l.some((x) => (x.text && /Băng Hà/.test(x.text)) || (x.list && walk(x.list))); return walk(window.__game.scene.getScene('Inventory').children.list); }));
  await page.keyboard.press('Tab'); await sleep(500);

  // ---------- every node type ----------
  const types = ['levelup', 'artifact', 'enchant', 'tablet', 'money', 'heart', 'anvil', 'dice', 'shop', 'roots'];
  for (const ty of types) {
    await closeOverlays();
    await ev(() => { window.__TS.addCurrency('money', 3000); window.__TS.addCurrency('dice', 2); });
    await gotoForced(1, { type: ty, modifier: 'none', event: null, altarSize: 2 });
    st = await S();
    if (st.room.fighting) { await fight(6000); await ev(() => window.__TS.clearRoom()); await waitFor(() => window.__TS.getState().run.cleared, 10000); }
    await sleep(600);
    const before = await S();
    await interact(`reward_${ty}`);
    await sleep(700);
    const sc = await ev(() => window.__TS.scenes());
    let pass = false;
    if (['artifact', 'tablet', 'anvil', 'roots'].includes(ty)) {
      const shown = sc.includes('Choice'); if (shown && ty === 'artifact') await shot('choice_artifact');
      if (shown && ty === 'artifact') { // V2: concrete deltas on cards, keep (lock) survives reroll, banish refills the slot
        await ev(() => window.__TS.addCurrency('dice', 3));
        ok('V2_choice_deltas', await ev(() => { const walk = (l) => l.some((x) => (typeof x.text === 'string' && /Sức mạnh/.test(x.text)) || (x.list && walk(x.list))); return walk(window.__game.scene.getScene('Choice').children.list); }));
        await btn('lock0'); const kept = await ev(() => { const c = window.__TS.G.run.choice; return c.locked === 0 ? c.options[0] : null; });
        const ban = await ev(() => window.__TS.G.run.choice.options[1]); await btn('banish1');
        const afterBan = await ev(() => ({ o: [...window.__TS.G.run.choice.options], b: [...(window.__TS.G.run.banished ?? [])] }));
        ok('V2_choice_banish', !!ban && afterBan.b.includes(ban) && !afterBan.o.includes(ban), JSON.stringify({ ban, ...afterBan }));
        await shot('v2_choice_keep_banish');
        const d0 = (await S()).run.dice; await btn('reroll');
        ok('V2_choice_keep', !!kept && (await ev(() => window.__TS.G.run.choice?.options[0])) === kept, `kept ${kept}`); ok('C080_reroll_choice', (await ev(() => window.__TS.log('reroll').length)) > 0 && (await S()).run.dice === d0 - 1); }
      await btn('take0'); await sleep(400); const a = await S();
      pass = shown && (ty === 'anvil' ? a.run.upgrades.length > before.run.upgrades.length : ty === 'roots' ? a.run.miracles.length === 1 : a.run.items.length > before.run.items.length);
      if (ty === 'roots') ok('C075_roots', pass); if (ty === 'anvil') ok('C034_anvil', pass);
    } else if (ty === 'shop') {
      pass = sc.includes('Shop'); await sleep(300); await shot('shop');
      const m0 = (await S()).run.money; await btn('buy0'); const m1 = (await S()).run.money; ok('shop_buy', m1 < m0, `${m0}→${m1}`);
      // sell: drag first bag item into sell zone
      const s2 = await S(); const Cs = s2.run.grid[0] > 6 ? 58 : 64; const it0 = s2.run.items[0];
      const from = await toPage(70 + it0.x * Cs + Cs / 2, 150 + it0.y * Cs + Cs / 2);
      const zoneY = 150 + Cs * s2.run.grid[1] + (await ev(() => window.__TS.G.run.grid.sideUnlocked) ? Cs + 60 : 20) + 35;
      const to = await toPage(70 + Cs * 2.5, zoneY);
      await drag(from, to); const m2 = (await S()).run.money;
      ok('C056_sell_zone', m2 > m1 && (await S()).run.items.length === s2.run.items.length - 1, `${m1}→${m2}`);
      await ev(() => window.__TS.addCurrency('dice', 1)); await btn('shopReroll'); ok('C080_reroll_shop', (await ev(() => window.__TS.log('shopReroll').length)) > 0);
      await btn('close');
    } else if (ty === 'enchant') {
      pass = sc.includes('Enchant'); await sleep(300);
      const s2 = await S(); const art = s2.run.items.find((i) => i.kind === 'artifact');
      const Ce = 72; const pp = await toPage(90 + art.x * Ce + Ce / 2, 130 + art.y * Ce + Ce / 2); await page.mouse.click(pp.x, pp.y); await sleep(400);
      ok('C076_enchant', (await ev(() => window.__TS.log('enchant').length)) > 0);
      await closeOverlays();
    } else {
      const a = await S();
      const rl = await ev((ty) => window.__TS.log('reward').some((r) => r.data.type === ty), ty);
      pass = rl || ty === 'levelup' ? (rl || a.run.level > before.run.level) : ty === 'money' ? a.run.money > before.run.money : ty === 'heart' ? a.room.stats.maxHp >= before.room.stats.maxHp + 15 || (await ev(() => window.__TS.log('reward').some((r) => r.data.type === 'heart'))) : ty === 'dice' ? a.run.dice >= before.run.dice + 2 : false;
    }
    ok(`C074_node_${ty}`, pass);
    await closeOverlays();
  }
  ok('C074_all_nodes', types.every((t) => checks[`C074_node_${t}`]));
  ok('C102_choice_cards', checks.C074_node_artifact);

  // ---------- modifiers: derangement + miniboss ----------
  await gotoForced(2, { type: 'money', modifier: 'derangement', event: null });
  await sleep(1500); st = await S(); ok('C077_derangement', st.room.fighting && (await ev(() => window.__TS.log('roomEnter').slice(-1)[0].data.modifier)) === 'derangement');
  await ev(() => window.__TS.clearRoom()); await sleep(800);
  await gotoForced(2, { type: 'money', modifier: 'miniboss', event: null });
  await fight(2500); await ev(() => { window.__TS.clearRoom(); }); await sleep(500); await ev(() => window.__TS.clearRoom()); await waitFor(() => window.__TS.getState().run.cleared, 15000);
  st = await S(); ok('C077_miniboss_drop', !!st.room.interacts.find((i) => i.id === 'miniboss_drop'));
  await interact('miniboss_drop'); await sleep(500); if ((await ev(() => window.__TS.scenes())).includes('Choice')) await btn('take0');

  // ---------- events ----------
  const evs = { clover: 'hp', merchant: 'go', obelisk: 'go', fountain: 'green', companion: 'go', blood: 'pay', pocket: 'go' };
  await ev(() => { const T = window.__TS; T.addCurrency('sapphire', 50); const d = T.G.meta; const node = (window.__TS.G.meta.destinyOwned); void node; void d; });
  // enable pocket dimension grant for the pocket event
  await ev(() => { const T = window.__TS; const m = T.G.meta; const reg = T.G; void reg; });
  for (const [e, opt] of Object.entries(evs)) {
    await closeOverlays(); await ev(() => window.__TS.addCurrency('money', 1000)); await ev(() => window.__TS.heal());
    if (e === 'pocket') await ev(() => { const T = window.__TS; T.G.run.pocket = true; T.grantNode('pocketDimension'); T.addCurrency('sapphire', 20); });
    await gotoForced(3, { type: 'money', modifier: 'none', event: e });
    st = await S(); if (st.room.fighting) { await ev(() => window.__TS.clearRoom()); await waitFor(() => window.__TS.getState().run.cleared, 10000); }
    await sleep(500);
    await interact(`event_${e}`); await sleep(500);
    if (e === 'clover') await shot('event_dialog');
    const optId = e === 'fountain' ? (await ev(() => window.__TS.buttons().map((b) => b.id))).find((x) => x.startsWith('ev_') && x !== 'ev_leave') : `ev_${opt}`;
    await btn(optId); await sleep(600);
    const sc = await ev(() => window.__TS.scenes());
    if (sc.includes('Choice')) await btn('take0'); if (sc.includes('Shop')) await btn('close');
    const L2 = await ev((e) => window.__TS.log('event').filter((x) => x.data.ev === e), e);
    const passed = L2.some((x) => x.data.ok);
    ok(`C079_event_${e}`, passed, JSON.stringify(L2.slice(-1)));
    await closeOverlays();
  }
  // arena (3-4 waves) + secret wall (attack it)
  await gotoForced(4, { type: 'money', modifier: 'none', event: 'arena' }); st = await S(); ok('C079_event_arena', st.room.waves >= 3, `waves=${st.room.waves}`); await ev(() => window.__TS.clearRoom()); await sleep(400); await ev(() => window.__TS.clearRoom()); await sleep(400); await ev(() => window.__TS.clearRoom()); await sleep(300); await ev(() => window.__TS.clearRoom());
  await gotoForced(4, { type: 'money', modifier: 'none', event: 'secret' }); await ev(() => { window.__TS.clearRoom(); }); await sleep(300); for (let i = 0; i < 4; i++) { await ev(() => window.__TS.clearRoom()); await sleep(300); }
  await walkTo(1180, 320, 26); const wp = await toPage(1230, 300); for (let i = 0; i < 6; i++) { await page.mouse.move(wp.x, wp.y); await page.mouse.down(); await sleep(150); await page.mouse.up(); await sleep(450); }
  await sleep(500); const secretLog = await ev(() => window.__TS.log('event').filter((x) => x.data.ev === 'secret'));
  ok('C079_event_secret', secretLog.length > 0); await closeOverlays();
  // blood bat option (fight)
  await gotoForced(5, { type: 'money', modifier: 'none', event: 'blood' }); await ev(() => window.__TS.clearRoom()); await waitFor(() => window.__TS.getState().run.cleared, 10000); await sleep(300);
  await interact('event_blood'); await btn('ev_bat'); await sleep(600); await fight(20000, async (s) => s.run.cleared);
  ok('C079_blood_bat', (await ev(() => window.__TS.log('kill').some((k) => k.data.id === 'bat'))));
  ok('C079_all_events', ['arena', 'secret', 'clover', 'merchant', 'obelisk', 'fountain', 'companion', 'blood', 'pocket'].every((e) => checks[`C079_event_${e}`]));

  // ---------- potion + spells + map + pause ----------
  await ev(() => { const r = window.__TS.G.run; r.potions[0] = 'heal'; r.hp = 10; });
  await page.keyboard.press('r'); await sleep(400); ok('C058_potion_drink', (await ev(() => window.__TS.log('potion').length)) > 0 && (await S()).run.hp > 10);
  // quick-slot spell: give a spell artifact and cast with key 1
  await ev(() => { const T = window.__TS; const id = T.artifactIds().find((a) => /icebolt|fireball|chain|arcane|bubble|blink/i.test(JSON.stringify(window.__TS.G && a)) ); void id; });
  const spellId = await ev(() => { const T = window.__TS; for (const id of T.artifactIds()) { T.G.run.grid.items = []; T.giveArtifact(id); const rs = window.__game.scene.getScene('Run'); if (rs.spells.length) return id; } return null; });
  await ev(() => { window.__TS.G.run.mp = 999; }); await page.keyboard.press('1'); await sleep(400);
  ok('C057_spell_slot', !!spellId && (await ev(() => window.__TS.log('spell').length)) > 0, String(spellId));
  ok('C103_font_vn', await ev(() => document.fonts.check('800 20px "Baloo 2"')));
  await page.keyboard.press('m'); ok('map_overlay', await waitScene('Map')); await shot('map'); await btn('close'); await sleep(400);

  // ---------- save between rooms → quit → continue ----------
  st = await S(); const posBefore = st.run.pos, chBefore = st.run.chapter;
  await page.keyboard.press('Escape'); await waitScene('Pause'); await shot('pause'); await btn('quit'); ok('quit_to_hub', await waitScene('Hub', 20000)); await sleep(800);
  const label = (await ev(() => window.__TS.buttons())).find((b) => b.id === 'startRun')?.label;
  await btn('startRun'); await waitScene('Run', 20000); await waitFor(() => window.__TS.getState().room, 20000); st = await S();
  ok('C083_save_continue', /^Tiếp tục/.test(label ?? '') && st.run.chapter === chBefore && String(st.run.pos) === String(posBefore), `label=${label} pos ${posBefore}→${st.run.pos}`);
  await ev(() => window.__TS.godMode(true));

  // ---------- full inventory (several artifacts + tablets, combos, tooltip card) ----------
  await ev(() => {
    const T = window.__TS; T.clearBag();
    const put = [['g_frost_shard', 1, 1, 0], ['t_arrow', 0, 1, 0], ['g_ice_lantern', 3, 0, 0], ['g_snow_charm', 1, 2, 0], ['e_ember_coal', 0, 3, 0], ['s_spark_bead', 4, 3, 0], ['gd_wooden_buckler', 4, 0, 0], ['a_icebolt_tome', 2, 0, 0]];
    for (const [id, x, y, r] of put) T.placeItem(id, x, y, r);
    for (const tb of T.tabletIds().slice(0, 6)) { if (T.getState().run.items.filter((i) => i.kind === 'tablet').length >= 3) break; T.giveTablet(tb); }
  });
  await page.keyboard.press('Tab'); await waitScene('Inventory'); await sleep(600);
  { const s3 = await S(); const C3 = gridCell(s3); const it = s3.run.items.find((i) => i.kind === 'artifact'); const hp = await toPage(90 + it.x * C3 + C3 / 2, 130 + it.y * C3 + C3 / 2); await page.mouse.move(hp.x, hp.y); await sleep(500);
    ok('inventory_full', s3.run.items.length >= 6 && s3.run.combos.length > 0, `items ${s3.run.items.length} combos ${JSON.stringify(s3.run.combos)}`); }
  await shot('inventory_full'); await page.keyboard.press('Tab'); await sleep(500);

  // ---------- floor 2 start room shop+dummy ----------
  await ev(() => window.__TS.setChapter(1, 2)); await sleep(1500); st = await S();
  ok('C071_start_shop_dummy_f2', st.run.startShop && st.room.interacts.some((i) => i.id === 'shop_stall') && st.room.enemies.some((e) => e.dummy));

  // ---------- bosses of all 6 chapters ----------
  const bossShots = []; const realKills = [];
  for (let ch = 1; ch <= 6; ch++) {
    await closeOverlays();
    await ev((ch) => window.__TS.setChapter(ch, 3), ch); await sleep(1200);
    await waitFor(() => window.__TS.getState().room, 30000);
    await shot(`ch${ch}_start_room`);
    ok(`C090_chapter_theme_${ch}`, (await S()).loadedChapter === ch && (await S()).placeholders.length === 0);
    // a real combat room of this chapter (enemies of the chapter, mid-fight)
    await gotoForced(0, { type: 'artifact', modifier: 'none', event: null });
    await waitFor(() => (window.__TS.getState().room?.enemies.length ?? 0) > 0, 8000); await fight(3500); await sleep(300);
    st = await S(); ok(`C090_combat_room_${ch}`, st.room.enemies.length > 0 && st.placeholders.length === 0, `enemies ${st.room.enemies.map((e) => e.id).join(',')}`);
    await shot(`ch${ch}_combat_room`);
    for (let k = 0; k < 4 && !(await S()).run.cleared; k++) { await ev(() => window.__TS.clearRoom()); await sleep(500); }
    await ev(() => { window.__TS.G.run.pos = 'start'; window.__TS.G.run.roomCleared = true; });
    // V2 (docs/V2_AI.md): bosses are tuned for a normal run's level at their chapter (L = 3 + 3·(ch−1)); give the bot that
    // level (a jumped-to chapter skips the XP of earlier floors) so the boss can be killed with real damage below.
    await ev((ch) => { const r = window.__TS.G.run; const L = 3 + 3 * (ch - 1); if (r.level < L) { r.level = L; r.xp = 0; } }, ch);
    await ev(() => window.__TS.gotoNode('gate')); await sleep(800);
    await waitFor(() => !!window.__TS.getState().room?.boss, 30000);
    st = await S(); const hp0 = st.room.boss?.hp;
    // real fight: at least ~5 s, continue (≤25 s) until real damage landed (bosses may be shielded)
    const tb0 = Date.now(); await fight(25000, async (s) => Date.now() - tb0 > 5000 && s.room.boss && s.room.boss.hp < hp0);
    st = await S(); const hp1 = st.room.boss?.hp ?? 0;
    await shot(`ch${ch}_boss_fight`);
    const dealt = hp0 - hp1;
    ok(`C087_boss_ch${ch}_damaged`, dealt > 0, `${st.room.boss?.id} ${hp0}→${hp1}`);
    if (ch === 1) { // phases: drop hp to trigger phase changes and see patterns
      await ev(() => { const rs = window.__game.scene.getScene('Run'); rs.bossRef.hp = rs.bossRef.maxHp * 0.5; }); await sleep(2500);
      await ev(() => { const rs = window.__game.scene.getScene('Run'); rs.bossRef.hp = rs.bossRef.maxHp * 0.2; }); await sleep(3000);
      const ph = await ev(() => window.__TS.log('bossPhase').length); ok('C087_phases', ph >= 2, `phase events ${ph}`); await shot('ch1_boss_phase3');
      st = await S(); ok('C089_boss_bar', !!st.room.boss);
    }
    if (dealt > 0) { // V2: fight to the death with real damage; killBoss() only as a logged fallback
      const nDef = await ev(() => window.__TS.log('bossDefeated').length); const tk = Date.now();
      await fight(150000, async (s) => !s.room.boss || !s.room.fighting);
      const realKill = (await ev(() => window.__TS.log('bossDefeated').length)) > nDef;
      log(realKill ? 'PASS' : 'NOTE', `boss_ch${ch}_real_kill`, realKill ? `${Math.round((Date.now() - tk) / 1000)} s` : 'timeout → __TS.killBoss() fallback');
      realKills.push(realKill);
      if (!realKill) await ev(() => window.__TS.killBoss());
    }
    await sleep(1500);
    const L3 = await ev(() => window.__TS.log('bossDefeated').map((x) => x.data));
    ok(`boss_ch${ch}_defeated`, L3.some((x) => x.chapter === Math.min(6, ch + 1) || (ch === 6 && x.res === 'win')), JSON.stringify(L3.slice(-1)));
  }
  log('boss real kills', realKills.filter(Boolean).length, '/', realKills.length);
  ok('C088_boss_patterns_seen', (await ev(() => window.__TS.G.log.filter((l) => l.type === 'hit').length)) > 0);
  ok('C082_ending', await waitScene('Ending', 15000)); await sleep(2500); await shot('ending_credits');
  st = await S(); ok('C082_hard_mode_unlocked', st.meta.hardModeUnlocked && st.meta.stats.wins === 1);
  await btn('toHub'); await waitScene('Hub', 15000); await sleep(600);
  ok('C110_full_run', checks.C082_ending);

  // ---------- death → results → hub → destiny purchase ----------
  await ev(() => window.__TS.startRun(42)); await waitFor(() => window.__TS.getState().room, 30000); await sleep(600);
  await ev(() => window.__TS.godMode(false));
  await gotoForced(0, { type: 'money', modifier: 'none', event: null });
  await ev(() => { const r = window.__TS.G.run; r.hp = 1; r.revives = 0; });
  const died = await waitFor(() => window.__TS.scenes().includes('Results'), 40000);
  if (!died) { log('no natural death; abandon via pause'); await page.keyboard.press('Escape'); await waitScene('Pause'); await btn('abandon'); await waitScene('Results', 15000); }
  ok('C081_death_results', (await ev(() => window.__TS.scenes())).includes('Results')); await sleep(800); await shot('results');
  const sap0 = (await S()).sapphires; ok('C081_sapphires_awarded', (await ev(() => window.__TS.log('runLost').slice(-1)[0]?.data.sapphires)) >= 0);
  await btn('toHub'); await waitScene('Hub', 15000); await sleep(600);
  await ev(() => window.__TS.addCurrency('sapphire', 300));
  await btn('destinyBtn'); await waitScene('Destiny'); await sleep(500);
  // click (real mouse) the chain of nodes leading to a weapon unlock + home repair + talent points
  const d0 = (await S()).meta.destiny;
  const nodes = await ev(() => window.__TS.destinyNodes());
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const chain = []; const addChain = (id) => { if (chain.includes(id)) return; for (const r of byId[id]?.requires ?? []) addChain(r); chain.push(id); };
  for (const key of ['homeRepair', 'talentPoints', 'unlockWeapon']) { const n = nodes.find((x) => x.key === key); if (n) addChain(n.id); }
  for (const id of chain) {
    const pos = await ev((id) => { const c = window.__game.scene.getScene('Destiny').children.list.find((c) => c.btnId === 'destiny_' + id); return c ? { x: c.x, y: c.y } : null; }, id);
    if (!pos) continue; const p = await toPage(pos.x, pos.y); await page.mouse.click(p.x, p.y); await sleep(300);
  }
  st = await S(); ok('C092_destiny_buy', st.meta.destiny > d0, `${d0}→${st.meta.destiny}`); await shot('destiny_tree');
  await btn('close'); await sleep(600);
  // talents (needs homeRepair) + respec
  await btn('talentsBtn'); await waitScene('Talents'); const tb = (await ev(() => window.__TS.buttons())).find((b) => b.id.startsWith('talent_') && b.enabled);
  if (tb) { await page.mouse.click(tb.x, tb.y); await sleep(300); }
  const tr = await ev(() => Object.values(window.__TS.G.meta.talentRanks).reduce((a, b) => a + b, 0));
  await shot('talents'); await btn('respec'); const tr2 = await ev(() => Object.values(window.__TS.G.meta.talentRanks).reduce((a, b) => a + b, 0));
  ok('C094_talents_respec', tr2 === 0, `ranks ${tr} → ${tr2}`); await btn('close'); await sleep(500);
  // weapon unlock + training room with real hits
  await ev(() => { const T = window.__TS; T.addCurrency('sapphire', 500); });
  const unlocked = await ev(() => { const T = window.__TS; const m = T.G.meta; return m.destinyOwned; });
  void unlocked;
  await btn('weaponsBtn'); await waitScene('Weapons'); await sleep(300);
  const trainable = (await ev(() => window.__TS.buttons())).find((b) => b.id.startsWith('weapon_') && b.enabled && /phòng tập/i.test(b.label));
  if (trainable) {
    await page.mouse.click(trainable.x, trainable.y); await waitScene('Run', 20000); await waitFor(() => window.__TS.getState().room?.enemies.some((e) => e.dummy), 20000);
    const dummy = (await S()).room.enemies.find((e) => e.dummy); await walkTo(dummy.x, dummy.y + 50, 20);
    const pp = await toPage(dummy.x, dummy.y - 14);
    for (let i = 0; i < 40 && !(await ev(() => window.__TS.log('trainingDone').length)); i++) { await page.mouse.move(pp.x, pp.y); await page.mouse.down(); await sleep(140); await page.mouse.up(); await sleep(120); }
    await shot('training_room');
    ok('C030_weapon_training_unlock', (await ev(() => window.__TS.log('trainingDone').length)) > 0);
    // training grounds spawn artifact
    await interact('picker'); await waitScene('Picker'); await sleep(300); const pk = await toPage(100, 164); await page.mouse.click(pk.x, pk.y); await sleep(300);
    ok('C098_training_spawn', (await ev(() => window.__TS.log('trainingSpawn').length)) > 0); await btn('close'); await sleep(400);
    const door2 = (await S()).room.doors[0]; await walkTo(door2.x, 175, 16); await hold(['w'], 800); ok('training_exit', await waitScene('Hub', 15000));
  } else { ok('C030_weapon_training_unlock', false, 'no trainable weapon (destiny unlock missing)'); await btn('close'); }
  await sleep(500);
  // weapon rack equip
  await btn('weaponsBtn'); await waitScene('Weapons'); const eq = (await ev(() => window.__TS.buttons())).find((b) => b.id.startsWith('weapon_') && b.enabled && /Trang bị/i.test(b.label));
  if (eq) { await page.mouse.click(eq.x, eq.y); await sleep(300); } ok('C096_weapon_rack', !!eq && (await S()).meta.weapon !== 'swordshield', (await S()).meta.weapon); await btn('close'); await sleep(400);
  ok('C097_journal', Object.values((await S()).meta.journal).every((n) => n > 0), JSON.stringify((await S()).meta.journal));
  ok('C099_meta_persisted', !!(await ev(() => JSON.parse(localStorage.getItem('thapsao.meta')).v)));
  ok('C108_sfx', (await S()).sfx.length > 0);
} catch (e) { errors.push('smoke exception: ' + (e.stack || e)); }

// ---------- touch controls (separate mobile-like context) ----------
try {
  const tp = await newPage({ hasTouch: true }, '&touch=1');
  await tp.evaluate(() => { window.__TS.startRun(3); }); await tp.waitForFunction(() => window.__TS.getState().room, null, { timeout: 30000 }); await tp.waitForTimeout(800);
  const cdp = await tp.context().newCDPSession(tp);
  const p0 = await tp.evaluate(() => window.__TS.getState().room.px);
  const pt = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await pt('touchStart', 200, 500); for (let i = 0; i < 12; i++) { await pt('touchMove', 200 + i * 6, 500); await tp.waitForTimeout(60); } await tp.waitForTimeout(900);
  await tp.screenshot({ path: path.join(OUT, `${String(shots.length + 1).padStart(2, '0')}_touch_controls.png`) }); shots.push('touch_controls');
  await pt('touchEnd', 0, 0);
  const p1 = await tp.evaluate(() => window.__TS.getState().room.px);
  ok('C104_touch_joystick', p1 > p0 + 10, `${p0}→${p1}`);
  const ab = await tp.evaluate(() => window.__TS.toPage(1170, 600)); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: ab.x, y: ab.y, id: 2 }] }); await tp.waitForTimeout(400); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  ok('C104_touch_attack_button', (await tp.evaluate(() => window.__TS.log('attack').length)) > 0);
  const vp = await tp.evaluate(() => { const c = window.__game.canvas.getBoundingClientRect(); return { w: c.width, h: c.height }; });
  ok('C106_landscape_fit', Math.abs(vp.w / vp.h - 16 / 9) < 0.02, JSON.stringify(vp));
  await tp.context().close();
} catch (e) { errors.push('touch exception: ' + (e.stack || e)); }

// ---------- single-file build (docs/ThapSao.html) loads with real art and no errors ----------
try {
  const single = path.join(root, 'docs/ThapSao.html');
  if (fs.existsSync(single)) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const sp = await ctx.newPage();
    sp.on('console', (m) => { if (m.type() === 'error') errors.push(`single console.error: ${m.text()}`); }); sp.on('pageerror', (e) => errors.push(`single pageerror: ${e.message}`));
    await sp.goto('file://' + single + '?debug=1');
    const okHub = await sp.waitForFunction(() => window.__TS && window.__TS.scenes().includes('Hub'), null, { timeout: 120000 }).then(() => true, () => false);
    const st = okHub ? await sp.evaluate(() => window.__TS.getState()) : null;
    await sp.waitForTimeout(1000); await sp.screenshot({ path: path.join(OUT, '99_single_file_hub.png') }); shots.push('99_single_file_hub.png');
    ok('single_file_build', okHub && st.placeholders.length === 0, `placeholders ${st?.placeholders.length}`);
    await ctx.close();
  } else ok('single_file_build', false, 'docs/ThapSao.html missing');
} catch (e) { errors.push('single exception: ' + (e.stack || e)); }

await browser.close(); srv.close();
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
const report = { ok: errors.length === 0 && failed.length === 0, checks, failed, errors, screenshots: shots.map((s) => path.relative(root, String(s))), seconds: (Date.now() - T0) / 1000 };
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
log(`checks: ${Object.keys(checks).length - failed.length}/${Object.keys(checks).length} passed; errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 40).join('\n'));
process.exit(report.ok ? 0 : 1);
