import { describe, it, expect } from 'vitest';
import { newAgent, think, shieldBlocks, newBrain, bossThink, phaseFor, ringAngles, BOSS_PATTERNS } from '../src/systems/ai';
import { Rng } from '../src/systems/rng';
import { bosses } from '../src/systems/registry';
import type { AiKind, BossDef } from '../src/data/types';

const run = (ai: AiKind, secs = 6, px = 200, py = 0, params = {}) => { const a = newAgent(ai, 0, 0, 80, 100, params); const r = new Rng(1); const acts: any[] = []; for (let t = 0; t < secs; t += 0.05) { acts.push(...think(a, { x: px, y: py }, 0.05, r)); a.x += a.vx * 0.05; a.y += a.vy * 0.05; } return { a, acts }; };
describe('enemy AI kit (C085, C086)', () => {
  it('chaser approaches', () => { const { a } = run('chaser', 1); expect(a.x).toBeGreaterThan(30); });
  it('charger telegraphs a line then dashes', () => { const { acts } = run('charger', 4, 150); expect(acts.some((x) => x.type === 'telegraphLine')).toBe(true); });
  it('shooter fires aimed', () => { expect(run('shooter').acts.some((x) => x.type === 'shoot' && x.count === 1)).toBe(true); });
  it('spread fires multiple', () => { expect(run('spread').acts.some((x) => x.type === 'shoot' && x.count > 1)).toBe(true); });
  it('ring fires rings', () => { expect(run('ring').acts.some((x) => x.type === 'ring')).toBe(true); });
  it('lobber marks AoE with delay', () => { expect(run('lobber').acts.some((x) => x.type === 'lob' && x.delay > 0)).toBe(true); });
  it('summoner summons', () => { expect(run('summoner', 8).acts.some((x) => x.type === 'summon')).toBe(true); });
  it('shielded blocks front', () => { const { a } = run('shielded', 1.2); expect(shieldBlocks(a, { x: a.x + 100, y: a.y })).toBe(true); expect(shieldBlocks(a, { x: a.x - 100, y: a.y })).toBe(false); });
  it('exploder fuses with telegraph then explodes', () => { const { acts } = run('exploder', 3, 30); expect(acts.some((x) => x.type === 'telegraphCircle')).toBe(true); expect(acts.some((x) => x.type === 'explode')).toBe(true); });
  it('teleporter telegraphs destination and teleports', () => { const { acts } = run('teleporter', 6); expect(acts.some((x) => x.type === 'telegraphCircle')).toBe(true); expect(acts.some((x) => x.type === 'teleport')).toBe(true); });
  it('turret stays still and shoots', () => { const { a, acts } = run('turret'); expect(a.x).toBe(0); expect(acts.some((x) => x.type === 'shoot' || x.type === 'ring')).toBe(true); });
  it('healer heals', () => { expect(run('healer').acts.some((x) => x.type === 'heal')).toBe(true); });
  it('content param aliases (fireRate / bulletCount)', () => { const { acts } = run('shooter', 6, 200, 0, { fireRate: 0.5, bulletCount: 3 }); expect(acts.filter((x) => x.type === 'shoot').length).toBeGreaterThanOrEqual(3); expect(acts.find((x) => x.type === 'shoot').count).toBe(3); });
});

const testBoss = (pattern: string, params: Record<string, number> = {}): BossDef => ({ id: 'tb', name: 'b', title: '', chapter: 1, mini: false, sprite: 'x', hp: 100, damage: 5, speed: 50, radius: 40, reward: { sapphire: 1, money: 1 }, phases: [{ hpBelow: 1, attacks: [{ id: 'a', pattern, params, weight: 1 }] }] });
const sim = (def: BossDef, secs = 6, hp = 1) => { const b = newBrain(); const me = newAgent('chaser', 300, 300, 50, 100); const r = new Rng(2); const acts: any[] = []; for (let t = 0; t < secs; t += 0.05) acts.push(...bossThink(b, def, hp, me, { x: 500, y: 300 }, { w: 960, h: 600 }, 0.05, r)); return acts; };
describe('boss patterns (C087, C088)', () => {
  it('phases at thresholds', () => { const d = bosses.find((x) => !x.mini && x.phases.length >= 3)!; expect(phaseFor(d, 1)).toBe(0); expect(phaseFor(d, d.phases[1].hpBelow - 0.01)).toBe(1); expect(phaseFor(d, 0.05)).toBe(d.phases.length - 1); });
  it('phase change emits phase action', () => { const d = bosses.find((x) => !x.mini)!; expect(sim(d, 0.2, 0.1).some((a) => a.type === 'phase')).toBe(true); });
  it('ring', () => { expect(sim(testBoss('ring', { count: 12 })).some((a) => a.type === 'ring' && a.count === 12)).toBe(true); });
  it('spiral rotates', () => { const r = sim(testBoss('spiral', { arms: 3, rate: 10, duration: 1 })).filter((a) => a.type === 'ring'); expect(r.length).toBeGreaterThan(5); expect(r[1].offset).not.toBe(r[0].offset); });
  it('cross waves', () => { expect(sim(testBoss('crossWave', { arms: 4, waves: 2 })).filter((a) => a.type === 'shoot').length).toBeGreaterThanOrEqual(8); });
  it('charge telegraphs then charges', () => { const a = sim(testBoss('charge', { telegraph: 0.5, count: 2 })); expect(a.some((x) => x.type === 'telegraphLine')).toBe(true); expect(a.filter((x) => x.type === 'charge').length).toBeGreaterThanOrEqual(2); });
  it('summon', () => { expect(sim(testBoss('summon', { count: 2 })).some((a) => a.type === 'summon')).toBe(true); });
  it('hazards / rain markers', () => { expect(sim(testBoss('rainMarkers', { count: 4 })).filter((a) => a.type === 'hazard').length).toBeGreaterThanOrEqual(4); });
  it('slam, minefield, laser, shield, teleportStrike, aimedBurst', () => {
    expect(sim(testBoss('slam')).some((a) => a.type === 'slam')).toBe(true);
    expect(sim(testBoss('minefield', { count: 5 })).filter((a) => a.type === 'mine').length).toBeGreaterThanOrEqual(5);
    expect(sim(testBoss('laserSweep')).some((a) => a.type === 'laser')).toBe(true);
    expect(sim(testBoss('shieldPhase')).some((a) => a.type === 'shield')).toBe(true);
    expect(sim(testBoss('teleportStrike', { count: 2 })).filter((a) => a.type === 'teleport').length).toBeGreaterThanOrEqual(2);
    expect(sim(testBoss('aimedBurst', { count: 5, spreadDeg: 40 })).some((a) => a.type === 'shoot' && a.count === 5)).toBe(true);
  });
  it('every pattern used by content is supported', () => { for (const b of bosses) for (const ph of b.phases) for (const at of ph.attacks) expect(BOSS_PATTERNS).toContain(at.pattern); });
  it('ring angles', () => { expect(ringAngles(4).length).toBe(4); expect(ringAngles(4)[1]).toBeCloseTo(Math.PI / 2); });
});
