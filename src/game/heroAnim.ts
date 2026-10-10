// Hero animation rig (v2): readable attacks on top of the baked sprite sheet.
// The hero art has tiny baked arms, so the weapon lives on a separate "hand pivot" (a paw + the weapon image) that
// swings / thrusts / recoils along the real attack arc. The body gets squash-and-stretch (attack, dash, hurt, turn),
// an anticipation pose, dash afterimages (pooled) and a soft lean into movement. Everything is driven by
// `rig.update()` from the scene's update (so hit-stop freezes the pose too) — no tweens, no per-frame allocations.
//
// Public API (see docs/V2_ANIM.md):
//   playAttack(scene, kind, arcDeg, durationMs, opts?)  — swing/thrust/shot/cast pose for one attack
//   playDash(scene, angle, durationMs?)                — stretch + afterimages
//   playHurt(scene, fromAngle?)                        — squash + recoil + wobble
//   playCast(scene, durationMs?)                       — raise weapon / paw (spells)
//   heroRig(scene)                                     — the rig instance (or null)
import Phaser from 'phaser';
import { MANIFEST, applyEntry, tex } from './assets';

export type AttackKind = 'slash' | 'heavy' | 'thrust' | 'stab' | 'shoot' | 'cast' | 'bash' | 'spin';
export interface AttackOpts {
  /** wind-up before the strike (ms). Default: 20% of duration, max 70 ms. Pass the move's real startup if hits are delayed. */
  windupMs?: number;
  /** swing direction: 1 = clockwise (screen), -1 = counter-clockwise. Default alternates every attack. */
  sweep?: 1 | -1;
  /** aim angle (radians); default = the facing passed to update(). */
  angle?: number;
  /** extra forward reach of the weapon on a thrust (px, default 14). */
  reach?: number;
  /** strength of the body squash/stretch 0..2 (default 1; finishers ~1.5). */
  power?: number;
}
export interface RigInput {
  x: number; y: number; facing: number; moving: boolean; guarding?: boolean; charge?: number; spinning?: boolean; dashing?: boolean;
  /** v2 combat state (src/systems/combat.ts CombatState): when given, every new move auto-plays its attack pose with
   *  wind-up = move startup and duration = startup + recovery (scaled), so the pose always matches the real frame data. */
  combat?: { phase: string; t: number; scale: number; move: { startup: number; recovery: number; sweep: 1 | -1; finisher: boolean; arc: number } | null } | null;
  /** weapon id + base arc (deg) used by the combat auto-sync */
  weapon?: string; arc?: number;
}

/** Default attack kind / timing per weapon id (callers may override). */
export const WEAPON_ANIM: Record<string, { kind: AttackKind; ms: number; finisher?: AttackKind }> = {
  swordshield: { kind: 'slash', ms: 230, finisher: 'heavy' },
  greatsword: { kind: 'heavy', ms: 420 },
  dagger: { kind: 'stab', ms: 150, finisher: 'slash' },
  katana: { kind: 'slash', ms: 240, finisher: 'thrust' },
  crossbow: { kind: 'shoot', ms: 160 },
  staff: { kind: 'cast', ms: 220 },
};

/** Held-weapon display scale (tiny art reads better a bit larger in the hand). */
export const WEAPON_SCALE: Record<string, number> = { dagger: 1.35, katana: 1.1, swordshield: 1.1 };

const RIGS = new WeakMap<Phaser.Scene, HeroRig>();
export const heroRig = (scene: Phaser.Scene) => RIGS.get(scene) ?? null;
export function playAttack(scene: Phaser.Scene, kind: AttackKind, arcDeg: number, durationMs: number, opts?: AttackOpts) { RIGS.get(scene)?.playAttack(kind, arcDeg, durationMs, opts); }
export function playDash(scene: Phaser.Scene, angle: number, durationMs = 180) { RIGS.get(scene)?.playDash(angle, durationMs); }
export function playHurt(scene: Phaser.Scene, fromAngle?: number) { RIGS.get(scene)?.playHurt(fromAngle); }
export function playCast(scene: Phaser.Scene, durationMs = 260) { RIGS.get(scene)?.playAttack('cast', 0, durationMs); }

const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
const easeIn = (t: number) => t * t;
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const wrap = Phaser.Math.Angle.Wrap;

