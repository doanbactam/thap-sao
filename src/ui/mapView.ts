// v2 floor map views (docs/V2_MAP.md): the compact, collapsible HUD mini-map and the full-screen map drawing.
// Geometry lives in src/ui/layout.ts; per-node state (current / cleared / reachable / ahead / skipped) comes from the pure
// floorgen.mapView so the rules are unit-tested.
import Phaser from 'phaser';
import { PAL, iconRef } from '../game/assets';
import { txt, darkTxt } from './kit';
import { t } from '../systems/i18n';
import { getChapter, getBoss } from '../systems/registry';
import { mapView, bossForeshadow, type NodeState, type MapNode } from '../systems/floorgen';
import type { RunState } from '../systems/run';
import type { Insets } from './hudLayout';
import { MINIMAP, MINIMAP_COLLAPSED, MINIMAP_TOGGLE, MINI, FULLMAP, miniNodePos, miniGatePos, fullNodePos, fullGatePos, fullStartPos } from './layout';

type Pt = { x: number; y: number };
export const MAP_COLORS = {
  current: PAL.orange, cleared: 0x9c8a70, reachable: PAL.cream, ahead: PAL.creamLo, skipped: 0x5a4a3c,
  ringReach: 0xffd34d, ringCurrent: 0xfff3b0, path: PAL.orange, next: 0xffd34d, edge: PAL.woodLo, elite: PAL.red, boss: PAL.redLo, gate: PAL.wood, check: PAL.green,
} as const;
const FILL: Record<NodeState, number> = { current: MAP_COLORS.current, cleared: MAP_COLORS.cleared, reachable: MAP_COLORS.reachable, ahead: MAP_COLORS.ahead, skipped: MAP_COLORS.skipped };
const ICON_ALPHA: Record<NodeState, number> = { current: 1, cleared: 0.55, reachable: 1, ahead: 0.9, skipped: 0.3 };

interface Geo { mode: 'mini' | 'full'; node: (c: number, d: number) => Pt; gate: Pt; start: Pt | null; r: number; gateR: number; edgeW: number; s: number }
const geo = (mode: 'mini' | 'full'): Geo => mode === 'mini'
  ? { mode, node: miniNodePos, gate: miniGatePos(), start: null, r: MINI.r, gateR: MINI.gateR, edgeW: 2, s: MINI.r / FULLMAP.r }
  : { mode, node: fullNodePos, gate: fullGatePos(), start: fullStartPos(), r: FULLMAP.r, gateR: FULLMAP.gateR, edgeW: 5, s: 1 };

/** Stable key of everything the map shows (redraw only when it changes). */
export const mapKey = (r: RunState) => `${r.chapter}-${r.floor}-${r.floorData?.seed}-${r.pos}-${r.visited.join('.')}-${r.roomCleared ? 1 : 0}`;

/**
 * Draws the floor's node graph into a container in screen coordinates. Returns the container and the ring of the
 * current room (the caller may pulse it).
 */
