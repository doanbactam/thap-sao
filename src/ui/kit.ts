// UI kit in the reference style: cream cards, orange rounded buttons, dark pills, Baloo 2, outline #3B2416.
import Phaser from 'phaser';
import { PAL, FONT, MANIFEST, iconRef } from '../game/assets';
import { sfx, unlockAudio } from '../game/audio';

export type BtnColor = 'orange' | 'green' | 'red' | 'wood' | 'purple';
const BTN: Record<BtnColor, [number, number, number, number]> = {
  orange: [PAL.orange, PAL.orangeHi, PAL.orangeLo, PAL.orangeLip], green: [PAL.green, PAL.greenHi, PAL.greenLo, PAL.greenLip],
  red: [PAL.red, PAL.redHi, PAL.redLo, PAL.redLip], wood: [PAL.wood, PAL.woodHi, PAL.woodLo, PAL.woodLip], purple: [PAL.purple, PAL.purpleHi, PAL.purpleLo, PAL.purpleLip],
};
export function txt(s: Phaser.Scene, x: number, y: number, str: string, size = 22, color = '#ffffff', stroke = true, opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) {
  const t = s.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '800', color, stroke: stroke ? '#3B2416' : undefined, strokeThickness: stroke ? Math.max(3, Math.round(size / 7)) : 0, ...opts });
  return t;
}
export const darkTxt = (s: Phaser.Scene, x: number, y: number, str: string, size = 18, opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) => txt(s, x, y, str, size, '#3B2416', false, { fontStyle: '700', ...opts });

