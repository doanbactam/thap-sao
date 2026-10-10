// Run state + economy + rewards + node/event resolution + progression. Framework-free (SPEC §4–5).
import type { WeaponId, Rarity, EventId, StatKey } from '../data/types';
import { Rng } from './rng';
import { computeStats, levelMods, addXp as addXpCalc, rarityWeights, buyPrice, sellPrice, type StatMod, type Stats, STAT_KEYS } from './stats';
import { newGrid, addItem, resolve, gridEffects, remove, type Grid, resizeGrid, cloneGrid, comboProgress } from './inventory';
import { globalFloor } from './floorgen';
import type { ComboId } from '../data/types';
import { buildBundle, statMods, type Bundle, type Ctx } from './effects';
import { generateFloor, choicesFrom, isBossFloor, type Floor, type MapNode } from './floorgen';
import { offerUpgrades } from './weapons';
import { artifacts, tablets, miracles, potions, getArtifact, getTablet, getMiracle, getPotion, getCostume, getUpgrade, getItem } from './registry';
import {
  type MetaState, grantSum, lockedOrder, levelUpHealPct, pocketEnabled, talentMods, costumeMods, destinyStartMods, artifactPool, tabletPool, sapphireReward, discover, checkCostumeUnlocks, lockedArtifacts,
} from './meta';

export interface ShopItem { id: string; kind: 'artifact' | 'tablet' | 'potion'; price: number; sold: boolean }
/** locked: option index kept on reroll (V2). minRarity: kept across rerolls/banish. */
export interface Choice { kind: 'artifact' | 'tablet' | 'miracle' | 'upgrade'; options: string[]; source: string; locked?: number; minRarity?: number }
export interface Shop { items: ShopItem[]; discount: number; healed?: boolean; enchants?: number; rerolls?: number }
export interface Buff { stat: StatKey; value: number; t: number; pct?: boolean }
export interface RunState {
  version: number; seed: number; rngState: number; chapter: number; floor: number; floorData: Floor;
  pos: 'start' | number | 'gate'; visited: number[]; roomCleared: boolean;
  money: number; dice: number; level: number; xp: number; hp: number; mp: number;
  grid: Grid; weapon: WeaponId; upgrades: string[];
  potions: (string | null)[]; mysteryAction: string; mysteryKnown: boolean;
  miracles: string[]; rootsUsed: boolean; extraMods: StatMod[]; costume: string; hard: boolean;
  bossesKilled: number; minisKilled: number; floorsCleared: number; kills: number; buffs: Buff[];
  shop: Shop | null; choice: Choice | null; revives: number; won: boolean; dead: boolean; pocket: boolean; phoenixUsed: boolean; chestRerolls: number; claimed?: Record<string, boolean>;
  log: string[];
  /** V2: items banished from offers for the rest of the run; offers since the last build-matching option (pity). */
  banished?: string[]; pity?: number; chestRerollUsed?: boolean;
}
export const RUN_STATE_VERSION = 3;

export function rngOf(run: RunState): Rng { const r = new Rng(run.rngState); return r; }
export function draw<T>(run: RunState, f: (r: Rng) => T): T { const r = rngOf(run); const v = f(r); run.rngState = r.s; return v; }

export interface NewRunOpts { seed?: number; weapon?: WeaponId; hard?: boolean }
export function newRun(meta: MetaState, o: NewRunOpts = {}): RunState {
  const seed = (o.seed ?? (Date.now() & 0x7fffffff)) >>> 0;
  const cols = 5 + Math.round(grantSum(meta, 'bagCols')), rows = 4 + Math.round(grantSum(meta, 'bagRows'));
  const run: RunState = {
    version: RUN_STATE_VERSION, seed, rngState: seed ^ 0x5bd1e995, chapter: 1, floor: 1, floorData: null as any, pos: 'start', visited: [], roomCleared: true,
    money: grantSum(meta, 'seedMoney'), dice: grantSum(meta, 'startDice'), level: 1, xp: 0, hp: 0, mp: 0,
    grid: newGrid(cols, rows, grantSum(meta, 'sideBag') > 0), weapon: o.weapon ?? meta.weapon, upgrades: [],
    potions: new Array(3 + Math.round(grantSum(meta, 'potionSlot'))).fill(null).map((_, i) => (i === 0 ? 'heal' : null)),
    mysteryAction: '', mysteryKnown: false, miracles: [], rootsUsed: false, extraMods: [], costume: meta.costume, hard: !!(o.hard ?? meta.hardMode),
    bossesKilled: 0, minisKilled: 0, floorsCleared: 0, kills: 0, buffs: [], shop: null, choice: null, revives: Math.round(grantSum(meta, 'revive')), won: false, dead: false, pocket: pocketEnabled(meta), phoenixUsed: false, chestRerolls: Math.round(grantSum(meta, 'chestReroll')), log: [],
  };
  run.mysteryAction = draw(run, (r) => r.chance(0.2) ? 'bad' : r.pick(potions.filter((p) => p.action !== 'mystery').map((p) => p.action)));
  const cos = getCostume(meta.costume);
  for (const id of cos?.startItems ?? []) if (getItem(id)) addItem(run.grid, id);
  run.floorData = makeFloor(run);
  const s = runStats(run, meta); run.hp = s.maxHp; run.mp = s.maxMp;
  return run;
}
export function makeFloor(run: RunState): Floor {
  const seed = draw(run, (r) => r.int(1, 2 ** 30));
  run.phoenixUsed = false; run.chestRerolls = Math.max(run.chestRerolls, 0); run.chestRerollUsed = false;
  return generateFloor(seed, run.chapter, run.floor, { rootsAvailable: !run.rootsUsed, hard: run.hard, pocket: run.pocket !== false });
}

