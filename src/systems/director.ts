// Encounter director: composes combat rooms from role budgets in 2–3 waves (arena 3–4), escalating per floor/depth,
// and promotes existing enemies to elites with an affix. Framework-free. See docs/V2_AI.md.
import type { AiKind, EnemyDef } from '../data/types';
import { Rng } from './rng';
import { roleOf, type Role } from './ai';
import { tuneFor, ELITE_HP_MUL, ELITE_DMG_MUL, ELITE_SCALE } from './difficulty';

export type Affix = 'swift' | 'shielded' | 'splitting' | 'volatile';
export const AFFIXES: Affix[] = ['swift', 'shielded', 'splitting', 'volatile'];
export interface WaveEntry { id: string; elite?: Affix }

/** encounter cost of one spawn (a swarm entry spawns several bodies but costs as one group) */
export function enemyCost(def: Pick<EnemyDef, 'ai' | 'hp' | 'chapter' | 'elite' | 'params'>): number {
  if (def.elite) return 3;
  const role = roleOf(def.ai as AiKind);
  if (role === 'tank') return 3;
  if (def.params?.swarmSize) return 2.5;
  if (role === 'support') return 2;
  return 1.5;
}
/** role mix the director aims for, and hard caps per wave */
export const ROLE_MIX: Record<Role, number> = { rusher: 0.45, ranged: 0.33, static: 0.07, tank: 0.1, support: 0.05 };
export function roleCaps(chapter: number, count: number): Record<Role, number> {
  return { rusher: 9, ranged: Math.max(1, Math.ceil(count * 0.5)), static: 1, tank: chapter >= 4 && count >= 6 ? 2 : 1, support: 1 };
}
export const MAX_WAVE_COUNT = 9;

export interface EncounterOpts { hard?: boolean; arena?: boolean; miniboss?: boolean; derangement?: boolean }
export interface Encounter { waves: WaveEntry[][]; budgets: number[] }

/** number of waves: 2 early, 3 once global floor + depth grows; arena 3–4 */
export function waveCount(rng: Rng, chapter: number, floor: number, depth: number, arena: boolean): number {
  if (arena) return rng.int(3, 4);
  if (chapter === 1 && floor === 1) return 2; // integration retune: the first floor never runs 3 waves (new players)
  const g = (chapter - 1) * 3 + floor; // global floor 1..18
  const p3 = Math.min(0.9, 0.15 + (g - 1) * 0.06 + depth * 0.15);
  return rng.chance(p3) ? 3 : 2;
}
/** wave budget escalates with floor, depth and wave index */
export function waveBudget(chapter: number, floor: number, depth: number, wave: number, hard = false): number {
  return tuneFor(chapter, hard).waveBudget + (floor - 1) * 0.75 + depth * 0.75 + wave * 1;
}
export function eliteChance(chapter: number, floor: number, depth: number, hard = false): number {
  const base = tuneFor(chapter, hard).eliteChance;
  if (chapter === 1 && floor === 1 && !hard) return 0; // first floor teaches the basics
  return Math.min(0.75, base + (floor - 1) * 0.05 + depth * 0.05);
}
/** which affixes fit a role (tanks don't get faster; static turrets can't be swift) */
export function affixesFor(ai: AiKind): Affix[] {
  const r = roleOf(ai);
  if (r === 'tank') return ['shielded', 'volatile'];
  if (r === 'static') return ['shielded', 'splitting'];
  if (ai === 'exploder') return ['swift', 'shielded', 'splitting'];
  return AFFIXES;
}

