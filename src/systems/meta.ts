// Persistent meta progression: Ngọc Sao, Destiny tree, talents, costumes, journal, unlocks, settings.
// Framework-free (SPEC §7).
import type { WeaponId, StatKey } from '../data/types';
import { destiny, talents, costumes, getDestiny, getTalent, getCostume, artifacts, tablets } from './registry';
import type { StatMod } from './stats';

export interface MetaState {
  version: number; sapphires: number; destinyOwned: string[]; talentRanks: Record<string, number>;
  costume: string; weapon: WeaponId; trained: WeaponId[]; unlockedCostumes: string[];
  journal: { artifacts: string[]; tablets: string[]; enemies: string[]; miracles: string[] };
  stats: { deaths: number; kills: number; bossKills: number; wins: number; maxChapter: number; runs: number; totalSapphires?: number; comboTier6?: number };
  hardModeUnlocked: boolean; hardMode: boolean; pocketUnlocked: string[];
  settings: { mute: boolean; sfxVolume: number; showDamage: boolean };
}
export const META_VERSION = 2;
export function newMeta(): MetaState {
  return {
    version: META_VERSION, sapphires: 0, destinyOwned: [], talentRanks: {}, costume: 'bong', weapon: 'swordshield', trained: ['swordshield'],
    unlockedCostumes: ['bong'], journal: { artifacts: [], tablets: [], enemies: [], miracles: [] },
    stats: { deaths: 0, kills: 0, bossKills: 0, wins: 0, maxChapter: 1, runs: 0 },
    hardModeUnlocked: false, hardMode: false, pocketUnlocked: [], settings: { mute: false, sfxVolume: 0.6, showDamage: true },
  };
}
/** Migrations: v1 → v2 added pocketUnlocked + settings.showDamage. */
export function migrateMeta(raw: any): MetaState {
  const base = newMeta();
  if (!raw || typeof raw !== 'object') return base;
  const m = { ...base, ...raw, journal: { ...base.journal, ...(raw.journal ?? {}) }, stats: { ...base.stats, ...(raw.stats ?? {}) }, settings: { ...base.settings, ...(raw.settings ?? {}) } };
  if (!raw.version || raw.version < 2) { m.pocketUnlocked = raw.pocketUnlocked ?? []; }
  m.version = META_VERSION;
  return m;
}

// ---- Destiny ----
export function canBuyDestiny(m: MetaState, id: string): { ok: boolean; reason?: string } {
  const n = getDestiny(id); if (!n) return { ok: false, reason: 'unknown' };
  if (m.destinyOwned.includes(id)) return { ok: false, reason: 'owned' };
  if (!n.requires.every((r) => m.destinyOwned.includes(r))) return { ok: false, reason: 'locked' };
  if (m.sapphires < n.cost) return { ok: false, reason: 'cost' };
  return { ok: true };
}
export function buyDestiny(m: MetaState, id: string): boolean {
  if (!canBuyDestiny(m, id).ok) return false;
  m.sapphires -= getDestiny(id)!.cost; m.destinyOwned.push(id);
  return true;
}
export function grantSum(m: MetaState, key: string): number {
  let s = 0; for (const id of m.destinyOwned) { const n = getDestiny(id); if (n && n.grant.key === key && typeof n.grant.value === 'number') s += n.grant.value; } return s;
}
export function grantList(m: MetaState, key: string): string[] {
  return m.destinyOwned.map(getDestiny).filter((n) => n && n.grant.key === key).map((n) => String(n!.grant.value));
}
export const hasHomeRepairs = (m: MetaState) => grantSum(m, 'homeRepair') > 0 || destiny.every((d) => d.grant.key !== 'homeRepair');
/** Hard Mode: needs a win, and the 'hardMode' Destiny gate when the tree has one. */
export const canUseHardMode = (m: MetaState) => m.stats.wins > 0 && (grantSum(m, 'hardMode') > 0 || destiny.every((d) => d.grant.key !== 'hardMode'));
export const pocketEnabled = (m: MetaState) => grantSum(m, 'pocketDimension') > 0 || destiny.every((d) => d.grant.key !== 'pocketDimension');
export const levelUpHealPct = (m: MetaState) => grantSum(m, 'levelUpHeal');
export const talentPointsTotal = (m: MetaState) => Math.min(25, grantSum(m, 'talentPoints'));
export const talentPointsSpent = (m: MetaState) => Object.values(m.talentRanks).reduce((a, b) => a + b, 0);
export function spendTalent(m: MetaState, id: string): boolean {
  const t = getTalent(id); if (!t || !hasHomeRepairs(m)) return false;
  const r = m.talentRanks[id] ?? 0;
  if (r >= t.maxRank || talentPointsSpent(m) >= talentPointsTotal(m)) return false;
  m.talentRanks[id] = r + 1; return true;
}
export function respecTalents(m: MetaState) { m.talentRanks = {}; }
export function talentMods(m: MetaState): StatMod[] {
  return talents.filter((t) => m.talentRanks[t.id]).map((t) => ({ stat: t.stat, value: t.perRank * m.talentRanks[t.id], pct: t.pct }));
}
/** weapons: swordshield always; others require a Destiny unlock node AND finishing its training room */
export function weaponDestinyUnlocked(m: MetaState, w: WeaponId) { return w === 'swordshield' || grantList(m, 'unlockWeapon').includes(w); }
export function weaponUsable(m: MetaState, w: WeaponId) { return weaponDestinyUnlocked(m, w) && m.trained.includes(w); }
export function completeTraining(m: MetaState, w: WeaponId): boolean { if (!weaponDestinyUnlocked(m, w)) return false; if (!m.trained.includes(w)) m.trained.push(w); return true; }

