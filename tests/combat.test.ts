import { describe, it, expect } from 'vitest';
import {
  LIGHT, CHARGED, moveFor, lightCooldown, newCombat, tickCombat, beginMove, canDash, takeDash, bufferDash, onDash, onHurt, stepAttack,
  tryPerfectDodge, timeScale, tickReal, nextHitBonus, consumeBonus, guardOpen, guardClose, onParry, newPoise, damagePoise, tickPoise, weightOf,
  knockImpulse, hitStopFor, shakeTierFor, moveMul, chargedMove, cancelStartup,
  BUFFER, HOLD_DELAY, MIN_CHARGE, OVERCHARGE, PERFECT_DODGE_WINDOW, SLOWMO_SCALE, COUNTER_BONUS, PARRY_LOCKOUT, POISE_REGEN_DELAY, DASH_IFRAMES,
  type AttackInput, type Pending,
} from '../src/systems/combat';
import { buildWeapon, newWeaponState, tryAttack, tickWeapon, tryCharged, canCharge, chargedFor, addFury, PERFECT_GUARD } from '../src/systems/weapons';
import { DASH_TIME } from '../src/systems/stats';
import type { WeaponId } from '../src/data/types';

const IDS: WeaponId[] = ['swordshield', 'greatsword', 'dagger', 'katana', 'crossbow', 'staff'];
const MELEE: WeaponId[] = ['swordshield', 'greatsword', 'dagger', 'katana'];
const P: Pending = { kind: 'light', hit: 0, coef: 1, last: false, lunge: false, angle: 0, power: 0 };
const inp = (o: Partial<AttackInput> = {}): AttackInput => ({ pressed: false, held: false, canAttack: true, canCharge: true, ready: true, chargeTime: 0.5, ...o });
const chainTime = (id: WeaponId) => LIGHT[id].reduce((a, m) => a + m.startup + m.cancel, 0);

describe('frame data (docs/COMBAT.md)', () => {
  it('every weapon has a light chain and a charged attack; windows are ordered', () => {
    for (const id of IDS) {
      expect(LIGHT[id].length).toBeGreaterThan(0); expect(CHARGED[id].chargeTime).toBeGreaterThan(0);
      for (const m of LIGHT[id]) { expect(m.cancel).toBeLessThanOrEqual(m.recovery); expect(m.dashCancel).toBeLessThanOrEqual(m.recovery); expect(m.startup).toBeGreaterThanOrEqual(0); }
    }
  });
  it('melee chains match the weapon combo length; finisher hits harder (knock, poise) than the lights', () => {
    for (const id of MELEE) {
      const c = buildWeapon(id); expect(LIGHT[id].length).toBe(c.coefs.length);
      const fin = LIGHT[id][LIGHT[id].length - 1]; expect(fin.finisher).toBe(true);
      for (const m of LIGHT[id].slice(0, -1)) { expect(fin.knock).toBeGreaterThan(m.knock); expect(fin.poise).toBeGreaterThan(m.poise); }
    }
  });
  it('lights alternate sweep direction so consecutive swings read differently', () => {
    for (const id of MELEE) { const l = LIGHT[id]; if (l.length >= 2) expect(l[0].sweep).not.toBe(l[1].sweep); }
  });
  it('weapons feel distinct: dagger fastest/no startup, greatsword slowest/most committed, katana finisher is a long thrust', () => {
    expect(LIGHT.dagger[0].startup).toBe(0); expect(LIGHT.dagger[0].dashCancel).toBe(0);
    const perHit = (id: WeaponId) => chainTime(id) / LIGHT[id].length;
    expect(perHit('dagger')).toBeLessThan(perHit('swordshield')); expect(perHit('swordshield')).toBeLessThan(perHit('greatsword'));
    expect(perHit('katana')).toBeLessThan(perHit('greatsword'));
    for (const id of ['swordshield', 'dagger', 'katana'] as WeaponId[]) expect(LIGHT.greatsword[0].startup).toBeGreaterThan(LIGHT[id][0].startup);
    expect(LIGHT.greatsword.every((m) => !m.feint)).toBe(true); expect(LIGHT.greatsword[0].moveMul).toBeLessThan(LIGHT.dagger[0].moveMul);
    const kt = LIGHT.katana[2]; expect(kt.lunge).toBeGreaterThanOrEqual(50); expect(kt.arc).toBeLessThan(1); expect(kt.range).toBeGreaterThan(1);
    expect(buildWeapon('greatsword').range * LIGHT.greatsword[0].range).toBeGreaterThan(buildWeapon('dagger').range * LIGHT.dagger[0].range);
  });
  it('extra hits from the Anvil reuse non-finisher hits; the last hit is always the finisher', () => {
    expect(moveFor('swordshield', 3, 4).finisher).toBe(true); expect(moveFor('swordshield', 2, 4).finisher).toBe(false);
    expect(moveFor('dagger', 4, 5)).toBe(LIGHT.dagger[3]); expect(moveFor('crossbow', 0, 1)).toBe(LIGHT.crossbow[0]);
  });
});

