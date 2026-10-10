// V2 enemy AI: telegraphs, recovery/punish windows, attack tokens, roles, separation (docs/V2_AI.md).
import { describe, it, expect } from 'vitest';
import { AiWorld, newAgent, contactMult, shieldBlocks, roleOf, type Agent, type AiAction } from '../src/systems/ai';
import { CHAPTER_TUNE, tuneFor, windupFor, MIN_WINDUP, EXPOSED_TAKEN } from '../src/systems/difficulty';
import { newStatus, expose, takenMult, tickStatus } from '../src/systems/status';
import { Rng } from '../src/systems/rng';
import { enemies } from '../src/systems/registry';
import type { AiKind } from '../src/data/types';

const DT = 1 / 30;
const DAMAGING = ['shoot', 'ring', 'explode', 'lob'];
const TELEGRAPH = ['telegraphLine', 'telegraphCircle', 'lob'];
type P = { x: number; y: number };
/** simulate a set of agents in one world; returns per-tick log */
function sim(w: AiWorld, agents: Agent[], p: P, secs: number, rng = new Rng(7), onTick?: (t: number, acts: Map<Agent, AiAction[]>) => void) {
  for (let t = 0; t < secs; t += DT) {
    w.beginFrame(DT, agents.map((a) => ({ agent: a, radius: a.radius })));
    const m = new Map<Agent, AiAction[]>();
    for (const a of agents) {
      const acts = w.think(a, p, DT, rng); m.set(a, acts);
      for (const x of acts) if (x.type === 'teleport') { a.x = x.x; a.y = x.y; }
      a.x += a.vx * DT; a.y += a.vy * DT;
    }
    onTick?.(t, m);
  }
}

