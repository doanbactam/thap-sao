// V2 headless balance simulator. Plays whole runs through the REAL run model (floors, node maps, rewards, choices,
// shops, events, XP, bosses) with an abstract combat model driven by the power heuristic (src/systems/power.ts), and
// reports the gold curve, build power by floor, combo formation rate and artifact dominance.
// Run: `npm run sim` (vitest, prints the report) — knobs: SIM_RUNS, SIM_POLICY (greedy|random|both), SIM_IMMORTAL=1.
import type { BossDef, WeaponId } from '../data/types';
import { Rng } from './rng';
import { newMeta, type MetaState } from './meta';
import {
  newRun, runStats, enterNode, applyNodeReward, bossDefeated, makeShop, buy, rerollChoice, takeChoice, skipChoice, gainXp,
  drinkPotion, resolveEvent, enchantTimes, enchant, shopHeal, shopHealCost, shopEnchant, enchantCost, rerollShop, shopRerollGold,
  sell, makeChoice, isFightNode, currentChoices, onLethal, batReward, companionPrice, bloodCost, type RunState,
} from './run';
import { planWaves, enemyScale, globalFloor, hardMult, type MapNode } from './floorgen';
import { getEnemy, getBoss, getChapter, getArtifact } from './registry';
import { resolve } from './inventory';
import { runPower, choiceDelta, addBest } from './build';
import { getSpecials, phoenix } from './specials';
import { runBundle } from './run';

/** greedy = planner (power + combo planning, rerolls, enchants); casual = takes the biggest immediate power gain, no
 *  rerolls/banish/enchant service; random = uniform choices. */
export type Policy = 'greedy' | 'casual' | 'random';
export interface SimOpts { runs: number; policy: Policy; seed0?: number; immortal?: boolean; meta?: () => MetaState; weapon?: WeaponId }
/** A mid-progress profile: bag +1 column, side bag, first two artifact shelves (+12 artifacts / +6 tablets), 2 dice. */
export function midMeta(): MetaState {
  const m = newMeta(); m.destinyOwned.push('d_home_repair', 'd_bag_col_1', 'd_side_bag', 'd_artifacts_1', 'd_artifacts_2', 'd_dice_1', 'd_seed_money_1'); return m;
}
/** Combat model knobs: enemy hits per second per living enemy, boss hits per second, player skill spread. */
/** Greedy shopper: buy when the option is worth at least minGain% power and minPer100 % per 100 gold. */
export const BUY = { minGain: 1.5, minPer100: 0.5 };
export const COMBAT = { enemyHitRate: 0.06, bossHitRate: 0.24, skillSd: 0.22, aoe: 1.6 };

export interface RunResult {
  reachedChapter: number; floorsCleared: number; won: boolean; died: boolean;
  goldHeld: number[]; goldEarned: number[]; power: number[]; combos: number[]; // indexed by global floor (1..18), recorded at floor end
  combosAtCh3: number | null; combosEndCh3: number | null; maxTagAtCh3: number | null; tier2AtCh3: boolean | null; tierSumEnd: number;
  spend: { items: number; heal: number; reroll: number; enchant: number; events: number; rerollGold: number };
  offered: Record<string, number>; taken: Record<string, number>; final: string[];
}

