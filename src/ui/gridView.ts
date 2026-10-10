// Interactive inventory grid: drag & drop, rotate, live preview (green/red), stars, tablets' targets, side bag,
// sell/discard zones, tooltip card. Works with mouse and touch.
import Phaser from 'phaser';
import { PAL, RARITY_COLOR, RARITY_TEXT, iconRef } from '../game/assets';
import { sfx } from '../game/audio';
import { txt, darkTxt, card, stars, wrapText, button } from './kit';
import { t } from '../systems/i18n';
import { type Grid, type Placed, resolve, preview, cellsOf, cellsAt, canPlace, place, remove, tabletTargets, rotateShape, shapeOf, type Resolution } from '../systems/inventory';
import { getArtifact, getTablet, getCombo, combos as COMBOS } from '../systems/registry';
import { scaled } from '../systems/effects';
import type { Effect } from '../data/types';
import { G } from '../game/state';

export interface GridViewOpts { x: number; y: number; cell: number; sellZone?: { x: number; y: number; w: number; h: number; onSell: (p: Placed) => void }; discard?: boolean; onChange?: () => void; selectMode?: (p: Placed) => void }
export function effectValue(e: Effect, level: number): number {
  switch (e.kind) {
    case 'stat': case 'onKill': case 'onDash': case 'onHurt': case 'periodic': case 'spell': case 'summon': case 'special': return scaled(e.base, e.perLevel, level);
    case 'onHit': return Math.round(scaled(e.chance, e.perLevel, level) * 100);
    case 'conditional': return effectValue(e.inner, level);
  }
}
export function itemDesc(id: string, level: number): string {
  const a = getArtifact(id); if (a) { const v = a.effects.length ? effectValue(a.effects[0], level) : 0; return a.desc.split('{v}').join(String(Math.round(v * 10) / 10)); }
  return getTablet(id)?.desc ?? '';
}
const CONSTRAINT_VN = (c: any) => !c ? '' : c.kind === 'touchEdge' ? `Phải chạm mép ${({ left: 'trái', right: 'phải', top: 'trên', bottom: 'dưới' } as any)[c.edge]}` : c.kind === 'emptyNeighbor' ? `Ô bên ${({ left: 'trái', right: 'phải', up: 'trên', down: 'dưới' } as any)[c.dir]} phải trống` : c.kind === 'cornerOnly' ? 'Chỉ đặt ở góc túi' : `Không có cổ vật ${getCombo(c.tag)?.name ?? c.tag} khác`;