export function drawFloorMap(s: Phaser.Scene, r: RunState, mode: 'mini' | 'full'): { c: Phaser.GameObjects.Container; pulse: Phaser.GameObjects.Arc | null } {
  const c = s.add.container(0, 0); const f = r.floorData; const G = geo(mode); const v = mapView(f, r.pos, r.visited, r.roomCleared);
  const g = s.add.graphics(); c.add(g);
  const P = (n: MapNode) => G.node(n.col, n.depth);
  const posOf = (id: number | 'start' | 'gate'): Pt | null => id === 'start' ? G.start : id === 'gate' ? G.gate : P(f.nodes[id]);
  // ---- edges: base (dim when a skipped room is involved), next choices (gold), walked path (orange, on top)
  const line = (a: Pt, b: Pt, w: number, col: number, al: number) => g.lineStyle(w, col, al).lineBetween(a.x, a.y, b.x, b.y);
  const live = (st: NodeState) => st !== 'skipped';
  const edges: Array<[number | 'start', number | 'gate']> = [];
  for (const n of f.nodes) { if (n.depth === 0) edges.push(['start', n.id]); if (n.depth === 2) edges.push([n.id, 'gate']); for (const x of n.next) edges.push([n.id, x]); }
  const stateOf = (id: number | 'start' | 'gate'): NodeState => id === 'start' ? 'cleared' : id === 'gate' ? (v.gate === 'current' ? 'current' : 'ahead') : v.nodes[id];
  const outline = PAL.outline;
  for (const [a, b] of edges) {
    const pa = posOf(a), pb = posOf(b); if (!pa || !pb) continue;
    const dim = !live(stateOf(a)) || !live(stateOf(b));
    line(pa, pb, G.edgeW + (mode === 'full' ? 3 : 1.5), outline, dim ? 0.15 : 0.55);
    line(pa, pb, G.edgeW, MAP_COLORS.edge, dim ? 0.25 : 1);
  }
  const from = r.pos === 'gate' ? null : r.pos;
  if (from !== null) for (const nx of v.nextIds) { const pa = posOf(from), pb = posOf(nx); if (pa && pb) line(pa, pb, G.edgeW + (mode === 'full' ? 2 : 1), MAP_COLORS.next, 1); }
  for (const [a, b] of v.path) { const pa = posOf(a), pb = posOf(b); if (pa && pb) line(pa, pb, G.edgeW + (mode === 'full' ? 3 : 1.5), MAP_COLORS.path, 1); }
  // ---- nodes
  let pulse: Phaser.GameObjects.Arc | null = null;
  const node = (p: Pt, icon: string, st: NodeState, rad: number, opts: { mod?: string; fill?: number; check?: boolean; label?: string } = {}) => {
    const fill = opts.fill ?? FILL[st];
    if (st === 'reachable') g.fillStyle(MAP_COLORS.ringReach, 0.35).fillCircle(p.x, p.y, rad * 1.45);
    g.fillStyle(fill, 1).fillCircle(p.x, p.y, rad).lineStyle(mode === 'full' ? 4 : 2, outline, 1).strokeCircle(p.x, p.y, rad);
    if (st === 'reachable') g.lineStyle(mode === 'full' ? 4 : 2.5, MAP_COLORS.ringReach, 1).strokeCircle(p.x, p.y, rad + (mode === 'full' ? 5 : 2.5));
    if (opts.mod === 'mod_miniboss') g.lineStyle(mode === 'full' ? 4 : 2, MAP_COLORS.elite, st === 'skipped' ? 0.4 : 1).strokeCircle(p.x, p.y, rad - (mode === 'full' ? 4 : 2));
    const ir = iconRef(s, icon); c.add(s.add.image(p.x, p.y, ir.tex, ir.frame).setDisplaySize(rad * 1.45, rad * 1.45).setAlpha(ICON_ALPHA[st]));
    if (opts.mod) { const mr = iconRef(s, opts.mod); const bs = mode === 'full' ? 26 : 11; c.add(s.add.image(p.x + rad * 0.78, p.y + rad * 0.68, mr.tex, mr.frame).setDisplaySize(bs, bs).setAlpha(st === 'skipped' ? 0.45 : 1)); }
    if (opts.check) { const cr = mode === 'full' ? 11 : 5; const cx = p.x - rad * 0.75, cy = p.y - rad * 0.7; g.fillStyle(MAP_COLORS.check, 1).fillCircle(cx, cy, cr).lineStyle(mode === 'full' ? 2 : 1, outline, 1).strokeCircle(cx, cy, cr)
      .lineStyle(mode === 'full' ? 3 : 1.5, 0xffffff, 1).beginPath().moveTo(cx - cr * 0.5, cy).lineTo(cx - cr * 0.1, cy + cr * 0.45).lineTo(cx + cr * 0.55, cy - cr * 0.45).strokePath(); }
    if (st === 'current') { const ring = s.add.circle(p.x, p.y, rad + (mode === 'full' ? 6 : 3)).setStrokeStyle(mode === 'full' ? 4 : 2, MAP_COLORS.ringCurrent, 1); c.add(ring); pulse = ring; }
    if (opts.label && mode === 'full') c.add(darkTxt(s, p.x, p.y + rad + 6, opts.label, 15, st === 'skipped' ? { color: '#a8977f' } : st === 'reachable' || st === 'current' ? { fontStyle: '800' } : {}).setOrigin(0.5, 0));
  };
  if (G.start) node(G.start, 'node_start', v.start === 'current' ? 'current' : 'cleared', G.r * 0.8, { check: v.start !== 'current', label: t('map.start') });
  for (const n of f.nodes) {
    const st = v.nodes[n.id];
    node(P(n), `node_${n.type}`, st, G.r, { mod: n.modifier !== 'none' ? `mod_${n.modifier}` : undefined, check: st === 'cleared' || (st === 'current' && v.currentCleared), label: t(`node.${n.type}`) });
  }
  // ---- gate / boss (foreshadowed from the first room)
  const fs = bossForeshadow(f); const gb = getBoss(fs.gateBossId);
  const gst: NodeState = v.gate === 'current' ? 'current' : v.gate === 'reachable' ? 'reachable' : 'ahead';
  node(G.gate, 'node_boss', gst, G.gateR, { fill: gst === 'current' ? MAP_COLORS.current : fs.gate === 'boss' ? MAP_COLORS.boss : MAP_COLORS.gate });
  if (mode === 'full') {
    const lx = G.gate.x + G.gateR + 18;
    c.add(darkTxt(s, lx, G.gate.y - 22, `${fs.gate === 'boss' ? t('map.boss') : t('map.gate')}: ${gb?.name ?? fs.gateBossId}`, 21, { color: fs.gate === 'boss' ? '#B02A22' : '#A9531E', fontStyle: '800' }).setOrigin(0, 0.5));
    if (gb?.title) c.add(darkTxt(s, lx, G.gate.y + 2, gb.title, 14, { color: '#7A4A24' }).setOrigin(0, 0.5));
    if (fs.gate !== 'boss') { const cb = getBoss(fs.chapterBossId); c.add(darkTxt(s, lx, G.gate.y + 24, `${t('map.chapterBoss')}: ${cb?.name ?? fs.chapterBossId}`, 14, { color: '#8E2420' }).setOrigin(0, 0.5)); }
  }
  return { c, pulse };
}