function fightRoom(run: RunState, meta: MetaState, rng: Rng, waves: string[][], boss: BossDef | null, res: RunResult, immortal: boolean): boolean {
  const pw = runPower(run, meta); const s = runStats(run, meta);
  const sc = enemyScale(run.chapter, run.floor, run.hard);
  const skill = Math.max(0.45, 1 + rng.range(-1, 1) * COMBAT.skillSd * 1.7);
  let raw = 0, time = 0, money = 0, xp = 0, kills = 0;
  for (const w of waves) {
    let hp = 0, dmg = 0;
    for (const id of w) { const d = getEnemy(id); if (!d) continue; hp += d.hp * sc.hp; dmg += d.damage * sc.dmg; money += rng.int(d.money[0], d.money[1]); xp += d.xp; kills++; }
    const t = hp / (pw.dps * COMBAT.aoe); time += t; raw += t * dmg * COMBAT.enemyHitRate * 0.55;
  }
  if (boss) {
    const hp = boss.hp * hardMult(run.hard); const t = hp / pw.dps; time += t; raw += t * boss.damage * hardMult(run.hard) * COMBAT.bossHitRate;
    xp += boss.mini ? 30 : 60;
  }
  const loss = raw * skill * s.maxHp / Math.max(1, pw.ehp);
  // on-kill money (cursed coin, golden touch)
  for (const t of runBundle(run).onKill) if (t.e.action === 'money') money += t.value * kills;
  run.money += Math.round(money);
  run.kills += kills;
  run.hp -= loss;
  if (run.hp <= 0) return survive(run, meta, res, immortal);
  // drink a heal potion when low between rooms
  if (run.hp < s.maxHp * 0.35) { const i = run.potions.indexOf('heal'); if (i >= 0) drinkPotion(run, meta, i); }
  gainXp(run, meta, xp);
  return true;
}
function survive(run: RunState, meta: MetaState, res: RunResult, immortal: boolean): boolean {
  const s = runStats(run, meta);
  const i = run.potions.indexOf('heal'); if (i >= 0) { run.hp = 1; drinkPotion(run, meta, i); if (run.hp > 1) return true; }
  const ph = phoenix(getSpecials(runBundle(run)), run.phoenixUsed, s.maxHp); if (ph) { run.phoenixUsed = true; run.hp = ph; return true; }
  if (immortal) { run.hp = s.maxHp * 0.5; return true; }
  if (onLethal(run, s.maxHp)) return true;
  res.died = true; run.dead = true; return false;
}

