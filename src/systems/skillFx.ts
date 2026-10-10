// Scene glue for active skills (v2 skills polish): spell quick slots (1/2) and the weapon special (F/L/touch).
// Input (hold = aim preview, release = cast, right-click / drag-out = cancel), 120 ms cast buffer, wind-up with a rig pose,
// commit (MP + cooldown) at the end of the wind-up, cancel by dash / guard / getting hit, per-skill VFX (one pooled
// Graphics for rings/lines/bolts + the fxPool sprites), hit-stop + shake, distinct SFX, touch button cooldown overlay.
// Pure rules + tuning: ./skills.ts (unit-tested). Docs: docs/V2_SKILLS.md.
import Phaser from 'phaser';
import type { RunScene } from '../scenes/RunScene';
import { sfx, type Sfx } from '../game/audio';
import { G } from '../game/state';
import { iconRef } from '../game/assets';
import { playAttack } from '../game/heroAnim';
import { applyStatus, chainTargets } from './status';
import { trySpecial, iaidoRelease } from './weapons';
import { SHAKE } from './combat';
import { chainCount, spellEchoes } from './specials';
import { getArtifact } from './registry';
import {
  SPELL, SPECIAL, SKILL_KEYS, checkCast, effectiveCooldown, cooldownFrac, bufferCast, tickCasts, canCast, nextBuffered, beginCast, windupDone,
  cancelCast, commitCast, denyCast, resolveAim, aimReach, spellCrit, spellHit, newCasts, type SkillKey, type AimShape, type CastCheck, type CastState,
} from './skills';
import type { SpellSlot } from './effects';

type RS = RunScene & Record<string, any>;
interface Vfx { kind: 'ring' | 'line' | 'bolt' | 'disc'; x: number; y: number; x2: number; y2: number; r0: number; r1: number; w: number; color: number; t: number; life: number; pts?: number[] }
interface St { aim: Phaser.GameObjects.Graphics; vfx: Phaser.GameObjects.Graphics; touch: Phaser.GameObjects.Graphics | null; list: Vfx[]; chargeWant: boolean; perfectPing: boolean;
  preview: { visible: boolean; key: SkillKey | ''; kind: string; angle: number; ok: boolean; cancel: boolean } }
const STATE = new WeakMap<object, St>();
const ELEMENT_COLOR: Record<string, number> = { ice: 0x9be4ff, lightning: 0xfff07a, fire: 0xff8a3a, physical: 0xffffff };

function st(rs: RS): St {
  let s = STATE.get(rs);
  if (!s || !s.aim.active) {
    s = { aim: rs.add.graphics().setDepth(3), vfx: rs.add.graphics().setDepth(3150), touch: null, list: [], chargeWant: false, perfectPing: false,
      preview: { visible: false, key: '', kind: '', angle: 0, ok: true, cancel: false } };
    if (rs.ctl?.touch) s.touch = rs.add.graphics().setScrollFactor(0).setDepth(9001);
    STATE.set(rs, s);
    // touch buttons show the spell artifact's icon / weapon icon
    for (let i = 0; i < 2; i++) { const a = rs.spells[i] ? getArtifact(rs.spells[i].source.split('<')[0]) : undefined; if (a) { const ir = iconRef(rs, a.icon); rs.ctl.setSkillIcon(i ? 'spell2' : 'spell1', ir.tex, ir.frame); } }
    const wi = iconRef(rs, rs.wcfg.def.icon); rs.ctl.setSkillIcon('special', wi.tex, wi.frame);
  }
  return s;
}
const casts = (rs: RS): CastState => (rs.casts ??= newCasts());

