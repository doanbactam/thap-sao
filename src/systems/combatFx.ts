// Scene glue for combat feel (v2). Keeps RunScene edits to a handful of hook calls: per-frame combat tick,
// attack input (tap/hold/charge), impact (hit-stop, shake tiers, poise + weight knockback, directional sparks),
// perfect dodge, perfect parry (stagger + riposte + projectile reflect), charge ring, wind-up pose.
// Pure rules live in ./combat.ts (unit-tested); this file only talks to Phaser and the scene.
import Phaser from 'phaser';
import type { RunScene } from '../scenes/RunScene';
import { playAnim } from '../game/assets';
import { fxAt } from '../game/fxPool';
import { sfx } from '../game/audio';
import { G } from '../game/state';
import { t } from './i18n';
import { applyStatus } from './status';
import { tryCharged, chargedFor, canCharge } from './weapons';
import {
  tickCombat, cancelStartup, stepAttack, bufferDash, beginMove, chargedMove, tryPerfectDodge, onParry, nextHitBonus, consumeBonus,
  newPoise, tickPoise, damagePoise, weightOf, knockImpulse, hitStopFor, shakeTierFor, SHAKE, DASH_IFRAMES, STAGGER_TIME,
  type MoveData, type Pending, type ShakeTier, type Poise,
} from './combat';

type RS = RunScene & Record<string, any>;
/** What the current melee strike carries into hitEnemy (bonus from counter/riposte, frame data). */
export interface StrikeCtx { move: MoveData; bonusPct: number; forceCrit: boolean; critBonus: number; charged: boolean }
const poiseMap = new WeakMap<object, { p: Poise; last: number }>();
const ringMap = new WeakMap<object, Phaser.GameObjects.Graphics>();

/** Every frame at the top of updatePlayer (game dt): timers, deferred strikes, dash buffer, i-frame tint, charge ring, wind-up pose. */
export function frame(rs: RS, dt: number) {
  const cs = rs.cs;
  if (rs.ws.guarding) cancelStartup(cs);
  const p = tickCombat(cs, dt); if (p) rs.strike(p);
  if (rs.ctl.consume('dash')) bufferDash(cs);
  // dash i-frames: a clear cyan read for exactly the invulnerable window
  const inv = cs.sinceDash <= DASH_IFRAMES;
  if (inv) rs.hero.setTint(0xa8ecff).setTintMode(Phaser.TintModes.MULTIPLY); else if (rs._dashTint) rs.hero.clearTint();
  rs._dashTint = inv;
  // wind-up / swing poses are owned by the hero rig (src/game/heroAnim.ts), which reads rs.cs every frame
  drawCharge(rs);
}

/** Replaces `if (c.attack) this.doAttack()` — tap = light (buffered), hold = charge, release = charged attack. */
export function attackInput(rs: RS, dt: number) {
  const c = rs.ctl, ws = rs.ws, wc = rs.wcfg, cs = rs.cs;
  const ch = chargedFor(wc);
  const busy = ws.charging || rs.spinT > 0 || ws.guarding;
  const cmds = stepAttack(cs, {
    pressed: c.takeAttackPress(), held: c.attack, canAttack: !busy, canCharge: canCharge(ws, wc),
    ready: ws.cooldown <= 0 && !(wc.magazine > 0 && ws.reloading > 0), chargeTime: ch.chargeTime,
  }, dt);
  for (const cmd of cmds) {
    if (cmd.type === 'light') rs.doAttack();
    else if (cmd.type === 'chargeStart') { sfx('ui'); G.logEvent('chargeStart', { weapon: wc.id }); }
    else if (cmd.type === 'chargeFull') { sfx('magic'); rs.floatText(rs.px, rs.py - 70, t('combat.chargeFull'), '#ffe7a0', 16); }
    else if (cmd.type === 'charged') chargedAttack(rs, cmd.power);
  }
}

