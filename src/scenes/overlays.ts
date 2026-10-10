// In-run overlay scenes: Inventory, Choice (1 of 3), Shop, Enchant, Map, Pause, Event dialog.
import Phaser from 'phaser';
import { Overlay } from './Overlay';
import { G } from '../game/state';
import { PAL, RARITY_COLOR, RARITY_TEXT, iconRef, MANIFEST } from '../game/assets';
import { sfx } from '../game/audio';
import { txt, darkTxt, card, button, stars, wrapText, toast, pill, dim, title } from '../ui/kit';
import { GridView, itemDesc } from '../ui/gridView';
import { t } from '../systems/i18n';
import { getArtifact, getTablet, getMiracle, getUpgrade, getCombo, getPotion, getChapter } from '../systems/registry';
import { rerollChoice, takeChoice, skipChoice, buy, sell, rerollShop, enchant, runStats, discard, itemBasePrice, toggleLock, banishOption, shopHeal, shopHealCost, shopEnchant, enchantCost, shopRerollGold, eventStakes, ECON } from '../systems/run';
import { choiceDelta, addBest } from '../systems/build';
import { comboLine } from '../systems/inventory';
import { resolve } from '../systems/inventory';
import { sellPrice } from '../systems/stats';
import type { RunState } from '../systems/run';
import { drawFloorMap, drawLegend } from '../ui/mapView';
import { FULLMAP } from '../ui/layout';

const run = (): RunState => G.run!;
const statsNow = () => runStats(run(), G.meta);

export class InventoryScene extends Overlay {
  constructor() { super('Inventory'); }
  view!: GridView; side!: Phaser.GameObjects.Container;
  create() {
    this.frame(t('inv.title'));
    const r = run();
    const cell = r.grid.cols > 6 || r.grid.rows > 4 ? 66 : 76;
    this.view = new GridView(this, r.grid, { x: 90, y: 130, cell, discard: true, onChange: () => this.refreshSide() });
    darkTxt(this, 90, 650, 'Kéo để di chuyển · Q/E hoặc nút Xoay · Kéo ra ngoài để vứt', 15);
    button(this, 640, 660, 150, 50, t('inv.rotate'), () => this.view.rotate(1), 'wood', { icon: 'btn_rotate', id: 'rotate' });
    this.refreshSide();
    this.input.keyboard?.on('keydown-TAB', () => this.close()); this.input.keyboard?.on('keydown-I', () => this.close()); this.input.keyboard?.on('keydown-ESC', () => this.close());
  }
  refreshSide() {
    this.side?.destroy(); this.side = this.add.container(0, 0);
    const s = statsNow(); const r = run();
    this.side.add(GridView.comboPanel(this, r.grid, 760, 110, 420));
    const lines = [`HP ${Math.ceil(r.hp)}/${s.maxHp}   MP ${Math.ceil(r.mp)}/${s.maxMp}`, `Vật lý ${Math.round(s.physical)} · Lửa ${Math.round(s.fire)} · Băng ${Math.round(s.ice)} · Sét ${Math.round(s.lightning)}`, `Phép ${Math.round(s.magic)} · Thủ ${Math.round(s.defense)}% · Né ${Math.round(s.evasion)}% · Chí mạng ${Math.round(s.critChance)}%`, `Tốc đánh ${Math.round(s.attackSpeed)}% · Tốc chạy ${Math.round(s.moveSpeed)}% · May ${Math.round(s.luck)}`];
    this.side.add(wrapText(this, 760, 470, lines.join('\n'), 420, 15));
    // miracles
    r.miracles.forEach((id, i) => { const m = getMiracle(id); if (!m) return; const ir = iconRef(this, m.icon); this.side.add(this.add.image(780 + i * 40, 590, ir.tex, ir.frame).setDisplaySize(34, 34)); });
  }
}