// ---------------- policies ----------------
function chooseNode(run: RunState, meta: MetaState, rng: Rng, opts: number[], policy: Policy): number {
  if (policy === 'random') return rng.pick(opts);
  const s = runStats(run, meta); const hpPct = run.hp / s.maxHp; const arts = run.grid.items.filter((p) => p.kind === 'artifact').length;
  const val = (n: MapNode) => {
    const base: Record<string, number> = { artifact: 6, tablet: arts >= 2 ? 4.5 : 2, enchant: arts >= 1 ? 4 + (n.altarSize ?? 1) : 0.5, shop: run.money > 180 ? 4 : 1.5, levelup: 3, heart: hpPct < 0.5 ? 6 : 2.5, anvil: 3.5, money: 2.5, dice: 2, roots: 7 };
    let v = base[n.type] ?? 1; if (n.modifier === 'miniboss') v += hpPct > 0.6 ? 2 : -3; if (n.event === 'blood' || n.event === 'secret') v += 1;
    return v + rng.next() * 0.5;
  };
  return opts.reduce((a, b) => (val(run.floorData.nodes[b]) > val(run.floorData.nodes[a]) ? b : a));
}
/** Value of an option for the greedy player: power gain plus a planning bonus for growing an existing combo. */
function optionValue(run: RunState, meta: MetaState, kind: 'artifact' | 'tablet' | 'miracle' | 'upgrade', id: string, plan = true): number {
  const d = choiceDelta(run, meta, kind, id);
  if (d.placed === 'none') return -1e9;
  let v = d.power.pct;
  if (plan) for (const c of d.combos) if (c.after > c.before) v += 1.2 * Math.min(4, c.after) + (c.tierAfter > c.tierBefore ? 4 : 0);
  if (d.placed === 'side') v *= 0.2;
  return v;
}
function handleChoice(run: RunState, meta: MetaState, rng: Rng, policy: Policy, res: RunResult) {
  const c = run.choice; if (!c) return;
  if (c.kind === 'artifact') for (const id of c.options) res.offered[id] = (res.offered[id] ?? 0) + 1;
  let pick = 0;
  if (policy === 'random') pick = rng.int(0, c.options.length - 1);
  else {
    const score = () => c.options.map((id) => optionValue(run, meta, run.choice!.kind, id, policy === 'greedy'));
    let vals = score();
    if (policy === 'greedy' && Math.max(...vals) < 3 && run.dice > 0 && (c.kind === 'artifact' || c.kind === 'tablet')) { const keep = vals.indexOf(Math.max(...vals)); run.choice!.locked = keep; rerollChoice(run, meta, runStats(run, meta).luck); vals = score(); res.spend.reroll++; }
    pick = vals.indexOf(Math.max(...vals));
    if (vals[pick] <= -1e8) { makeRoomFor(run, meta, run.choice!.options[pick]); }
  }
  const cc = run.choice!; const id = cc.options[pick];
  if (takeChoice(run, meta, pick, (r, x) => addBest(r, meta, x))) { if (cc.kind === 'artifact') res.taken[id] = (res.taken[id] ?? 0) + 1; }
  else skipChoice(run);
}
/** Bag full: sell the artifact whose removal costs the least power (greedy only). */
function makeRoomFor(run: RunState, meta: MetaState, _id: string) {
  const base = runPower(run, meta).score; let best: { uid: number; loss: number } | null = null;
  for (const p of run.grid.items) { const c = { ...run, grid: { ...run.grid, items: run.grid.items.filter((i) => i.uid !== p.uid) } }; const loss = base - runPower(c, meta).score; if (!best || loss < best.loss) best = { uid: p.uid, loss }; }
  if (best) sell(run, best.uid);
}
function handleShop(run: RunState, meta: MetaState, rng: Rng, policy: Policy, res: RunResult) {
  const shop = run.shop; if (!shop) return;
  const s = runStats(run, meta);
  if (policy === 'random') {
    if (run.hp < s.maxHp * 0.4 && rng.chance(0.5) && shopHeal(run, s.maxHp)) res.spend.heal += shopHealCost(run);
    for (let i = 0; i < shop.items.length; i++) if (!shop.items[i].sold && rng.chance(0.35)) { const p = shop.items[i].price; if (buy(run, meta, i, (r, x) => addBest(r, meta, x))) res.spend.items += p; }
    return;
  }
  // greedy: heal first when low, then best value-per-gold purchases, then enchant, maybe one gold reroll
  if (run.hp < s.maxHp * 0.5) { const c = shopHealCost(run); if (shopHeal(run, s.maxHp)) res.spend.heal += c; }
  for (let pass = 0; pass < 2; pass++) {
    let bought = true;
    while (bought) {
      bought = false; let best: { i: number; v: number } | null = null;
      shop.items.forEach((it, i) => {
        if (it.sold || it.price > run.money) return;
        let v: number;
        if (it.kind === 'potion') v = it.id === 'heal' && !run.potions.includes('heal') ? 6 : 1;
        else v = optionValue(run, meta, it.kind, it.id, policy === 'greedy');
        const per = v / it.price * 100; if (v >= BUY.minGain && per > BUY.minPer100 && (!best || per > best.v)) best = { i, v: per };
      });
      if (best) { const it = shop.items[(best as any).i]; const p = it.price; if (buy(run, meta, (best as any).i, (r, x) => addBest(r, meta, x))) { res.spend.items += p; bought = true; } }
    }
    if (pass === 0) {
      for (let e = 0; e < 2; e++) { const arts = run.grid.items.filter((p) => p.kind === 'artifact'); let bestE: { uid: number; c: number; gain: number } | null = null;
        for (const p of arts) { const c = enchantCost(run, p.uid); if (c === null || c > run.money) continue; const r2 = { ...run, grid: { ...run.grid, items: run.grid.items.map((i) => (i.uid === p.uid ? { ...i, level: i.level + 1 } : i)) } }; const gain = runPower(r2, meta).score - runPower(run, meta).score; if (gain / c * 100 > 1 && (!bestE || gain / c > bestE.gain / bestE.c)) bestE = { uid: p.uid, c, gain }; }
        if (bestE && shopEnchant(run, bestE.uid)) res.spend.enchant += bestE.c; else break; }
      const unsold = shop.items.filter((i) => !i.sold).length;
      if (policy === 'casual') break;
      if (unsold > 0 && run.dice > 0) { if (rerollShop(run, meta, s.luck, s.barter)) res.spend.reroll++; }
      else if (unsold > 0 && run.money > shopRerollGold(run) + 250) { const g = shopRerollGold(run); if (rerollShop(run, meta, s.luck, s.barter, true)) { res.spend.reroll++; res.spend.rerollGold += g; } }
      else break;
    }
  }
}
function handleEvent(run: RunState, meta: MetaState, rng: Rng, n: MapNode, policy: Policy, res: RunResult, immortal: boolean): boolean {
  const ev = n.event!; const s = runStats(run, meta);
  const fountain = (['green', 'gold', 'red'] as const)[n.id % 3];
  let opt = 'go';
  switch (ev) {
    case 'arena': return fightRoom(run, meta, rng, planWaves(rng.int(1, 1e9), run.chapter, run.floor, n.depth, 'none', 'arena').waves, null, res, immortal);
    case 'secret': resolveEvent(run, meta, 'secret', ''); handleChoice(run, meta, rng, policy, res); return true;
    case 'clover': opt = policy === 'random' ? rng.pick(['hp', 'def']) : 'def'; break;
    case 'fountain': opt = fountain; break;
    case 'blood': opt = policy === 'random' ? rng.pick(['pay', 'bat', 'leave']) : run.hp - bloodCost(run, s.maxHp) > s.maxHp * 0.45 ? 'pay' : 'bat'; break;
    case 'companion': if (policy === 'greedy' ? run.money < companionPrice(run) * 1.6 : !rng.chance(0.5)) return true; res.spend.events += companionPrice(run); break;
    case 'obelisk': if (policy === 'greedy' || rng.chance(0.5)) return true; break;
    case 'pocket': return true;
  }
  if (opt === 'leave') return true;
  const r = resolveEvent(run, meta, ev, opt, { luck: s.luck, barter: s.barter, maxHp: s.maxHp });
  if (!r.ok) return true;
  if (r.choice) handleChoice(run, meta, rng, policy, res);
  if (r.shop) handleShop(run, meta, rng, policy, res);
  if (r.fight === 'waves') return fightRoom(run, meta, rng, planWaves(rng.int(1, 1e9), run.chapter, run.floor, 2, 'none', null).waves.slice(0, 2), null, res, immortal);
  if (r.fight === 'bat') { const ok = fightRoom(run, meta, rng, [], { ...(getBoss(getChapter(run.chapter).miniBoss) as BossDef), hp: 60 + run.chapter * 30, damage: 6 + run.chapter * 2, mini: true }, res, immortal); if (ok) batReward(run); return ok; }
  return true;
}