// ---------- stats ----------
export function runBundle(run: RunState): Bundle {
  const list = gridEffects(run.grid);
  for (const id of run.miracles) for (const e of getMiracle(id)?.effects ?? []) list.push({ effect: e, level: 0, source: `miracle:${id}` });
  return buildBundle(list);
}
export function runStats(run: RunState, meta: MetaState, ctx?: Partial<Ctx>, bundle = runBundle(run)): Stats {
  const c: Ctx = { hpPct: 1, mpPct: 1, dashLeft: 1, bossRoom: false, ...ctx };
  const mods: StatMod[] = [...talentMods(meta), ...costumeMods({ ...meta, costume: run.costume }), ...destinyStartMods(meta), ...levelMods(run.level), ...run.extraMods, ...statMods(bundle, c), ...run.buffs.map((b) => ({ stat: b.stat, value: b.value, pct: b.pct }))];
  const s = computeStats(mods);
  const cos = getCostume(run.costume); if (cos?.fixedHp) s.maxHp = cos.fixedHp;
  return s;
}
export function tickBuffs(run: RunState, dt: number) { for (const b of run.buffs) b.t -= dt; run.buffs = run.buffs.filter((b) => b.t > 0); }

// ---------- rewards ----------
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
export function rollRarity(r: Rng, luck: number, chapter: number, minRarity = 0, floor = 1): Rarity {
  const w = rarityWeights(luck, chapter, floor).map((x, i) => (i < minRarity ? 0 : x));
  return RARITIES[r.weighted([0, 1, 2, 3], (i) => w[i])];
}
function pickByRarity(r: Rng, ids: string[], getR: (id: string) => Rarity | undefined, luck: number, chapter: number, n: number, minRarity = 0, weight: (id: string) => number = () => 1, floor = 1, overflow: string[] = []): string[] {
  const out: string[] = []; const pool = [...ids];
  const rank = (id: string) => RARITIES.indexOf(getR(id) ?? 'common');
  // V2 audit: a rarity floor (mini-boss / blood altar / secret room) used to fall back to commons when the unlocked
  // pool had no rare+ items (a fresh save has none) — the "rare+" reward was a lie. Now the floor is honoured: missing
  // rarities fall back downward only to the floor, then to `overflow` (next locked items) at or above the floor.
  if (minRarity > 0 && !pool.some((id) => rank(id) >= minRarity)) for (const id of overflow) if (rank(id) >= minRarity && !pool.includes(id)) pool.push(id);
  for (let i = 0; i < n && pool.length; i++) {
    const rar = rollRarity(r, luck, chapter, minRarity, floor);
    let cands = pool.filter((id) => getR(id) === rar);
    for (let k = RARITIES.indexOf(rar); !cands.length && k >= minRarity; k--) cands = pool.filter((id) => getR(id) === RARITIES[k]);
    for (let k = RARITIES.indexOf(rar) + 1; !cands.length && k < RARITIES.length; k++) cands = pool.filter((id) => getR(id) === RARITIES[k]);
    if (!cands.length) cands = pool;
    const pick = r.weighted(cands, weight); out.push(pick); pool.splice(pool.indexOf(pick), 1);
  }
  return out;
}