export class ChoiceScene extends Overlay {
  constructor() { super('Choice'); }
  create() { this.build(); }
  build() {
    this.children.removeAll(true);
    const r = run(); const c = r.choice; if (!c) { this.close(); return; }
    dim(this); title(this, `${t('choice.title')} — ${t(`choice.${c.kind}`)}`, 70);
    c.options.forEach((id, i) => this.cardFor(c.kind, id, 240 + i * 400, 350, i));
    const rr = button(this, 520, 664, 260, 52, `${t('choice.reroll')} (${r.dice})`, () => { if (rerollChoice(r, G.meta, statsNow().luck)) { sfx('magic'); G.logEvent('reroll', { kind: c.kind, locked: c.locked }); this.build(); } }, 'purple', { icon: 'btn_reroll', id: 'reroll' });
    rr.setEnabled(r.dice > 0);
    button(this, 800, 664, 200, 52, t('choice.skip'), () => { skipChoice(r); this.close(); }, 'wood', { id: 'skip' });
    G.logEvent('choiceShown', { kind: c.kind, options: c.options });
  }
  cardFor(kind: string, id: string, x: number, y: number, i: number) {
    const W = 340, H = 440; card(this, x, y, W, H); const r0 = run(); const locked = r0.choice?.locked === i;
    if (locked) { const lg = this.add.graphics(); lg.lineStyle(5, 0xffcb3a, 1).strokeRoundedRect(x - W / 2 - 4, y - H / 2 - 4, W + 8, H + 8, 20); }
    let name = id, desc = '', icon = '', rar = 'common', maxL = 0, tags: string[] = [];
    if (kind === 'artifact') { const a = getArtifact(id)!; name = a.name; desc = itemDesc(id, 0); icon = a.icon; rar = a.rarity; maxL = a.maxLevel; tags = a.tags.map((tg) => getCombo(tg)?.name ?? tg); if (a.constraint) desc += '\n! ' + ({ touchEdge: 'Ràng buộc mép', emptyNeighbor: 'Cần ô trống', cornerOnly: 'Chỉ ở góc', noOtherOfTag: 'Độc nhất' } as any)[a.constraint.kind]; }
    else if (kind === 'tablet') { const tb = getTablet(id)!; name = tb.name; desc = tb.desc; icon = tb.icon; rar = tb.rarity; }
    else if (kind === 'miracle') { const m = getMiracle(id)!; name = m.name; desc = m.desc; icon = m.icon; rar = 'legendary'; }
    else { const u = getUpgrade(id)!; name = u.name; desc = u.desc; icon = `wic_${u.weapon}`; rar = (['common', 'rare', 'epic'] as const)[u.tier - 1]; tags = [`Bậc ${u.tier}`]; }
    const col = RARITY_COLOR[rar];
    const g = this.add.graphics(); g.fillStyle(col, 1).fillRoundedRect(x - W / 2 + 14, y - H / 2 + 14, W - 28, 130, 14).lineStyle(3, PAL.outline, 1).strokeRoundedRect(x - W / 2 + 14, y - H / 2 + 14, W - 28, 130, 14);
    const ir = iconRef(this, icon); this.add.image(x, y - H / 2 + 79, ir.tex, ir.frame).setDisplaySize(104, 104);
    // footprint (polyomino) preview in the header's top-right corner
    const shape = kind === 'artifact' ? getArtifact(id)?.shape : kind === 'tablet' ? getTablet(id)?.shape : undefined;
    if (shape) { const cs = 13; const mx = Math.max(...shape.map((c) => c[0])); const fg = this.add.graphics(); for (const [cx, cy] of shape) fg.fillStyle(PAL.cream, 1).fillRect(x + W / 2 - 30 - (mx + 1) * cs + cx * cs, y - H / 2 + 24 + cy * cs, cs - 2, cs - 2).lineStyle(2, PAL.outline, 1).strokeRect(x + W / 2 - 30 - (mx + 1) * cs + cx * cs, y - H / 2 + 24 + cy * cs, cs - 2, cs - 2); }
    const top = y - H / 2;
    darkTxt(this, x, top + 150, name, 23, { fontStyle: '800', align: 'center', wordWrap: { width: W - 30 } }).setOrigin(0.5, 0);
    darkTxt(this, x - 8, top + 180, t(`rar.${rar}`), 16, { color: RARITY_TEXT[rar], fontStyle: '800' }).setOrigin(1, 0);
    if (maxL) stars(this, x + 6, top + 191, 0, maxL, 12);
    if (tags.length) darkTxt(this, x, top + 202, tags.join(' · '), 14, { color: '#A9531E' }).setOrigin(0.5, 0);
    wrapText(this, x - W / 2 + 18, top + 222, desc, W - 36, 14).setOrigin(0, 0);
    // V2: concrete delta to the current build (power, stats, combo progress) — computed where it would be placed
    try {
      const dl = choiceDelta(r0, G.meta, kind as any, id);
      const box = this.add.graphics(); box.fillStyle(0xf3e3c3, 1).fillRoundedRect(x - W / 2 + 12, top + 290, W - 24, 92, 10).lineStyle(2, PAL.outline, 0.6).strokeRoundedRect(x - W / 2 + 12, top + 290, W - 24, 92, 10);
      const pc = dl.power.pct; const head = `${pc >= 0 ? '▲' : '▼'} Sức mạnh ${pc >= 0 ? '+' : '−'}${Math.abs(pc).toFixed(0)}%`;
      darkTxt(this, x - W / 2 + 22, top + 294, head, 16, { color: pc > 0.5 ? '#3F7A25' : pc < -0.5 ? '#B23A2A' : '#7A4A24', fontStyle: '800' });
      const rest = [...dl.combos.filter((cb) => cb.after !== cb.before).slice(0, 2).map(comboLine), ...dl.stats.slice(0, 3).map((sd) => sd.text)];
      if (dl.placed === 'side') rest.unshift('Túi đầy → vào Túi Phụ (chưa có tác dụng)'); if (dl.placed === 'none') rest.unshift('Túi đầy!');
      wrapText(this, x - W / 2 + 22, top + 314, rest.slice(0, 3).join('\n') || 'Không đổi chỉ số trực tiếp', W - 44, 13, '#5A3A20');
    } catch (err) { G.logEvent('deltaError', { id, err: String(err) }); }
    button(this, x, y + H / 2 - 30, 180, 46, t('choice.take'), () => {
      if (takeChoice(run(), G.meta, i, (rr, iid) => addBest(rr, G.meta, iid))) { sfx('pickup'); G.logEvent('choiceTaken', { kind, id }); G.saveMeta(); this.close(); }
      else { toast(this, t('inv.full'), '#ff7a66'); sfx('deny'); }
    }, 'green', { id: `take${i}` });
    // V2: lock (free, kept on reroll) and banish (1 die, never offered again this run)
    if (kind !== 'miracle') {
      button(this, x - 95, y + H / 2 + 26, 150, 38, locked ? 'Bỏ giữ' : 'Giữ lại', () => { toggleLock(r0, i); sfx('ui'); G.logEvent('choiceLock', { i, id }); this.build(); }, locked ? 'orange' : 'wood', { id: `lock${i}`, size: 17 });
      if (kind !== 'upgrade') { const bb = button(this, x + 95, y + H / 2 + 26, 150, 38, 'Loại (1 xúc xắc)', () => { if (banishOption(r0, G.meta, i, statsNow().luck)) { sfx('deny'); G.logEvent('choiceBanish', { i, id }); this.build(); } }, 'red', { id: `banish${i}`, size: 15 }); bb.setEnabled(r0.dice > 0); }
    }
  }
}