describe('tryAttack uses frame data', () => {
  it('melee cooldown = startup + chain window, scaled by attack speed and fury', () => {
    const c = buildWeapon('greatsword'); const s = newWeaponState(c);
    const h = tryAttack(s, c, 100)!; expect(s.cooldown).toBeCloseTo(lightCooldown(LIGHT.greatsword[0], 1)); expect(h.move).toBe(LIGHT.greatsword[0]);
    const s2 = newWeaponState(c); tryAttack(s2, c, 200); expect(s2.cooldown).toBeCloseTo(lightCooldown(LIGHT.greatsword[0], 0.5));
    const d = buildWeapon('dagger'); const ds = newWeaponState(d); for (let i = 0; i < 20; i++) addFury(ds, d); const fh = tryAttack(ds, d, 100)!; expect(fh.scale).toBeCloseTo(1 / 1.5);
  });
  it('ranged keeps the v1 cadence (crossbow magazine unaffected)', () => {
    const c = buildWeapon('crossbow'); const s = newWeaponState(c); tryAttack(s, c); expect(s.cooldown).toBeCloseTo(c.interval * 1.6);
  });
  it('charged attack: crossbow spends ammo, cannot charge while reloading; power scales the coefficient', () => {
    const c = buildWeapon('crossbow'); const s = newWeaponState(c);
    expect(canCharge(s, c)).toBe(true); const r = tryCharged(s, c, 1)!; expect(s.ammo).toBe(5); expect(r.data.pierce).toBeGreaterThan(0);
    s.ammo = 0; s.reloading = 1; expect(canCharge(s, c)).toBe(false); expect(tryCharged(s, c, 1)).toBeNull();
    const g = buildWeapon('greatsword'); const gs = newWeaponState(g);
    const lo = tryCharged(gs, g, MIN_CHARGE)!.coef, hi = tryCharged(newWeaponState(g), g, 1)!.coef; expect(hi).toBeGreaterThan(lo); expect(hi).toBeCloseTo(CHARGED.greatsword.coef);
    expect(gs.combo).toBe(0);
  });
  it('Anvil charge-speed upgrades shorten the hold', () => { expect(chargedFor(buildWeapon('greatsword', ['gs_quick_charge'])).chargeTime).toBeLessThan(CHARGED.greatsword.chargeTime); });
});