// ---------------- per-skill lookups ----------------
const spellOf = (rs: RS, k: SkillKey): SpellSlot | undefined => (k === 'spell1' ? rs.spells[0] : k === 'spell2' ? rs.spells[1] : undefined);
export function costOf(rs: RS, k: SkillKey): number { if (k === 'special') return rs.wcfg.specialCost; return spellOf(rs, k)?.mpCost ?? 0; }
export function baseCooldownOf(rs: RS, k: SkillKey): number { if (k === 'special') return SPECIAL[rs.wcfg.id as keyof typeof SPECIAL].cooldown; return spellOf(rs, k)?.cooldown ?? 0; }
export const cooldownOf = (rs: RS, k: SkillKey) => effectiveCooldown(baseCooldownOf(rs, k), rs.stats.cooldownPct);
const has = (rs: RS, k: SkillKey) => k === 'special' || !!spellOf(rs, k);
const tuneOf = (rs: RS, k: SkillKey) => (k === 'special' ? SPECIAL[rs.wcfg.id as keyof typeof SPECIAL] : SPELL[spellOf(rs, k)!.spell]);
/** Aim shape with the live numbers (blink distance from power, nova radius from Anvil mods, spin reach). */
export function aimOf(rs: RS, k: SkillKey): AimShape {
  const a = { ...tuneOf(rs, k).aim };
  if (k !== 'special') { const sl = spellOf(rs, k)!; if (sl.spell === 'blink') a.range = Math.max(80, sl.power); }
  else if (rs.wcfg.id === 'staff') a.radius = rs.wcfg.novaRadius;
  else if (rs.wcfg.id === 'greatsword') a.radius = rs.wcfg.range * 1.1 + 14;
  return a;
}
const isCharge = (rs: RS, k: SkillKey) => k === 'special' && SPECIAL[rs.wcfg.id as keyof typeof SPECIAL].mode === 'charge';
const castOpen = (rs: RS) => canCast(rs.cs, { dashing: rs.dashT > 0, guarding: rs.ws.guarding, charging: rs.ws.charging || rs.cs.charging, spinning: rs.spinT > 0, casting: casts(rs).phase === 'windup' });

function aimNow(rs: RS, k: SkillKey): number {
  const c = rs.ctl; const a = aimOf(rs, k);
  const mouse = c.aimSet && !c.touch ? c.aim : null;
  const drag = c.skillDrag[k];
  const tgt = (!drag || drag.mode !== 'aim') && mouse === null ? rs.nearestEnemy(rs.px, rs.py, Math.max(120, aimReach(a) + 60)) : null;
  return resolveAim({ drag, mouse, target: tgt ? { x: tgt.agent.x, y: tgt.agent.y } : null, px: rs.px, py: rs.py, facing: rs.facing });
}
function deny(rs: RS, k: SkillKey, reason: CastCheck) {
  denyCast(casts(rs), k, reason); sfx('deny');
  if (reason === 'mp') rs.floatText(rs.px, rs.py - 74, 'Thiếu MP!', '#7fc8ff', 16);
  else if (reason === 'target') rs.floatText(rs.px, rs.py - 74, 'Không có mục tiêu', '#ffd9a0', 15);
  G.logEvent('skillDeny', { key: k, reason });
}
/** Tap / release of a skill → buffered cast (or a deny flash). Also used by SIM queue presses. */
export function request(rs: RS, k: SkillKey) {
  const cs = casts(rs);
  const r = checkCast(cs.slots[k].cd, rs.run.mp, costOf(rs, k), has(rs, k));
  if (r !== 'ok') { deny(rs, k, r); return; }
  bufferCast(cs, k, aimNow(rs, k));
}

// ---------------- per frame ----------------
export function frame(rs: RS, dt: number) {
  const S = st(rs); const cs = casts(rs); const c = rs.ctl;
  for (const k of tickCasts(cs, dt)) { sfx('ready'); G.logEvent('skillReady', { key: k }); }
  // cancel rules (same as an attack startup): dash, guard, stun
  if (cs.phase === 'windup' && (rs.dashT > 0 || rs.ws.guarding)) cancel(rs, 'dash');
  // input edges
  for (const k of SKILL_KEYS) {
    const down = c.takeSkillDown(k); const up = c.takeSkillUp(k);
    if (isCharge(rs, k)) {
      if (down) S.chargeWant = true;
      if (up) { S.chargeWant = false; if (rs.ws.charging) releaseCharge(rs, up === 'cancel'); }
      continue;
    }
    if (down && !has(rs, k)) deny(rs, k, 'empty');
    if (up === 'cast') request(rs, k);
    else if (up === 'cancel') { sfx('cancel'); G.logEvent('skillCancel', { key: k, by: 'input' }); }
  }
  // charge-type special: start the charge as soon as the window opens while the key is held
  if (S.chargeWant && c.skillHeld.special && !rs.ws.charging && rs.spinT <= 0) {
    if (castOpen(rs)) {
      const r = checkCast(cs.slots.special.cd, rs.run.mp, rs.wcfg.specialCost);
      if (r === 'ok') { rs.ws.charging = true; rs.ws.charge = 0; S.perfectPing = false; sfx('cast'); G.logEvent('skillCharge', { w: rs.wcfg.id }); }
      else deny(rs, 'special', r);
      S.chargeWant = false;
    }
  } else if (!c.skillHeld.special) S.chargeWant = false;
  if (rs.ws.charging && rs.wcfg.id === 'katana') { // iaido: a glint + ping when the perfect window opens
    const t = rs.ws.charge; const w = rs.wcfg.iaidoWindow, p = rs.wcfg.iaidoPerfectAt;
    if (!S.perfectPing && t >= p - w) { S.perfectPing = true; sfx('ready'); rs.fxAt('fx_crit', rs.px + Math.cos(rs.facing) * 18, rs.py - 26, 34); }
  }
  // buffered → wind-up
  if (cs.phase === 'idle') { const k = nextBuffered(cs); if (k && castOpen(rs)) start(rs, k); }
  const done = windupDone(cs); if (done) perform(rs, done, cs.angle);
  drawPreview(rs, S); drawVfx(rs, S, dt); drawTouch(rs, S);
}
/** Player got hit: a wind-up is interrupted unless the weapon has super armor (greatsword), like an attack startup. */
export function onHurt(rs: RS) { if (!rs.wcfg.superArmor && casts(rs).phase === 'windup') cancel(rs, 'hurt'); }
function cancel(rs: RS, by: string) { const k = cancelCast(casts(rs)); if (k) { sfx('cancel'); G.logEvent('skillCancel', { key: k, by }); } }

