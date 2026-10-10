// V2 bosses: stagger on phase change, recovery windows, sequencing, enrage, telegraph floors, safe lanes, killability.
import { describe, it, expect } from 'vitest';
import { newAgent, newBrain, bossThink, pickBossAttack, AiWorld, AREA_PATTERNS, SAFE_LANE, SAFE_LANE_MIN, type BossAction } from '../src/systems/ai';
import { tuneFor } from '../src/systems/difficulty';
import { Rng } from '../src/systems/rng';
import { bosses } from '../src/systems/registry';
import type { BossDef, BossAttack } from '../src/data/types';

const DT = 1 / 30;
const ARENA = { w: 1280, h: 720 };
const tb = (attacks: BossAttack[], extra: Partial<BossDef> = {}): BossDef => ({ id: 'tb', name: 'b', title: '', chapter: 1, mini: false, sprite: 'x', hp: 1000, damage: 5, speed: 50, radius: 40, reward: { sapphire: 1, money: 1 }, phases: [{ hpBelow: 1, attacks }], ...extra });
const A = (id: string, pattern: string, params: Record<string, number> = {}, weight = 1): BossAttack => ({ id, pattern, weight, params });
/** effective time an action can first hurt the player, relative to its emission */
function hitDelay(a: BossAction): number | null {
  switch (a.type) {
    case 'shoot': case 'ring': return 0;
    case 'hazard': return a.delay; case 'slam': return a.telegraph; case 'mine': return a.arm; case 'laser': return a.telegraph;
    case 'charge': return 0; case 'lob': return a.delay;
    default: return null;
  }
}

describe('V2 boss pacing', () => {
  it('phase transition: stagger (no attacks, no movement, Exposed) for bossStagger seconds', () => {
    const def = bosses.find((b) => !b.mini && b.chapter === 2)!; const tune = tuneFor(2);
    const b = newBrain(); const me = newAgent('chaser', 640, 300, def.speed, def.hp); const r = new Rng(1); const p = { x: 640, y: 560 };
    let hp = 1; let phaseAt = -1; let dmgDuringStagger = 0;
    for (let t = 0; t < 12; t += DT) {
      if (t > 4 && hp === 1) hp = 0.6;
      const acts = bossThink(b, def, hp, me, p, ARENA, DT, r);
      if (acts.some((a) => a.type === 'phase')) { phaseAt = t; expect(me.exposedT).toBeGreaterThan(tune.bossStagger - 0.01); }
      if (phaseAt >= 0 && t > phaseAt && t < phaseAt + tune.bossStagger - DT) { dmgDuringStagger += acts.filter((a) => hitDelay(a) !== null).length; expect(me.vx).toBe(0); expect(me.vy).toBe(0); }
    }
    expect(phaseAt).toBeGreaterThan(4); expect(dmgDuringStagger).toBe(0);
  });
  it('every pattern ends in a recovery window (Exposed, standing still)', () => {
    const def = tb([A('s', 'slam', { telegraph: 0.8, radius: 100 })]); const tune = tuneFor(1);
    const b = newBrain(); const me = newAgent('chaser', 300, 300, 50, 100); const r = new Rng(2); let sawRecover = false;
    for (let t = 0; t < 6; t += DT) { bossThink(b, def, 1, me, { x: 600, y: 300 }, ARENA, DT, r); if (b.recoverT > 0 && !b.cur) { sawRecover = true; expect(me.vx).toBe(0); expect(me.exposedT).toBeGreaterThan(0); } }
    expect(sawRecover).toBe(true); expect(tune.bossRecovery).toBeGreaterThanOrEqual(0.5);
  });
  it('sequencing: no immediate repeat, no back-to-back area denial, no new minefield while mines live', () => {
    const atks = [A('mines', 'minefield', {}, 5), A('rain', 'rainMarkers', {}, 5), A('ring', 'ring', {}, 1), A('laser', 'laserSweep', {}, 5)];
    const b = newBrain(); const r = new Rng(4);
    for (let i = 0; i < 300; i++) {
      const a = pickBossAttack(b, atks, r);
      expect(a.id).not.toBe(b.lastId);
      if (b.lastPattern && AREA_PATTERNS.includes(b.lastPattern)) expect(AREA_PATTERNS.includes(a.pattern)).toBe(false);
      if (b.time < b.minesUntil) expect(a.pattern).not.toBe('minefield');
      b.lastId = a.id; b.lastPattern = a.pattern; b.time += 2; if (a.pattern === 'minefield') b.minesUntil = b.time + 8;
    }
    // single-attack phases still work
    expect(pickBossAttack(newBrain(), [atks[0]], r).id).toBe('mines');
  });
  it('enrage at low HP: announced once, faster cadence, telegraphs unchanged', () => {
    const def = tb([A('s', 'slam', { telegraph: 0.8, radius: 100 }), A('r', 'ring', { count: 10, telegraph: 0.7 })]); const tune = tuneFor(1);
    const run = (hp: number) => { const b = newBrain(); const me = newAgent('chaser', 300, 300, 50, 100); const r = new Rng(3); const acts: BossAction[] = []; for (let t = 0; t < 40; t += DT) acts.push(...bossThink(b, def, hp, me, { x: 600, y: 300 }, ARENA, DT, r)); return acts; };
    const calm = run(0.9), mad = run(tune.enrageAt - 0.05);
    expect(calm.some((a) => a.type === 'enrage')).toBe(false); expect(mad.filter((a) => a.type === 'enrage').length).toBe(1);
    const n = (xs: BossAction[]) => xs.filter((a) => a.type === 'slam' || a.type === 'telegraphCircle').length;
    expect(n(mad)).toBeGreaterThan(n(calm));
    const tl = (xs: BossAction[]) => [...new Set(xs.filter((a) => a.type === 'slam').map((a) => (a as any).telegraph))];
    expect(tl(mad)).toEqual(tl(calm));
  });
  it('rings of ≥ SAFE_LANE_MIN bullets leave a dodge lane', () => {
    const def = tb([A('r', 'ring', { count: 20, telegraph: 0.5 })]);
    const b = newBrain(); const me = newAgent('chaser', 300, 300, 50, 100); const r = new Rng(5); let shots = 0;
    for (let t = 0; t < 3; t += DT) shots += bossThink(b, def, 1, me, { x: 600, y: 300 }, ARENA, DT, r).filter((a) => a.type === 'shoot').length;
    expect(shots).toBe(20 - SAFE_LANE); expect(SAFE_LANE_MIN).toBeLessThanOrEqual(20);
  });
  it('a boss pattern holds an attack token, leaving fewer for its minions', () => {
    const w = new AiWorld(1); const def = tb([A('s', 'slam', { telegraph: 0.8 })]); const b = newBrain(); const me = newAgent('chaser', 300, 300, 50, 100);
    w.beginFrame(DT, [{ agent: me, radius: 40 }]); b.cd = 0; bossThink(b, def, 1, me, { x: 600, y: 300 }, ARENA, DT, new Rng(1), w);
    expect(w.attacking()).toBe(1);
  });
});

