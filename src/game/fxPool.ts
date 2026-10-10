// Object pools for the combat hot path (v2 perf): FX sprites, projectile images, floating damage numbers and
// enemy HP bars. Everything is recycled instead of created/destroyed per hit, animated by one scene UPDATE
// listener (no tweens, no per-frame allocation), and capped so a 30-enemy fight cannot flood the display list.
// Damage numbers use a bitmap font generated once at runtime from Baloo 2 (no per-number canvas/texture upload).
import Phaser from 'phaser';
import { MANIFEST, applyEntry, entry, tex, FONT } from './assets';
import { G } from './state';

export const CAPS = { fx: 56, text: 36, proj: 520 };

interface FxItem { s: Phaser.GameObjects.Sprite; t: number; life: number; anim: boolean; s0: number }
interface TxtItem { o: Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text; t: number; y0: number; bmp: boolean }
interface Pools { fx: FxItem[]; fxLive: number; bmp: TxtItem[]; txt: TxtItem[]; img: Phaser.GameObjects.Image[]; tick: (t: number, d: number) => void }
const POOLS = new WeakMap<Phaser.Scene, Pools>();

function pools(scene: Phaser.Scene): Pools {
  let p = POOLS.get(scene);
  if (p) return p;
  const pp: Pools = { fx: [], fxLive: 0, bmp: [], txt: [], img: [], tick: (_t, d) => tickPools(pp, Math.min(0.1, d / 1000)) };
  POOLS.set(scene, pp);
  scene.events.on(Phaser.Scenes.Events.UPDATE, pp.tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { scene.events.off(Phaser.Scenes.Events.UPDATE, pp.tick); POOLS.delete(scene); });
  return pp;
}

// ---------------- FX sprites ----------------
/** Pooled one-shot effect (manifest sheet anim if any, else a 300 ms fade/scale). Same contract as the old fxAt. */
export function fxAt(scene: Phaser.Scene, key: string, x: number, y: number, size: number, depth = 3200): Phaser.GameObjects.Sprite | null {
  const P = pools(scene);
  let it: FxItem | undefined;
  for (const f of P.fx) if (!f.s.visible) { it = f; break; }
  if (!it) {
    if (P.fx.length >= CAPS.fx) { // recycle the oldest live effect (particle cap)
      it = P.fx[0]; for (const f of P.fx) if (f.t / f.life > it.t / it.life) it = f;
    } else {
      const s = scene.add.sprite(x, y, tex(scene, key, 'fx').tex);
      it = { s, t: 0, life: 0.3, anim: false, s0: 1 }; P.fx.push(it);
      const item = it; s.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => { if (item.anim) { item.s.setVisible(false); item.s.setActive(false); } });
    }
  }
  const s = it.s; s.anims.stop();
  s.setTexture(tex(scene, key, 'fx').tex).setPosition(x, y).setDepth(depth).setAlpha(1).setRotation(0).clearTint().setVisible(true).setActive(true);
  s.setOrigin(0.5, 0.5); s.setDisplaySize(size, size);
  it.t = 0; it.s0 = s.scaleX;
  const e = entry(key); const anims = e?.anims; let first: string | null = null;
  if (anims) for (const k in anims) { first = k; break; }
  if (first && scene.anims.exists(`${key}:${first}`)) { it.anim = true; it.life = 1.5; s.play(`${key}:${first}`, false); }
  else { it.anim = false; it.life = 0.3; }
  return s;
}

// ---------------- projectile images ----------------
export function acquireImage(scene: Phaser.Scene, key: string, px: number, x: number, y: number, rot: number, depth = 3100): Phaser.GameObjects.Image {
  const P = pools(scene); let s = P.img.pop();
  const t = tex(scene, key, 'proj').tex;
  if (!s || !s.scene) s = scene.add.image(x, y, t);
  else s.setTexture(t).setVisible(true).setActive(true).setAlpha(1).clearTint();
  s.setScale(1); s.setPosition(x, y).setDepth(depth); applyEntry(s, key, px, [0.5, 0.5]); s.setRotation(rot);
  return s;
}
export function releaseImage(s: Phaser.GameObjects.Image) {
  if (!s || !s.scene) return; const P = POOLS.get(s.scene);
  if (!P || P.img.length > CAPS.proj) { s.destroy(); return; }
  s.setVisible(false).setActive(false); P.img.push(s);
}