/** Legend for the full map: room states, modifiers and every room type with its icon. */
export function drawLegend(s: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = s.add.container(0, 0); const g = s.add.graphics(); c.add(g);
  g.fillStyle(PAL.pill, 0.9).fillRoundedRect(x - 14, y - 14, 330, 520, 16).lineStyle(3, PAL.outline, 1).strokeRoundedRect(x - 14, y - 14, 330, 520, 16);
  c.add(txt(s, x, y, t('map.legend'), 20, '#ffcb6b'));
  let yy = y + 40; const row = 29;
  const dot = (fill: number, ring?: number, extra?: (cx: number, cy: number) => void) => { const cx = x + 12, cy = yy + 10; if (ring === MAP_COLORS.ringReach) g.fillStyle(ring, 0.35).fillCircle(cx, cy, 15); g.fillStyle(fill, 1).fillCircle(cx, cy, 10).lineStyle(2, PAL.outline, 1).strokeCircle(cx, cy, 10); if (ring) g.lineStyle(2.5, ring, 1).strokeCircle(cx, cy, 13); extra?.(cx, cy); };
  const label = (str: string) => { c.add(txt(s, x + 34, yy + 10, str, 14, '#fff4dc').setOrigin(0, 0.5)); yy += row; };
  dot(MAP_COLORS.current, MAP_COLORS.ringCurrent); label(t('map.you'));
  dot(MAP_COLORS.cleared, undefined, (cx, cy) => g.fillStyle(MAP_COLORS.check, 1).fillCircle(cx - 8, cy - 7, 5)); label(t('map.cleared'));
  dot(MAP_COLORS.reachable, MAP_COLORS.ringReach); label(t('map.reachable'));
  dot(MAP_COLORS.ahead); label(t('map.ahead'));
  dot(MAP_COLORS.skipped); label(t('map.skipped'));
  g.lineStyle(5, MAP_COLORS.path, 1).lineBetween(x, yy + 10, x + 24, yy + 10); label(t('map.path'));
  for (const [ic, key] of [['mod_miniboss', 'map.elite'], ['mod_derangement', 'map.derange']] as const) { const ir = iconRef(s, ic); c.add(s.add.image(x + 12, yy + 10, ir.tex, ir.frame).setDisplaySize(24, 24)); label(t(key)); }
  yy += 6; c.add(txt(s, x, yy, t('map.rooms'), 16, '#ffcb6b')); yy += 28;
  const types = ['artifact', 'tablet', 'enchant', 'anvil', 'levelup', 'money', 'dice', 'heart', 'shop', 'roots'];
  const items: Array<[string, string]> = [...types.map((tp) => [`node_${tp}`, t(`node.${tp}`)] as [string, string]), ['node_boss', t('map.boss')]];
  items.forEach(([ic, name], i) => { const col = i % 2, rw = Math.floor(i / 2); const px = x + col * 152, py = yy + rw * 30; const ir = iconRef(s, ic); c.add(s.add.image(px + 12, py + 10, ir.tex, ir.frame).setDisplaySize(24, 24)); c.add(txt(s, px + 30, py + 10, name, 14, '#fff4dc').setOrigin(0, 0.5)); });
  return c;
}

const PREF_KEY = 'thapsao.minimapCollapsed';
const readPref = () => { try { return typeof localStorage !== 'undefined' && localStorage.getItem(PREF_KEY) === '1'; } catch { return false; } };
const writePref = (v: boolean) => { try { localStorage.setItem(PREF_KEY, v ? '1' : '0'); } catch { /* storage unavailable */ } };

/**
 * HUD mini-map: compact panel in the top wall band (layout.MINIMAP), collapsible to a chip (MINIMAP_COLLAPSED).
 * Tap the panel → full map; tap the corner toggle → collapse; tap the chip → expand. Collapsed state persists.
 * Usage (HudScene): `this.minimap = new Minimap(this, () => openOverlay(this.scene.get('Run'), 'Map', {}))`, then
 * `this.minimap.update(G.run, G.training)` every frame (redraws only on change).
 */