function start(rs: RS, k: SkillKey) {
  const cs = casts(rs); const r = checkCast(cs.slots[k].cd, rs.run.mp, costOf(rs, k), has(rs, k));
  if (r !== 'ok') { deny(rs, k, r); return; }
  const a = aimNow(rs, k); const T = tuneOf(rs, k); rs.facing = a;
  if (k === 'special' && rs.wcfg.id === 'dagger' && !daggerTarget(rs, a)) { deny(rs, k, 'target'); return; }
  beginCast(cs, k, T.windup, a);
  const ms = Math.round(T.windup * 1000);
  if (k !== 'special') playAttack(rs, 'cast', 0, ms + 240, { windupMs: ms, angle: a, power: 1.2 });
  else { const w = rs.wcfg.id; playAttack(rs, w === 'swordshield' ? 'bash' : w === 'crossbow' ? 'shoot' : w === 'staff' ? 'cast' : 'stab', 0, ms + 220, { windupMs: ms, angle: a, power: 1.5 }); }
  if (T.windup >= 0.08) { sfx('cast'); ring(rs, rs.px, rs.py - 18, 30, 14, 3, T.color, T.windup); }
}
function perform(rs: RS, k: SkillKey, a: number) {
  const cs = casts(rs); const cost = costOf(rs, k);
  if (rs.run.mp < cost) { deny(rs, k, 'mp'); return; }
  rs.spendMp(cost); commitCast(cs, k, cooldownOf(rs, k)); rs.facing = a;
  const T = tuneOf(rs, k); sfx(T.sfx as Sfx);
  if (k === 'special') { doSpecial(rs, a); G.logEvent('special', { w: rs.wcfg.id }); }
  else {
    const sl = spellOf(rs, k)!; doSpell(rs, sl, a);
    if (spellEchoes(rs.sp, Math.random())) rs.time.delayedCall(250, () => { if (rs.ready) { doSpell(rs, sl, rs.facing); rs.floatText(rs.px, rs.py - 80, 'Lặp lại!', '#c9a3ff', 14); } });
    G.logEvent('spell', { spell: sl.spell });
  }
  G.logEvent('skillCast', { key: k, id: k === 'special' ? rs.wcfg.id : spellOf(rs, k)!.spell, cd: +cs.slots[k].cdMax.toFixed(2), mp: cost });
}