// ---- V2: build-aware offers ----
/** Tuning knobs for offer weighting (see docs/V2_BUILD.md; tuned with src/systems/sim.ts). */
export const OFFER = { perTag: 0.25, nearThreshold: 0.6, weaponBias: 0.5, pityAfter: 3, maxTagCount: 4 };
/** Tag counts of the artifacts in the bag (active or not: intent counts), side bag excluded. */
export function buildTags(run: RunState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of run.grid.items) if (p.kind === 'artifact') for (const t of getArtifact(p.id)?.tags ?? []) out[t] = (out[t] ?? 0) + 1;
  return out;
}
/** Offer weight of an artifact for this run: leans toward the player's combo tags and weapon. Always ≥ 1. */
export function offerWeight(run: RunState, id: string, tags = buildTags(run)): number {
  const a = getArtifact(id); if (!a) return 1;
  let w = 1;
  for (const t of a.tags) {
    const n = tags[t] ?? 0; if (!n) continue;
    w += OFFER.perTag * Math.min(n, OFFER.maxTagCount);
    const { next } = comboProgress(t as ComboId, n); if (next !== null && next - n <= 1) w += OFFER.nearThreshold;
  }
  if (a.weaponBias?.includes(run.weapon)) w += OFFER.weaponBias;
  return w;
}
const matchesBuild = (id: string, tags: Record<string, number>) => (getArtifact(id)?.tags ?? []).some((t) => (tags[t] ?? 0) > 0);
export function offerArtifacts(run: RunState, meta: MetaState, luck = 0, n = 3, minRarity = 0, exclude: string[] = []): string[] {
  const tags = buildTags(run); const ban = new Set([...(run.banished ?? []), ...exclude]);
  const pool = artifactPool(meta).filter((id) => !ban.has(id));
  return draw(run, (r) => {
    // overflow for a rarity floor the pool cannot meet: the next 6 locked artifacts of that rarity (a preview of the next shelf)
    const overflow = minRarity > 0 ? lockedOrder().filter((id) => !ban.has(id) && RARITIES.indexOf(getArtifact(id)!.rarity) >= minRarity).slice(0, 6) : [];
    const out = pickByRarity(r, pool, (id) => getArtifact(id)?.rarity, luck, run.chapter, n, minRarity, (id) => offerWeight(run, id, tags), run.floor, overflow);
    if (Object.keys(tags).length && n >= 2) {
      if (out.some((id) => matchesBuild(id, tags))) run.pity = 0;
      else if ((run.pity ?? 0) + 1 >= OFFER.pityAfter) { // pity: guarantee one option that grows the current build
        const cands = pool.filter((id) => !out.includes(id) && matchesBuild(id, tags) && RARITIES.indexOf(getArtifact(id)!.rarity) >= minRarity);
        if (cands.length) { out[out.length - 1] = r.weighted(cands, (id) => offerWeight(run, id, tags) * (rarityWeights(luck, run.chapter, run.floor)[RARITIES.indexOf(getArtifact(id)!.rarity)] ?? 1)); run.pity = 0; }
        else run.pity = (run.pity ?? 0) + 1;
      } else run.pity = (run.pity ?? 0) + 1;
    }
    return out;
  });
}
export function offerTablets(run: RunState, meta: MetaState, luck = 0, n = 3, exclude: string[] = []) {
  const ban = new Set([...(run.banished ?? []), ...exclude]);
  return draw(run, (r) => pickByRarity(r, tabletPool(meta).filter((id) => !ban.has(id)), (id) => getTablet(id)?.rarity, luck, run.chapter, n, 0, () => 1, run.floor));
}
export function offerMiracles(run: RunState, n = 3) { return draw(run, (r) => r.shuffle(miracles.map((m) => m.id).filter((id) => !run.miracles.includes(id))).slice(0, n)); }
export function offerWeaponUpgrades(run: RunState, n = 3) { return draw(run, (r) => offerUpgrades(r, run.weapon, run.upgrades, run.chapter, n).map((u) => u.id)); }
export function makeChoice(run: RunState, meta: MetaState, kind: Choice['kind'], source: string, luck = 0, minRarity = 0): Choice {
  const options = kind === 'artifact' ? offerArtifacts(run, meta, luck, 3, minRarity) : kind === 'tablet' ? offerTablets(run, meta, luck) : kind === 'miracle' ? offerMiracles(run) : offerWeaponUpgrades(run);
  run.choice = { kind, options, source, minRarity }; return run.choice;
}
function freshOptions(run: RunState, meta: MetaState, c: Choice, n: number, luck: number, exclude: string[]): string[] {
  if (c.kind === 'artifact') return offerArtifacts(run, meta, luck, n, c.minRarity ?? 0, exclude);
  if (c.kind === 'tablet') return offerTablets(run, meta, luck, n, exclude);
  if (c.kind === 'miracle') return draw(run, (r) => r.shuffle(miracles.map((m) => m.id).filter((id) => !run.miracles.includes(id) && !exclude.includes(id))).slice(0, n));
  return draw(run, (r) => offerUpgrades(r, run.weapon, run.upgrades, run.chapter, 6).map((u) => u.id).filter((id) => !exclude.includes(id)).slice(0, n));
}
/** Dice reroll of the current choice (1 die). A locked option stays in its slot; rarity floor (mini-boss/blood) is kept. */
export function rerollChoice(run: RunState, meta: MetaState, luck = 0): boolean {
  if (!run.choice || run.dice < 1) return false;
  run.dice--; const c = run.choice; const lock = c.locked !== undefined ? c.options[c.locked] : undefined;
  if (lock === undefined) { makeChoice(run, meta, c.kind, c.source, luck, c.minRarity ?? 0); return true; }
  const fresh = freshOptions(run, meta, c, c.options.length - 1, luck, [lock]);
  const opts: string[] = []; let k = 0;
  for (let i = 0; i < c.options.length; i++) { if (i === c.locked) opts.push(lock); else if (fresh[k] !== undefined) opts.push(fresh[k++]); }
  run.choice = { ...c, options: opts }; return true;
}
/** Lock / unlock option i so the next reroll keeps it (free). */
export function toggleLock(run: RunState, i: number): boolean {
  const c = run.choice; if (!c || !c.options[i]) return false;
  c.locked = c.locked === i ? undefined : i; return true;
}
/** Banish option i for the rest of the run (1 die): it never shows up again and its slot is refilled. */
export function banishOption(run: RunState, meta: MetaState, i: number, luck = 0): boolean {
  const c = run.choice; if (!c || !c.options[i] || run.dice < 1 || c.kind === 'upgrade') return false;
  run.dice--; const id = c.options[i];
  (run.banished ??= []).push(id);
  const repl = freshOptions(run, meta, c, 1, luck, c.options)[0];
  if (repl) c.options[i] = repl; else c.options.splice(i, 1);
  if (c.locked === i) c.locked = undefined; else if (c.locked !== undefined && c.locked > i && !repl) c.locked--;
  return true;
}
/** Take option i of the current choice. Returns false if the bag is full (item goes nowhere). */
export function takeChoice(run: RunState, meta: MetaState, i: number, placer?: (run: RunState, id: string) => unknown): boolean {
  const c = run.choice; if (!c || !c.options[i]) return false;
  const id = c.options[i];
  if (c.kind === 'artifact' || c.kind === 'tablet') {
    if (!(placer ? placer(run, id) : addItem(run.grid, id))) return false;
    discover(meta, c.kind === 'artifact' ? 'artifacts' : 'tablets', id);
  } else if (c.kind === 'miracle') { run.miracles.push(id); run.rootsUsed = true; discover(meta, 'miracles', id); }
  else if (c.kind === 'upgrade') run.upgrades.push(id);
  run.choice = null; return true;
}
export function skipChoice(run: RunState) { run.choice = null; }

