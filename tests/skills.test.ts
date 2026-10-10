// v2 skills polish: pure rules for spells (quick slots 1/2) and weapon specials. docs/V2_SKILLS.md
import { describe, it, expect } from 'vitest';
import {
  SPELL, SPECIAL, SPECIAL_BEFORE, SKILL_KEYS, effectiveCooldown, checkCast, cooldownFrac, newCasts, bufferCast, tickCasts, canCast, nextBuffered, beginCast,
  windupDone, cancelCast, commitCast, denyCast, aimFromDrag, resolveAim, aimGeometry, spellInfo, specialInfo, tooltipLines, spellHit, spellCrit, valuePerMp,
  AIM_DEAD, AIM_CANCEL, READY_PULSE, DENY_FLASH,
} from '../src/systems/skills';
import { BUFFER, newCombat, beginMove, tickCombat, LIGHT, onDash } from '../src/systems/combat';
import { buildWeapon } from '../src/systems/weapons';
import { weaponUpgrades } from '../src/systems/registry';
import { artifacts } from '../src/systems/registry';
import { BASE_STATS as BASE } from '../src/systems/stats';
import { SKILL_SFX } from '../src/game/audio';
import type { Stats } from '../src/systems/stats';
import type { WeaponId, SpellId } from '../src/data/types';

const WEAPONS: WeaponId[] = ['swordshield', 'greatsword', 'dagger', 'katana', 'crossbow', 'staff'];
const SPELLS: SpellId[] = ['icebolt', 'fireball', 'chainLightning', 'arcaneMissiles', 'shieldBubble', 'blink'];
const stats = (o: Partial<Stats> = {}): Stats => ({ ...(BASE as Stats), ...o });
const spellArt = (id: SpellId) => { const a = artifacts.find((x) => x.effects.some((e: any) => e.kind === 'spell' && e.spell === id))!; return { a, e: a.effects.find((e: any) => e.kind === 'spell') as any }; };