describe('input buffer, hold-to-charge (touch-friendly)', () => {
  it('a tap fires a light immediately', () => { const cs = newCombat(); expect(stepAttack(cs, inp({ pressed: true, held: true }), 0.016)).toEqual([{ type: 'light' }]); });
  it('a press during cooldown is buffered for BUFFER s, then dropped', () => {
    const cs = newCombat();
    expect(stepAttack(cs, inp({ pressed: true, ready: false }), 0.016)).toEqual([]);
    tickCombat(cs, BUFFER * 0.6); expect(stepAttack(cs, inp({ ready: true }), 0.016)).toEqual([{ type: 'light' }]);
    const cs2 = newCombat(); stepAttack(cs2, inp({ pressed: true, ready: false }), 0.016); tickCombat(cs2, BUFFER + 0.01);
    expect(stepAttack(cs2, inp({ ready: true }), 0.016)).toEqual([]);
  });
  it('lights never fire during a startup', () => {
    const cs = newCombat(); beginMove(cs, LIGHT.greatsword[0], 1, P);
    expect(stepAttack(cs, inp({ pressed: true }), 0.016)).toEqual([]);
    const p = tickCombat(cs, LIGHT.greatsword[0].startup + 0.001); expect(p).toBe(P); expect(cs.phase).toBe('recovery');
  });
  it('hold → charge after HOLD_DELAY; short release cancels; long release fires charged', () => {
    const cs = newCombat(); stepAttack(cs, inp({ pressed: true, held: true }), 0.016);
    let cmds = stepAttack(cs, inp({ held: true, ready: false }), HOLD_DELAY); expect(cmds).toEqual([{ type: 'chargeStart' }]); expect(cs.charging).toBe(true);
    stepAttack(cs, inp({ held: true }), 0.1); cmds = stepAttack(cs, inp({ held: false }), 0.016); expect(cmds).toEqual([{ type: 'chargeCancel' }]);
    stepAttack(cs, inp({ held: true }), HOLD_DELAY); stepAttack(cs, inp({ held: true }), 0.4);
    cmds = stepAttack(cs, inp({ held: false }), 0.016); expect(cmds[0].type).toBe('charged'); expect((cmds[0] as any).power).toBeGreaterThanOrEqual(MIN_CHARGE);
  });
  it('full charge held OVERCHARGE auto-releases at power 1 (never stuck holding on touch)', () => {
    const cs = newCombat(); stepAttack(cs, inp({ held: true }), HOLD_DELAY);
    const a = stepAttack(cs, inp({ held: true }), 0.5); expect(a).toEqual([{ type: 'chargeFull' }]);
    const b = stepAttack(cs, inp({ held: true }), OVERCHARGE); expect(b).toEqual([{ type: 'charged', power: 1 }]); expect(cs.charging).toBe(false);
  });
  it('no charge when the weapon cannot (guarding, reloading)', () => {
    const cs = newCombat(); expect(stepAttack(cs, inp({ held: true, canCharge: false }), HOLD_DELAY + 0.1)).toEqual([]);
    const cs2 = newCombat(); stepAttack(cs2, inp({ held: true }), HOLD_DELAY); expect(stepAttack(cs2, inp({ held: true, canAttack: false }), 0.016)).toEqual([{ type: 'chargeCancel' }]);
  });
  it('charging slows movement', () => { const cs = newCombat(); stepAttack(cs, inp({ held: true }), HOLD_DELAY); expect(moveMul(cs, 0.5)).toBe(0.5); });
});