// ---------- XP ----------
export function gainXp(run: RunState, meta: MetaState, n: number): number {
  const r = addXpCalc(run.level, run.xp, n); const ups = r.ups;
  run.level = r.level; run.xp = r.xp;
  if (ups > 0) { const s = runStats(run, meta); run.mp = s.maxMp; run.hp = Math.min(s.maxHp, run.hp + LEVEL_HP_GAIN * ups + Math.round(s.maxHp * levelUpHealPct(meta) / 100 * ups)); }
  return ups;
}
const LEVEL_HP_GAIN = 5;

// ---------- shop ----------
// ---- V2 economy knobs (tuned with src/systems/sim.ts, documented in docs/V2_BUILD.md) ----
export const ECON = {
  inflationPerChapter: 0.1,       // shop prices +10% per chapter after the first
  potionBase: 40, potionPerChapter: 12,
  healPct: 0.35, healBase: 30, healPerFloor: 9,          // shop "Băng bó" service: once per shop
  enchantBase: 60, enchantFactor: 0.4, // shop enchant service: (base + price × factor) × (level+1), +50% per extra enchant in the same shop
  rerollGoldBase: 30, rerollGoldStep: 25,               // shop reroll with gold when out of dice (escalates per shop)
  moneyNode: [60, 110] as [number, number], moneyNodeChapter: 0.35,
  bloodHpPct: 0.25, bloodMinRarity: 2,                  // blood altar: pay 25% MAX HP for an epic+ artifact choice
  companionBase: 150, companionPerChapter: 50,
  redFountainBase: 90, redFountainPerChapter: 45,       // red fountain pays its gold up front, then the waves come
};
export const inflation = (chapter: number) => 1 + ECON.inflationPerChapter * Math.max(0, chapter - 1);
export const potionPrice = (chapter: number) => ECON.potionBase + ECON.potionPerChapter * chapter;
export function shopPrice(run: RunState, base: number, barter = 0, discount = 0) { return buyPrice(Math.round(base * inflation(run.chapter)), barter, discount); }
export function makeShop(run: RunState, meta: MetaState, size: number, discount = 0, luck = 0, barter = 0): Shop {
  const arts = offerArtifacts(run, meta, luck, Math.ceil(size / 2));
  const tabs = offerTablets(run, meta, luck, Math.floor(size / 2));
  const pot = draw(run, (r) => r.pick(potions).id);
  const items: ShopItem[] = [
    ...arts.map((id) => ({ id, kind: 'artifact' as const, price: shopPrice(run, getArtifact(id)!.price, barter, discount), sold: false })),
    ...tabs.map((id) => ({ id, kind: 'tablet' as const, price: shopPrice(run, getTablet(id)!.price, barter, discount), sold: false })),
    { id: pot, kind: 'potion', price: buyPrice(potionPrice(run.chapter), barter, discount), sold: false },
  ];
  const prev = run.shop;
  run.shop = { items, discount, healed: prev?.healed, enchants: prev?.enchants ?? 0, rerolls: prev?.rerolls ?? 0 }; return run.shop;
}
/** Gold price of the next shop reroll (used when the player has no dice). */
export const shopRerollGold = (run: RunState) => ECON.rerollGoldBase + ECON.rerollGoldStep * (run.shop?.rerolls ?? 0);
/** Reroll the shop stock: 1 die if the player has one, else gold (escalating). `useGold` forces gold. */
export function rerollShop(run: RunState, meta: MetaState, luck = 0, barter = 0, useGold = false): boolean {
  if (!run.shop) return false;
  if (!useGold && run.dice >= 1) run.dice--;
  else { const c = shopRerollGold(run); if (run.money < c) return false; run.money -= c; }
  run.shop.rerolls = (run.shop.rerolls ?? 0) + 1;
  makeShop(run, meta, run.shop.items.length - 1, run.shop.discount, luck, barter); return true;
}
/** Shop service: bandage (heal ECON.healPct of max HP), once per shop. */
export const shopHealCost = (run: RunState) => ECON.healBase + ECON.healPerFloor * globalFloor(run.chapter, run.floor);
export function shopHeal(run: RunState, maxHp: number): boolean {
  if (!run.shop || run.shop.healed || run.hp >= maxHp) return false;
  const c = shopHealCost(run); if (run.money < c) return false;
  run.money -= c; run.hp = Math.min(maxHp, run.hp + Math.round(maxHp * ECON.healPct)); run.shop.healed = true; return true;
}
/** Shop service: +1 permanent level to an artifact. Price grows with base price and level; each further enchant in
 *  the same shop costs +50% (repeatable gold sink). */