// ---------------- spells ----------------
export function doSpell(rs: RS, sl: SpellSlot, a: number) {
  const T = SPELL[sl.spell]; const c = spellCrit(rs.stats, rs.sp); const crit = Math.random() * 100 < c.chance;
  const dmg = Math.round(spellHit(rs.stats, sl.spell, sl.power) * (crit ? c.mult : 1));
  const hx = rs.px + Math.cos(a) * 16, hy = rs.py - 20 + Math.sin(a) * 10;
  rs.fxAt('fx_spawn', hx, hy, 34);
  const o = { flat: dmg, spell: true, shownCrit: crit, hs: T.hitstop, shk: T.shake };
  switch (sl.spell) {
    case 'icebolt': { const p = rs.spawnProj('pj_icebolt', hx, hy, a, T.speed!, 10, 0, { ...o, status: 'frostbite', element: 'ice' }); p.sprite.setScale(p.sprite.scaleX * 1.2); break; }
    case 'fireball': rs.spawnProj('pj_fireball', hx, hy, a, T.speed!, 13, 0, { ...o, status: 'burn', explode: T.explode, element: 'fire' }); break;
    case 'chainLightning': {
      const n = rs.nearestEnemy(rs.px, rs.py, T.aim.range);
      if (!n) { bolt(rs, hx, hy, hx + Math.cos(a) * 120, hy + Math.sin(a) * 120, T.color); break; }
      bolt(rs, hx, hy, n.agent.x, n.agent.y - 20, T.color); rs.fxAt('fx_shock', n.agent.x, n.agent.y - 20, 56); rs.hitEnemy(n, { ...o, status: 'shock', element: 'lightning' });
      let prev = n; const others = rs.enemies.filter((e: any) => !e.dead && e !== n && (!e.dummy || rs.mode === 'training')).map((e: any) => e.agent);
      for (const ag of chainTargets(n.agent as any, others as any, chainCount(rs.sp)) as any[]) {
        const e = rs.enemies.find((x: any) => x.agent === ag); if (!e) continue;
        bolt(rs, prev.agent.x, prev.agent.y - 20, e.agent.x, e.agent.y - 20, T.color); rs.fxAt('fx_shock', e.agent.x, e.agent.y - 20, 44);
        rs.hitEnemy(e, { flat: Math.round(dmg * T.chainFalloff!), spell: true, shownCrit: crit, status: 'shock', element: 'lightning' }); prev = e;
      }
      break;
    }
    case 'arcaneMissiles': for (let k = 0; k < T.missiles!; k++) rs.time.delayedCall(k * 80, () => { if (!rs.ready) return; const p = rs.spawnProj('pj_orb_magic', rs.px, rs.py - 20, a + (k - (T.missiles! - 1) / 2) * T.spread!, T.speed!, 8, 0, { ...o, homing: 1.2 }); p.sprite.setTint(T.color); }); break;
    case 'shieldBubble': rs.shield = Math.max(rs.shield, sl.power); rs.shieldT = T.shieldTime!; rs.fxAt('fx_heal', rs.px, rs.py - 20, 80); ring(rs, rs.px, rs.py - 20, 20, 52, 5, T.color, 0.35); rs.floatText(rs.px, rs.py - 76, `+${Math.round(sl.power)} khiên`, '#8fe0ff', 16); break;
    case 'blink': {
      const d = Math.max(80, sl.power); const x0 = rs.px, y0 = rs.py; rs.fxAt('fx_dash_dust', rs.px, rs.py, 54);
      rs.moveBy(Math.cos(a) * d, Math.sin(a) * d); rs.iframes = Math.max(rs.iframes, 0.3); rs.cs.sinceDash = 0; // counts as a dash for perfect dodge
      line(rs, x0, y0 - 18, rs.px, rs.py - 18, 8, T.color, 0.22); ring(rs, rs.px, rs.py - 18, 10, 36, 4, T.color, 0.3); rs.fxAt('fx_spawn', rs.px, rs.py - 20, 54);
      break;
    }
  }
}