describe('skills: tuning table', () => {
  it('skills: every spell and weapon special has tuning, cooldown and a distinct sfx', () => {
    const voices = new Set<string>();
    for (const s of SPELLS) { const t = SPELL[s]; expect(t.windup).toBeGreaterThanOrEqual(0); expect(t.windup).toBeLessThanOrEqual(0.2); expect(t.role.length).toBeGreaterThan(5); voices.add(t.sfx); expect(SKILL_SFX).toContain(t.sfx); }
    for (const w of WEAPONS) { const t = SPECIAL[w]; expect(t.cooldown).toBeGreaterThan(0); expect(t.name.length).toBeGreaterThan(2); voices.add(t.sfx); expect(SKILL_SFX).toContain(t.sfx); }
    expect(voices.size).toBe(SPELLS.length + WEAPONS.length); // one voice per skill
  });
  it('weapon specials cost less MP than before and now have a short cooldown (HUD sweep)', () => {
    for (const w of WEAPONS) { const c = buildWeapon(w); expect(c.specialCost).toBeLessThanOrEqual(SPECIAL_BEFORE[w].mp); expect(SPECIAL[w].coef).toBeGreaterThanOrEqual(SPECIAL_BEFORE[w].coef); }
  });
  it('each skill has a distinct role: aim shapes match what the skill does', () => {
    expect(SPELL.icebolt.aim.kind).toBe('line'); expect(SPELL.fireball.aim.radius).toBe(SPELL.fireball.explode); expect(SPELL.chainLightning.aim.kind).toBe('target');
    expect(SPELL.arcaneMissiles.aim.kind).toBe('cone'); expect(SPELL.shieldBubble.aim.kind).toBe('self'); expect(SPELL.blink.aim.kind).toBe('blink');
    expect(SPECIAL.staff.aim.kind).toBe('circle'); expect(SPECIAL.greatsword.mode).toBe('charge'); expect(SPECIAL.katana.mode).toBe('charge'); expect(SPECIAL.dagger.aim.kind).toBe('target');
  });
  it('balance band: damage per MP of every damaging skill sits in 3–10 at a fresh hero (no spell dominates, books no longer lose to specials)', () => {
    const s = stats(); const v: Record<string, number> = {};
    const ib = spellArt('icebolt'), fb = spellArt('fireball'), ch = spellArt('chainLightning'), am = spellArt('arcaneMissiles');
    v.icebolt = valuePerMp(spellHit(s, 'icebolt', ib.e.base), 1, ib.e.mpCost);
    v.fireball = valuePerMp(spellHit(s, 'fireball', fb.e.base) * (1 + 0.6) + spellHit(s, 'fireball', fb.e.base) * 0.6, 1, fb.e.mpCost); // primary + splash + 1 bystander
    v.chain = valuePerMp(spellHit(s, 'chainLightning', ch.e.base) * (1 + 2 * SPELL.chainLightning.chainFalloff!), 1, ch.e.mpCost);
    v.arcane = valuePerMp(spellHit(s, 'arcaneMissiles', am.e.base) * SPELL.arcaneMissiles.missiles!, 1, am.e.mpCost);
    const sp = (w: WeaponId, mult: number, targets: number) => valuePerMp(s.physical * SPECIAL[w].coef * mult, targets, buildWeapon(w).specialCost);
    v.bash = sp('swordshield', 1, 2); v.iaido = sp('katana', 1.2 * 1.5, 2); v.pierce = sp('crossbow', 1, 2);
    v.dagger = valuePerMp(s.physical * 1.0 * 2 * 1.5, 1, buildWeapon('dagger').specialCost);
    v.nova = valuePerMp((s.fire * 0.5 + s.magic * 0.5) * SPECIAL.staff.coef, 3, buildWeapon('staff').specialCost);
    for (const [k, x] of Object.entries(v)) { expect(x, k).toBeGreaterThanOrEqual(3); expect(x, k).toBeLessThanOrEqual(10); }
    expect(v.arcane).toBeLessThanOrEqual(v.fireball); // v1 arcane (5 × full magic for 10 MP) was the best value by far
  });
  it('arcane missiles: each missile takes 40% of Magic (was 100% ×5)', () => {
    const lo = spellHit(stats({ magic: 10 }), 'arcaneMissiles', 12), hi = spellHit(stats({ magic: 60 }), 'arcaneMissiles', 12);
    expect(hi - lo).toBe(20); expect(spellHit(stats({ magic: 60 }), 'icebolt', 40) - spellHit(stats({ magic: 10 }), 'icebolt', 40)).toBe(50);
  });
});

describe('skills: cost, cooldown, cast checks', () => {
  it('cooldown% applies to spells and specials, capped at 60%', () => {
    expect(effectiveCooldown(2, 0)).toBe(2); expect(effectiveCooldown(2, 25)).toBeCloseTo(1.5); expect(effectiveCooldown(10, 90)).toBeCloseTo(4); expect(effectiveCooldown(2, -10)).toBe(2);
  });
  it('checkCast order: empty > cooldown > mp', () => {
    expect(checkCast(0, 0, 10, false)).toBe('empty'); expect(checkCast(1, 0, 10)).toBe('cooldown'); expect(checkCast(0, 5, 10)).toBe('mp'); expect(checkCast(0, 10, 10)).toBe('ok');
  });
  it('cooldown sweep fraction uses the reduced cooldown (v1 HUD used the base value)', () => {
    const c = newCasts(); commitCast(c, 'spell1', effectiveCooldown(2, 50)); expect(c.slots.spell1.cdMax).toBe(1); expect(cooldownFrac(c.slots.spell1.cd, c.slots.spell1.cdMax)).toBe(1);
    tickCasts(c, 0.5); expect(cooldownFrac(c.slots.spell1.cd, c.slots.spell1.cdMax)).toBeCloseTo(0.5); expect(cooldownFrac(0, 0)).toBe(0);
  });
  it('ready pulse fires once when a cooldown ends; deny flash decays', () => {
    const c = newCasts(); commitCast(c, 'special', 0.3);
    expect(tickCasts(c, 0.2)).toEqual([]); expect(tickCasts(c, 0.2)).toEqual(['special']); expect(c.slots.special.pulse).toBe(READY_PULSE); expect(tickCasts(c, 0.1)).toEqual([]);
    denyCast(c, 'spell2', 'mp'); expect(c.slots.spell2.deny).toBe(DENY_FLASH); expect(c.slots.spell2.denyReason).toBe('mp'); tickCasts(c, 1); expect(c.slots.spell2.deny).toBe(0);
  });
});