// ---- Costumes ----
export function costumeProgress(m: MetaState, kind: string): number {
  switch (kind) {
    case 'deaths': return m.stats.deaths; case 'kills': return m.stats.kills;
    case 'bossKills': case 'bossesKilled': return m.stats.bossKills;
    case 'wins': case 'winRuns': return m.stats.wins;
    case 'chapter': case 'chapterReached': return m.stats.maxChapter;
    case 'runs': case 'runsStarted': return m.stats.runs;
    case 'artifactsFound': return m.journal.artifacts.length;
    case 'totalSapphires': return m.stats.totalSapphires ?? 0;
    case 'comboTier6': return m.stats.comboTier6 ?? 0;
    default: return 0;
  }
}
/** updates unlockedCostumes from tracked stats; returns newly unlocked ids */
export function checkCostumeUnlocks(m: MetaState): string[] {
  const out: string[] = [];
  for (const c of costumes) {
    if (m.unlockedCostumes.includes(c.id)) continue;
    if (!c.unlock || costumeProgress(m, c.unlock.kind) >= c.unlock.value) { m.unlockedCostumes.push(c.id); out.push(c.id); }
  }
  return out;
}
export function costumeMods(m: MetaState): StatMod[] {
  const c = getCostume(m.costume); if (!c) return [];
  return Object.entries(c.stats ?? {}).map(([stat, value]) => ({ stat: stat as StatKey, value: value as number }));
}
export function destinyStartMods(m: MetaState): StatMod[] {
  const out: StatMod[] = [];
  const hp = grantSum(m, 'startMaxHp'); if (hp) out.push({ stat: 'maxHp', value: hp });
  const lk = grantSum(m, 'startLuck'); if (lk) out.push({ stat: 'luck', value: lk });
  const bt = grantSum(m, 'startBarter'); if (bt) out.push({ stat: 'barter', value: bt });
  return out;
}
// ---- Journal ----
export function discover(m: MetaState, kind: keyof MetaState['journal'], id: string): boolean {
  const l = m.journal[kind]; if (l.includes(id)) return false; l.push(id); return true;
}
const RANK: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
/** Artifacts not unlocked by default, in unlock order (cheapest first by rarity, then price). */
export function lockedOrder(): string[] {
  return artifacts.filter((a) => a.unlockedByDefault !== true).sort((x, y) => (RANK[x.rarity] - RANK[y.rarity]) || (x.price - y.price) || x.id.localeCompare(y.id)).map((a) => a.id);
}
/** Artifact pool: default-unlocked + first N of lockedOrder (Destiny 'unlockArtifacts') + Pocket Dimension unlocks. */
export function artifactPool(m: MetaState): string[] {
  const n = Math.round(grantSum(m, 'unlockArtifacts'));
  const extra = new Set(lockedOrder().slice(0, n));
  return artifacts.filter((a) => a.unlockedByDefault === true || extra.has(a.id) || m.pocketUnlocked.includes(a.id)).map((a) => a.id);
}
export function tabletPool(m: MetaState): string[] {
  const n = Math.round(grantSum(m, 'unlockArtifacts'));
  const locked = tablets.filter((t) => t.unlockedByDefault !== true).sort((x, y) => (RANK[x.rarity] - RANK[y.rarity]) || (x.price - y.price));
  const extra = new Set(locked.slice(0, Math.ceil(n / 2)).map((t) => t.id));
  // a run always needs some tablets: if none unlocked by default, the 6 cheapest are available
  const base = tablets.filter((t) => t.unlockedByDefault === true).length ? [] : locked.slice(0, 6).map((t) => t.id);
  return tablets.filter((t) => t.unlockedByDefault === true || extra.has(t.id) || base.includes(t.id) || m.pocketUnlocked.includes(t.id)).map((t) => t.id);
}
export function lockedArtifacts(m: MetaState): string[] { const p = new Set(artifactPool(m)); return artifacts.filter((a) => !p.has(a.id)).map((a) => a.id); }
/** Ngọc Sao reward on run end. */
export function sapphireReward(floorsCleared: number, bossKills: number, miniKills: number, won: boolean, hard: boolean): number {
  const v = floorsCleared * 2 + bossKills * 8 + miniKills * 3 + (won ? 30 : 0);
  return Math.round(v * (hard ? 1.5 : 1));
}