export function enchantCost(run: RunState, uid: number): number | null {
  const p = run.grid.items.find((i) => i.uid === uid && i.kind === 'artifact'); if (!p) return null;
  const d = getArtifact(p.id)!; if (p.level >= d.maxLevel) return null;
  return Math.round((ECON.enchantBase + d.price * ECON.enchantFactor) * (p.level + 1) * inflation(run.chapter) * (1 + 0.5 * (run.shop?.enchants ?? 0)));
}
export function shopEnchant(run: RunState, uid: number): boolean {
  if (!run.shop) return false;
  const c = enchantCost(run, uid); if (c === null || run.money < c) return false;
  run.money -= c; enchant(run, uid, 1); run.shop.enchants = (run.shop.enchants ?? 0) + 1; return true;
}
export function buy(run: RunState, meta: MetaState, idx: number, placer?: (run: RunState, id: string) => unknown): boolean {
  const it = run.shop?.items[idx]; if (!it || it.sold || run.money < it.price) return false;
  if (it.kind === 'potion') { if (!addPotion(run, it.id)) return false; }
  else { if (!(placer ? placer(run, it.id) : addItem(run.grid, it.id))) return false; discover(meta, it.kind === 'artifact' ? 'artifacts' : 'tablets', it.id); }
  run.money -= it.price; it.sold = true; return true;
}
export function itemBasePrice(id: string) { return getArtifact(id)?.price ?? getTablet(id)?.price ?? 0; }
export function sell(run: RunState, uid: number, barter = 0): number {
  let p = remove(run.grid, uid);
  if (!p) { const i = run.grid.side.findIndex((s) => s?.uid === uid); if (i >= 0) { p = run.grid.side[i]; run.grid.side[i] = null; } }
  if (!p) return 0;
  const v = sellPrice(itemBasePrice(p.id), barter); run.money += v; return v;
}
export function discard(run: RunState, uid: number): boolean {
  if (remove(run.grid, uid)) return true;
  const i = run.grid.side.findIndex((s) => s?.uid === uid); if (i >= 0) { run.grid.side[i] = null; return true; }
  return false;
}

// ---------- enchant ----------
export function enchant(run: RunState, uid: number, times: number): boolean {
  const p = run.grid.items.find((i) => i.uid === uid && i.kind === 'artifact'); if (!p) return false;
  p.level = Math.min(p.level + times, getArtifact(p.id)!.maxLevel);
  return true;
}

// ---------- potions ----------
export function addPotion(run: RunState, id: string): boolean { const i = run.potions.indexOf(null); if (i < 0 || !getPotion(id)) return false; run.potions[i] = id; return true; }
/** Drink slot i: returns the resolved action applied (for UI), identifies mystery potions on first drink. */
export function drinkPotion(run: RunState, meta: MetaState, i: number): { action: string; identified?: boolean } | null {
  const id = run.potions[i]; if (!id) return null;
  const def = getPotion(id)!; run.potions[i] = null;
  let action = def.action; let value = def.value; let duration = def.duration; let identified: boolean | undefined;
  if (action === 'mystery') {
    identified = !run.mysteryKnown; run.mysteryKnown = true;
    if (run.mysteryAction === 'bad') { action = 'bad'; value = 0.15; duration = def.duration ?? 10; }
    else { const real = potions.find((p) => p.action === run.mysteryAction) ?? potions[0]; action = real.action; value = real.value; duration = real.duration; }
  }
  const s = runStats(run, meta);
  applyPotionAction(run, s, action, value, duration);
  return { action, identified };
}