export function composeWave(rng: Rng, pool: EnemyDef[], budget: number, chapter: number): string[] {
  const byRole = new Map<Role, EnemyDef[]>();
  for (const d of pool) { const r = roleOf(d.ai); byRole.set(r, [...(byRole.get(r) ?? []), d]); }
  const roles = [...byRole.keys()];
  const counts: Record<Role, number> = { rusher: 0, ranged: 0, static: 0, tank: 0, support: 0 };
  const out: string[] = []; let left = budget;
  // a wave always opens with a rusher (if the chapter has one) so the player is engaged
  const opener = byRole.get('rusher'); if (opener?.length) { const d = rng.pick(opener); out.push(d.id); counts.rusher++; left -= enemyCost(d); }
  let guard = 0;
  while (left > 0.99 && out.length < MAX_WAVE_COUNT && guard++ < 60) {
    const caps = roleCaps(chapter, out.length + 1);
    const avail = roles.filter((r) => counts[r] < caps[r] && byRole.get(r)!.some((d) => enemyCost(d) <= left + 0.5));
    if (!avail.length) break;
    // weight roles by how far below their target share they are
    const role = rng.weighted(avail, (r) => Math.max(0.05, ROLE_MIX[r] * (out.length + 1) - counts[r] + 0.2));
    const opts = byRole.get(role)!.filter((d) => enemyCost(d) <= left + 0.5);
    const d = rng.pick(opts); out.push(d.id); counts[role]++; left -= enemyCost(d);
  }
  if (!out.length && pool.length) out.push(pool[0].id);
  return out;
}

export function planEncounter(seed: number, chapter: number, floor: number, depth: number, pool: EnemyDef[], o: EncounterOpts = {}): Encounter {
  const rng = new Rng((seed ^ 0x51ed27) >>> 0);
  const n = waveCount(rng, chapter, floor, depth, !!o.arena);
  const waves: WaveEntry[][] = []; const budgets: number[] = [];
  const pe = eliteChance(chapter, floor, depth, o.hard);
  for (let w = 0; w < n; w++) {
    const b = waveBudget(chapter, floor, depth, w, o.hard); budgets.push(b);
    const ids = composeWave(rng, pool, b, chapter);
    const wave: WaveEntry[] = ids.map((id) => ({ id }));
    // elites: none in miniboss rooms; at most 1 per wave (2 in the last wave from chapter 5); arena last wave always has one
    if (!o.miniboss) {
      const last = w === n - 1;
      let want = rng.chance(pe * (last ? 1.4 : 0.7)) ? 1 : 0;
      if (last && (o.arena || o.derangement) && chapter + floor > 2) want = Math.max(want, 1);
      if (last && chapter >= 5 && rng.chance(pe * 0.5)) want++;
      const cands = wave.filter((e) => { const d = pool.find((p) => p.id === e.id); return d && !d.params?.swarmSize && !d.elite; });
      rng.shuffle(cands);
      for (const e of cands.slice(0, want)) { const d = pool.find((p) => p.id === e.id)!; e.elite = rng.pick(affixesFor(d.ai)); }
    }
    waves.push(wave);
  }
  return { waves, budgets };
}

// ---------------- elite modifiers (applied by the scene) ----------------
export interface EliteMods { hpMul: number; dmgMul: number; speedMul: number; cdMul: number; armor: number; explodeOnDeath: boolean; split: number; scale: number; color: number; label: string }
export function eliteMods(affix: Affix): EliteMods {
  const base: EliteMods = { hpMul: ELITE_HP_MUL, dmgMul: ELITE_DMG_MUL, speedMul: 1, cdMul: 1, armor: 0, explodeOnDeath: false, split: 0, scale: ELITE_SCALE, color: 0xffcb3a, label: '' };
  switch (affix) {
    case 'swift': return { ...base, speedMul: 1.35, cdMul: 0.75, color: 0x7cf0d0, label: 'Tinh Anh · Nhanh' };
    case 'shielded': return { ...base, armor: 40, color: 0x9be4ff, label: 'Tinh Anh · Giáp' };
    case 'splitting': return { ...base, hpMul: ELITE_HP_MUL * 0.85, split: 2, color: 0xc89bff, label: 'Tinh Anh · Phân Tách' };
    case 'volatile': return { ...base, explodeOnDeath: true, color: 0xff8a3a, label: 'Tinh Anh · Nổ' };
  }
}
/** a split child: 35% of the elite's max HP, no affix */
export const SPLIT_HP = 0.35;