describe('V2 telegraphs + recovery (every enemy, every chapter)', () => {
  for (const def of enemies) {
    it(`${def.id}: telegraphed ≥ chapter windup, then punishable recovery`, () => {
      const tune = tuneFor(def.chapter);
      const w = new AiWorld(def.chapter, false);
      const a = newAgent(def.ai, 400, 400, def.speed, def.hp, { ...(def.params ?? {}) }); a.radius = def.radius; a.cd = 0.2;
      const p = { x: 400 + Math.min(60, (def.params?.triggerRange ?? 44) - 6), y: 400 };
      let windStart = -1, teleSeen = false, attacks = 0, recovers = 0, prevState = a.state, maxExposed = 0;
      sim(w, [a], p, 12, new Rng(3), (t, m) => {
        const acts = m.get(a)!;
        if (acts.some((x) => TELEGRAPH.includes(x.type))) teleSeen = true;
        if ((a.state === 'windup' || a.state === 'blink') && prevState !== a.state && prevState !== 'blink') windStart = t;
        if (a.state === 'blink') windStart = -1; // teleporter: the aim windup after emerging is what counts
        if (prevState === 'blink' && a.state === 'windup') windStart = t;
        for (const x of acts) {
          if (x.type === 'lob') { expect(x.delay).toBeGreaterThanOrEqual(tune.windupMin - 1e-9); attacks++; }
          else if (DAMAGING.includes(x.type)) { expect(windStart).toBeGreaterThanOrEqual(0); expect(t - windStart).toBeGreaterThanOrEqual(tune.windupMin - DT - 1e-9); attacks++; }
        }
        if (a.state === 'active' && prevState === 'windup' && ['chaser', 'charger', 'shielded'].includes(a.ai)) { expect(t - windStart).toBeGreaterThanOrEqual(tune.windupMin - DT - 1e-9); attacks++; }
        if (a.state === 'recover' && prevState !== 'recover') recovers++;
        if (a.state === 'recover') { expect(a.vx).toBe(0); expect(a.vy).toBe(0); maxExposed = Math.max(maxExposed, a.exposedT); }
        prevState = a.state;
      });
      if (def.ai === 'summoner' || def.ai === 'healer') { expect(teleSeen).toBe(true); return; }
      expect(teleSeen).toBe(true);
      expect(attacks).toBeGreaterThan(0);
      if (def.ai !== 'exploder') { expect(recovers).toBeGreaterThan(0); expect(maxExposed).toBeGreaterThan(0.2); }
    });
  }
  it('windups never drop below MIN_WINDUP (any chapter, hard mode included)', () => {
    for (let ch = 1; ch <= 6; ch++) for (const hard of [false, true]) for (const tele of [0, 0.2, 0.35, 0.6, 1]) expect(windupFor(tuneFor(ch, hard), tele)).toBeGreaterThanOrEqual(MIN_WINDUP);
    for (let ch = 2; ch <= 6; ch++) expect(CHAPTER_TUNE[ch - 1].windupMin).toBeLessThanOrEqual(CHAPTER_TUNE[ch - 2].windupMin);
  });
  it('Exposed adds EXPOSED_TAKEN to damage taken and expires', () => {
    const s = newStatus(); expose(s, 0.5); expect(takenMult(s)).toBeCloseTo(EXPOSED_TAKEN); tickStatus(s, 0.6); expect(takenMult(s)).toBe(0);
  });
  it('contact damage only during active melee frames; boss only while charging', () => {
    const a = newAgent('chaser', 0, 0, 80, 50); expect(contactMult(a, false, false)).toBe(0);
    a.state = 'active'; expect(contactMult(a, false, false)).toBe(1);
    const r = newAgent('shooter', 0, 0, 80, 50); r.state = 'active'; expect(contactMult(r, false, false)).toBe(0);
    expect(contactMult(newAgent('chaser', 0, 0, 1, 1), true, false)).toBe(0); expect(contactMult(newAgent('chaser', 0, 0, 1, 1), true, true)).toBeCloseTo(1.4);
  });
  it('shield is lowered during recovery (punish from the front)', () => {
    const a = newAgent('shielded', 0, 0, 50, 80); a.shieldAngle = 0; expect(shieldBlocks(a, { x: 100, y: 0 })).toBe(true);
    a.state = 'recover'; expect(shieldBlocks(a, { x: 100, y: 0 })).toBe(false);
  });
  it('stun/freeze during windup cancels the attack and frees the token', () => {
    const w = new AiWorld(1); const a = newAgent('shooter', 0, 0, 50, 50); a.cd = 0; const p = { x: 200, y: 0 };
    w.beginFrame(DT, [{ agent: a, radius: 14 }]); w.think(a, p, DT, new Rng(1)); expect(a.state).toBe('windup'); expect(w.attacking()).toBe(1);
    const acts = w.think(a, p, 2, new Rng(1), true); expect(acts.length).toBe(0); expect(a.state).toBe('idle'); expect(w.attacking()).toBe(0);
  });
});

describe('V2 attack tokens', () => {
  for (const ch of [1, 3, 6]) it(`chapter ${ch}: never more than ${CHAPTER_TUNE[ch - 1].tokens} attackers, starts spaced by attackGap`, () => {
    const tune = tuneFor(ch); const w = new AiWorld(ch);
    const p = { x: 600, y: 400 };
    const ags = Array.from({ length: 9 }, (_, i) => { const kind: AiKind = (['chaser', 'shooter', 'charger'] as AiKind[])[i % 3]; const a = newAgent(kind, 600 + Math.cos(i) * 150, 400 + Math.sin(i) * 150, 80, 50); a.radius = 14; a.cd = 0; return a; });
    let maxAtk = 0, starts: number[] = []; let prevHolders = 0;
    sim(w, ags, p, 15, new Rng(9), (t) => {
      const n = ags.filter((a) => a.state === 'windup' || a.state === 'active' || a.state === 'blink').length;
      maxAtk = Math.max(maxAtk, n);
      if (w.attacking() > prevHolders) starts.push(t); prevHolders = w.attacking();
    });
    expect(maxAtk).toBeLessThanOrEqual(tune.tokens);
    expect(maxAtk).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(tune.attackGap - DT - 1e-9);
    expect(starts.length).toBeGreaterThan(8);
  });
  it('a dead agent releases its token (beginFrame prunes)', () => {
    const w = new AiWorld(1); const a = newAgent('shooter', 0, 0, 50, 50); a.cd = 0;
    w.beginFrame(DT, [{ agent: a, radius: 14 }]); w.think(a, { x: 200, y: 0 }, DT, new Rng(1)); expect(w.attacking()).toBe(1);
    w.beginFrame(DT, []); expect(w.attacking()).toBe(0); expect(a.token).toBe(false);
  });
});