// ---------------- weapon specials ----------------
function daggerTarget(rs: RS, a: number): any {
  const T = SPECIAL.dagger; let best: any = null, bs = Infinity;
  for (const e of rs.enemies) { if (e.dead || (e.dummy && rs.mode !== 'training')) continue; const d = Math.hypot(e.agent.x - rs.px, e.agent.y - rs.py); if (d > T.dist!) continue;
    let da = Math.abs(Math.atan2(e.agent.y - rs.py, e.agent.x - rs.px) - a) % (Math.PI * 2); if (da > Math.PI) da = Math.PI * 2 - da;
    const score = d + da * 160; if (score < bs) { bs = score; best = e; } } // nearest to the aim direction
  return best;
}
function doSpecial(rs: RS, a: number) {
  const w = rs.wcfg.id; const T = SPECIAL[w as keyof typeof SPECIAL];
  switch (w) {
    case 'swordshield': {
      rs.iframes = Math.max(rs.iframes, T.iframes!); const x0 = rs.px, y0 = rs.py; rs.moveBy(Math.cos(a) * T.dist!, Math.sin(a) * T.dist!);
      let hit = 0;
      for (const e of rs.enemies) if (!e.dead && rs.segDist(e.agent.x, e.agent.y, x0, y0, rs.px, rs.py) < e.radius + 30) { rs.hitEnemy(e, { coef: T.coef, knock: a, knockMul: T.knockMul }); applyStatus(e.status, 'stun', 1, 0, T.stun!); hit++; }
      line(rs, x0, y0 - 14, rs.px, rs.py - 14, 22, T.color, 0.2); rs.fxAt('fx_dash_dust', rs.px, rs.py, 64);
      if (hit) { rs.fxAt('fx_hit', rs.px + Math.cos(a) * 26, rs.py - 18, 70); feel(rs, T.hitstop, T.shake); } break;
    }
    case 'dagger': {
      const n = daggerTarget(rs, a); if (!n) break;
      const x0 = rs.px, y0 = rs.py; rs.fxAt('fx_dash_dust', rs.px, rs.py, 54);
      rs.px = Phaser.Math.Clamp(n.agent.x - Math.cos(n.agent.angle) * (n.radius + 26), 76, 1220); rs.py = Phaser.Math.Clamp(n.agent.y - Math.sin(n.agent.angle) * (n.radius + 26), 164, 658);
      rs.facing = Math.atan2(n.agent.y - rs.py, n.agent.x - rs.px); rs.iframes = Math.max(rs.iframes, T.iframes!);
      line(rs, x0, y0 - 18, rs.px, rs.py - 18, 6, T.color, 0.25); ring(rs, rs.px, rs.py - 18, 8, 30, 3, T.color, 0.25);
      playAttack(rs, 'stab', 0, 180, { windupMs: 0, angle: rs.facing, power: 1.6, reach: 18 });
      rs.hitEnemy(n, { coef: rs.wcfg.coefs[rs.wcfg.coefs.length - 1] * rs.wcfg.backstabMult, forceCrit: true, knock: rs.facing });
      rs.fxAt('fx_crit', n.agent.x, n.agent.y - 22, 70); feel(rs, T.hitstop, T.shake); break;
    }
    case 'crossbow': {
      const p = rs.spawnProj('pj_bolt', rs.px, rs.py - 20, a, T.speed!, T.size!, T.coef, { pierce: 99, hs: T.hitstop, shk: T.shake });
      p.sprite.setTint(T.color).setScale(p.sprite.scaleX * 1.4); line(rs, rs.px, rs.py - 20, rs.px + Math.cos(a) * 60, rs.py - 20 + Math.sin(a) * 60, 10, T.color, 0.15);
      rs.cameras.main.shake(...SHAKE[1]); break;
    }
    case 'staff': {
      const R = rs.wcfg.novaRadius; const col = ELEMENT_COLOR[rs.wcfg.element] ?? 0xffffff; rs.iframes = Math.max(rs.iframes, T.iframes!);
      disc(rs, rs.px, rs.py - 10, R, col, 0.3); ring(rs, rs.px, rs.py - 10, 20, R, 6, col, 0.32); rs.fxAt('fx_explosion', rs.px, rs.py - 14, Math.min(220, R * 1.2));
      const stt = ({ fire: 'burn', ice: 'frostbite', lightning: 'shock' } as Record<string, any>)[rs.wcfg.element];
      let hit = 0;
      for (const e of rs.enemies) if (!e.dead && rs.dist(e.agent, { x: rs.px, y: rs.py }) < R + e.radius) { rs.hitEnemy(e, { coef: T.coef, knock: Math.atan2(e.agent.y - rs.py, e.agent.x - rs.px), knockMul: T.knockMul }); if (stt) applyStatus(e.status, stt, 2, rs.stats[rs.wcfg.element] * 0.15); hit++; }
      feel(rs, hit ? T.hitstop : 0, T.shake); break;
    }
  }
}
/** Release a held charge special (greatsword spin / katana iaido). Cost + cooldown are committed here. */
function releaseCharge(rs: RS, cancelled: boolean) {
  const w = rs.wcfg.id; const T = SPECIAL[w as keyof typeof SPECIAL]; const cs = casts(rs);
  if (cancelled) { rs.ws.charging = false; rs.ws.charge = 0; sfx('cancel'); G.logEvent('skillCancel', { key: 'special', by: 'input' }); return; }
  const r = trySpecial(rs.run.mp, rs.wcfg); if (!r.ok) { rs.ws.charging = false; rs.ws.charge = 0; deny(rs, 'special', 'mp'); return; }
  rs.spendMp(rs.run.mp - r.mp); commitCast(cs, 'special', cooldownOf(rs, 'special'));
  if (w === 'greatsword') {
    rs.ws.charging = false; rs.spinT = rs.wcfg.spinDuration * Math.max(T.minPower!, Math.min(1.5, 0.6 + rs.ws.charge)); rs.ws.charge = 0; rs.spinTick = 0;
    sfx('sk_spin'); ring(rs, rs.px, rs.py - 10, 30, rs.wcfg.range * 1.1 + 14, 5, T.color, 0.3); feel(rs, 0, 1);
  } else {
    const a = rs.facing; const ir = iaidoRelease(rs.ws, rs.wcfg); const len = T.dist!;
    playAttack(rs, 'thrust', 20, 260, { reach: 22, power: 1.6, angle: a, windupMs: 0 });
    const x0 = rs.px, y0 = rs.py; rs.moveBy(Math.cos(a) * len, Math.sin(a) * len); rs.iframes = Math.max(rs.iframes, T.iframes!);
    line(rs, x0, y0 - 16, rs.px, rs.py - 16, ir.perfect ? 14 : 9, ir.perfect ? 0xffe27a : 0xffffff, 0.28);
    let hit = 0;
    for (const e of rs.enemies) if (!e.dead && rs.segDist(e.agent.x, e.agent.y - 10, x0, y0 - 16, rs.px, rs.py - 16) < e.radius + 24) { rs.hitEnemy(e, { coef: T.coef * ir.power, forceCrit: ir.perfect, knock: a }); rs.fxAt(ir.perfect ? 'fx_crit' : 'fx_slash_small', e.agent.x, e.agent.y - 20, 60); hit++; }
    if (ir.perfect) {
      sfx('sk_iaido_perfect'); rs.floatText(rs.px, rs.py - 70, 'Hoàn hảo!', '#ffcb6b', 20);
      if (T.perfectCdRefund) { cs.slots.special.cd = 0; cs.slots.special.pulse = 0.35; }
      feel(rs, T.hitstop + 0.02, 3);
    } else { sfx('sk_iaido'); feel(rs, hit ? T.hitstop * 0.6 : 0, hit ? 2 : 1); }
    G.logEvent('special', { w, perfect: ir.perfect });
    G.logEvent('skillCast', { key: 'special', id: w, perfect: ir.perfect, cd: +cs.slots.special.cdMax.toFixed(2), mp: rs.wcfg.specialCost });
    return;
  }
  G.logEvent('special', { w }); G.logEvent('skillCast', { key: 'special', id: w, cd: +cs.slots.special.cdMax.toFixed(2), mp: rs.wcfg.specialCost });
}
function feel(rs: RS, hs: number, shake: number) { if (hs > 0) rs.hitStop = Math.max(rs.hitStop, hs); if (shake > 0) rs.cameras.main.shake(...SHAKE[shake as 1 | 2 | 3]); }