/** Procedural paw texture (cream fill, thick brown outline) — matches the cartoon style. */
function pawTexture(scene: Phaser.Scene, fill: string) {
  const key = `hero_paw_${fill.slice(1)}`;
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, 20, 20)!; const c = t.getContext();
  c.fillStyle = fill; c.strokeStyle = '#3b2416'; c.lineWidth = 3;
  c.beginPath(); c.arc(10, 10, 6.5, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.arc(8, 8, 2.2, 0, Math.PI * 2); c.fill();
  t.refresh(); return key;
}
/** Sample the costume's body colour (opaque, light pixels around the belly of frame 0) for the paw. */
function bodyColour(scene: Phaser.Scene, key: string): string {
  try {
    const e = MANIFEST[key]; const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const fw = e?.frameW ?? src.width, fh = e?.frameH ?? src.height;
    const cv = document.createElement('canvas'); cv.width = fw; cv.height = fh; const c = cv.getContext('2d', { willReadFrequently: true })!;
    c.drawImage(src as any, 0, 0, fw, fh, 0, 0, fw, fh);
    const d = c.getImageData(Math.floor(fw * 0.3), Math.floor(fh * 0.55), Math.floor(fw * 0.4), Math.floor(fh * 0.3)).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 250) continue; const l = d[i] + d[i + 1] + d[i + 2]; if (l < 300) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    if (n < 10) return '#f6dcb4';
    const h = (v: number) => Math.round(v / n).toString(16).padStart(2, '0'); return `#${h(r)}${h(g)}${h(b)}`;
  } catch { return '#f6dcb4'; }
}

interface Ghost { img: Phaser.GameObjects.Image; t: number }

export class HeroRig {
  pivot: Phaser.GameObjects.Container; wpn: Phaser.GameObjects.Image; paw: Phaser.GameObjects.Image; off: Phaser.GameObjects.Image | null = null;
  weaponId = ''; weaponKey = '';
  private base = 0.5; private baseW = 0.5;
  // squash spring (multipliers on the body scale)
  private sx = 1; private sy = 1; private vx = 0; private vy = 0;
  // attack state
  private atk = { on: false, t: 0, dur: 0, wind: 0, strike: 0, kind: 'slash' as AttackKind, arc: 0, sweep: 1 as 1 | -1, angle: 0, hasAngle: false, reach: 14, power: 1 };
  private nextSweep: 1 | -1 = 1;
  private hurt = { t: 9, dir: 0 }; private dash = { t: 9, dur: 0.18, a: 0, ghostT: 0 };
  private flipT = 9; private left = false; private lean = 0; private time = 0;
  private ghosts: Ghost[] = [];
  private restA = 0; private poseA = 0; private poseOff = 0; private poseLift = 0;
  private cPhase = 'idle'; private cT = 0; private cMove: unknown = null;

  constructor(public scene: Phaser.Scene, public hero: Phaser.GameObjects.Sprite, public heroKey: string, weaponKey: string, weaponId: string) {
    this.base = Math.abs(hero.scaleX) || 0.5;
    const paw = pawTexture(scene, bodyColour(scene, heroKey));
    this.wpn = scene.add.image(0, 0, tex(scene, weaponKey, 'weapon').tex);
    this.paw = scene.add.image(0, 0, paw).setScale(0.8);
    this.pivot = scene.add.container(0, 0, [this.wpn, this.paw]);
    this.setWeapon(weaponKey, weaponId);
    RIGS.set(scene, this);
    scene.events.once('shutdown', () => { if (RIGS.get(scene) === this) RIGS.delete(scene); this.ghosts.length = 0; });
  }
  setWeapon(weaponKey: string, weaponId: string) {
    this.weaponKey = weaponKey; this.weaponId = weaponId;
    this.wpn.setTexture(tex(this.scene, weaponKey, 'weapon').tex);
    applyEntry(this.wpn, weaponKey, 14, [0.12, 0.5]);
    this.baseW = (Math.abs(this.wpn.scaleX) || 0.5) * (WEAPON_SCALE[weaponId] ?? 1);
    // the paw sits on the handle: weapon origin is the grip in the manifest
    this.wpn.setPosition(0, 0);
    if (weaponId === 'swordshield') {
      if (!this.off) { this.off = this.scene.add.image(0, 0, tex(this.scene, 'wpn_shield', 'weapon').tex); applyEntry(this.off, 'wpn_shield', 16, [0.5, 0.5]); }
      this.off.setVisible(true);
    } else this.off?.setVisible(false);
  }
  get busy() { return this.atk.on; }

