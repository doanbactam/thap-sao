// Enemy readability poses (v2): wind-up tell and recovery (punish window) for any enemy/boss sprite.
// Called from the AI layer:  enemyWindup(sprite, ms)  when an attack starts winding up,
//                            enemyRecover(sprite, ms) when it finishes and is open to punishment,
//                            enemyPoseClear(sprite)    to cancel (stun, death, interrupt).
// The pose is applied in the scene's POST_UPDATE (after RunScene has positioned/tinted the sprite and before
// render), so it composes with the per-frame tint code instead of fighting it; hit flashes (FILL tint) win.
// No tweens and no per-frame allocation: one Map of active sprites per scene.
import Phaser from 'phaser';

type Mode = 'windup' | 'recover';
interface Pose { mode: Mode; t: number; dur: number; bx: number; by: number; rot: number; strength: number; color: number }
const ACTIVE = new WeakMap<Phaser.Scene, Map<Phaser.GameObjects.Sprite, Pose>>();

function poses(scene: Phaser.Scene) {
  let m = ACTIVE.get(scene);
  if (!m) {
    const mm = new Map<Phaser.GameObjects.Sprite, Pose>(); m = mm; ACTIVE.set(scene, mm);
    const tick = (_t: number, dms: number) => tickPoses(mm, Math.min(0.05, dms / 1000));
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick); mm.clear(); ACTIVE.delete(scene); });
  }
  return m;
}
function begin(s: Phaser.GameObjects.Sprite, mode: Mode, ms: number, strength: number, color: number) {
  if (!s || !s.active || !s.scene) return;
  const m = poses(s.scene); const old = m.get(s);
  const bx = old ? old.bx : Math.abs(s.scaleX), by = old ? old.by : Math.abs(s.scaleY);
  if (old) restore(s, old);
  m.set(s, { mode, t: 0, dur: Math.max(0.05, ms / 1000), bx, by, rot: old ? old.rot : s.rotation, strength, color });
}
/** Wind-up tell: crouch (squash) then swell (+scale), additive red glow pulsing faster, white flash in the last 70 ms. */
export function enemyWindup(sprite: Phaser.GameObjects.Sprite, ms: number, opts: { strength?: number; color?: number } = {}) { begin(sprite, 'windup', ms, opts.strength ?? 1, opts.color ?? 0xff5a3c); }
/** Recovery / punish window: slumped, dimmed blue-grey, slow wobble. Default 450 ms. */
export function enemyRecover(sprite: Phaser.GameObjects.Sprite, ms = 450, opts: { strength?: number } = {}) { begin(sprite, 'recover', ms, opts.strength ?? 1, 0x9aa6c8); }
/** Cancel any pose and restore scale/rotation/tint. */
export function enemyPoseClear(sprite: Phaser.GameObjects.Sprite) {
  const m = sprite?.scene && ACTIVE.get(sprite.scene); const p = m?.get(sprite); if (!m || !p) return;
  restore(sprite, p); m.delete(sprite);
}
export const enemyPose = (sprite: Phaser.GameObjects.Sprite): Mode | null => (sprite?.scene && ACTIVE.get(sprite.scene)?.get(sprite)?.mode) || null;

function restore(s: Phaser.GameObjects.Sprite, p: Pose) {
  if (!s.active) return;
  s.scaleX = Math.sign(s.scaleX || 1) * p.bx; s.scaleY = p.by; s.rotation = p.rot;
}
const lerpCol = (a: number, b: number, t: number) => {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t), g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t), bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};
function tickPoses(m: Map<Phaser.GameObjects.Sprite, Pose>, dt: number) {
  for (const [s, p] of m) {
    if (!s.active) { m.delete(s); continue; }
    p.t += dt; const k = Math.min(1, p.t / p.dur); const sign = Math.sign(s.scaleX || 1);
    const flashing = s.isTinted && s.tintMode === Phaser.TintModes.FILL && !(p.mode === 'windup' && p.dur - p.t < 0.07);
    if (p.mode === 'windup') {
      // 0..40%: crouch (wide+short); 40..100%: swell (grow + taller), slight back-lean
      const st = p.strength; let sx: number, sy: number;
      if (k < 0.4) { const e = k / 0.4; sx = 1 + 0.12 * st * e; sy = 1 - 0.14 * st * e; }
      else { const e = (k - 0.4) / 0.6; sx = 1 + 0.12 * st * (1 - e) + 0.1 * st * e; sy = 1 - 0.14 * st * (1 - e) + 0.12 * st * e; }
      s.scaleX = sign * p.bx * sx; s.scaleY = p.by * sy; s.rotation = p.rot - sign * 0.08 * st * k;
      if (!flashing) {
        if (p.dur - p.t < 0.07) s.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
        else { const freq = 3 + 11 * k; const w = 0.5 + 0.5 * Math.sin(p.t * freq * Math.PI * 2); s.setTint(lerpCol(0x000000, p.color, (0.15 + 0.35 * w) * (0.35 + 0.65 * k))).setTintMode(Phaser.TintModes.ADD); } // additive glow: reads on dark and light art
      }
      if (p.t >= p.dur) { restore(s, p); if (!flashing) s.clearTint(); m.delete(s); }
    } else {
      const e = 1 - k; const wob = Math.sin(p.t * 9) * 0.07 * p.strength * e;
      s.scaleX = sign * p.bx * (1 + 0.07 * p.strength * e); s.scaleY = p.by * (1 - 0.1 * p.strength * e); s.rotation = p.rot + wob;
      if (!flashing) s.setTint(lerpCol(0xffffff, p.color, 0.8 * e)).setTintMode(Phaser.TintModes.MULTIPLY);
      if (p.t >= p.dur) { restore(s, p); if (!flashing) s.clearTint(); m.delete(s); }
    }
  }
}

const LAST = new WeakMap<Phaser.GameObjects.Sprite, string>();
/** Convenience for the AI layer: call once per enemy per frame with its agent; starts the wind-up pose when the
 *  agent enters `windup` (duration = agent.windup s) and the recovery pose when it enters `recover`
 *  (duration = agent.recoverDur s). Clears the pose when the agent is stunned/frozen (pass disabled = true). */
export function syncEnemyPose(sprite: Phaser.GameObjects.Sprite, agent: { state: string; windup?: number; recoverDur?: number }, disabled = false, strength = 1) {
  const prev = LAST.get(sprite); const st = disabled ? 'disabled' : agent.state;
  if (st === prev) return; LAST.set(sprite, st);
  if (st === 'windup') enemyWindup(sprite, Math.max(80, (agent.windup ?? 0.5) * 1000), { strength });
  else if (st === 'recover') enemyRecover(sprite, Math.max(150, (agent.recoverDur ?? 0.45) * 1000), { strength });
  else if (prev === 'windup' || prev === 'recover' || st === 'disabled') enemyPoseClear(sprite);
}
/** debug/tools handle (tools/anim-shots.mjs, smoke probes): window.__TSAnim.enemyWindup(sprite, ms) … */
if (typeof window !== 'undefined') (window as any).__TSAnim = { ...((window as any).__TSAnim ?? {}), enemyWindup, enemyRecover, enemyPoseClear, syncEnemyPose, enemyPose };