describe('skills: cast buffer, wind-up, cancel (same rules as attacks)', () => {
  it('cast buffer: a press is kept BUFFER s (120 ms) and then dropped', () => {
    const c = newCasts(); bufferCast(c, 'spell1', 0.5); expect(nextBuffered(c)).toBe('spell1');
    tickCasts(c, BUFFER - 0.01); expect(nextBuffered(c)).toBe('spell1'); tickCasts(c, 0.02); expect(nextBuffered(c)).toBeNull();
    expect(BUFFER).toBeCloseTo(0.12);
  });
  it('cast window follows the dash-cancel rule: blocked in a committed startup and early recovery, open after dashCancel', () => {
    const cs = newCombat(); const o = { dashing: false, guarding: false, charging: false, spinning: false, casting: false };
    expect(canCast(cs, o)).toBe(true);
    beginMove(cs, LIGHT.greatsword[0], 1, { kind: 'light', hit: 0, coef: 1, last: false, lunge: false, angle: 0, power: 0 });
    expect(canCast(cs, o)).toBe(false); // greatsword startup cannot feint
    tickCombat(cs, LIGHT.greatsword[0].startup + 0.001); expect(canCast(cs, o)).toBe(false);
    tickCombat(cs, LIGHT.greatsword[0].dashCancel); expect(canCast(cs, o)).toBe(true);
    expect(canCast(newCombat(), { ...o, dashing: true })).toBe(false); expect(canCast(newCombat(), { ...o, guarding: true })).toBe(false);
    expect(canCast(newCombat(), { ...o, casting: true })).toBe(false); expect(canCast(newCombat(), { ...o, spinning: true })).toBe(false);
    beginMove(cs, LIGHT.swordshield[0], 1, { kind: 'light', hit: 0, coef: 1, last: false, lunge: false, angle: 0, power: 0 }); expect(canCast(cs, o)).toBe(true); // feint-able startup
    onDash(cs); expect(canCast(cs, o)).toBe(true);
  });
  it('wind-up: effect fires after the wind-up; a cancel (dash / hit) spends nothing', () => {
    const c = newCasts(); bufferCast(c, 'special', 1); beginCast(c, 'special', 0.12, 1);
    expect(c.slots.special.buf).toBe(0); tickCasts(c, 0.1); expect(windupDone(c)).toBeNull(); tickCasts(c, 0.03); expect(windupDone(c)).toBe('special'); expect(c.phase).toBe('idle');
    beginCast(c, 'spell1', 0.16, 0); tickCasts(c, 0.05); expect(cancelCast(c)).toBe('spell1'); expect(c.slots.spell1.cd).toBe(0); expect(windupDone(c)).toBeNull(); expect(cancelCast(c)).toBeNull();
  });
  it('instant skills (wind-up 0) fire on the next frame', () => { const c = newCasts(); beginCast(c, 'special', 0, 0); expect(windupDone(c)).toBe('special'); });
});