function chargedAttack(rs: RS, power: number) {
  const wc = rs.wcfg; const r = tryCharged(rs.ws, wc, power, rs.stats.attackSpeed); if (!r) return;
  G.logEvent('attack', { hit: -1, weapon: wc.id, charged: true, power: +power.toFixed(2) });
  G.logEvent('chargedAttack', { weapon: wc.id, power: +power.toFixed(2) });
  playAnim(rs.hero, rs.heroKey, 'attack', false);
  if (wc.arc > 0) {
    const p: Pending = { kind: 'charged', hit: -1, coef: r.coef, last: true, lunge: false, angle: rs.facing, power };
    if (beginMove(rs.cs, chargedMove(r.data), r.scale, p)) rs.strike(p);
    return;
  }
  // ranged charged shot: one empowered projectile (pierce, speed, size)
  sfx('shoot'); beginMove(rs.cs, chargedMove(r.data), r.scale, { kind: 'charged', hit: -1, coef: r.coef, last: true, lunge: false, angle: rs.facing, power });
  const staff = wc.id === 'staff'; const b = nextHitBonus(rs.cs); consumeBonus(rs.cs);
  const pj = rs.spawnProj(staff ? 'pj_orb_magic' : 'pj_bolt', rs.px, rs.py - 20, rs.facing, (staff ? 380 : 620) * r.data.speed, (staff ? 10 : 8) * r.data.size,
    r.coef * (1 + b.bonusPct / 100), { pierce: wc.pierce + r.data.pierce, homing: staff ? Math.max(0.3, wc.homing) : wc.homing, magicShare: wc.magicShare });
  (pj as any).charged = true; pj.sprite.setTint(0xfff3b0);
  rs.cameras.main.shake(...SHAKE[1]);
}

/** Context for hitEnemy during a melee strike (set by RunScene.strike, cleared after). */
export function strikeCtx(rs: RS, m: MoveData, p: Pending): StrikeCtx {
  const b = nextHitBonus(rs.cs);
  return { move: m, bonusPct: b.bonusPct, forceCrit: b.forceCrit, critBonus: p.kind === 'charged' ? chargedFor(rs.wcfg).critBonus : 0, charged: p.kind === 'charged' };
}

interface HitOpts { knock?: number; knockMul?: number; melee?: boolean; spell?: boolean; noTrigger?: boolean; flat?: number }
/** After damage is applied in hitEnemy: poise/weight knockback, stagger, hit-stop, shake tier, directional spark. */
export function impact(rs: RS, e: any, o: HitOpts, amt: number, crit: boolean, sk: StrikeCtx | null, projCharged = false) {
  const m = sk?.move;
  // poise + knockback (bosses/dummies/turrets: no knockback, bosses never stagger — patterns stay intact)
  let broke = false;
  if (!e.boss && !e.dummy) {
    let ent = poiseMap.get(e); const now = rs.time.now;
    if (!ent) { ent = { p: newPoise({ radius: e.radius, elite: e.def?.elite }), last: now }; poiseMap.set(e, ent); }
    tickPoise(ent.p, (now - ent.last) / 1000); ent.last = now;
    const pd = m ? m.poise : (o.knock !== undefined ? 6 * (o.knockMul ?? 1) : 0);
    if (pd > 0) broke = damagePoise(ent.p, pd);
    if (broke) { applyStatus(e.status, 'stun', 1, 0, STAGGER_TIME); rs.floatText(e.agent.x, e.agent.y - 66, t('combat.stagger'), '#ffd27a', 15); G.logEvent('stagger', { id: e.id }); }
    if (o.knock !== undefined && e.agent.ai !== 'turret') {
      const k = knockImpulse(rs.wcfg.knockback, (o.knockMul ?? 1) * (m ? m.knock : 1), weightOf({ radius: e.radius, elite: e.def?.elite }), broke);
      e.kvx += Math.cos(o.knock) * k; e.kvy += Math.sin(o.knock) * k;
    }
  }
  const info = { amount: amt, targetMaxHp: e.maxHp, crit, melee: !!o.melee, finisher: m?.finisher, charged: !!sk?.charged || projCharged, hitstopMul: m?.hitstop, kill: e.hp <= 0 && !e.dummy, broke };
  rs.hitStop = Math.max(rs.hitStop, hitStopFor(info));
  const tier = shakeTierFor(info, (m?.shake ?? 0) as ShakeTier);
  if (tier > 0) rs.cameras.main.shake(...SHAKE[tier]);
  // directional spark at the contact edge (existing fx art), bigger for crits / finishers
  const a = o.knock ?? Math.atan2(e.agent.y - rs.py, e.agent.x - rs.px);
  const sx = e.agent.x - Math.cos(a) * e.radius * 0.6, sy = e.agent.y - 20 - Math.sin(a) * e.radius * 0.4;
  const size = (crit ? 60 : 44) * (m?.finisher || sk?.charged ? 1.25 : 1);
  spark(rs, crit ? 'fx_crit' : 'fx_hit', sx, sy, a, size);
  if (o.melee && (m?.finisher || sk?.charged)) spark(rs, 'fx_slash_small', sx, sy, a + Math.PI / 2, size * 0.9);
}
function spark(rs: RS, key: string, x: number, y: number, a: number, size: number) {
  fxAt(rs, key, x, y, size, 3200)?.setRotation(a); // pooled (src/game/fxPool.ts): no sprite/tween per hit
}