function nine(s: Phaser.Scene, key: string, x: number, y: number, w: number, h: number) {
  const e = MANIFEST[key]; if (!e || !s.textures.exists(key)) return null;
  const n = e.nine ?? [16, 16, 16, 16];
  return s.add.nineslice(x, y, key, undefined, w, h, n[0], n[1], n[2], n[3]);
}
export function drawBtnBg(g: Phaser.GameObjects.Graphics, w: number, h: number, color: BtnColor, pressed = false) {
  const [face, hi, lo, lip] = BTN[color]; const r = Math.min(16, h / 2.4); const off = pressed ? 3 : 0;
  g.clear();
  g.fillStyle(0x281808, 0.35).fillRoundedRect(-w / 2 + 2, -h / 2 + 6, w, h, r);
  g.fillStyle(lip, 1).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, r);
  g.fillStyle(lo, 1).fillRoundedRect(-w / 2, -h / 2 + off, w, h - 4, r);
  g.fillStyle(face, 1).fillRoundedRect(-w / 2 + 3, -h / 2 + off + 2, w - 6, h * 0.62, r * 0.8);
  g.fillStyle(hi, 0.9).fillRoundedRect(-w / 2 + 8, -h / 2 + off + 4, w - 16, Math.max(3, h * 0.14), 4);
  g.lineStyle(3, PAL.outline, 1).strokeRoundedRect(-w / 2, -h / 2 + off, w, h - 4 + (pressed ? 0 : 4), r);
}
export interface Btn extends Phaser.GameObjects.Container { label: Phaser.GameObjects.Text; setEnabled(b: boolean): Btn; btnId: string; enabled: boolean }
export const BUTTONS = new Set<Btn>();
export function button(s: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, onClick: () => void, color: BtnColor = 'orange', opts: { icon?: string; size?: number; id?: string } = {}): Btn {
  const c = s.add.container(x, y) as Btn;
  const key = `ui_btn_${color}`;
  const ns = nine(s, key, 0, 0, w, h);
  const g = s.add.graphics(); if (!ns) drawBtnBg(g, w, h, color); else c.add(ns);
  c.add(g);
  let lx = 0;
  if (opts.icon) { const r = iconRef(s, opts.icon); const ic = s.add.image(label ? -w / 2 + h / 2 + 4 : 0, -2, r.tex, r.frame); ic.setDisplaySize(h * 0.62, h * 0.62); c.add(ic); if (label) lx = h * 0.3; }
  const t = txt(s, lx, -2, label, opts.size ?? Math.min(26, Math.round(h * 0.42))).setOrigin(0.5); c.add(t); c.label = t;
  c.setSize(w, h); c.btnId = opts.id ?? label; c.enabled = true;
  c.setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => { if (!c.enabled) return; unlockAudio(); if (!ns) drawBtnBg(g, w, h, color, true); t.y = 1; });
  c.on('pointerout', () => { if (!ns) drawBtnBg(g, w, h, color); t.y = -2; });
  c.on('pointerup', () => { if (!c.enabled) { sfx('deny'); return; } if (!ns) drawBtnBg(g, w, h, color); t.y = -2; sfx('ui'); onClick(); });
  c.setEnabled = (b: boolean) => { c.enabled = b; c.setAlpha(b ? 1 : 0.5); return c; };
  BUTTONS.add(c); c.once('destroy', () => BUTTONS.delete(c));
  return c;
}
export function card(s: Phaser.Scene, x: number, y: number, w: number, h: number, origin: 'center' | 'topleft' = 'center') {
  const ox = origin === 'center' ? -w / 2 : 0, oy = origin === 'center' ? -h / 2 : 0;
  const ns = nine(s, 'ui_card_cream', x + ox + w / 2, y + oy + h / 2, w, h); if (ns) return ns;
  const g = s.add.graphics({ x, y });
  g.fillStyle(0x281808, 0.3).fillRoundedRect(ox + 3, oy + 7, w, h, 18);
  g.fillStyle(PAL.creamLip, 1).fillRoundedRect(ox, oy + 4, w, h, 18);
  g.fillStyle(PAL.cream, 1).fillRoundedRect(ox, oy, w, h - 2, 18);
  g.fillStyle(PAL.creamLo, 1).fillRoundedRect(ox + 6, oy + h - 16, w - 12, 8, 4);
  g.lineStyle(3, PAL.outline, 1).strokeRoundedRect(ox, oy, w, h + 2, 18);
  return g;
}
export function darkPanel(s: Phaser.Scene, x: number, y: number, w: number, h: number, alpha = 0.92) {
  const ns = nine(s, 'ui_panel_dark', x + w / 2, y + h / 2, w, h); if (ns) return ns;
  const g = s.add.graphics({ x, y }); g.fillStyle(PAL.pill, alpha).fillRoundedRect(0, 0, w, h, 14); g.lineStyle(3, PAL.outline, 1).strokeRoundedRect(0, 0, w, h, 14); return g;
}
export interface Pill extends Phaser.GameObjects.Container { value: Phaser.GameObjects.Text; set(v: string | number): void }
export function pill(s: Phaser.Scene, x: number, y: number, w: number, icon: string, value: string | number): Pill {
  const c = s.add.container(x, y) as Pill; const h = 36;
  const ns = nine(s, 'ui_pill_dark', w / 2, 0, w, h);
  if (ns) c.add(ns); else { const g = s.add.graphics(); g.fillStyle(0x281808, 0.43).fillRoundedRect(2, -h / 2 + 4, w, h, h / 2); g.fillStyle(PAL.pill, 1).fillRoundedRect(0, -h / 2, w, h, h / 2); g.fillStyle(0xffffff, 0.12).fillRoundedRect(8, -h / 2 + 3, w - 16, 7, 3); g.lineStyle(3, PAL.outline, 1).strokeRoundedRect(0, -h / 2, w, h, h / 2); c.add(g); }
  const r = iconRef(s, icon); const ic = s.add.image(4, 0, r.tex, r.frame).setDisplaySize(42, 42); c.add(ic);
  const t = txt(s, w - 12, -1, String(value), 20).setOrigin(1, 0.5); c.add(t); c.value = t;
  c.set = (v) => t.setText(String(v));
  return c;
}
export interface Bar extends Phaser.GameObjects.Container { setValue(v: number, max: number, label?: string): void }
export function bar(s: Phaser.Scene, x: number, y: number, w: number, h: number, color: number, hi = 0xffffff): Bar {
  const c = s.add.container(x, y) as Bar; const g = s.add.graphics(); c.add(g);
  const t = txt(s, w / 2, h / 2 - 1, '', Math.max(12, h - 6)).setOrigin(0.5); c.add(t);
  c.setValue = (v, max, label) => {
    const p = Math.max(0, Math.min(1, max > 0 ? v / max : 0)); g.clear();
    g.fillStyle(PAL.track, 1).fillRoundedRect(0, 0, w, h, h / 2);
    if (p > 0) { g.fillStyle(color, 1).fillRoundedRect(2, 2, Math.max(h - 4, (w - 4) * p), h - 4, (h - 4) / 2); g.fillStyle(hi, 0.3).fillRoundedRect(6, 4, Math.max(2, (w - 12) * p), Math.max(2, h * 0.2), 2); }
    g.lineStyle(3, PAL.outline, 1).strokeRoundedRect(0, 0, w, h, h / 2);
    t.setText(label ?? `${Math.ceil(v)}/${Math.round(max)}`);
  };
  return c;
}
export function dim(s: Phaser.Scene, alpha = 0.55) { return s.add.rectangle(640, 360, 1280, 720, 0x1d120b, alpha).setInteractive(); }
export function stars(s: Phaser.Scene, x: number, y: number, level: number, max: number, size = 12) {
  const c = s.add.container(x, y);
  for (let i = 0; i < max; i++) {
    const on = i < level; const k = on ? 'ui_star_on' : 'ui_star_off';
    if (s.textures.exists(k)) c.add(s.add.image(i * (size + 2), 0, k).setDisplaySize(size, size));
    else { const g = s.add.graphics(); g.fillStyle(on ? 0xffcf3a : 0x6b5644, 1).lineStyle(2, PAL.outline, 1); const pts: Phaser.Math.Vector2[] = []; for (let k2 = 0; k2 < 10; k2++) { const r = k2 % 2 ? size * 0.22 : size * 0.5; const a = -Math.PI / 2 + k2 * Math.PI / 5; pts.push(new Phaser.Math.Vector2(i * (size + 2) + Math.cos(a) * r, Math.sin(a) * r)); } g.fillPoints(pts, true); g.strokePoints(pts, true, true); c.add(g); }
  }
  return c;
}
/** Card title on the orange ribbon (ui_card_header) like the reference UI. */
export function title(s: Phaser.Scene, str: string, y = 54) {
  const t = txt(s, 640, y, str, 34).setOrigin(0.5);
  const rib = nine(s, 'ui_card_header', 640, y + 2, Math.max(240, t.width + 90), 58);
  if (rib) { rib.setDepth(t.depth); s.children.moveBelow(rib as any, t as any); }
  return t;
}
/** Floating toast */
export function toast(s: Phaser.Scene, str: string, color = '#ffffff', y = 150) {
  const t = txt(s, 640, y, str, 30, color).setOrigin(0.5).setDepth(5000).setScrollFactor(0);
  s.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 1600, delay: 600, onComplete: () => t.destroy() });
  return t;
}
export function wrapText(s: Phaser.Scene, x: number, y: number, str: string, width: number, size = 16, color = '#3B2416') {
  return txt(s, x, y, str, size, color, false, { fontStyle: '700', wordWrap: { width, useAdvancedWrap: true } });
}