describe('skills: aim (hold-to-aim, touch drag, cancel)', () => {
  it('touch drag: dead zone = auto aim, drag = aim, beyond the ring = cancel', () => {
    expect(aimFromDrag(5, 5).mode).toBe('auto'); const a = aimFromDrag(60, 0); expect(a.mode).toBe('aim'); expect(a.angle).toBeCloseTo(0);
    expect(aimFromDrag(0, AIM_CANCEL + 1).mode).toBe('cancel'); expect(aimFromDrag(AIM_DEAD + 1, 0).mode).toBe('aim');
  });
  it('aim priority: drag > mouse > nearest target > facing', () => {
    const base = { px: 0, py: 0, facing: 3 };
    expect(resolveAim({ ...base, drag: { mode: 'aim', angle: 1 }, mouse: 2 })).toBe(1);
    expect(resolveAim({ ...base, drag: { mode: 'auto', angle: 1 }, mouse: 2 })).toBe(2);
    expect(resolveAim({ ...base, target: { x: 0, y: 10 } })).toBeCloseTo(Math.PI / 2);
    expect(resolveAim(base)).toBe(3);
  });
  it('line geometry ends at the skill range', () => { const g = aimGeometry(SPECIAL.katana.aim, 100, 100, 0); expect(g.x1).toBeCloseTo(100 + SPECIAL.katana.aim.range); expect(g.y1).toBeCloseTo(100); });
});

describe('skills: synergy numbers (HUD tooltip = what the cast does)', () => {
  it('synergy: tooltip numbers follow magic, damage%, cooldown%, spellCrit, spellEcho and Anvil cost', () => {
    const { a, e } = spellArt('fireball');
    const plain = spellInfo('spell1', a.name, 'fireball', e.base, e.mpCost, e.cooldown, stats(), {});
    const built = spellInfo('spell1', a.name, 'fireball', e.base + e.perLevel, e.mpCost, e.cooldown, stats({ magic: 35, damagePct: 20, cooldownPct: 20, critChance: 5 }), { spellCrit: 10, spellEcho: 25 });
    expect(plain.damage).toBe(e.base + 10); expect(built.damage).toBe(Math.round((e.base + e.perLevel + 35) * 1.2));
    expect(built.cooldown).toBeCloseTo(e.cooldown * 0.8); expect(built.crit).toBe(15); expect(built.echo).toBe(25);
    const lines = tooltipLines(built).join('\n'); expect(lines).toMatch(/Lặp lại 25%/); expect(lines).toMatch(new RegExp(`${built.damage}`)); expect(lines).toMatch(/MP/);
    const cheap = weaponUpgrades.find((u) => u.weapon === 'swordshield' && u.mods.some((m) => m.key === 'specialCostPct'))!;
    const w0 = buildWeapon('swordshield'), w1 = buildWeapon('swordshield', [cheap.id]);
    const s0 = specialInfo('swordshield', w0.specialCost, 20, stats()), s1 = specialInfo('swordshield', w1.specialCost, 20, stats({ cooldownPct: 50 }));
    expect(s1.mp).toBeLessThan(s0.mp); expect(s1.cooldown).toBeCloseTo(SPECIAL.swordshield.cooldown / 2); expect(s0.damage).toBe(Math.round(20 * SPECIAL.swordshield.coef));
  });
  it('spell crits use critDamage like weapon hits (v1: fixed ×1.5)', () => {
    expect(spellCrit(stats({ critDamage: 50 }), {}).mult).toBeCloseTo(1.5); expect(spellCrit(stats({ critDamage: 100 }), {}).mult).toBeCloseTo(2);
    expect(spellCrit(stats({ critChance: 95 }), { spellCrit: 20 }).chance).toBe(100);
  });
  it('defensive spells show their real numbers', () => {
    const b = spellArt('shieldBubble'); const i = spellInfo('spell2', b.a.name, 'shieldBubble', b.e.base, b.e.mpCost, b.e.cooldown, stats(), {});
    expect(i.damage).toBe(0); expect(i.extra).toMatch(new RegExp(`${b.e.base}.*${SPELL.shieldBubble.shieldTime}s`));
    const k = spellArt('blink'); expect(spellInfo('spell2', k.a.name, 'blink', k.e.base, k.e.mpCost, k.e.cooldown, stats(), {}).extra).toMatch(/px/);
  });
  it('spell artifact descriptions quote the tuned MP cost', () => {
    for (const s of SPELLS) { const { a, e } = spellArt(s); expect(a.desc).toContain(`(${e.mpCost} MP)`); }
    expect(SKILL_KEYS).toEqual(['spell1', 'spell2', 'special']);
  });
});