export class ShopScene extends Overlay {
  constructor() { super('Shop'); }
  view!: GridView; list!: Phaser.GameObjects.Container; money!: ReturnType<typeof pill>; enchantMode = false;
  doEnchant(p: { uid: number; id: string }) {
    const r = run(); const c = enchantCost(r, p.uid);
    if (c === null) { sfx('deny'); toast(this, 'Đã đạt cấp tối đa', '#ff7a66'); return; }
    if (!shopEnchant(r, p.uid)) { sfx('deny'); toast(this, `Cần ${c} Hạt Dẻ`, '#ff7a66'); return; }
    sfx('levelup'); G.logEvent('shopEnchant', { id: p.id, cost: c }); toast(this, `${getArtifact(p.id)?.name ?? p.id} +1 cấp (−${c})`, '#a6e070');
    this.enchantMode = false; this.view.o.selectMode = undefined; this.view.redraw(); this.refresh(); G.saveRun();
  }
  create() {
    this.frame(t('shop.title'));
    const r = run();
    this.money = pill(this, 90, 92, 150, 'ic_money', r.money); pill(this, 260, 92, 110, 'ic_dice', r.dice);
    const cell = r.grid.cols > 6 ? 58 : 64;
    this.enchantMode = false;
    this.view = new GridView(this, r.grid, { x: 70, y: 150, cell, onChange: () => this.refresh(), tipExtra: (p) => { if (p.kind !== 'artifact') return null; const c = enchantCost(run(), p.uid); return c === null ? 'Cường hóa: đã tối đa' : `Cường hóa +1: ${c} Hạt Dẻ`; }, sellZone: { x: 70, y: 150 + cell * r.grid.rows + (r.grid.sideUnlocked ? cell + 60 : 20), w: cell * 5, h: 70, onSell: (p) => { const v = sellPrice(itemBasePrice(p.id), statsNow().barter); r.money += v; sfx('coin'); toast(this, `+${v} Hạt Dẻ`, '#ffcb6b'); this.refresh(); } } });
    this.refresh();
  }
  refresh() {
    const r = run(); this.money.set(r.money); this.list?.destroy(); this.list = this.add.container(0, 0);
    const shop = r.shop; if (!shop) return;
    shop.items.forEach((it, i) => {
      const x = 620 + (i % 3) * 200, y = 200 + Math.floor(i / 3) * 230;
      const g = this.add.graphics(); g.fillStyle(it.sold ? 0xd8c8a8 : PAL.creamLo, 1).fillRoundedRect(x - 90, y - 90, 180, 210, 14).lineStyle(3, PAL.outline, 1).strokeRoundedRect(x - 90, y - 90, 180, 210, 14); this.list.add(g);
      const def: any = it.kind === 'artifact' ? getArtifact(it.id) : it.kind === 'tablet' ? getTablet(it.id) : getPotion(it.id);
      const ir = iconRef(this, def?.icon ?? it.id); const im = this.add.image(x, y - 40, ir.tex, ir.frame).setDisplaySize(72, 72); this.list.add(im);
      if (def?.rarity) { const rc = this.add.graphics(); rc.lineStyle(4, RARITY_COLOR[def.rarity], 1).strokeRoundedRect(x - 44, y - 78, 88, 76, 10); this.list.add(rc); }
      this.list.add(darkTxt(this, x, y + 4, def?.name ?? it.id, 16, { fontStyle: '800', align: 'center', wordWrap: { width: 170 } }).setOrigin(0.5, 0));
      if (!it.sold && it.kind !== 'potion') { try { const dl = choiceDelta(r, G.meta, it.kind, it.id); const pc = dl.power.pct; const cl = dl.combos.find((cb) => cb.after > cb.before);
        this.list.add(darkTxt(this, x, y + 27, `${pc >= 0 ? '+' : '−'}${Math.abs(pc).toFixed(0)}% sức mạnh${cl ? `\n${comboLine(cl)}` : ''}`, 12, { color: pc > 0.5 ? '#3F7A25' : '#7A4A24', align: 'center', wordWrap: { width: 170 }, lineSpacing: -2 }).setOrigin(0.5, 0)); } catch { /* preview only */ } }
      else if (!it.sold && it.kind === 'potion') this.list.add(darkTxt(this, x, y + 30, def?.desc ?? '', 12, { color: '#7A4A24', align: 'center', wordWrap: { width: 170 } }).setOrigin(0.5, 0));
      const b = button(this, x, y + 88, 160, 44, it.sold ? t('shop.sold') : `${it.price} Hạt Dẻ`, () => {
        if (buy(r, G.meta, i, (rr, iid) => addBest(rr, G.meta, iid))) { sfx('coin'); G.logEvent('shopBuy', { id: it.id, price: it.price }); this.view.redraw(); this.refresh(); G.saveMeta(); }
        else { sfx('deny'); toast(this, r.money < it.price ? 'Không đủ Hạt Dẻ' : t('inv.full'), '#ff7a66'); }
      }, it.sold ? 'wood' : 'green', { id: `buy${i}` });
      b.setEnabled(!it.sold); this.list.add(b);
    });
    // V2 services: reroll (die, or escalating gold when out of dice), bandage heal (once), enchant an artifact (gold)
    const gold = shopRerollGold(r); const useDie = r.dice > 0;
    const rr = button(this, 1108, 652, 220, 50, useDie ? `${t('shop.reroll')} (1 xúc xắc · còn ${r.dice})` : `${t('shop.reroll')} (${gold} HD)`, () => { const s = statsNow(); if (rerollShop(r, G.meta, s.luck, s.barter)) { sfx('magic'); G.logEvent('shopReroll', { gold: !useDie }); this.refresh(); } else { sfx('deny'); toast(this, 'Không đủ Hạt Dẻ', '#ff7a66'); } }, 'purple', { id: 'shopReroll', size: 18 });
    rr.setEnabled(useDie || r.money >= gold); this.list.add(rr);
    const s0 = statsNow(); const hc = shopHealCost(r);
    const hb = button(this, 640, 652, 220, 50, shop.healed ? 'Đã băng bó' : `Băng bó +${Math.round(ECON.healPct * 100)}% HP (${hc})`, () => { if (shopHeal(r, statsNow().maxHp)) { sfx('levelup'); G.logEvent('shopHeal', { cost: hc }); this.refresh(); } else { sfx('deny'); toast(this, r.hp >= s0.maxHp ? 'HP đã đầy' : 'Không đủ Hạt Dẻ', '#ff7a66'); } }, 'green', { id: 'shopHeal', size: 16 });
    hb.setEnabled(!shop.healed && r.hp < s0.maxHp && r.money >= hc); this.list.add(hb);
    const eb = button(this, 874, 652, 220, 50, this.enchantMode ? 'Chọn cổ vật…' : 'Cường hóa +1 cấp', () => { this.enchantMode = !this.enchantMode; this.view.o.selectMode = this.enchantMode ? (p) => this.doEnchant(p) : undefined; this.refresh(); }, this.enchantMode ? 'orange' : 'wood', { id: 'shopEnchant', size: 17 });
    this.list.add(eb);
    this.list.add(darkTxt(this, 560, 600, this.enchantMode ? 'Bấm một cổ vật trong túi để cường hóa (giá hiện khi rê chuột).' : shop.discount ? `Giảm ${Math.round(shop.discount * 100)}%!` : `${t('shop.sellHint')} · HP ${Math.ceil(r.hp)}/${s0.maxHp}`, 14));
  }
}