  playAttack(kind: AttackKind, arcDeg: number, durationMs: number, o: AttackOpts = {}) {
    const a = this.atk; const dur = Math.max(60, durationMs) / 1000;
    const wind = o.windupMs !== undefined ? Math.max(0, o.windupMs) / 1000 : Math.min(0.07, dur * 0.2);
    a.on = true; a.t = 0; a.dur = Math.max(dur, wind + 0.08); a.wind = wind;
    a.strike = Math.min(0.14, Math.max(0.05, (a.dur - wind) * 0.38));
    a.kind = kind; a.arc = Phaser.Math.DegToRad(Phaser.Math.Clamp(arcDeg || 0, 0, 300)); a.power = o.power ?? 1; a.reach = o.reach ?? 14;
    a.sweep = o.sweep ?? this.nextSweep; this.nextSweep = (a.sweep === 1 ? -1 : 1);
    a.hasAngle = o.angle !== undefined; a.angle = o.angle ?? 0;
    // anticipation squash (crouch) immediately; release stretch is applied when the strike starts
    const p = a.power; if (kind === 'heavy' || kind === 'bash') this.kick(0.12 * p, -0.16 * p); else if (kind !== 'shoot') this.kick(0.07 * p, -0.08 * p); else this.kick(0.06, -0.05);
  }
  playDash(angle: number, durationMs = 180) {
    this.dash.t = 0; this.dash.dur = Math.max(0.08, durationMs / 1000); this.dash.a = angle; this.dash.ghostT = 0;
    const h = Math.abs(Math.cos(angle)); this.kick(0.3 * h - 0.12 * (1 - h), -0.22 * h + 0.25 * (1 - h));
    this.spawnGhost();
  }
  playHurt(fromAngle?: number) {
    this.hurt.t = 0; this.hurt.dir = fromAngle ?? (this.left ? 0 : Math.PI);
    this.kick(0.28, -0.3);
  }
  /** impulse on the squash spring: positive dx = wider, negative dy = shorter */
  private kick(dx: number, dy: number) { this.sx += dx; this.sy += dy; this.vx = 0; this.vy = 0; }

  private spawnGhost() {
    let g: Ghost | undefined;
    for (const x of this.ghosts) if (!x.img.visible) { g = x; break; }
    if (!g) {
      if (this.ghosts.length >= 6) { g = this.ghosts[0]; for (const x of this.ghosts) if (x.t > g.t) g = x; }
      else { const img = this.scene.add.image(0, 0, this.hero.texture.key); img.setTintMode(Phaser.TintModes.FILL); g = { img, t: 0 }; this.ghosts.push(g); }
    }
    const h = this.hero; g.t = 0;
    g.img.setTexture(h.texture.key, h.frame.name).setOrigin(h.originX, h.originY).setScale(h.scaleX, h.scaleY).setPosition(h.x, h.y)
      .setRotation(h.rotation).setTint(0xbfeaff).setAlpha(0.55).setVisible(true).setDepth(h.depth - 1);
  }