export function simulateRun(seed: number, o: SimOpts): RunResult {
  const meta = o.meta ? o.meta() : newMeta(); const rng = new Rng(seed * 7919 + 13);
  const run = newRun(meta, { seed, weapon: o.weapon });
  const res: RunResult = { reachedChapter: 1, floorsCleared: 0, won: false, died: false, goldHeld: [], goldEarned: [], power: [], combos: [], combosAtCh3: null, combosEndCh3: null, maxTagAtCh3: null, tier2AtCh3: null, tierSumEnd: 0, spend: { items: 0, heal: 0, reroll: 0, enchant: 0, events: 0, rerollGold: 0 }, offered: {}, taken: {}, final: [] };
  let guard = 0;
  while (!run.won && !run.dead && guard++ < 40) {
    const gf = globalFloor(run.chapter, run.floor);
    if (run.floorData.startShop) { makeShop(run, meta, 4, 0, runStats(run, meta).luck, runStats(run, meta).barter); handleShop(run, meta, rng, o.policy, res); run.shop = null; }
    let alive = true;
    for (let d = 0; d < 3 && alive; d++) {
      const ch = currentChoices(run); if (!Array.isArray(ch) || !ch.length) break;
      const target = chooseNode(run, meta, rng, ch, o.policy);
      const n = enterNode(run, target, true) as MapNode;
      if (isFightNode(n)) {
        const plan = planWaves(rng.int(1, 1e9), run.chapter, run.floor, n.depth, n.modifier, n.event);
        const mini = plan.miniBoss ? getBoss(plan.miniBoss) ?? null : null;
        alive = fightRoom(run, meta, rng, plan.waves, mini, res, !!o.immortal); if (!alive) break;
        if (mini) { makeChoice(run, meta, 'artifact', 'miniboss', runStats(run, meta).luck, 1); handleChoice(run, meta, rng, o.policy, res); }
      }
      run.roomCleared = true;
      if (n.event) { alive = handleEvent(run, meta, rng, n, o.policy, res, !!o.immortal); if (!alive) break; }
      const s = runStats(run, meta);
      const r = applyNodeReward(run, meta, n, s.luck, s.barter);
      if (r === 'choice') handleChoice(run, meta, rng, o.policy, res);
      else if (r === 'shop') { handleShop(run, meta, rng, o.policy, res); run.shop = null; }
      else if (r === 'enchant') {
        const times = enchantTimes(n, meta); const arts = run.grid.items.filter((p) => p.kind === 'artifact' && p.level < getArtifact(p.id)!.maxLevel);
        for (let k = 0; k < times && arts.length; k++) {
          const target2 = o.policy === 'random' ? rng.pick(arts) : arts.reduce((a, b) => (getArtifact(b.id)!.price > getArtifact(a.id)!.price ? b : a));
          enchant(run, target2.uid, 1);
        }
      }
    }
    if (!alive) break;
    // gate / boss
    const bossId = run.floorData.bossId; const boss = getBoss(bossId) ?? null; const mini = run.floor !== 3;
    if (!fightRoom(run, meta, rng, [], boss, res, !!o.immortal)) break;
    const out = bossDefeated(run, meta, mini, boss?.reward);
    res.floorsCleared = run.floorsCleared;
    const rr = resolve(run.grid);
    res.goldHeld[gf] = run.money; res.goldEarned[gf] = run.money + res.spend.items + res.spend.heal + res.spend.enchant + res.spend.events + res.spend.rerollGold; res.power[gf] = runPower(run, meta).score; res.combos[gf] = rr.activeCombos.length;
    if (gf === 9) res.combosEndCh3 = rr.activeCombos.length;
    if (mini) { makeChoice(run, meta, 'artifact', 'gate', runStats(run, meta).luck, 1); handleChoice(run, meta, rng, o.policy, res); }
    if (out === 'nextChapter' && run.chapter === 3) { const r3 = resolve(run.grid); res.combosAtCh3 = r3.activeCombos.length; res.maxTagAtCh3 = Math.max(0, ...Object.values(r3.comboCounts)); res.tier2AtCh3 = r3.activeCombos.some((c) => c.tier >= 2); }
    if (out === 'win') { res.won = true; break; }
    run.hp = Math.min(runStats(run, meta).maxHp, run.hp + 0); // no free heal between floors
  }
  res.reachedChapter = run.chapter; res.final = run.grid.items.filter((p) => p.kind === 'artifact').map((p) => p.id);
  res.tierSumEnd = resolve(run.grid).activeCombos.reduce((a, c) => a + c.tier, 0);
  return res;
}

