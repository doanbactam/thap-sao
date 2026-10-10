// Single data access point. Prefers the content agent's src/data/<name>.ts (default export) and
// falls back to engine fixtures when a file is missing, empty or malformed.
import type {
  ArtifactDef, TabletDef, ComboDef, WeaponDef, WeaponUpgradeDef, EnemyDef, BossDef, ChapterDef,
  MiracleDef, PotionDef, DestinyNode, TalentDef, CostumeDef,
} from '../data/types';
import * as fx from '../dev/fixtures/index';

const mods: Record<string, any> = import.meta.glob(['../data/*.ts', '!../data/*.test.ts', '!../data/types.ts'], { eager: true });

export const sources: Record<string, 'data' | 'fixture'> = {};

function pick<T>(name: string, fallback: T[], valid: (x: any) => boolean): T[] {
  const m = mods[`../data/${name}.ts`];
  const arr = m && (m.default ?? m[name]);
  if (Array.isArray(arr) && arr.length) {
    const ok = arr.filter((x) => x && valid(x));
    if (ok.length >= Math.min(arr.length, 1)) { sources[name] = 'data'; return ok as T[]; }
  }
  sources[name] = 'fixture';
  return fallback;
}
const hasId = (x: any) => typeof x.id === 'string' || typeof x.id === 'number';

export const artifacts = pick<ArtifactDef>('artifacts', fx.artifacts, (x) => hasId(x) && Array.isArray(x.shape) && x.shape.length > 0 && Array.isArray(x.effects));
export const tablets = pick<TabletDef>('tablets', fx.tablets, (x) => hasId(x) && Array.isArray(x.targets) && Array.isArray(x.shape));
export const combos = pick<ComboDef>('combos', fx.combos, (x) => hasId(x) && Array.isArray(x.tiers));
export const weapons = pick<WeaponDef>('weapons', fx.weapons, (x) => hasId(x) && Array.isArray(x.baseCoef));
export const weaponUpgrades = pick<WeaponUpgradeDef>('weaponUpgrades', fx.weaponUpgrades, (x) => hasId(x) && x.weapon && Array.isArray(x.mods));
export const enemies = pick<EnemyDef>('enemies', fx.enemies, (x) => hasId(x) && typeof x.hp === 'number');
export const bosses = pick<BossDef>('bosses', fx.bosses, (x) => hasId(x) && Array.isArray(x.phases) && x.phases.length > 0);
export const chapters = pick<ChapterDef>('chapters', fx.chapters, (x) => typeof x.id === 'number' && Array.isArray(x.enemies)).slice().sort((a, b) => a.id - b.id);
export const miracles = pick<MiracleDef>('miracles', fx.miracles, (x) => hasId(x) && Array.isArray(x.effects));
export const potions = pick<PotionDef>('potions', fx.potions, (x) => hasId(x) && typeof x.action === 'string');
export const destiny = pick<DestinyNode>('destiny', fx.destiny, (x) => hasId(x) && x.grant && Array.isArray(x.requires));
export const talents = pick<TalentDef>('talents', fx.talents, (x) => hasId(x) && x.stat);
export const costumes = pick<CostumeDef>('costumes', fx.costumes, (x) => hasId(x));

const strMod = mods['../data/strings.ts'];
export const contentStrings: Record<string, string> = (strMod && typeof strMod.default === 'object' && strMod.default) || {};
sources.strings = Object.keys(contentStrings).length ? 'data' : 'fixture';

function index<T extends { id: any }>(arr: T[]): Map<string, T> { const m = new Map<string, T>(); for (const a of arr) m.set(String(a.id), a); return m; }
const ix = {
  artifacts: index(artifacts), tablets: index(tablets), combos: index(combos), weapons: index(weapons),
  weaponUpgrades: index(weaponUpgrades), enemies: index(enemies), bosses: index(bosses), miracles: index(miracles),
  potions: index(potions), destiny: index(destiny), talents: index(talents), costumes: index(costumes),
};
export const getArtifact = (id: string) => ix.artifacts.get(id);
export const getTablet = (id: string) => ix.tablets.get(id);
export const getCombo = (id: string) => ix.combos.get(id);
export const getWeapon = (id: string) => ix.weapons.get(id);
export const getUpgrade = (id: string) => ix.weaponUpgrades.get(id);
export const getEnemy = (id: string) => ix.enemies.get(id) ?? ix.enemies.get(id.replace(/^en_/, ''));
export const getBoss = (id: string) => ix.bosses.get(id);
export const getMiracle = (id: string) => ix.miracles.get(id);
export const getPotion = (id: string) => ix.potions.get(id);
export const getDestiny = (id: string) => ix.destiny.get(id);
export const getTalent = (id: string) => ix.talents.get(id);
export const getCostume = (id: string) => ix.costumes.get(id);
export const getChapter = (n: number) => chapters.find((c) => c.id === n) ?? chapters[Math.max(0, Math.min(chapters.length - 1, n - 1))];
/** item lookup for inventory: artifact or tablet */
export function getItem(id: string): { kind: 'artifact'; def: ArtifactDef } | { kind: 'tablet'; def: TabletDef } | undefined {
  const a = getArtifact(id); if (a) return { kind: 'artifact', def: a };
  const t = getTablet(id); if (t) return { kind: 'tablet', def: t };
  return undefined;
}
/** Runtime registration (tests, training grounds tools). Does not persist. */
export function registerArtifact(def: ArtifactDef) { if (!ix.artifacts.has(def.id)) artifacts.push(def); ix.artifacts.set(def.id, def); }
export function registerTablet(def: TabletDef) { if (!ix.tablets.has(def.id)) tablets.push(def); ix.tablets.set(def.id, def); }