  /** Per-frame pose. Call after the hero position/anim were updated, every frame the scene is not in hit-stop. */
  update(dt: number, i: RigInput) {
    const h = this.hero; this.time += dt;
    if (i.combat) this.syncCombat(i);
    // ---- facing (with a short turn squash when it flips) ----
    const left = Math.cos(i.facing) < -0.05 ? true : Math.cos(i.facing) > 0.05 ? false : this.left;
    if (left !== this.left) { this.left = left; this.flipT = 0; }
    this.flipT += dt;
    // ---- squash spring back to 1 (slightly under-damped → bounce) ----
    const k = 260, c = 18;
    this.vx += ((1 - this.sx) * k - this.vx * c) * dt; this.vy += ((1 - this.sy) * k - this.vy * c) * dt;
    this.sx += this.vx * dt; this.sy += this.vy * dt;
    // ---- attack timeline ----
    const a = this.atk; let off = 0, lift = 0, wsx = 1, angle = i.facing, swingA = 0, bodyRot = 0;
    const side = left ? -1 : 1;
    if (a.on) {
      a.t += dt; const aim = a.hasAngle ? a.angle : i.facing; angle = aim;
      const tw = a.wind > 0 ? clamp01(a.t / a.wind) : 1; const ts = clamp01((a.t - a.wind) / a.strike); const tr = clamp01((a.t - a.wind - a.strike) / Math.max(0.01, a.dur - a.wind - a.strike));
      const sw = a.sweep * side; const half = a.arc / 2;
      if (a.t >= a.wind && a.t - dt < a.wind) { // strike frame: stretch toward the hit
        const p = a.power; if (a.kind === 'heavy' || a.kind === 'bash') this.kick(-0.1 * p, 0.2 * p); else if (a.kind === 'thrust' || a.kind === 'stab') this.kick(0.12 * p, -0.04 * p); else if (a.kind !== 'shoot') this.kick(-0.05 * p, 0.1 * p);
      }
      switch (a.kind) {
        case 'slash': case 'heavy': {
          const back = half + (a.kind === 'heavy' ? 0.7 : 0.35); // wind past the start of the arc
          const from = -sw * back, to = sw * (half + 0.15);
          if (a.t < a.wind) swingA = from * easeOut(tw);
          else if (ts < 1) swingA = from + (to - from) * easeOut(ts);
          else swingA = to * (1 - easeIn(tr));
          if (a.kind === 'heavy') { lift = a.t < a.wind ? -6 * tw : -6 * (1 - ts); bodyRot = side * (a.t < a.wind ? -0.12 * tw : 0.12 * (1 - tr)); }
          else bodyRot = side * (a.t < a.wind ? -0.06 * tw : 0.06 * (1 - tr));
          off = a.t < a.wind ? -3 * tw : 4 * (1 - tr);
          break;
        }
        case 'thrust': case 'stab': {
          const pull = a.kind === 'thrust' ? -9 : -5; const reach = a.kind === 'thrust' ? a.reach + 6 : a.reach;
          if (a.t < a.wind) off = pull * easeOut(tw); else if (ts < 1) off = pull + (reach - pull) * easeOut(ts); else off = reach * (1 - easeIn(tr));
          wsx = 1 + 0.25 * (ts < 1 ? ts : 1 - tr) * (a.t >= a.wind ? 1 : 0);
          swingA = a.kind === 'stab' ? -a.sweep * side * 0.18 * (1 - ts) : 0; bodyRot = side * 0.08 * (a.t < a.wind ? -tw : (1 - tr));
          break;
        }
        case 'shoot': { // recoil: kick back and tip up, settle
          const r = a.t < a.wind ? 0 : (ts < 1 ? easeOut(ts) : 1 - easeIn(tr)); off = -7 * r; swingA = -side * 0.35 * r; break;
        }
        case 'cast': { // raise overhead, then point the weapon/orb at the target, settle back upright
          const up = -side * 1.35, at = -side * 0.1, rest = -side * 0.95;
          if (a.t < a.wind) swingA = rest + (up - rest) * easeOut(tw); else if (ts < 1) swingA = up + (at - up) * easeOut(ts); else swingA = at + (rest - at) * easeIn(tr);
          lift = a.t < a.wind ? -6 * tw : -6 * (1 - Math.min(1, ts)); off = ts < 1 && a.t >= a.wind ? 6 * Math.sin(ts * Math.PI) : 0; break;
        }
        case 'bash': { // shield/body bash: shove forward
          const r = a.t < a.wind ? -0.4 * easeOut(tw) : (ts < 1 ? easeOut(ts) : 1 - easeIn(tr)); off = 12 * r; swingA = 0; break;
        }
        case 'spin': swingA = (a.t / a.dur) * Math.PI * 2 * side; break;
      }
      if (a.t >= a.dur) a.on = false;
    } else {
      // rest pose: weapon forward-down, idle bob / run swing; guard and charge poses
      const bob = i.moving ? Math.sin(this.time * 14) * 0.18 : Math.sin(this.time * 3) * 0.06;
      const rest = this.weaponId === 'crossbow' ? 0.12 : this.weaponId === 'staff' ? -0.95 : 0.55; // ranged weapons aim; staff held upright
      swingA = side * (rest + bob * (this.weaponId === 'crossbow' ? 0.3 : 1)); off = 0; lift = i.moving ? Math.abs(Math.sin(this.time * 14)) * -1.5 : 0;
      if (i.charge !== undefined && i.charge >= 0) { // drawn back, trembling more as it fills
        const f = Math.min(1, i.charge / 0.6); swingA = -side * (0.9 + 0.9 * f) + Math.sin(this.time * 60) * 0.06 * f; off = -4 * f; lift = -3 * f;
        this.sx += (1 + 0.08 * f - this.sx) * Math.min(1, dt * 10); this.sy += (1 - 0.08 * f - this.sy) * Math.min(1, dt * 10);
      }
      if (i.guarding) { swingA = side * 1.1; off = -2; }
    }
    if (i.spinning) swingA = 0; // RunScene spins `facing` itself
    // ---- dash ----
    this.dash.t += dt; let dashing = this.dash.t < this.dash.dur;
    if (i.dashing !== undefined) dashing = i.dashing || dashing;
    if (dashing) { this.dash.ghostT -= dt; if (this.dash.ghostT <= 0) { this.dash.ghostT = 0.035; this.spawnGhost(); } }
    for (const g of this.ghosts) if (g.img.visible) { g.t += dt; const al = 0.55 * (1 - g.t / 0.2); if (al <= 0) g.img.setVisible(false); else g.img.setAlpha(al); }
    // ---- hurt recoil ----
    this.hurt.t += dt; let rx = 0, ry = 0, rot = 0;
    if (this.hurt.t < 0.22) { const r = 1 - this.hurt.t / 0.22; rx = -Math.cos(this.hurt.dir) * 5 * r; ry = -Math.sin(this.hurt.dir) * 3 * r; rot = Math.sin(this.hurt.t * 60) * 0.14 * r; }
    // ---- body: scale (squash, turn), lean, recoil ----
    const turn = this.flipT < 0.09 ? 0.55 + 0.45 * (this.flipT / 0.09) : 1;
    const nat = MANIFEST[this.heroKey]?.facing === 'left'; const flip = nat ? !left : left;
    h.scaleX = (flip ? -1 : 1) * this.base * this.sx * turn; h.scaleY = this.base * this.sy;
    this.lean += ((i.moving && !a.on ? Math.cos(i.facing) * 0.07 : 0) - this.lean) * Math.min(1, dt * 10);
    h.setRotation(this.lean + bodyRot + rot); h.x = i.x + rx; h.y = i.y + ry;
    // ---- hand pivot ----
    this.restA = angle; this.poseA = swingA; this.poseOff = off; this.poseLift = lift;
    const fa = angle + swingA; const ca = Math.cos(angle), sa = Math.sin(angle);
    const hx = i.x + rx + ca * (7 + off) + side * 2, hy = i.y + ry - 17 * this.sy + sa * (3 + off * 0.5) + lift;
    this.pivot.setPosition(hx, hy);
    this.wpn.setRotation(fa); this.wpn.scaleX = this.baseW * wsx; this.wpn.scaleY = this.baseW * (Math.cos(fa) < 0 ? -1 : 1);
    this.paw.setPosition(0, 0);
    const behind = Math.sin(angle) < -0.3;
    this.pivot.setDepth(behind ? h.y - 1 : h.y + 1);
    if (this.off && this.off.visible) {
      const g = !!i.guarding; const oa = angle + (g ? 0 : -side * 0.9); const od = g ? 13 : 6;
      this.off.setPosition(i.x + rx + Math.cos(oa) * od - side * (g ? 0 : 6), i.y + ry - 15 * this.sy + Math.sin(oa) * od * 0.6 + lift).setScale(g ? 0.56 : 0.42).setDepth(g ? (Math.sin(angle) < 0 ? h.y - 2 : h.y + 2) : (behind ? h.y + 1 : h.y - 1));
    }
  }
  /** Detect the start of a new move in the combat state machine and play the matching pose. */
  private syncCombat(i: RigInput) {
    const c = i.combat!; const ph = c.phase;
    const fresh = ph !== 'idle' && (this.cPhase === 'idle' || c.move !== this.cMove || (c.t < this.cT - 1e-6 && !(this.cPhase === 'startup' && ph === 'recovery')));
    if (fresh && c.move) {
      const m = c.move; const w = WEAPON_ANIM[i.weapon ?? this.weaponId] ?? WEAPON_ANIM.swordshield;
      const kind = m.finisher && w.finisher ? w.finisher : w.kind;
      const wind = (ph === 'startup' ? m.startup : 0) * c.scale * 1000; const dur = Math.max(w.ms * Math.min(1.2, c.scale), wind + (m.recovery * c.scale * 1000) * 0.7);
      // ranged moves have no startup: use a tiny anticipation so the recoil still reads
      this.playAttack(kind, (i.arc ?? 120) * (m.arc || 1), dur, { windupMs: wind > 0 ? wind : (kind === 'shoot' ? 0 : kind === 'cast' ? 45 : 30), sweep: m.sweep, power: m.finisher ? 1.5 : 1 });
    }
    this.cPhase = ph; this.cT = c.t; this.cMove = c.move;
  }
  setAlpha(v: number) { this.pivot.setAlpha(v); this.off?.setAlpha(v); }
  setVisible(v: boolean) { this.pivot.setVisible(v); this.off?.setVisible(v && this.weaponId === 'swordshield'); }
  destroy() { this.pivot.destroy(); this.off?.destroy(); for (const g of this.ghosts) g.img.destroy(); this.ghosts.length = 0; if (RIGS.get(this.scene) === this) RIGS.delete(this.scene); }
}