describe('V2 roles, separation', () => {
  it('role mapping', () => {
    expect(roleOf('chaser')).toBe('rusher'); expect(roleOf('charger')).toBe('rusher'); expect(roleOf('exploder')).toBe('rusher');
    expect(roleOf('shielded')).toBe('tank'); expect(roleOf('shooter')).toBe('ranged'); expect(roleOf('lobber')).toBe('ranged');
    expect(roleOf('healer')).toBe('support'); expect(roleOf('turret')).toBe('static');
  });
  it('enemies spawned on one point separate (no stacking)', () => {
    const w = new AiWorld(1); const p = { x: 900, y: 400 };
    const ags = Array.from({ length: 6 }, () => { const a = newAgent('shooter', 400, 400, 70, 50); a.radius = 14; a.cd = 99; return a; });
    sim(w, ags, p, 3);
    let minD = 1e9; for (let i = 0; i < ags.length; i++) for (let j = i + 1; j < ags.length; j++) minD = Math.min(minD, Math.hypot(ags[i].x - ags[j].x, ags[i].y - ags[j].y));
    expect(minD).toBeGreaterThan(20);
  });
  it('rushers waiting for a token flank/surround instead of queueing on one side', () => {
    const w = new AiWorld(1); const p = { x: 640, y: 420 };
    const ags = Array.from({ length: 4 }, (_, i) => { const a = newAgent('chaser', 300, 380 + i * 30, 90, 50); a.radius = 14; a.cd = 99; return a; });
    sim(w, ags, p, 5);
    const angs = ags.map((a) => Math.atan2(a.y - p.y, a.x - p.x)).sort((x, y) => x - y);
    let minGap = 1e9; for (let i = 1; i < angs.length; i++) minGap = Math.min(minGap, angs[i] - angs[i - 1]);
    expect(minGap).toBeGreaterThan(0.6); // spread at least ~35° apart around the player
    for (const a of ags) { const d = Math.hypot(a.x - p.x, a.y - p.y); expect(d).toBeGreaterThan(70); expect(d).toBeLessThan(200); }
  });
  it('ranged keep their distance band and keep moving (reposition)', () => {
    const w = new AiWorld(2); const p = { x: 640, y: 420 };
    const a = newAgent('shooter', 680, 420, 60, 40, { keepDistance: 220 }); a.radius = 14; a.cd = 99;
    let path = 0, lx = a.x, ly = a.y;
    sim(w, [a], p, 6, new Rng(5), () => { path += Math.hypot(a.x - lx, a.y - ly); lx = a.x; ly = a.y; });
    const d = Math.hypot(a.x - p.x, a.y - p.y); expect(d).toBeGreaterThan(150); expect(d).toBeLessThan(290); expect(path).toBeGreaterThan(200);
  });
  it('tank body-blocks between the player and its backline', () => {
    const w = new AiWorld(2); const p = { x: 900, y: 400 };
    const back = newAgent('shooter', 400, 400, 0, 40); back.radius = 14; back.cd = 99; // pinned archer
    const tank = newAgent('shielded', 500, 600, 60, 90); tank.radius = 16; tank.cd = 99;
    sim(w, [back, tank], p, 6);
    expect(tank.x).toBeGreaterThan(back.x + 40); expect(tank.x).toBeLessThan(p.x - 60); expect(Math.abs(tank.y - 400)).toBeLessThan(60);
  });
});