export class EnchantScene extends Overlay {
  constructor() { super('Enchant'); }
  left = 1; view!: GridView; info!: Phaser.GameObjects.Text;
  create() {
    this.left = this.data0.times ?? 1;
    this.frame(t('enchant.title'));
    const r = run();
    this.info = darkTxt(this, 760, 140, '', 22, { fontStyle: '800' });
    this.view = new GridView(this, r.grid, { x: 90, y: 130, cell: 72, selectMode: (p) => {
      if (this.left <= 0) return;
      const before = p.level; enchant(r, p.uid, 1);
      if (p.level === before) { sfx('deny'); toast(this, 'Đã đạt cấp tối đa', '#ff7a66'); return; }
      this.left--; sfx('levelup'); G.logEvent('enchant', { id: p.id, level: p.level }); this.view.redraw(); this.upd();
      if (this.left <= 0) this.time.delayedCall(500, () => this.close());
    } });
    wrapText(this, 760, 190, t('enchant.hint') + '. Cường hóa tăng cấp vĩnh viễn (tối đa = số sao).', 400, 17);
    this.upd();
  }
  upd() { this.info.setText(`${t('enchant.left')}: ${this.left}`); }
}

export class MapScene extends Overlay {
  constructor() { super('Map'); }
  private openedAt = 0; private closed = false; private tw: Phaser.Tweens.Tween | null = null;
  /** v2 full-screen floor map (docs/V2_MAP.md): legend, walked path + next choices highlighted, boss foreshadow.
   *  Closes with M / Esc / any tap (a 250 ms guard ignores the press that opened it). */
  create() {
    this.openedAt = this.time.now; this.closed = false; const r = run();
    this.frame(`${t('map.title')} — ${t('chapter')} ${r.chapter}: ${getChapter(r.chapter).name} · ${t('floor')} ${r.floor}`);
    const { pulse } = drawFloorMap(this, r, 'full');
    if (pulse) this.tw = this.tweens.add({ targets: pulse, scale: 1.18, alpha: 0.2, duration: 750, yoyo: true, repeat: -1 });
    drawLegend(this, FULLMAP.legendX, FULLMAP.legendY);
    darkTxt(this, FULLMAP.legendX + 151, 672, t('map.closeHint'), 14, { color: '#7A4A24' }).setOrigin(0.5);
    const ready = () => this.time.now - this.openedAt > 250;
    this.input.keyboard?.on('keydown-M', () => { if (ready()) this.close(); });
    this.input.keyboard?.on('keydown-ESC', () => { if (ready()) this.close(); });
    this.input.on('pointerup', () => { if (ready()) this.close(); });
    this.events.once('shutdown', () => { this.tw?.remove(); this.tw = null; });
  }
  close(result?: any) { if (this.closed) return; this.closed = true; super.close(result); }
}
/** Legacy v1 node map drawing (kept for callers not yet on src/ui/mapView.ts; the v2 map uses drawFloorMap). */
export function drawMap(s: Phaser.Scene, r: RunState, cx: number, cy: number, scale = 1): Phaser.GameObjects.Container {
  const c = s.add.container(cx, cy); const f = r.floorData; const g = s.add.graphics(); c.add(g);
  const P = (col: number, depth: number) => ({ x: (col - 1) * 90 * scale, y: (1 - depth) * 70 * scale });
  const start = { x: 0, y: 140 * scale }, gate = { x: 0, y: -140 * scale };
  g.lineStyle(4 * scale, PAL.woodLo, 1);
  for (const n of f.nodes) { const a = P(n.col, n.depth); if (n.depth === 0) g.lineBetween(start.x, start.y, a.x, a.y); if (n.depth === 2) g.lineBetween(a.x, a.y, gate.x, gate.y); for (const nx of n.next) { const b = P(f.nodes[nx].col, f.nodes[nx].depth); g.lineBetween(a.x, a.y, b.x, b.y); } }
  const dot = (p: { x: number; y: number }, icon: string, cur: boolean, visited: boolean, mod?: string) => {
    g.fillStyle(cur ? PAL.orange : visited ? 0x9c8a70 : PAL.cream, 1).fillCircle(p.x, p.y, 22 * scale).lineStyle(3, PAL.outline, 1).strokeCircle(p.x, p.y, 22 * scale);
    const ir = iconRef(s, icon); c.add(s.add.image(p.x, p.y, ir.tex, ir.frame).setDisplaySize(30 * scale, 30 * scale).setAlpha(visited && !cur ? 0.6 : 1));
    if (mod) { const mr = iconRef(s, mod); c.add(s.add.image(p.x + 16 * scale, p.y + 14 * scale, mr.tex, mr.frame).setDisplaySize(16 * scale, 16 * scale)); }
  };
  dot(start, 'node_start', r.pos === 'start', true);
  for (const n of f.nodes) dot(P(n.col, n.depth), `node_${n.type}`, r.pos === n.id, r.visited.includes(n.id), n.modifier !== 'none' ? `mod_${n.modifier}` : undefined);
  dot(gate, 'node_boss', r.pos === 'gate', false);
  return c;
}