// ---------------- floating text / damage numbers ----------------
const DMG_FONT = 'dmgfont'; const GLYPHS = '0123456789+-%.!';
function ensureDmgFont(scene: Phaser.Scene): boolean {
  if (scene.cache.bitmapFont.exists(DMG_FONT)) return true;
  try {
    const S = 44, stroke = 8, pad = stroke; const cv = document.createElement('canvas'); const c0 = cv.getContext('2d')!;
    c0.font = `800 ${S}px ${FONT}`; const ws = [...GLYPHS].map((g) => Math.ceil(c0.measureText(g).width));
    const H = Math.ceil(S * 1.25) + pad * 2; const W = ws.reduce((a, b) => a + b + pad * 2 + 2, 0);
    const t = scene.textures.createCanvas(DMG_FONT, W, H)!; const c = t.getContext();
    c.font = `800 ${S}px ${FONT}`; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = stroke; c.strokeStyle = '#3B2416'; c.fillStyle = '#ffffff';
    const data: any = { retroFont: false, font: DMG_FONT, size: S, lineHeight: H, chars: {} };
    let x = 0;
    [...GLYPHS].forEach((g, i) => {
      const cw = ws[i] + pad * 2; c.strokeText(g, x + pad, H / 2); c.fillText(g, x + pad, H / 2);
      data.chars[g.charCodeAt(0)] = { x, y: 0, width: cw, height: H, centerX: cw / 2, centerY: H / 2, xOffset: 0, yOffset: 0, xAdvance: ws[i] + 1, data: {}, kerning: {}, u0: x / W, v0: 1, u1: (x + cw) / W, v1: 1 - H / H };
      x += cw + 2;
    });
    t.refresh();
    scene.cache.bitmapFont.add(DMG_FONT, { data, texture: DMG_FONT, frame: null });
    return true;
  } catch (err) { console.warn('dmg font failed', err); return false; }
}
const NUMERIC = /^[-+]?\d+[%!]?$/;
const hexNum = (c: string) => parseInt(c.replace('#', ''), 16) || 0xffffff;
/** Pooled floating text: digits use the bitmap font (tinted), words fall back to pooled Text. Rises 34 px, fades in 700 ms. */
export function floatText(scene: Phaser.Scene, x: number, y: number, s: string, color = '#ffffff', size = 20) {
  if (!G.meta.settings.showDamage && /^\d+$/.test(s)) return;
  const P = pools(scene); const bmp = NUMERIC.test(s) && ensureDmgFont(scene);
  const list = bmp ? P.bmp : P.txt; let it: TxtItem | undefined;
  for (const q of list) if (!q.o.visible) { it = q; break; }
  if (!it && P.bmp.length + P.txt.length >= CAPS.text) { // cap: reuse the oldest of this kind
    for (const q of list) if (!it || q.t > it.t) it = q;
  }
  if (!it) {
    const o = bmp ? scene.add.bitmapText(x, y, DMG_FONT, s) : scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '800', color, stroke: '#3B2416', strokeThickness: Math.max(3, Math.round(size / 7)) });
    it = { o, t: 0, y0: y, bmp }; list.push(it);
  }
  const o = it.o; it.t = 0; it.y0 = y;
  if (bmp) { const b = o as Phaser.GameObjects.BitmapText; b.setText(s); b.setFontSize(Math.round(size * 1.25)); b.setTint(hexNum(color)); }
  else { const tt = o as Phaser.GameObjects.Text; if (tt.text !== s) tt.setText(s); tt.setColor(color); tt.setFontSize(size); tt.setStroke('#3B2416', Math.max(3, Math.round(size / 7))); }
  o.setOrigin(0.5).setPosition(x, y).setAlpha(1).setDepth(4500).setVisible(true).setActive(true);
}

