// Run state + economy + rewards + node/event resolution + progression. Framework-free (SPEC §4–5).
import type { WeaponId, Rarity, EventId, StatKey } from '../data/types';
import { Rng } from './rng';
import { computeStats, levelMods, addXp as addXpCalc, rarityWeights, buyPrice, sellPrice, type StatMod, type Stats, STAT_KEYS } from './stats';
import { newGrid, addItem, resolve, gridEffects, remove, type Grid, resizeGrid, cloneGrid } from './inventory';
import { buildBundle, statMods, type Bundle, type Ctx } from './effects';
import { generateFloor, choicesFrom, isBossFloor, type Floor, type MapNode } from './floorgen';
import { offerUpgrades } from './weapons';
import { artifacts, tablets, miracles, potions, getArtifact, getTablet, getMiracle, getPotion, getCostume, getUpgrade, getItem } from './registry';
import {
  type MetaState, grantSum, levelUpHealPct, pocketEnabled, talentMods, costumeMods, destinyStartMods, artifactPool, tabletPool, sapphireReward, discover, checkCostumeUnlocks, lockedArtifacts,
} from './meta';

export interface ShopItem { id: string; kind: 'artifact' | 'tablet' | 'potion'; price: number; sold: boolean }
export interface Choice { kind: 'artifact' | 'tablet' | 'miracle' | 'upgrade'; options: string[]; source: string }
export interface Buff { stat: StatKey; value: number; t: number; pct?: boolean }
export interface RunState {
  version: number; seed: number; rngState: number; chapter: number; floor: number; floorData: Floor;
  pos: 'start' | number | 'gate'; visited: number[]; roomCleared: boolean;
  money: number; dice: number; level: number; xp: number; hp: number; mp: number;
  grid: Grid; weapon: WeaponId; upgrades: string[];
  potions: (string | null)[]; mysteryAction: string; mysteryKnown: boolean;
  miracles: string[]; rootsUsed: boolean; extraMods: StatMod[]; costume: string; hard: boolean;
  bossesKilled: number; minisKilled: number; floorsCleared: number; kills: number; buffs: Buff[];
  shop: { items: ShopItem[]; discount: number } | null; choice: Choice | null; revives: number; won: boolean; dead: boolean; pocket: boolean; phoenixUsed: boolean; chestRerolls: number; claimed?: Record<string, boolean>;
  log: string[];
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
  run.phoenixUsed = false; run.chestRerolls = Math.max(run.chestRerolls, 0);
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
export function rollRarity(r: Rng, luck: number, chapter: number, minRarity = 0): Rarity {
  const w = rarityWeights(luck, chapter).map((x, i) => (i < minRarity ? 0 : x));
  return RARITIES[r.weighted([0, 1, 2, 3], (i) => w[i])];
}
function pickByRarity(r: Rng, ids: string[], getR: (id: string) => Rarity | undefined, luck: number, chapter: number, n: number, minRarity = 0): string[] {
  const out: string[] = []; const pool = [...ids];
  for (let i = 0; i < n && pool.length; i++) {
    const rar = rollRarity(r, luck, chapter, minRarity);
    let cands = pool.filter((id) => getR(id) === rar);
    for (let k = RARITIES.indexOf(rar); !cands.length && k >= 0; k--) cands = pool.filter((id) => getR(id) === RARITIES[k]);
    if (!cands.length) cands = pool;
    const pick = r.pick(cands); out.push(pick); pool.splice(pool.indexOf(pick), 1);
  }
  return out;
}
export function offerArtifacts(run: RunState, meta: MetaState, luck = 0, n = 3, minRarity = 0) { return draw(run, (r) => pickByRarity(r, artifactPool(meta), (id) => getArtifact(id)?.rarity, luck, run.chapter, n, minRarity)); }
export function offerTablets(run: RunState, meta: MetaState, luck = 0, n = 3) { return draw(run, (r) => pickByRarity(r, tabletPool(meta), (id) => getTablet(id)?.rarity, luck, run.chapter, n)); }
export function offerMiracles(run: RunState, n = 3) { return draw(run, (r) => r.shuffle(miracles.map((m) => m.id).filter((id) => !run.miracles.includes(id))).slice(0, n)); }
export function offerWeaponUpgrades(run: RunState, n = 3) { return draw(run, (r) => offerUpgrades(r, run.weapon, run.upgrades, run.chapter, n).map((u) => u.id)); }
export function makeChoice(run: RunState, meta: MetaState, kind: Choice['kind'], source: string, luck = 0, minRarity = 0): Choice {
  const options = kind === 'artifact' ? offerArtifacts(run, meta, luck, 3, minRarity) : kind === 'tablet' ? offerTablets(run, meta, luck) : kind === 'miracle' ? offerMiracles(run) : offerWeaponUpgrades(run);
  run.choice = { kind, options, source }; return run.choice;
}
/** Dice reroll of the current choice. */
export function rerollChoice(run: RunState, meta: MetaState, luck = 0): boolean {
  if (!run.choice || run.dice < 1) return false;
  run.dice--; const c = run.choice; makeChoice(run, meta, c.kind, c.source, luck); return true;
}
/** Take option i of the current choice. Returns false if the bag is full (item goes nowhere). */
export function takeChoice(run: RunState, meta: MetaState, i: number): boolean {
  const c = run.choice; if (!c || !c.options[i]) return false;
  const id = c.options[i];
  if (c.kind === 'artifact' || c.kind === 'tablet') {
    if (!addItem(run.grid, id)) return false;
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
export function makeShop(run: RunState, meta: MetaState, size: number, discount = 0, luck = 0, barter = 0): RunState['shop'] {
  const arts = offerArtifacts(run, meta, luck, Math.ceil(size / 2));
  const tabs = offerTablets(run, meta, luck, Math.floor(size / 2));
  const pot = draw(run, (r) => r.pick(potions).id);
  const items: ShopItem[] = [
    ...arts.map((id) => ({ id, kind: 'artifact' as const, price: buyPrice(getArtifact(id)!.price, barter, discount), sold: false })),
    ...tabs.map((id) => ({ id, kind: 'tablet' as const, price: buyPrice(getTablet(id)!.price, barter, discount), sold: false })),
    { id: pot, kind: 'potion', price: buyPrice(60, barter, discount), sold: false },
  ];
  run.shop = { items, discount }; return run.shop;
}
export function rerollShop(run: RunState, meta: MetaState, luck = 0, barter = 0): boolean {
  if (!run.shop || run.dice < 1) return false;
  run.dice--; makeShop(run, meta, run.shop.items.length - 1, run.shop.discount, luck, barter); return true;
}
export function buy(run: RunState, meta: MetaState, idx: number): boolean {
  const it = run.shop?.items[idx]; if (!it || it.sold || run.money < it.price) return false;
  if (it.kind === 'potion') { if (!addPotion(run, it.id)) return false; }
  else { if (!addItem(run.grid, it.id)) return false; discover(meta, it.kind === 'artifact' ? 'artifacts' : 'tablets', it.id); }
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
    case 'money': run.money += draw(run, (r) => r.int(60, 110)) * (1 + (run.chapter - 1) * 0.35) | 0; return 'money';
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
      return { ok: true, text: 'fountain_red', fight: 'waves' };
    }
    case 'companion': {
      if (run.money < 500) return { ok: false, text: 'no_money' };
      const comp = artifacts.filter((a) => a.tags.includes('companion') || a.effects.some((e) => e.kind === 'summon'));
      const id = draw(run, (r) => r.pick(comp.length ? comp : artifacts).id);
      if (!addItem(run.grid, id)) return { ok: false, text: 'bag_full' };
      run.money -= 500; discover(meta, 'artifacts', id); return { ok: true, text: `companion:${id}` };
    }
    case 'blood': {
      if (option === 'bat') return { ok: true, text: 'blood_bat', fight: 'bat' };
      const cost = Math.ceil(run.hp * 0.33); if (run.hp - cost < 1) return { ok: false, text: 'no_hp' };
      run.hp -= cost; makeChoice(run, meta, 'artifact', 'blood', luck, 1); return { ok: true, text: 'blood_pay', choice: run.choice! };
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
export function batReward(run: RunState): string | null { const id = draw(run, (r) => r.pick(potions).id); return addPotion(run, id) ? id : null; }
export function cloneRun(run: RunState): RunState { return JSON.parse(JSON.stringify(run)); }
export function serializeRun(run: RunState): RunState { return { ...cloneRun(run), grid: cloneGrid(run.grid) }; }
export function deserializeRun(data: any): RunState | null {
  if (!data || data.version !== RUN_STATE_VERSION || !data.floorData) return null;
  if (data.grid) resizeGrid(data.grid, data.grid.cols, data.grid.rows);
  return data as RunState;
}
export { getUpgrade };