describe('cancel windows and dash', () => {
  it('dash during recovery only after dashCancel; buffered dash fires as soon as the window opens (coyote)', () => {
    const cs = newCombat(); const m = LIGHT.swordshield[2]; beginMove(cs, m, 1, P); tickCombat(cs, m.startup + 0.001);
    bufferDash(cs); expect(takeDash(cs, true)).toBe(false); // too early: still committed
    tickCombat(cs, m.dashCancel - 0.05); bufferDash(cs); expect(takeDash(cs, true)).toBe(false);
    tickCombat(cs, 0.06); expect(cs.dashBuf).toBeGreaterThan(0); expect(takeDash(cs, true)).toBe(true);
  });
  it('a stale dash press expires after BUFFER', () => { const cs = newCombat(); bufferDash(cs); tickCombat(cs, BUFFER + 0.01); expect(takeDash(cs, true)).toBe(false); });
  it('no dash charge = no dash', () => { const cs = newCombat(); bufferDash(cs); expect(takeDash(cs, false)).toBe(false); });
  it('feint: dagger/sword startup can be dash-cancelled, greatsword cannot', () => {
    const a = newCombat(); beginMove(a, LIGHT.katana[2], 1, P); expect(canDash(a)).toBe(true);
    const b = newCombat(); beginMove(b, LIGHT.greatsword[0], 1, P); expect(canDash(b)).toBe(false);
    onDash(a); expect(a.phase).toBe('idle'); expect(a.pending).toBeNull();
  });
  it('guard during a wind-up drops the strike', () => { const cs = newCombat(); beginMove(cs, LIGHT.swordshield[2], 1, P); cancelStartup(cs); expect(tickCombat(cs, 1)).toBeNull(); });
  it('getting hit interrupts startup unless super armor (greatsword)', () => {
    const a = newCombat(); beginMove(a, LIGHT.katana[0], 1, P); onHurt(a, false); expect(tickCombat(a, 1)).toBeNull();
    const b = newCombat(); beginMove(b, LIGHT.greatsword[0], 1, P); onHurt(b, buildWeapon('greatsword').superArmor); expect(tickCombat(b, 1)).toBe(P);
  });
  it('recovery ends and movement returns to full speed', () => {
    const cs = newCombat(); const m = LIGHT.greatsword[1]; beginMove(cs, m, 1, P); tickCombat(cs, m.startup + 0.001); expect(moveMul(cs)).toBeCloseTo(m.moveMul);
    tickCombat(cs, m.recovery + 0.01); expect(cs.phase).toBe('idle'); expect(moveMul(cs)).toBe(1);
  });
  it('charged move shares the machinery', () => { const m = chargedMove(CHARGED.greatsword); expect(m.finisher).toBe(true); expect(m.startup).toBe(CHARGED.greatsword.startup); });
});

describe('dash i-frames & perfect dodge', () => {
  it('i-frame window covers the dash plus a small tail', () => { expect(DASH_IFRAMES).toBeCloseTo(DASH_TIME + 0.05); expect(PERFECT_DODGE_WINDOW).toBeLessThan(DASH_IFRAMES); });
  it('a threat within the window = perfect dodge: slow-mo + next hit bonus; then cooldown', () => {
    const cs = newCombat(); onDash(cs); tickCombat(cs, PERFECT_DODGE_WINDOW * 0.5);
    expect(tryPerfectDodge(cs, true)).toBe(true); expect(timeScale(cs)).toBe(SLOWMO_SCALE); expect(nextHitBonus(cs).bonusPct).toBe(COUNTER_BONUS);
    expect(tryPerfectDodge(cs, true)).toBe(false); // cooldown
    tickReal(cs, 1); expect(timeScale(cs)).toBe(1);
    consumeBonus(cs); expect(nextHitBonus(cs).bonusPct).toBe(0);
  });
  it('late in the dash or not dashing = plain dodge', () => {
    const cs = newCombat(); onDash(cs); tickCombat(cs, PERFECT_DODGE_WINDOW + 0.02); expect(tryPerfectDodge(cs, true)).toBe(false);
    const cs2 = newCombat(); expect(tryPerfectDodge(cs2, false)).toBe(false);
  });
});

describe('guard / perfect parry', () => {
  it('fresh guard opens the perfect window; re-raising right after dropping it (spam) does not', () => {
    const cs = newCombat(); expect(guardOpen(cs, PERFECT_GUARD)).toBe(0);
    guardClose(cs); tickCombat(cs, PARRY_LOCKOUT * 0.5); expect(guardOpen(cs, PERFECT_GUARD)).toBeGreaterThan(PERFECT_GUARD);
    guardClose(cs); tickCombat(cs, PARRY_LOCKOUT + 0.01); expect(guardOpen(cs, PERFECT_GUARD)).toBe(0);
  });
  it('a successful parry lifts the lockout and grants a riposte crit', () => {
    const cs = newCombat(); guardOpen(cs, PERFECT_GUARD); onParry(cs); expect(nextHitBonus(cs).forceCrit).toBe(true);
    guardClose(cs); expect(guardOpen(cs, PERFECT_GUARD)).toBe(0);
  });
});