/** hurtPlayer bailed out on i-frames: a real threat during the first frames of a dash = perfect dodge. */
export function dodged(rs: RS, src?: any) {
  const cs = rs.cs;
  const threat = !src || src.boss || src.chargeT > 0 || src.agent?.state === 'dash' || src.agent?.ai === 'exploder';
  if (!threat) return;
  if (!tryPerfectDodge(cs, rs.dashT > 0 || cs.sinceDash <= DASH_IFRAMES)) return;
  sfx('crit'); rs.floatText(rs.px, rs.py - 66, t('combat.perfectDodge'), '#9be4ff', 20);
  // afterimages come from the hero rig's pooled dash ghosts (playDash in RunScene.startDash)
  rs.cameras.main.flash(90, 190, 236, 255);
  G.logEvent('perfectDodge', {});
}

/** Perfect guard against a melee/contact source: stagger (poise break + shove), riposte (next hit crits). */
export function parried(rs: RS, src?: any) {
  onParry(rs.cs); rs.hitStop = Math.max(rs.hitStop, 0.09); rs.cameras.main.shake(...SHAKE[3]);
  spark(rs, 'fx_crit', rs.px + Math.cos(rs.facing) * 22, rs.py - 22, rs.facing, 70);
  if (src && !src.boss && !src.dead) {
    const ent = poiseMap.get(src); if (ent) ent.p.cur = ent.p.max;
    applyStatus(src.status, 'stun', 1, 0, Math.max(1.2, STAGGER_TIME));
    const a = Math.atan2(src.agent.y - rs.py, src.agent.x - rs.px); const k = 320 / weightOf({ radius: src.radius, elite: src.def?.elite });
    src.kvx += Math.cos(a) * k; src.kvy += Math.sin(a) * k;
  }
  G.logEvent('parry', { proj: false });
}
/** Perfect guard against a projectile: reflect it back as a player projectile (+50% damage). */
export function reflect(rs: RS, p: any) {
  onParry(rs.cs);
  const n = rs.nearestEnemy(p.x, p.y, 700); const sp = Math.hypot(p.vx, p.vy) * 1.2;
  const a = n ? Math.atan2(n.agent.y - 14 - p.y, n.agent.x - p.x) : Math.atan2(-p.vy, -p.vx);
  p.from = 'player'; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.dmg = Math.max(1, Math.round(p.dmg * 1.5)); p.life = 1.5; p.hit = new Set(); p.pierce = 0; p.homing = 0;
  p.sprite.setTint(0xfff3b0).setRotation(a);
  rs.hitStop = Math.max(rs.hitStop, 0.06); rs.cameras.main.shake(...SHAKE[2]);
  rs.floatText(rs.px, rs.py - 80, t('combat.reflect'), '#ffe7a0', 16);
  G.logEvent('parry', { proj: true });
}

function drawCharge(rs: RS) {
  let g = ringMap.get(rs);
  if (!g || !g.active) { g = rs.add.graphics().setDepth(3300); ringMap.set(rs, g); }
  g.clear(); const cs = rs.cs; if (!cs.charging) return;
  const x = rs.px, y = rs.py - 62, r = 13;
  g.fillStyle(0x3b2416, 0.75).fillCircle(x, y, r + 3);
  g.lineStyle(5, cs.full ? 0xfff3b0 : 0xf4a63b, 1).beginPath().arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, cs.charge)).strokePath();
  if (cs.full && Math.floor(rs.time.now / 80) % 2) g.fillStyle(0xffffff, 0.5).fillCircle(x, y, r - 4);
}