/** Potion actions (CONTENT.md §6): heal/mana = fraction, rage = +% dmg, iron = +def, swift = +% move & attack; legacy stat keys accepted. */
export function applyPotionAction(run: RunState, s: Stats, action: string, value: number, duration?: number) {
  const d = duration ?? 10;
  switch (action) {
    case 'heal': case 'healPct': run.hp = Math.min(s.maxHp, run.hp + s.maxHp * value); break;
    case 'mana': case 'mpFull': run.mp = Math.min(s.maxMp, run.mp + s.maxMp * (value || 1)); break;
    case 'rage': run.buffs.push({ stat: 'damagePct', value, t: d }); break;
    case 'iron': run.buffs.push({ stat: 'defense', value, t: d }); break;
    case 'swift': run.buffs.push({ stat: 'moveSpeed', value, t: d }, { stat: 'attackSpeed', value, t: d }); break;
    case 'bad': run.buffs.push({ stat: 'moveSpeed', value: -Math.round(value * 100), t: d }); run.hp = Math.max(1, run.hp - Math.round(s.maxHp * 0.05)); break;
    default: if ((STAT_KEYS as string[]).includes(action)) run.buffs.push({ stat: action as StatKey, value, t: d }); else run.hp = Math.min(s.maxHp, run.hp + s.maxHp * 0.2);
  }
}

// ---------- nodes & progression ----------
export function currentChoices(run: RunState) { return choicesFrom(run.floorData, run.pos === 'gate' ? 'start' : run.pos); }
export function canEnter(run: RunState, target: number | 'gate'): boolean {
  if (!run.roomCleared) return false;
  const ch = choicesFrom(run.floorData, run.pos === 'gate' ? 'start' : run.pos);
  return target === 'gate' ? ch === 'gate' : Array.isArray(ch) && ch.includes(target);
}
export function enterNode(run: RunState, target: number | 'gate', force = false): MapNode | 'gate' | null {
  if (!force && !canEnter(run, target)) return null;
  run.pos = target; run.roomCleared = false; run.shop = null; run.choice = null;
  if (target === 'gate') return 'gate';
  run.visited.push(target);
  return run.floorData.nodes[target];
}
export const isFightNode = (n: MapNode) => n.type !== 'shop' && n.type !== 'roots';

/** Immediate (non-choice) node rewards. Returns a short description key for the UI. */
export function applyNodeReward(run: RunState, meta: MetaState, n: MapNode, luck = 0, barter = 0): string {
  switch (n.type) {
    case 'levelup': { const need = Math.max(1, 20 + (run.level - 1) * 18 - run.xp); gainXp(run, meta, need); return 'levelup'; }
    case 'money': {
      let roll = draw(run, (r) => r.int(ECON.moneyNode[0], ECON.moneyNode[1]));
      // Destiny 'chestReroll' (Rương May Mắn): once per floor the money chest is rolled twice and pays the better roll.
      if (grantSum(meta, 'chestReroll') > 0 && !run.chestRerollUsed) { roll = Math.max(roll, draw(run, (r) => r.int(ECON.moneyNode[0], ECON.moneyNode[1]))); run.chestRerollUsed = true; }
      run.money += roll * (1 + (run.chapter - 1) * ECON.moneyNodeChapter) | 0; return 'money';
    }
    case 'heart': run.extraMods.push({ stat: 'maxHp', value: 15 }); run.hp += 15; return 'heart';
    case 'dice': run.dice += 2; return 'dice';
    case 'artifact': makeChoice(run, meta, 'artifact', 'node', luck, n.modifier === 'miniboss' ? 1 : 0); return 'choice';
    case 'tablet': makeChoice(run, meta, 'tablet', 'node', luck); return 'choice';
    case 'anvil': makeChoice(run, meta, 'upgrade', 'anvil'); return 'choice';
    case 'roots': if (run.rootsUsed) return 'none'; makeChoice(run, meta, 'miracle', 'roots'); return 'choice';
    case 'shop': makeShop(run, meta, 4, 0, luck, barter); return 'shop';
    case 'enchant': return 'enchant';
  }
  return 'none';
}
export const enchantTimes = (n: MapNode, meta: MetaState) => Math.min(3, (n.altarSize ?? 1) + Math.round(grantSum(meta, 'enchantBonus')));