export interface SimReport {
  opts: SimOpts; runs: number; winRate: number; reachCh3: number; comboAtCh3: number; comboAtCh3OfReached: number; comboEndCh3OfReached: number;
  avgChapter: number; goldHeld: number[]; goldEarned: number[]; power: number[]; combos: number[]; reachedFloor: number[];
  tier2AtCh3OfReached: number; maxTagHist: number[];
  spend: RunResult['spend']; topTaken: Array<{ id: string; takeRate: number; offered: number; inFinal: number }>; maxFinalShare: number; topFinal: Array<{ id: string; share: number }>;
}
export function simulate(o: SimOpts): SimReport {
  const N = o.runs; const results: RunResult[] = [];
  for (let i = 0; i < N; i++) results.push(simulateRun((o.seed0 ?? 1000) + i, o));
  const avgAt = (pick: (r: RunResult) => number[] | undefined) => Array.from({ length: 19 }, (_, gf) => { const v = results.map((r) => pick(r)?.[gf]).filter((x): x is number => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; });
  const reached = results.filter((r) => r.combosAtCh3 !== null);
  const offered: Record<string, number> = {}, taken: Record<string, number> = {}, finals: Record<string, number> = {};
  for (const r of results) { for (const [k, v] of Object.entries(r.offered)) offered[k] = (offered[k] ?? 0) + v; for (const [k, v] of Object.entries(r.taken)) taken[k] = (taken[k] ?? 0) + v; for (const id of new Set(r.final)) finals[id] = (finals[id] ?? 0) + 1; }
  const topTaken = Object.keys(offered).map((id) => ({ id, takeRate: (taken[id] ?? 0) / offered[id], offered: offered[id], inFinal: (finals[id] ?? 0) / N })).filter((x) => x.offered >= 10).sort((a, b) => b.takeRate - a.takeRate).slice(0, 8);
  const spend = { items: 0, heal: 0, reroll: 0, enchant: 0, events: 0, rerollGold: 0 };
  for (const r of results) for (const k of Object.keys(spend) as Array<keyof typeof spend>) spend[k] += r.spend[k] / N;
  return {
    opts: o, runs: N, winRate: results.filter((r) => r.won).length / N, reachCh3: reached.length / N,
    comboAtCh3: reached.filter((r) => (r.combosAtCh3 ?? 0) > 0).length / N,
    comboAtCh3OfReached: reached.length ? reached.filter((r) => (r.combosAtCh3 ?? 0) > 0).length / reached.length : 0,
    comboEndCh3OfReached: (() => { const e = results.filter((r) => r.combosEndCh3 !== null); return e.length ? e.filter((r) => (r.combosEndCh3 ?? 0) > 0).length / e.length : 0; })(),
    tier2AtCh3OfReached: reached.length ? reached.filter((r) => r.tier2AtCh3).length / reached.length : 0,
    maxTagHist: Array.from({ length: 8 }, (_, k) => reached.length ? reached.filter((r) => Math.min(7, r.maxTagAtCh3 ?? 0) === k).length / reached.length : 0),
    avgChapter: results.reduce((a, r) => a + r.reachedChapter, 0) / N,
    goldHeld: avgAt((r) => r.goldHeld), goldEarned: avgAt((r) => r.goldEarned), power: avgAt((r) => r.power), combos: avgAt((r) => r.combos),
    reachedFloor: Array.from({ length: 19 }, (_, gf) => results.filter((r) => r.power[gf] !== undefined).length / N),
    spend, topTaken, maxFinalShare: Math.max(0, ...Object.values(finals).map((v) => v / N)),
    topFinal: Object.entries(finals).map(([id, v]) => ({ id, share: v / N })).sort((a, b) => b.share - a.share).slice(0, 8),
  };
}
const f0 = (x: number) => (Number.isFinite(x) ? Math.round(x).toString() : '–');
const pct = (x: number) => `${Math.round(x * 100)}%`;
export function formatReport(r: SimReport): string {
  const L: string[] = [];
  L.push(`## Sim: policy=${r.opts.policy}${r.opts.immortal ? ' (immortal)' : ''}, meta=${r.opts.meta === midMeta ? 'mid-progress' : r.opts.meta ? 'custom' : 'fresh'}, runs=${r.runs}`);
  L.push(`win ${pct(r.winRate)} · reach ch3 ${pct(r.reachCh3)} · avg chapter reached ${r.avgChapter.toFixed(2)}`);
  L.push(`≥1 active combo on reaching ch3: ${pct(r.comboAtCh3OfReached)} of runs that reached it (${pct(r.comboAtCh3)} of all) · at end of ch3: ${pct(r.comboEndCh3OfReached)} · tier≥2 combo on reaching ch3: ${pct(r.tier2AtCh3OfReached)}`);
  L.push(`largest tag count on reaching ch3 (0..7+): ${r.maxTagHist.map(pct).join(' ')}`);
  L.push(`avg spend/run: items ${f0(r.spend.items)} · heal ${f0(r.spend.heal)} · enchant ${f0(r.spend.enchant)} · events ${f0(r.spend.events)} · rerolls ${r.spend.reroll.toFixed(1)}`);
  L.push('| floor | alive | gold held | gold earned (cum.) | power | active combos |'); L.push('|---|---|---|---|---|---|');
  for (let gf = 1; gf <= 18; gf++) L.push(`| ${Math.ceil(gf / 3)}-${((gf - 1) % 3) + 1} | ${pct(r.reachedFloor[gf])} | ${f0(r.goldHeld[gf])} | ${f0(r.goldEarned[gf])} | ${f0(r.power[gf])} | ${Number.isFinite(r.combos[gf]) ? r.combos[gf].toFixed(2) : '–'} |`);
  L.push(`most-taken artifacts (take rate when offered, share of final builds): ${r.topTaken.map((x) => `${x.id} ${pct(x.takeRate)}/${pct(x.inFinal)}`).join(', ')}`);
  L.push(`most common in final builds: ${r.topFinal.map((x) => `${x.id} ${pct(x.share)}`).join(', ')}`);
  return L.join('\n');
}
