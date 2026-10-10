import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { simulate, formatReport, simulateRun, midMeta } from '../src/systems/sim';

describe('balance simulator (V2)', () => {
  it('plays deterministic runs through the run model', () => {
    const a = simulateRun(42, { runs: 1, policy: 'greedy' }); const b = simulateRun(42, { runs: 1, policy: 'greedy' });
    expect(a.floorsCleared).toBe(b.floorsCleared); expect(a.final).toEqual(b.final);
    expect(a.floorsCleared).toBeGreaterThan(0);
  });
  it('combos form, build depth needs intent, power grows, nothing is auto-picked (smoke-sized sample)', () => {
    const r = simulate({ runs: 30, policy: 'casual', seed0: 500, immortal: true, meta: midMeta });
    expect(r.comboAtCh3OfReached).toBeGreaterThanOrEqual(0.6);           // ≥1 active combo on reaching ch3
    expect(r.tier2AtCh3OfReached).toBeGreaterThanOrEqual(0.45);          // tier-2 (4 tags) target band 60–75%, loose for n=30
    expect(r.tier2AtCh3OfReached).toBeLessThanOrEqual(0.95);
    expect(r.power[9]).toBeGreaterThan(r.power[1] * 2);
    for (const t of r.topTaken) expect(t.takeRate, t.id).toBeLessThan(0.85); // no artifact taken almost every time it is offered
  }, 120000);
  it.runIf(!!process.env.SIM_REPORT)('full report', () => {
    const N = Number(process.env.SIM_RUNS ?? 200); const pol = process.env.SIM_POLICY ?? 'both';
    const out: string[] = [];
    for (const policy of (pol === 'both' ? ['greedy', 'casual', 'random'] : [pol]) as Array<'greedy' | 'casual' | 'random'>) {
      const meta = process.env.SIM_META === 'fresh' ? undefined : midMeta;
      out.push(formatReport(simulate({ runs: N, policy, seed0: 1000, meta })));
      if (process.env.SIM_IMMORTAL) out.push(formatReport(simulate({ runs: N, policy, seed0: 1000, immortal: true })));
    }
    const txt = out.join('\n\n'); console.log(txt); writeFileSync(process.env.SIM_OUT ?? 'work/sim_report.md', txt + '\n');
  }, 600000);
});