/** Boss / gate defeated: next floor (or chapter), or win after chapter 6 boss. */
export function bossDefeated(run: RunState, meta: MetaState, mini: boolean, reward?: { sapphire: number; money: number }): 'nextFloor' | 'nextChapter' | 'win' {
  if (mini) run.minisKilled++; else { run.bossesKilled++; meta.stats.bossKills++; }
  run.money += reward?.money ?? 0;
  run.floorsCleared++; run.roomCleared = true;
  if (isBossFloor(run.floor)) {
    if (run.chapter >= 6) { run.won = true; return 'win'; }
    run.chapter++; run.floor = 1; meta.stats.maxChapter = Math.max(meta.stats.maxChapter, run.chapter);
    run.floorData = makeFloor(run); run.pos = 'start'; run.visited = []; return 'nextChapter';
  }
  run.floor++; run.floorData = makeFloor(run); run.pos = 'start'; run.visited = []; return 'nextFloor';
}
export function setChapter(run: RunState, chapter: number, floor: number) {
  run.chapter = Math.max(1, Math.min(6, chapter)); run.floor = Math.max(1, Math.min(3, floor));
  run.floorData = makeFloor(run); run.pos = 'start'; run.visited = []; run.roomCleared = true;
}
/** End of run: sapphires + stats into meta. Returns sapphires earned. */
export function endRun(run: RunState, meta: MetaState, won: boolean): number {
  const earned = sapphireReward(run.floorsCleared, run.bossesKilled, run.minisKilled, won, run.hard);
  meta.sapphires += earned; meta.stats.totalSapphires = (meta.stats.totalSapphires ?? 0) + earned; meta.stats.runs++; meta.stats.kills += run.kills;
  if (won) { meta.stats.wins++; meta.hardModeUnlocked = true; } else meta.stats.deaths++;
  checkCostumeUnlocks(meta);
  return earned;
}
/** Player took lethal damage: use a revive if any. */
export function onLethal(run: RunState, maxHp: number): boolean { if (run.revives > 0) { run.revives--; run.hp = Math.round(maxHp * 0.5); return true; } run.dead = true; return false; }

// ---------- events ----------
export interface EventResult { ok: boolean; text: string; fight?: 'waves' | 'arena' | 'bat'; choice?: Choice; shop?: boolean }
export function resolveEvent(run: RunState, meta: MetaState, ev: EventId, option: string, ctx: { luck?: number; barter?: number; maxHp?: number } = {}): EventResult {
  const luck = ctx.luck ?? 0, barter = ctx.barter ?? 0;
  switch (ev) {
    case 'arena': return { ok: true, text: 'arena', fight: 'arena' };
    case 'secret': run.money += 80; makeChoice(run, meta, 'artifact', 'secret', luck, 1); return { ok: true, text: 'secret', choice: run.choice! };
    case 'clover': if (option === 'def') run.extraMods.push({ stat: 'defense', value: 4 }); else { run.extraMods.push({ stat: 'maxHp', value: 6 }); run.hp += 6; } return { ok: true, text: `clover_${option === 'def' ? 'def' : 'hp'}` };
    case 'merchant': makeShop(run, meta, 5, 0.1, luck, barter); return { ok: true, text: 'merchant', shop: true };
    case 'obelisk': {
      const keys: StatKey[] = ['physical', 'fire', 'ice', 'lightning', 'defense', 'critChance', 'moveSpeed', 'maxHp'];
      const [a, b] = draw(run, (r) => r.shuffle([...keys]).slice(0, 2));
      const s = runStats(run, meta); const amt = Math.max(3, Math.round(Math.min(s[a], s[b]) * 0.25));
      run.extraMods.push({ stat: a, value: amt }, { stat: b, value: -amt });
      return { ok: true, text: `obelisk:${a}:${b}:${amt}` };
    }
    case 'fountain': {
      if (option === 'green') { gainXp(run, meta, 30 + run.chapter * 10); return { ok: true, text: 'fountain_green' }; }
      if (option === 'gold') { run.money += 100 + run.chapter * 40; return { ok: true, text: 'fountain_gold' }; }
      run.money += redFountainGold(run); return { ok: true, text: 'fountain_red', fight: 'waves' };
    }
    case 'companion': {
      const price = companionPrice(run); if (run.money < price) return { ok: false, text: 'no_money' };
      const comp = artifacts.filter((a) => a.tags.includes('companion') || a.effects.some((e) => e.kind === 'summon'));
      const id = draw(run, (r) => r.pick(comp.length ? comp : artifacts).id);
      if (!addItem(run.grid, id)) return { ok: false, text: 'bag_full' };
      run.money -= price; discover(meta, 'artifacts', id); return { ok: true, text: `companion:${id}` };
    }
    case 'blood': {
      if (option === 'bat') return { ok: true, text: 'blood_bat', fight: 'bat' };
      const cost = bloodCost(run, ctx.maxHp ?? runStats(run, meta).maxHp); if (run.hp - cost < 1) return { ok: false, text: 'no_hp' };
      run.hp -= cost; makeChoice(run, meta, 'artifact', 'blood', luck, ECON.bloodMinRarity); return { ok: true, text: 'blood_pay', choice: run.choice! };
    }
    case 'pocket': {
      if (!pocketEnabled(meta)) return { ok: false, text: 'pocket_locked' };
      const locked = lockedArtifacts(meta); const cost = 5;
      if (!locked.length) return { ok: false, text: 'none_locked' };
      if (meta.sapphires < cost) return { ok: false, text: 'no_sapphire' };
      const id = draw(run, (r) => r.pick(locked)); meta.sapphires -= cost; meta.pocketUnlocked.push(id); return { ok: true, text: `pocket:${id}` };
    }
  }
  return { ok: false, text: 'unknown' };
}
export const companionPrice = (run: RunState) => ECON.companionBase + ECON.companionPerChapter * run.chapter;
export const redFountainGold = (run: RunState) => ECON.redFountainBase + ECON.redFountainPerChapter * run.chapter;
export const bloodCost = (run: RunState, maxHp: number) => Math.ceil(maxHp * ECON.bloodHpPct);
/**
 * V2: the exact stakes of an event option, shown on the event dialog before choosing. Deterministic: it resolves the
 * option on a clone of the run (same RNG state), so the obelisk preview names the real stats that will swap.
 */