export class PauseScene extends Overlay {
  constructor() { super('Pause'); }
  create() {
    // v2 layout: one centred column on an 8-px rhythm (56 px buttons, 14 px gaps); the card is sized to its rows so it
    // fits the 1280×720 FIT frame at every aspect and the test pack never touches the card edge
    const rows: Array<[string, () => void, 'green' | 'wood' | 'purple' | 'orange' | 'red', string]> = [
      [t('menu.resume'), () => this.close(), 'green', 'resume'],
      [t('map.title'), () => { if (G.training) return; this.scene.stop(); this.scene.launch('Map', { from: this.data0.from }); }, 'wood', 'map'],
      [G.meta.settings.mute ? t('settings.unmute') : t('settings.mute'), () => { G.meta.settings.mute = !G.meta.settings.mute; G.saveMeta(); this.scene.restart(this.data0); }, 'purple', 'mute'],
      [G.training ? t('menu.back') : t('menu.quit'), () => { G.saveRun(); this.toHub(); }, 'orange', 'quit'],
    ];
    if (!G.training) rows.push([t('menu.abandon'), () => { const rs = this.scene.get('Run') as any; this.scene.stop(); this.scene.resume('Run'); if (rs && G.run) { G.run.hp = 0; G.run.dead = true; rs.dieRun(); } }, 'red', 'abandon']);
    const BH = 56, STEP = 70, TEST_H = 46; const H = 80 + rows.length * STEP + 16 + TEST_H + 30; const top = 360 - H / 2;
    dim(this, 0.6); card(this, 640, 360, 460, H); title(this, t('menu.pause'), top + 4);
    rows.forEach(([label, fn, col, id], i) => button(this, 640, top + 80 + BH / 2 + i * STEP, 320, BH, label, fn, col, { id }));
    // Test pack: quick resources for playtesting (v2 test build)
    button(this, 640, top + 80 + rows.length * STEP + 16 + TEST_H / 2 - (STEP - BH), 340, TEST_H, 'Gói Test: +500 HD, +5 xúc xắc, hồi đầy', () => { const r = G.run; if (!r) return; r.money += 500; r.dice += 5; r.hp = runStats(r, G.meta).maxHp; r.mp = 999; G.saveRun(); sfx('levelup'); G.logEvent('testPack', {}); toast(this, '+500 Hạt Dẻ · +5 xúc xắc · hồi đầy', '#9be37a', top - 30 > 60 ? top - 30 : 80); }, 'purple', { id: 'testPack', size: 15 });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }
  toHub() { G.logEvent('quitToHub', {}); this.scene.stop('Run'); this.scene.stop('Hud'); this.scene.stop(); G.run = null; G.training = false; this.scene.start('Hub'); }
}