// ---------------- pooled VFX (one Graphics for every ring / line / bolt) ----------------
const MAX_VFX = 48;
function push(rs: RS, v: Vfx) { const S = st(rs); if (S.list.length >= MAX_VFX) S.list.shift(); S.list.push(v); }
export function ring(rs: RS, x: number, y: number, r0: number, r1: number, w: number, color: number, life: number) { push(rs, { kind: 'ring', x, y, x2: 0, y2: 0, r0, r1, w, color, t: 0, life }); }
export function disc(rs: RS, x: number, y: number, r: number, color: number, life: number) { push(rs, { kind: 'disc', x, y, x2: 0, y2: 0, r0: r * 0.6, r1: r, w: 0, color, t: 0, life }); }
export function line(rs: RS, x: number, y: number, x2: number, y2: number, w: number, color: number, life: number) { push(rs, { kind: 'line', x, y, x2, y2, r0: 0, r1: 0, w, color, t: 0, life }); }
/** Jagged lightning bolt (also used by RunScene.zap for shock chains). */
export function bolt(rs: RS, x: number, y: number, x2: number, y2: number, color = 0xfff07a, life = 0.18) {
  const pts: number[] = [x, y]; for (let i = 1; i < 5; i++) pts.push(x + (x2 - x) * i / 5 + (Math.random() * 20 - 10), y + (y2 - y) * i / 5 + (Math.random() * 20 - 10)); pts.push(x2, y2);
  push(rs, { kind: 'bolt', x, y, x2, y2, r0: 0, r1: 0, w: 3, color, t: 0, life, pts });
}
function drawVfx(rs: RS, S: St, dt: number) {
  const g = S.vfx; g.clear(); let n = 0;
  for (const v of S.list) {
    v.t += dt; if (v.t >= v.life) continue; S.list[n++] = v; const k = v.t / v.life; const al = 1 - k;
    if (v.kind === 'ring') g.lineStyle(Math.max(1, v.w * al), v.color, al).strokeCircle(v.x, v.y, v.r0 + (v.r1 - v.r0) * (1 - (1 - k) * (1 - k)));
    else if (v.kind === 'disc') g.fillStyle(v.color, 0.35 * al).fillCircle(v.x, v.y, v.r0 + (v.r1 - v.r0) * k);
    else if (v.kind === 'line') { g.lineStyle(v.w * (0.4 + 0.6 * al), v.color, al).lineBetween(v.x, v.y, v.x2, v.y2); g.lineStyle(Math.max(1, v.w * 0.35 * al), 0xffffff, al).lineBetween(v.x, v.y, v.x2, v.y2); }
    else if (v.kind === 'bolt' && v.pts) { g.lineStyle(v.w + 2, v.color, 0.35 * al); g.strokePoints(toPts(v.pts)); g.lineStyle(v.w, 0xffffff, al); g.strokePoints(toPts(v.pts)); }
  }
  S.list.length = n;
  // shield bubble stays visible while it holds
  if (rs.shield > 0 && rs.shieldT > 0) { const p = 0.5 + 0.2 * Math.sin(rs.time.now / 140); g.lineStyle(3, 0x8fe0ff, p).strokeCircle(rs.px, rs.py - 20, 30); g.fillStyle(0x8fe0ff, 0.08).fillCircle(rs.px, rs.py - 20, 30); }
}
const PT: Phaser.Math.Vector2[] = Array.from({ length: 6 }, () => new Phaser.Math.Vector2());
function toPts(p: number[]) { for (let i = 0; i < 6; i++) PT[i].set(p[i * 2], p[i * 2 + 1]); return PT; }