export class Minimap {
  c: Phaser.GameObjects.Container | null = null; key = ''; collapsed = readPref(); private tw: Phaser.Tweens.Tween | null = null;
  /** `insets` = safe-area insets in logical px (src/ui/safeArea.ts safeInsets); the whole panel shifts left by ins.r and
   *  down by ins.t so it matches hudLayout.minimapRect (where the HUD stacks pause / music / bag around it). */
  constructor(public scene: Phaser.Scene, public openFull: () => void, public insets: () => Insets = () => ({ l: 0, t: 0, r: 0, b: 0 })) {}
  private off() { const i = this.insets(); return { x: -(i.r || 0), y: i.t || 0 }; }
  update(r: RunState | null, training: boolean) {
    const o = this.off();
    const key = !r || training ? 'none' : `${mapKey(r)}-${this.collapsed ? 1 : 0}-${o.x},${o.y}`;
    if (key === this.key) return; this.key = key; this.clear();
    if (!r || training || !r.floorData) return;
    this.c = this.collapsed ? this.drawChip(r) : this.drawPanel(r);
    this.c.setPosition(o.x, o.y); // container transform also moves the hit zones
  }
  setCollapsed(v: boolean) { this.collapsed = v; writePref(v); this.key = ''; }
  /** current visible rect (for probes / layout checks) */
  rect() { if (this.key === 'none' || !this.key) return null; const b = this.collapsed ? MINIMAP_COLLAPSED : MINIMAP; const o = this.off(); return { ...b, x: b.x + o.x, y: b.y + o.y }; }
  clear() { this.tw?.remove(); this.tw = null; this.c?.destroy(); this.c = null; }
  destroy() { this.clear(); this.key = ''; }
  private zone(x: number, y: number, w: number, h: number, cb: () => void, padW = w, padH = h) {
    const z = this.scene.add.zone(x + w / 2, y + h / 2, Math.max(w, padW), Math.max(h, padH)).setInteractive({ useHandCursor: true });
    z.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 30) cb(); }); return z;
  }
  private title(r: RunState) { return `${getChapter(r.chapter).name.toUpperCase()} ${r.chapter}-${r.floor}`; }
  private drawPanel(r: RunState) {
    const s = this.scene; const c = s.add.container(0, 0).setDepth(20); const R = MINIMAP;
    const bg = s.add.graphics(); bg.fillStyle(0x1d120b, 0.86).fillRoundedRect(R.x, R.y, R.w, R.h, 12).lineStyle(2, PAL.outline, 1).strokeRoundedRect(R.x, R.y, R.w, R.h, 12); c.add(bg);
    c.add(this.zone(R.x, R.y, R.w - 34, R.h, () => this.openFull())); // body → full map (toggle corner excluded)
    const tt = txt(s, R.x + 10, MINI.titleY, this.title(r), 13, '#ffe7b0').setOrigin(0, 0.5); c.add(tt);
    if (tt.width > R.w - 46) tt.setScale((R.w - 46) / tt.width);
    const { c: m, pulse } = drawFloorMap(s, r, 'mini'); c.add(m);
    if (pulse) this.tw = s.tweens.add({ targets: pulse, scale: 1.35, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });
    const T = MINIMAP_TOGGLE; const tg = s.add.graphics(); tg.fillStyle(PAL.woodLo, 1).fillRoundedRect(T.x, T.y, T.w, T.h, 6).lineStyle(2, PAL.outline, 1).strokeRoundedRect(T.x, T.y, T.w, T.h, 6)
      .lineStyle(3, 0xfff4dc, 1).lineBetween(T.x + 7, T.y + T.h / 2, T.x + T.w - 7, T.y + T.h / 2); c.add(tg);
    c.add(this.zone(T.x, T.y, T.w, T.h, () => this.setCollapsed(true), 44, 40));
    return c;
  }
  private drawChip(r: RunState) {
    const s = this.scene; const c = s.add.container(0, 0).setDepth(20); const R = MINIMAP_COLLAPSED;
    const bg = s.add.graphics(); bg.fillStyle(0x1d120b, 0.86).fillRoundedRect(R.x, R.y, R.w, R.h, 12).lineStyle(2, PAL.outline, 1).strokeRoundedRect(R.x, R.y, R.w, R.h, 12); c.add(bg);
    const ir = iconRef(s, 'btn_map'); c.add(s.add.image(R.x + R.w / 2, R.y + 22, ir.tex, ir.frame).setDisplaySize(30, 30));
    c.add(txt(s, R.x + R.w / 2, R.y + R.h - 10, `${r.chapter}-${r.floor}`, 13, '#ffe7b0').setOrigin(0.5));
    c.add(this.zone(R.x, R.y, R.w, R.h, () => this.setCollapsed(false), 96, 72));
    return c;
  }
}