export class GridView {
  c: Phaser.GameObjects.Container; res!: Resolution; rot = 0;
  drag: { p: Placed; fromSide: number | null; img: Phaser.GameObjects.Container; ox: number; oy: number } | null = null;
  hl: Phaser.GameObjects.Graphics; tip: Phaser.GameObjects.Container | null = null; selected: Placed | null = null;
  constructor(public s: Phaser.Scene, public g: Grid, public o: GridViewOpts) {
    this.c = s.add.container(0, 0); this.hl = s.add.graphics().setDepth(50);
    s.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    s.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    s.input.keyboard?.on('keydown-Q', () => this.rotate(-1)); s.input.keyboard?.on('keydown-E', () => this.rotate(1)); s.input.keyboard?.on('keydown-R', () => this.rotate(1));
    s.input.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.rightButtonDown() && this.drag) this.rotate(1); });
    this.redraw();
  }
  rotate(d: number) { if (!this.drag) return; this.rot = (this.rot + d + 4) % 4; sfx('ui'); this.rebuildDragImg(); this.onMove(this.s.input.activePointer); }
  cellXY(cx: number, cy: number) { return { x: this.o.x + cx * this.o.cell, y: this.o.y + cy * this.o.cell }; }
  sideXY(i: number) { return { x: this.o.x + i * this.o.cell, y: this.o.y + this.g.rows * this.o.cell + 40 }; }
  pointerCell(px: number, py: number) { return { cx: Math.floor((px - this.o.x) / this.o.cell), cy: Math.floor((py - this.o.y) / this.o.cell) }; }
  redraw() {
    this.c.removeAll(true); this.res = resolve(this.g); const C = this.o.cell; const s = this.s;
    // cells
    for (let y = 0; y < this.g.rows; y++) for (let x = 0; x < this.g.cols; x++) this.c.add(this.cellBg(this.o.x + x * C, this.o.y + y * C, C));
    // side bag
    if (this.g.sideUnlocked) {
      this.c.add(txt(s, this.o.x, this.o.y + this.g.rows * C + 8, t('inv.side'), 16));
      for (let i = 0; i < this.g.side.length; i++) { const p = this.sideXY(i); this.c.add(this.cellBg(p.x, p.y, C, 0x6b5644)); }
    }
    for (const p of this.g.items) this.c.add(this.itemImg(p, false));
    this.g.side.forEach((p) => { if (p) this.c.add(this.itemImg(p, true)); });
    if (this.o.sellZone) { const z = this.o.sellZone; const gz = s.add.graphics(); gz.fillStyle(PAL.red, 0.25).fillRoundedRect(z.x, z.y, z.w, z.h, 14).lineStyle(3, PAL.redLip, 1).strokeRoundedRect(z.x, z.y, z.w, z.h, 14); this.c.add(gz); this.c.add(txt(s, z.x + z.w / 2, z.y + z.h / 2, `${t('inv.sell')} Hạt Dẻ`, 22).setOrigin(0.5)); }
  }
  cellBg(x: number, y: number, C: number, col = 0x8a6a4a) {
    if (this.s.textures.exists('ui_cell')) return this.s.add.image(x + C / 2, y + C / 2, 'ui_cell').setDisplaySize(C - 4, C - 4);
    const g = this.s.add.graphics(); g.fillStyle(col, 1).fillRoundedRect(x + 2, y + 2, C - 4, C - 4, 8).fillStyle(0x000000, 0.12).fillRoundedRect(x + 4, y + C - 12, C - 8, 8, 4).lineStyle(2, PAL.outline, 1).strokeRoundedRect(x + 2, y + 2, C - 4, C - 4, 8); return g;
  }
  footprintGfx(id: string, rot: number, color: number, alpha = 1) {
    const C = this.o.cell; const g = this.s.add.graphics();
    for (const [x, y] of rotateShape(shapeOf(id), rot).cells) { g.fillStyle(color, alpha).fillRoundedRect(x * C + 4, y * C + 4, C - 8, C - 8, 10).lineStyle(3, PAL.outline, 1).strokeRoundedRect(x * C + 4, y * C + 4, C - 8, C - 8, 10); }
    return g;
  }
  itemImg(p: Placed, side: boolean): Phaser.GameObjects.Container {
    const s = this.s; const C = this.o.cell; const isArt = p.kind === 'artifact'; const def: any = getArtifact(p.id) ?? getTablet(p.id);
    const pos = side ? this.sideXY(p.x) : this.cellXY(p.x, p.y);
    const rot = side ? 0 : p.rot;
    const c = s.add.container(pos.x, pos.y);
    const st = this.res.arts.get(p.uid);
    const col = isArt ? RARITY_COLOR[def.rarity] : 0xb9a48a;
    const fp = this.footprintGfx(p.id, rot, col, side ? 0.6 : 0.95); c.add(fp);
    const cells = rotateShape(shapeOf(p.id), rot).cells; const mx = Math.max(...cells.map((q) => q[0])) + 1, my = Math.max(...cells.map((q) => q[1])) + 1;
    const r = iconRef(s, def.icon); const ic = s.add.image(mx * C / 2, my * C / 2 - (isArt ? 4 : 0), r.tex, r.frame); const sz = Math.min(mx, my) * C * 0.78; ic.setDisplaySize(sz, sz); c.add(ic);
    if (isArt && st) {
      const lv = st.disabled ? 0 : st.effLevel; c.add(stars(s, mx * C / 2 - (st.maxLevel - 1) * 6, my * C - 12, lv, Math.min(6, st.maxLevel), 11));
      if (!st.active && !side) { ic.setTint(0x777777); fp.setAlpha(0.5); c.add(txt(s, mx * C / 2, 14, st.disabled ? t('inv.disabled') : '!', 12, '#ff7a66').setOrigin(0.5)); }
      if (st.level > st.baseLevel && !side) c.add(txt(s, mx * C - 10, 10, `+${st.level - st.baseLevel}`, 14, '#a6e070').setOrigin(0.5));
      if (st.level < st.baseLevel && !side) c.add(txt(s, mx * C - 10, 10, `${st.level - st.baseLevel}`, 14, '#ff7a66').setOrigin(0.5));
    }
    const hit = s.add.zone(0, 0, mx * C, my * C).setOrigin(0, 0).setInteractive({ useHandCursor: true }); c.add(hit);
    hit.on('pointerdown', (ptr: Phaser.Input.Pointer) => { if (ptr.rightButtonDown()) return; if (this.o.selectMode) { if (!side && isArt) this.o.selectMode(p); return; } this.startDrag(p, side ? p.x : null, ptr); });
    hit.on('pointerover', () => { if (!this.drag) this.showTip(p, pos.x + mx * C + 8, pos.y, side); });
    hit.on('pointerout', () => { if (!this.drag) this.hideTip(); });
    (c as any).placed = p;
    return c;
  }
  startDrag(p: Placed, fromSide: number | null, ptr: Phaser.Input.Pointer) {
    this.hideTip(); this.selected = p; this.rot = fromSide !== null ? 0 : p.rot;
    if (fromSide !== null) this.g.side[fromSide] = null; else remove(this.g, p.uid);
    this.redraw();
    this.drag = { p, fromSide, img: this.s.add.container(ptr.x, ptr.y).setDepth(100), ox: 0, oy: 0 };
    this.rebuildDragImg(); sfx('pickup');
    G.logEvent('invDrag', { id: p.id });
    this.onMove(ptr);
  }
  rebuildDragImg() {
    if (!this.drag) return; const d = this.drag; d.img.removeAll(true); const C = this.o.cell;
    const def: any = getArtifact(d.p.id) ?? getTablet(d.p.id);
    d.img.add(this.footprintGfx(d.p.id, this.rot, d.p.kind === 'artifact' ? RARITY_COLOR[def.rarity] : 0xb9a48a, 0.8));
    const r = iconRef(this.s, def.icon); d.img.add(this.s.add.image(C / 2, C / 2, r.tex, r.frame).setDisplaySize(C * 0.75, C * 0.75));
    d.img.setPosition(this.s.input.activePointer.x - C / 2, this.s.input.activePointer.y - C / 2);
  }
  dropCell(px: number, py: number) { const C = this.o.cell; return this.pointerCell(px - C / 2 + C / 2, py - C / 2 + C / 2); }
  onMove(ptr: Phaser.Input.Pointer) {
    this.hl.clear(); if (!this.drag) return; const C = this.o.cell; const d = this.drag;
    d.img.setPosition(ptr.x - C / 2, ptr.y - C / 2);
    const { cx, cy } = this.pointerCell(ptr.x, ptr.y);
    if (cx < -1 || cy < -1 || cx > this.g.cols || cy > this.g.rows) return;
    const pv = preview(this.g, d.p.id, cx, cy, this.rot);
    for (const m of pv.marks) if (m.x >= 0 && m.y >= 0 && m.x < this.g.cols && m.y < this.g.rows) this.hl.fillStyle(m.ok ? 0x7cc44e : 0xe2483d, 0.45).fillRoundedRect(this.o.x + m.x * C + 3, this.o.y + m.y * C + 3, C - 6, C - 6, 8);
    for (const [tx, ty] of pv.targets) if (tx >= 0 && ty >= 0 && tx < this.g.cols && ty < this.g.rows) this.hl.lineStyle(3, 0xffcb6b, 1).strokeRoundedRect(this.o.x + tx * C + 6, this.o.y + ty * C + 6, C - 12, C - 12, 8);
    for (const ch of pv.changes) { const it = this.g.items.find((i) => i.uid === ch.uid); if (!it) continue; const good = ch.dLevel > 0 || (ch.nowActive && !ch.wasActive); for (const [x, y] of cellsOf(it)) this.hl.lineStyle(4, good ? 0x7cf07c : 0xff5040, 1).strokeRoundedRect(this.o.x + x * C + 2, this.o.y + y * C + 2, C - 4, C - 4, 8); }
  }
  inZone(z: { x: number; y: number; w: number; h: number } | undefined, px: number, py: number) { return !!z && px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h; }
  onUp(ptr: Phaser.Input.Pointer) {
    if (!this.drag) return; const d = this.drag; this.drag = null; d.img.destroy(); this.hl.clear();
    const C = this.o.cell; const { cx, cy } = this.pointerCell(ptr.x, ptr.y);
    let done = false;
    if (canPlace(this.g, d.p.id, cx, cy, this.rot)) { const np = place(this.g, d.p.id, cx, cy, this.rot, d.p.level); if (np) { np.uid = d.p.uid; done = true; sfx('pickup'); G.logEvent('invPlace', { id: d.p.id, x: cx, y: cy, rot: this.rot }); } }
    else if (this.o.sellZone && this.inZone(this.o.sellZone, ptr.x, ptr.y)) { this.o.sellZone.onSell(d.p); done = true; G.logEvent('invSell', { id: d.p.id }); }
    else if (this.g.sideUnlocked) {
      const si = Math.floor((ptr.x - this.o.x) / C); const sy = this.o.y + this.g.rows * C + 40;
      if (ptr.y >= sy && ptr.y <= sy + C && si >= 0 && si < this.g.side.length && !this.g.side[si]) { this.g.side[si] = { ...d.p, x: si, y: 0, rot: 0 }; done = true; G.logEvent('invSide', { id: d.p.id }); }
    }
    if (!done && this.o.discard && (ptr.x < this.o.x - 40 || ptr.y > 700)) { done = true; G.logEvent('invDiscard', { id: d.p.id }); sfx('deny'); }
    if (!done) { // revert
      if (d.fromSide !== null) this.g.side[d.fromSide] = d.p; else this.g.items.push(d.p);
    }
    this.redraw(); this.o.onChange?.();
  }
  showTip(p: Placed, x: number, y: number, side: boolean) {
    this.hideTip(); const s = this.s; const art = getArtifact(p.id); const tab = getTablet(p.id); const st = this.res.arts.get(p.uid);
    const W = 260; const gx = this.o.x + this.g.cols * this.o.cell + 16; const beside = gx + W <= 752; // between the grid and the combo panel (x≥760)
    const xx = beside ? gx : Math.min(x, 1270 - W), yy = beside ? Math.max(this.o.y, Math.min(y - 40, 420)) : Math.min(y, 420);
    const c = s.add.container(xx, yy).setDepth(200); this.tip = c;
    const def: any = art ?? tab; const lines: string[] = [];
    const lvl = st ? st.effLevel : p.level;
    c.add(card(s, 0, 0, W, 230, 'topleft'));
    c.add(darkTxt(s, 14, 10, def.name, 22, { fontStyle: '800' }));
    c.add(darkTxt(s, 14, 38, t(`rar.${def.rarity}`), 16, { color: RARITY_TEXT[def.rarity], fontStyle: '800' }));
    if (art) { c.add(stars(s, 120, 50, lvl, art.maxLevel, 13)); lines.push(art.tags.map((tg) => getCombo(tg)?.name ?? tg).join(' · ')); }
    lines.push(itemDesc(p.id, lvl));
    if (art?.constraint) lines.push((st && !st.constraintOk && !st.ignoreConstraint ? '✗ ' : '✓ ') + CONSTRAINT_VN(art.constraint));
    if (st?.disabled) lines.push(`! ${t('inv.disabled')} (cấp ${st.level})`);
    else if (st && !st.active) lines.push(`! ${t('inv.inactive')}`);
    if (side) lines.push(`(${t('inv.side')})`);
    if (st?.copies.length) lines.push(`Sao chép: ${st.copies.map((cid) => getArtifact(cid)?.name).join(', ')}`);
    c.add(wrapText(s, 14, 66, lines.join('\n'), W - 28, 15));
    // show tablet targets on hover
    if (tab && !side) { this.hl.clear(); for (const tt of tabletTargets(p)) { const [tx, ty] = tt.cell; if (tx >= 0 && ty >= 0 && tx < this.g.cols && ty < this.g.rows) this.hl.lineStyle(3, tt.op.op === 'level' && (tt.op as any).amount < 0 ? 0xff5040 : 0xffcb6b, 1).strokeRoundedRect(this.o.x + tx * this.o.cell + 6, this.o.y + ty * this.o.cell + 6, this.o.cell - 12, this.o.cell - 12, 8); } }
  }
  hideTip() { this.tip?.destroy(); this.tip = null; if (!this.drag) this.hl.clear(); }
  /** combos side panel */
  static comboPanel(s: Phaser.Scene, g: Grid, x: number, y: number, w: number): Phaser.GameObjects.Container {
    const c = s.add.container(x, y); const res = resolve(g);
    c.add(darkTxt(s, 0, 0, t('inv.combos'), 22, { fontStyle: '800' }));
    let yy = 34;
    for (const cd of COMBOS) {
      const n = res.comboCounts[cd.id] ?? 0; if (!n) continue;
      const act = res.activeCombos.find((a) => a.id === cd.id);
      const r = iconRef(s, cd.icon); c.add(s.add.image(14, yy + 12, r.tex, r.frame).setDisplaySize(26, 26));
      const thr = cd.tiers.map((tt) => tt.count).join('/');
      c.add(darkTxt(s, 34, yy, `${cd.name}  ${n} (${thr})${act ? `  ★${act.tier}` : ''}`, 16, { color: act ? '#3F7A25' : '#7A4A24', fontStyle: act ? '800' : '700' }));
      if (act) { c.add(wrapText(s, 34, yy + 20, cd.tiers[act.tier - 1].text, w - 40, 13, '#A9531E')); yy += 20; }
      yy += 30; if (yy > 430) break;
    }
    if (yy === 34) c.add(wrapText(s, 0, yy, 'Chưa có bộ nào. Gom 2+ cổ vật cùng bộ để kích hoạt.', w, 14, '#7A4A24'));
    return c;
  }
}
void cellsAt; void button;