export class EventScene extends Overlay {
  constructor() { super('Event'); }
  create() {
    const ev: string = this.data0.event; dim(this); card(this, 640, 360, 640, 420); title(this, t(`ev.${ev}`), 190);
    const opts: Array<[string, string, string?]> = [];
    switch (ev) {
      case 'clover': opts.push(['hp', t('ev.clover.hp')], ['def', t('ev.clover.def')]); break;
      case 'merchant': opts.push(['go', t('shop.title')]); break;
      case 'obelisk': opts.push(['go', t('ev.obelisk.touch')]); break;
      case 'fountain': { const f = this.data0.fountain ?? 'green'; opts.push([f, t(`ev.fountain.${f}`)]); break; }
      case 'companion': opts.push(['go', t('ev.companion.pay')]); break;
      case 'blood': opts.push(['pay', t('ev.blood.pay')], ['bat', t('ev.blood.bat')]); break;
      case 'pocket': opts.push(['go', `${t('ev.pocket.pay')} (${G.meta.sapphires} Ngọc)`]); break;
      default: opts.push(['go', 'OK']);
    }
    opts.push(['leave', t('ev.leave')]);
    const art = ({ clover: 'clover', merchant: 'merchant_rat', obelisk: 'obelisk', fountain: `fountain_${this.data0.fountain ?? 'green'}`, companion: 'cmp_sprout', blood: 'blood_altar', pocket: 'pocket_portal' } as Record<string, string>)[ev];
    if (art && MANIFEST[art] && this.textures.exists(art)) { const im = this.add.image(440, 470, art).setOrigin(0.5, 1); const sc = Math.min(150 / im.height, 190 / im.width); im.setScale(sc); }
    wrapText(this, 560, 240, eventText(ev), 380, 17);
    const r = G.run; const maxHp = r ? runStats(r, G.meta).maxHp : 0;
    opts.forEach(([k, label], i) => {
      const yy = 340 + i * 82; button(this, 750, yy, 360, 52, label, () => this.close(k), k === 'leave' ? 'wood' : 'orange', { id: `ev_${k}` });
      // V2: clear stakes — exact cost and reward of this option, computed from the run (obelisk names the real swap)
      if (r && k !== 'leave') { let st = ''; try { st = eventStakes(r, G.meta, ev as any, k, { maxHp }); } catch { st = ''; }
        if (st) darkTxt(this, 750, yy + 30, st, 13, { color: '#7A2E1E', fontStyle: '800', align: 'center', wordWrap: { width: 380 } }).setOrigin(0.5, 0); }
    });
  }
}
function eventText(ev: string) {
  return ({ clover: 'Một cây cỏ bốn lá lấp lánh. Hãy chọn phúc lành.', merchant: 'Thương nhân chuột lang thang bán rẻ hơn 10%.', obelisk: 'Bia đá cổ hoán đổi sức mạnh của bạn một cách ngẫu nhiên.', fountain: 'Đài phun nước kỳ lạ…', companion: 'Một người bạn đồng hành đang chờ được thuê.', blood: 'Bàn thờ đòi máu. Hoặc… đánh con dơi canh giữ.', pocket: 'Một khe nứt dẫn tới không gian túi. Ngọc Sao có thể mở khóa cổ vật vĩnh viễn.' } as any)[ev] ?? '';
}
void discard; void sell; void resolve; void getCombo; void enchant;