function tickPools(P: Pools, dt: number) {
  for (const f of P.fx) {
    if (!f.s.visible) continue; f.t += dt;
    if (f.anim) { if (f.t >= f.life) { f.s.anims.stop(); f.s.setVisible(false).setActive(false); } continue; }
    const k = f.t / f.life; if (k >= 1) { f.s.setVisible(false).setActive(false); continue; }
    f.s.setAlpha(1 - k); f.s.setScale(f.s0 * (1 + 0.3 * k));
  }
  for (let li = 0; li < 2; li++) {
    const list = li ? P.txt : P.bmp;
    for (const q of list) {
      if (!q.o.visible) continue; q.t += dt; const k = q.t / 0.7;
      if (k >= 1) { q.o.setVisible(false).setActive(false); continue; }
      const e = 1 - (1 - k) * (1 - k) * (1 - k); q.o.y = q.y0 - 34 * e; q.o.alpha = 1 - e;
    }
  }
}

// ---------------- enemy HP bars ----------------
function barTex(scene: Phaser.Scene, key: string, w: number, h: number, col: string) {
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, w, h)!; const c = t.getContext(); const r = h / 2;
  c.fillStyle = col; c.beginPath(); c.moveTo(r, 0); c.arcTo(w, 0, w, h, r); c.arcTo(w, h, 0, h, r); c.arcTo(0, h, 0, 0, r); c.arcTo(0, 0, w, 0, r); c.closePath(); c.fill();
  t.refresh(); return key;
}
/** Image-based HP bar (2 quads + status dots) replacing a per-enemy Graphics that was re-tessellated every frame.
 *  Usage per frame: bar.begin(x, y, hpFrac); bar.dot(color) for each active status; bar.end(). */
export class EnemyBar {
  track: Phaser.GameObjects.Image; fill: Phaser.GameObjects.Image; dots: Phaser.GameObjects.Image[] = []; private n = 0; private dx = 0; private dy = 0;
  constructor(public scene: Phaser.Scene, public w = 36) {
    this.track = scene.add.image(0, 0, barTex(scene, 'ebar_track', 36, 6, '#3a2a20')).setOrigin(0, 0).setDepth(3500).setVisible(false);
    this.fill = scene.add.image(0, 0, barTex(scene, 'ebar_fill', 34, 4, '#e2483d')).setOrigin(0, 0).setDepth(3501).setVisible(false);
    this.track.setScale(w / 36, 1);
  }
  begin(x: number, y: number, frac: number) {
    this.track.setPosition(x, y).setVisible(true);
    const f = frac < 0 ? 0 : frac > 1 ? 1 : frac; this.fill.setPosition(x + 1, y + 1).setScale(((this.w - 2) * f) / 34, 1).setVisible(f > 0);
    this.n = 0; this.dx = x; this.dy = y; return this;
  }
  dot(color: number) {
    let d = this.dots[this.n]; if (!d) { d = this.scene.add.image(0, 0, barTex(this.scene, 'ebar_dot', 6, 6, '#ffffff')).setDepth(3501); this.dots.push(d); }
    d.setPosition(this.dx + 3 + this.n * 8, this.dy - 6).setTint(color).setVisible(true); this.n++; return this;
  }
  end() { for (let i = this.n; i < this.dots.length; i++) this.dots[i].setVisible(false); return this; }
  clear() { this.track.setVisible(false); this.fill.setVisible(false); for (const d of this.dots) d.setVisible(false); return this; }
  destroy() { this.track.destroy(); this.fill.destroy(); for (const d of this.dots) d.destroy(); this.dots.length = 0; }
}
void MANIFEST;