// ---------------- aim preview (floor decal while a skill is held / charging / winding up) ----------------
function previewKey(rs: RS): SkillKey | null {
  const cs = casts(rs); if (cs.phase === 'windup') return cs.key;
  if (rs.ws.charging && isCharge(rs, 'special')) return 'special';
  for (const k of SKILL_KEYS) if (rs.ctl.skillHeld[k] && has(rs, k)) return k;
  return null;
}
function drawPreview(rs: RS, S: St) {
  const g = S.aim; g.clear(); const k = previewKey(rs); const P = S.preview;
  if (!k || rs.dashT > 0) { P.visible = false; P.key = ''; return; }
  const cs = casts(rs); const winding = cs.phase === 'windup' && cs.key === k;
  const a = winding ? cs.angle : rs.ws.charging && k === 'special' ? rs.facing : aimNow(rs, k);
  if (!winding && !(rs.ws.charging && k === 'special')) rs.facing = a; // the hero turns to the aim while holding
  const shape = aimOf(rs, k); const T = tuneOf(rs, k);
  const ok = winding || rs.ws.charging || checkCast(cs.slots[k].cd, rs.run.mp, costOf(rs, k)) === 'ok';
  const cancelZone = rs.ctl.skillWillCancel(k);
  let col = cancelZone ? 0xff5a5a : ok ? T.color : 0x8a8a8a;
  if (rs.ws.charging && rs.wcfg.id === 'katana' && k === 'special' && Math.abs(rs.ws.charge - rs.wcfg.iaidoPerfectAt) <= rs.wcfg.iaidoWindow) col = 0xffe27a;
  const fa = winding ? 0.34 : 0.22, la = winding ? 1 : 0.9; const x = rs.px, y = rs.py - 4;
  Object.assign(P, { visible: true, key: k, kind: shape.kind, angle: a, ok, cancel: cancelZone });
  const lineShape = (len: number, w: number) => {
    const cx = Math.cos(a), sy = Math.sin(a), nx = -sy * w / 2, ny = cx * w / 2; const ex = x + cx * len, ey = y + sy * len;
    g.fillStyle(col, fa).fillTriangle(x + nx, y + ny, ex + nx, ey + ny, ex - nx, ey - ny).fillTriangle(x + nx, y + ny, ex - nx, ey - ny, x - nx, y - ny);
    g.lineStyle(2, col, la).lineBetween(x + nx, y + ny, ex + nx, ey + ny).lineBetween(x - nx, y - ny, ex - nx, ey - ny);
    g.fillStyle(col, la).fillTriangle(ex + cx * 12, ey + sy * 12, ex - sy * 9, ey + cx * 9, ex + sy * 9, ey - cx * 9); // arrow head
    return { ex, ey };
  };
  switch (shape.kind) {
    case 'line': { const e = lineShape(shape.range, shape.width); if (shape.radius) g.lineStyle(2, col, la).strokeCircle(e.ex, e.ey, shape.radius).fillStyle(col, fa * 0.8).fillCircle(e.ex, e.ey, shape.radius); break; }
    case 'blink': { const ex = Phaser.Math.Clamp(x + Math.cos(a) * shape.range, 76, 1220), ey = Phaser.Math.Clamp(y + Math.sin(a) * shape.range, 164, 660); const len = Math.hypot(ex - x, ey - y); lineShape(len, 10); g.lineStyle(3, col, la).strokeCircle(ex, ey, shape.radius ?? 18); break; }
    case 'circle': { const R = shape.radius ?? 80; g.fillStyle(col, fa).fillCircle(x, y, R).lineStyle(3, col, la).strokeCircle(x, y, R); break; }
    case 'self': g.lineStyle(3, col, la).strokeCircle(x, y - 16, shape.radius ?? 40); break;
    case 'cone': { const h = shape.half ?? 0.5; g.fillStyle(col, fa).slice(x, y, shape.range, a - h, a + h, false).fillPath(); g.lineStyle(2, col, la).beginPath().arc(x, y, shape.range, a - h, a + h).strokePath().lineBetween(x, y, x + Math.cos(a - h) * shape.range, y + Math.sin(a - h) * shape.range).lineBetween(x, y, x + Math.cos(a + h) * shape.range, y + Math.sin(a + h) * shape.range); break; }
    case 'target': {
      g.lineStyle(2, col, la * 0.5).strokeCircle(x, y, shape.range);
      const tg = k === 'special' && rs.wcfg.id === 'dagger' ? daggerTarget(rs, a) : rs.nearestEnemy(rs.px, rs.py, shape.range);
      if (tg) { const r = tg.radius + 10; const sp = rs.time.now / 300; g.lineStyle(3, col, la).strokeCircle(tg.agent.x, tg.agent.y - 10, r); for (let i = 0; i < 4; i++) { const q = sp + i * Math.PI / 2; g.lineBetween(tg.agent.x + Math.cos(q) * (r + 2), tg.agent.y - 10 + Math.sin(q) * (r + 2), tg.agent.x + Math.cos(q) * (r + 10), tg.agent.y - 10 + Math.sin(q) * (r + 10)); } g.lineStyle(1, col, la * 0.6).lineBetween(x, y, tg.agent.x, tg.agent.y - 10); }
      break;
    }
  }
  if (winding) { const p = Math.min(1, cs.t / Math.max(0.01, cs.windup)); g.lineStyle(4, col, 1).beginPath().arc(rs.px, rs.py - 18, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p).strokePath(); }
}

