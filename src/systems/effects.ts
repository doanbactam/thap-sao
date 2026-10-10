// Effects interpreter: turns Effect instances (artifacts, combos, miracles, costumes...) into stat mods and
// trigger lists, and fires triggers deterministically. Every Effect kind of types.ts is handled. Framework-free.
import type { Effect, StatusId, SpellId } from '../data/types';
import type { StatMod } from './stats';
import type { EffectInstance } from './inventory';

export type When = 'hpBelow50' | 'fullHp' | 'mpAbove50' | 'noDashLeft' | 'bossRoom';
export interface Ctx { hpPct: number; mpPct: number; dashLeft: number; bossRoom: boolean }
export interface Trig<T> { e: T; value: number; when?: When; source: string }
export interface Bundle {
  stats: Array<StatMod & { when?: When; source: string }>;
  onHit: Array<Trig<Extract<Effect, { kind: 'onHit' }>> & { chance: number }>;
  onKill: Array<Trig<Extract<Effect, { kind: 'onKill' }>>>;
  onDash: Array<Trig<Extract<Effect, { kind: 'onDash' }>>>;
  onHurt: Array<Trig<Extract<Effect, { kind: 'onHurt' }>>>;
  periodic: Array<Trig<Extract<Effect, { kind: 'periodic' }>> & { key: string }>;
  spells: Array<Trig<Extract<Effect, { kind: 'spell' }>>>;
  summons: Array<Trig<Extract<Effect, { kind: 'summon' }>>>;
  specials: Array<Trig<Extract<Effect, { kind: 'special' }>>>;
}
export const scaled = (base: number, perLevel: number, level: number) => base + perLevel * Math.max(0, level);
export const emptyBundle = (): Bundle => ({ stats: [], onHit: [], onKill: [], onDash: [], onHurt: [], periodic: [], spells: [], summons: [], specials: [] });

export function addEffect(b: Bundle, e: Effect, level: number, source: string, when?: When) {
  switch (e.kind) {
    case 'stat': b.stats.push({ stat: e.stat, value: scaled(e.base, e.perLevel, level), pct: e.pct, when, source }); break;
    case 'onHit': b.onHit.push({ e, value: e.stacks ?? 1, chance: Math.min(1, scaled(e.chance, e.perLevel, level)), when, source }); break;
    case 'onKill': b.onKill.push({ e, value: scaled(e.base, e.perLevel, level), when, source }); break;
    case 'onDash': b.onDash.push({ e, value: scaled(e.base, e.perLevel, level), when, source }); break;
    case 'onHurt': b.onHurt.push({ e, value: scaled(e.base, e.perLevel, level), when, source }); break;
    case 'periodic': b.periodic.push({ e, value: scaled(e.base, e.perLevel, level), when, source, key: `${source}#${b.periodic.length}` }); break;
    case 'conditional': addEffect(b, e.inner, level, source, e.when); break;
    case 'spell': b.spells.push({ e, value: scaled(e.base, e.perLevel, level), when, source }); break;
    case 'summon': b.summons.push({ e, value: scaled(e.base, e.perLevel, level), when, source }); break;
    case 'special': b.specials.push({ e, value: scaled(e.base, e.perLevel, level), when, source }); break;
  }
}
export function buildBundle(list: EffectInstance[]): Bundle {
  const b = emptyBundle(); for (const it of list) addEffect(b, it.effect, it.level, it.source); return b;
}
export function condOk(when: When | undefined, c: Ctx): boolean {
  if (!when) return true;
  switch (when) {
    case 'hpBelow50': return c.hpPct < 0.5;
    case 'fullHp': return c.hpPct >= 0.999;
    case 'mpAbove50': return c.mpPct > 0.5;
    case 'noDashLeft': return c.dashLeft <= 0;
    case 'bossRoom': return c.bossRoom;
  }
}
export function statMods(b: Bundle, c: Ctx): StatMod[] { return b.stats.filter((s) => condOk(s.when, c)).map(({ stat, value, pct }) => ({ stat, value, pct })); }

// ---- trigger firing (returns actions for the game to execute) ----
export interface StatusApp { status: StatusId; stacks: number; source: string }
export function fireOnHit(b: Bundle, c: Ctx, rand: () => number): StatusApp[] {
  const out: StatusApp[] = [];
  for (const t of b.onHit) if (condOk(t.when, c) && rand() < t.chance) out.push({ status: t.e.apply, stacks: t.value, source: t.source });
  return out;
}
export interface Action { action: string; amount: number; source: string }
const fire = (arr: Array<Trig<any>>, c: Ctx): Action[] => arr.filter((t) => condOk(t.when, c)).map((t) => ({ action: t.e.action, amount: t.value, source: t.source }));
export const fireOnKill = (b: Bundle, c: Ctx) => fire(b.onKill, c);
export const fireOnDash = (b: Bundle, c: Ctx) => fire(b.onDash, c);
export const fireOnHurt = (b: Bundle, c: Ctx) => fire(b.onHurt, c);

/** Periodic timers keyed by trigger key; returns actions that fired in this dt. Cooldown reduction applies. */
export function tickPeriodic(timers: Record<string, number>, b: Bundle, c: Ctx, dt: number, cooldownPct = 0): Action[] {
  const out: Action[] = [];
  for (const t of b.periodic) {
    const every = Math.max(0.5, t.e.every * (1 - cooldownPct / 100));
    timers[t.key] = (timers[t.key] ?? 0) + dt;
    if (timers[t.key] >= every) { timers[t.key] -= every; if (condOk(t.when, c)) out.push({ action: t.e.action, amount: t.value, source: t.source }); }
  }
  return out;
}
/** Up to 2 quick-slot spells from the bundle (first two distinct spell artifacts). */
export interface SpellSlot { spell: SpellId; mpCost: number; cooldown: number; power: number; source: string }
export function quickSpells(b: Bundle): SpellSlot[] {
  return b.spells.slice(0, 2).map((s) => ({ spell: s.e.spell, mpCost: s.e.mpCost, cooldown: s.e.cooldown, power: s.value, source: s.source }));
}
export function castSpell(slot: SpellSlot, mp: number, cdLeft: number): { ok: boolean; mp: number; reason?: string } {
  if (cdLeft > 0) return { ok: false, mp, reason: 'cooldown' };
  if (mp < slot.mpCost) return { ok: false, mp, reason: 'mp' };
  return { ok: true, mp: mp - slot.mpCost };
}
/** Special hooks implemented by the engine. Unknown ids are reported (not silently dropped). */
export const KNOWN_SPECIALS = ['echoStrike', 'goldTouch', 'secondWind', 'starFall', 'vampire', 'berserk', 'glassCannon', 'thornArmor'];
export function specialsOf(b: Bundle): Record<string, number> {
  const out: Record<string, number> = {}; for (const s of b.specials) out[s.e.id] = (out[s.e.id] ?? 0) + s.value; return out;
}