describe('poise, weight, knockback', () => {
  it('heavier / elite enemies weigh more and have more poise', () => {
    expect(weightOf({ radius: 20 })).toBeGreaterThan(weightOf({ radius: 12 })); expect(weightOf({ radius: 16, elite: true })).toBeGreaterThan(weightOf({ radius: 16 }));
    expect(newPoise({ radius: 16, elite: true }).max).toBeGreaterThan(newPoise({ radius: 16 }).max);
  });
  it('sword chain breaks a normal enemy on the finisher; greatsword breaks it in one hit', () => {
    const p = newPoise({ radius: 16 }); const ss = LIGHT.swordshield;
    expect(damagePoise(p, ss[0].poise)).toBe(false); expect(damagePoise(p, ss[1].poise)).toBe(false); expect(damagePoise(p, ss[2].poise)).toBe(true);
    expect(damagePoise(newPoise({ radius: 16 }), LIGHT.greatsword[0].poise)).toBe(true);
    const d = newPoise({ radius: 16 }); const dg = LIGHT.dagger; expect([0, 1, 2].some((i) => damagePoise(d, dg[i].poise))).toBe(false); expect(damagePoise(d, dg[3].poise)).toBe(true);
  });
  it('poise refills after a pause', () => { const p = newPoise({ radius: 16 }); damagePoise(p, 10); tickPoise(p, POISE_REGEN_DELAY + 0.01); expect(p.cur).toBe(p.max); });
  it('knockback: weight divides, held poise damps, a break shoves', () => {
    expect(knockImpulse(100, 1, 2, false)).toBeLessThan(knockImpulse(100, 1, 1, false));
    expect(knockImpulse(100, 1, 1, true)).toBeGreaterThan(knockImpulse(100, 1, 1, false) * 2);
  });
});

describe('hit-stop & shake tiers', () => {
  const base = { amount: 20, targetMaxHp: 100, crit: false, melee: true };
  it('scales with crit, finisher and damage; capped', () => {
    const l = hitStopFor({ ...base, hitstopMul: 1 }), c = hitStopFor({ ...base, crit: true }), f = hitStopFor({ ...base, hitstopMul: 1.6, finisher: true });
    expect(c).toBeGreaterThan(l); expect(f).toBeGreaterThan(l); expect(hitStopFor({ ...base, amount: 100 })).toBeGreaterThan(l);
    expect(hitStopFor({ ...base, crit: true, charged: true, hitstopMul: 3, kill: true, broke: true, amount: 999 })).toBeLessThanOrEqual(0.12);
  });
  it('ranged/proc hits only stop on crits or charged shots', () => {
    expect(hitStopFor({ ...base, melee: false })).toBe(0); expect(hitStopFor({ ...base, melee: false, crit: true })).toBeGreaterThan(0); expect(hitStopFor({ ...base, melee: false, charged: true })).toBeGreaterThan(0);
  });
  it('shake tiers: none < crit < break/charged; move tier respected', () => {
    expect(shakeTierFor(base)).toBe(0); expect(shakeTierFor({ ...base, crit: true })).toBe(1); expect(shakeTierFor({ ...base, broke: true })).toBe(2); expect(shakeTierFor(base, 3)).toBe(3);
  });
});
describe('weapon tick still works with frame data', () => {
  it('sword chain cycles with taps spaced past the cooldown', () => {
    const c = buildWeapon('swordshield'); const s = newWeaponState(c); const hits: number[] = [];
    for (let i = 0; i < 4; i++) { const h = tryAttack(s, c); expect(h).not.toBeNull(); hits.push(h!.hit); tickWeapon(s, c, s.cooldown + 0.001); }
    expect(hits).toEqual([0, 1, 2, 0]);
  });
});