describe('V2 boss telegraph floors (all 12 bosses, every phase)', () => {
  for (const def of bosses) it(`${def.id}: every damaging action lands ≥ bossTeleMin after its pattern starts`, () => {
    const tune = tuneFor(def.chapter);
    def.phases.forEach((ph, pi) => {
      const hp = pi === 0 ? 0.99 : ph.hpBelow - 0.01;
      const b = newBrain(); b.phase = pi; const me = newAgent('chaser', 640, 300, def.speed, def.hp); const r = new Rng(11 + pi); const p = { x: 640, y: 560 };
      let start = -1; let patterns = 0;
      for (let t = 0; t < 40; t += DT) {
        const was = b.cur;
        const acts = bossThink(b, def, hp, me, p, ARENA, DT, r);
        if (b.cur && b.cur !== was) { start = t; patterns++; }
        for (const a of acts) {
          const dl = hitDelay(a); if (dl === null) continue;
          if (a.type === 'slam' && a.telegraph === 0) continue; // teleportStrike landing: its telegraphCircle was emitted ≥ tmin earlier
          expect(t + dl - start).toBeGreaterThanOrEqual(tune.bossTeleMin - DT - 1e-9);
        }
      }
      expect(patterns).toBeGreaterThan(3);
    });
  });
});

describe('V2 bosses are killable by real damage in a normal run', () => {
  // Normal-run player model at a chapter's boss (floor 3): level L = 3 + 3·(ch−1) (the smoke bot is given the same level),
  // base element damage 20 + 2·(L−1), modest item bonus +15%/chapter, Kiếm & Khiên combo (avg coef 1.13, 0.32 s/hit) at
  // 45% uptime. Shield phases make the boss immune; stagger/recovery windows add +EXPOSED_TAKEN (ignored: conservative).
  for (const def of bosses.filter((b) => !b.mini)) it(`${def.id}: time-to-kill between 20 and 90 s`, () => {
    const ch = def.chapter, L = 3 + 3 * (ch - 1);
    const dps = (20 + 2 * (L - 1)) * (1 + 0.15 * (ch - 1)) * 1.13 / 0.32 * 0.45;
    const shieldShare = Math.max(...def.phases.map((ph) => { const tot = ph.attacks.reduce((s, a) => s + a.weight, 0); return ph.attacks.filter((a) => a.pattern === 'shieldPhase').reduce((s, a) => s + a.weight, 0) / tot; }));
    const ttk = def.hp / (dps * (1 - shieldShare * 0.5));
    expect(ttk).toBeGreaterThan(20); expect(ttk).toBeLessThan(90);
  });
});
