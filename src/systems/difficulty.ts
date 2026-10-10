// Per-chapter combat tuning: the single source of truth for telegraph windups, recovery (punish) windows,
// attack tokens, encounter budgets, elite odds and boss pacing. Documented in docs/V2_AI.md. Framework-free.

export interface ChapterTune {
  /** minimum telegraph/windup of every enemy attack (s) — never below MIN_WINDUP */
  windupMin: number;
  /** multiplier on an enemy's own `telegraph` param (content value) before the floor above is applied */
  windupMul: number;
  /** stationary recovery after a melee attack (s); ranged attackers use RANGED_RECOVERY_MUL of it. Enemy is Exposed. */
  recovery: number;
  /** max simultaneous attackers (windup + active) in a room — the attack token pool */
  tokens: number;
  /** minimum time between two attack starts in the room (s), so windups never fire on the same frame */
  attackGap: number;
  /** encounter budget of the first wave on floor 1, depth 0 (see director.ts for costs) */
  waveBudget: number;
  /** base chance that a wave carries an elite (grows with floor + depth) */
  eliteChance: number;
  /** minimum telegraph of boss damaging patterns (s) */
  bossTeleMin: number;
  /** boss stands still + Exposed after each pattern (s) */
  bossRecovery: number;
  /** boss stagger (no attacks, Exposed) on every phase transition (s) */
  bossStagger: number;
  /** HP ratio at/below which the boss enrages */
  enrageAt: number;
  /** cooldown multiplier between boss patterns while enraged (telegraphs are NOT shortened) */
  enrageCdMul: number;
}

export const MIN_WINDUP = 0.4;
export const RANGED_RECOVERY_MUL = 0.6;
/** extra damage taken while Exposed (recovery / boss stagger) — read by status.takenMult */
export const EXPOSED_TAKEN = 0.25;
export const ELITE_HP_MUL = 2.0, ELITE_DMG_MUL = 1.2, ELITE_SCALE = 1.2;

export const CHAPTER_TUNE: ChapterTune[] = [
  { windupMin: 0.60, windupMul: 1.20, recovery: 0.75, tokens: 2, attackGap: 0.45, waveBudget: 2.75, eliteChance: 0.00, bossTeleMin: 0.60, bossRecovery: 0.80, bossStagger: 1.5, enrageAt: 0.20, enrageCdMul: 0.75 },
  { windupMin: 0.55, windupMul: 1.10, recovery: 0.70, tokens: 2, attackGap: 0.40, waveBudget: 4, eliteChance: 0.10, bossTeleMin: 0.55, bossRecovery: 0.75, bossStagger: 1.4, enrageAt: 0.20, enrageCdMul: 0.72 },
  { windupMin: 0.50, windupMul: 1.05, recovery: 0.65, tokens: 3, attackGap: 0.35, waveBudget: 5, eliteChance: 0.15, bossTeleMin: 0.50, bossRecovery: 0.70, bossStagger: 1.3, enrageAt: 0.22, enrageCdMul: 0.70 },
  { windupMin: 0.48, windupMul: 1.00, recovery: 0.60, tokens: 3, attackGap: 0.32, waveBudget: 5.5, eliteChance: 0.20, bossTeleMin: 0.48, bossRecovery: 0.65, bossStagger: 1.25, enrageAt: 0.22, enrageCdMul: 0.68 },
  { windupMin: 0.45, windupMul: 0.95, recovery: 0.55, tokens: 3, attackGap: 0.28, waveBudget: 6, eliteChance: 0.25, bossTeleMin: 0.45, bossRecovery: 0.60, bossStagger: 1.2, enrageAt: 0.25, enrageCdMul: 0.65 },
  { windupMin: 0.42, windupMul: 0.90, recovery: 0.50, tokens: 4, attackGap: 0.25, waveBudget: 6.5, eliteChance: 0.30, bossTeleMin: 0.42, bossRecovery: 0.55, bossStagger: 1.1, enrageAt: 0.25, enrageCdMul: 0.62 },
];

/** Tune for a chapter (1-based). Hard mode: +1 token, windups ×0.92 (still ≥ MIN_WINDUP), +0.1 elite chance. */
export function tuneFor(chapter: number, hard = false): ChapterTune {
  const base = CHAPTER_TUNE[Math.max(0, Math.min(CHAPTER_TUNE.length - 1, Math.round(chapter) - 1))];
  if (!hard) return base;
  return { ...base, tokens: base.tokens + 1, windupMin: Math.max(MIN_WINDUP, base.windupMin * 0.92), eliteChance: base.eliteChance + 0.1 };
}
/** Effective windup for an attack whose content telegraph is `tele` (s). */
export function windupFor(t: ChapterTune, tele: number | undefined): number {
  return Math.max(MIN_WINDUP, t.windupMin, (tele ?? 0) * t.windupMul);
}