// ---------------- touch buttons: cooldown sweep / MP dim / ready pulse / deny flash ----------------
function drawTouch(rs: RS, S: St) {
  const g = S.touch; if (!g) return; g.clear(); const cs = casts(rs);
  for (const k of SKILL_KEYS) {
    const b = rs.ctl.skillButtons[k]; if (!b || !b.c.visible) continue; const x = b.c.x, y = b.c.y, r = b.r; const s = cs.slots[k];
    if (!has(rs, k)) { g.fillStyle(0x000000, 0.45).fillCircle(x, y, r); continue; }
    const f = cooldownFrac(s.cd, s.cdMax);
    if (f > 0) g.fillStyle(0x000000, 0.55).slice(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f, false).fillPath();
    if (rs.run.mp < costOf(rs, k)) g.fillStyle(0x2a5a9a, 0.45).fillCircle(x, y, r);
    if (s.deny > 0) g.lineStyle(5, 0xff4a4a, s.deny / 0.35).strokeCircle(x, y, r + 2);
    if (s.pulse > 0) { const q = 1 - s.pulse / 0.35; g.lineStyle(4, 0xffffff, 1 - q).strokeCircle(x, y, r + 4 + q * 14); }
    if (rs.ctl.skillHeld[k]) g.lineStyle(3, rs.ctl.skillWillCancel(k) ? 0xff5a5a : 0xfff3b0, 0.9).strokeCircle(x, y, 110); // drag past this ring = cancel
  }
}

/** Debug/smoke handle: window.__TSSkills.state(). */
export function debugState(rs: RS) {
  const cs = casts(rs); const S = STATE.get(rs);
  return { phase: cs.phase, key: cs.key, slots: Object.fromEntries(SKILL_KEYS.map((k) => [k, { cd: +cs.slots[k].cd.toFixed(2), cdMax: +cs.slots[k].cdMax.toFixed(2), pulse: cs.slots[k].pulse, deny: cs.slots[k].deny, reason: cs.slots[k].denyReason, cost: costOf(rs, k), has: has(rs, k) }])), preview: S ? { ...S.preview } : null, vfx: S?.list.length ?? 0 };
}
if (typeof window !== 'undefined') (window as any).__TSSkills = {
  state() { const g = (window as any).__game; const rs = g?.scene?.getScene('Run'); return rs && rs.stats && rs.casts ? debugState(rs) : null; },
};
