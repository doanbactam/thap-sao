import { describe, it, expect } from 'vitest';
import { newStatus, applyStatus, tickStatus, isDisabled, takenMult, woundBonus, chainTargets, FREEZE_AT } from '../src/systems/status';

describe('status effects (C012-C017)', () => {
  it('burn stacks and lasts 3s', () => {
    const s = newStatus(); applyStatus(s, 'burn', 1, 4); applyStatus(s, 'burn', 1, 4);
    expect(s.burn.stacks).toBe(2);
    expect(tickStatus(s, 1)).toBeCloseTo(8);
    tickStatus(s, 2.1); expect(s.burn.stacks).toBe(0);
  });
  it('frostbite freezes at 5 stacks for 1.5s', () => {
    const s = newStatus(); let ev: string[] = [];
    for (let i = 0; i < FREEZE_AT; i++) ev = applyStatus(s, 'frostbite');
    expect(ev).toContain('freeze'); expect(isDisabled(s)).toBe(true);
    tickStatus(s, 1.6); expect(isDisabled(s)).toBe(false);
  });
  it('shock +15% taken and chains', () => {
    const s = newStatus(); expect(applyStatus(s, 'shock')).toContain('chain'); expect(takenMult(s)).toBeCloseTo(0.15);
    const o = { x: 0, y: 0 }; const c = [o, { x: 10, y: 0 }, { x: 50, y: 0 }, { x: 90, y: 0 }, { x: 120, y: 0 }, { x: 999, y: 0 }];
    expect(chainTargets(o, c, 3).length).toBe(3);
  });
  it('poison dot', () => { const s = newStatus(); applyStatus(s, 'poison', 2, 5); expect(tickStatus(s, 1)).toBeGreaterThan(0); });
  it('wound adds bleed on hit', () => { const s = newStatus(); applyStatus(s, 'wound', 2); expect(woundBonus(s, 100)).toBe(12); });
  it('stun disables', () => { const s = newStatus(); applyStatus(s, 'stun', 1, 0, 1); expect(isDisabled(s)).toBe(true); tickStatus(s, 1.1); expect(isDisabled(s)).toBe(false); });
});