export function eventStakes(run: RunState, meta: MetaState, ev: EventId, option: string, ctx: { maxHp?: number } = {}): string {
  const maxHp = ctx.maxHp ?? runStats(run, meta).maxHp;
  switch (ev) {
    case 'clover': return option === 'def' ? '+4 Phòng thủ vĩnh viễn' : '+6 HP tối đa vĩnh viễn';
    case 'merchant': return 'Cửa hàng 5 món, rẻ hơn 10%';
    case 'fountain': return option === 'green' ? `+${30 + run.chapter * 10} kinh nghiệm` : option === 'gold' ? `+${100 + run.chapter * 40} Hạt Dẻ` : `Nhận ngay ${redFountainGold(run)} Hạt Dẻ, rồi đánh 2 đợt quái`;
    case 'companion': { const p = companionPrice(run); return `Trả ${p} Hạt Dẻ (có ${run.money}) lấy 1 cổ vật Đồng Hành`; }
    case 'blood': {
      if (option === 'bat') return `Đánh dơi canh (${60 + run.chapter * 30} HP) lấy 1 bình thuốc`;
      const c = bloodCost(run, maxHp); return `Mất ${c} HP (còn ${Math.max(0, Math.ceil(run.hp - c))}/${maxHp}) → chọn 1/3 cổ vật Sử Thi trở lên${run.hp - c < 1 ? ' — KHÔNG ĐỦ MÁU' : ''}`;
    }
    case 'obelisk': {
      const c = cloneRun(run); const res = resolveEvent(c, meta, 'obelisk', 'go');
      const [, a, b, amt] = res.text.split(':');
      return `${STAT_VN[a] ?? a} +${amt}, ${STAT_VN[b] ?? b} −${amt} (vĩnh viễn)`;
    }
    case 'pocket': return `Trả 5 Ngọc Sao (có ${meta.sapphires}) mở khóa vĩnh viễn 1 cổ vật`;
    case 'arena': return '3–4 đợt quái';
    case 'secret': return '+80 Hạt Dẻ và chọn 1/3 cổ vật Hiếm trở lên';
  }
  return '';
}
export const STAT_VN: Record<string, string> = {
  maxHp: 'HP tối đa', maxMp: 'MP tối đa', mpRegen: 'Hồi MP', physical: 'Vật lý', fire: 'Lửa', ice: 'Băng', lightning: 'Sét', magic: 'Phép thuật',
  defense: 'Phòng thủ', evasion: 'Né tránh', critChance: 'Chí mạng', critDamage: 'ST chí mạng', attackSpeed: 'Tốc đánh', moveSpeed: 'Tốc chạy',
  dashCount: 'Lượt lướt', dashRecovery: 'Hồi lướt', luck: 'May mắn', barter: 'Mặc cả', lifesteal: 'Hút máu', damagePct: 'Sát thương', cooldownPct: 'Giảm hồi chiêu',
};
export function batReward(run: RunState): string | null { const id = draw(run, (r) => r.pick(potions).id); return addPotion(run, id) ? id : null; }
export function cloneRun(run: RunState): RunState { return JSON.parse(JSON.stringify(run)); }
export function serializeRun(run: RunState): RunState { return { ...cloneRun(run), grid: cloneGrid(run.grid) }; }
export function deserializeRun(data: any): RunState | null {
  if (!data || data.version !== RUN_STATE_VERSION || !data.floorData) return null;
  if (data.grid) resizeGrid(data.grid, data.grid.cols, data.grid.rows);
  return data as RunState;
}
export { getUpgrade };
