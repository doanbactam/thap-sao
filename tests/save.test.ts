import { describe, it, expect } from 'vitest';
import { SaveStore, MemoryKV, META_KEY, RUN_KEY } from '../src/systems/save';
import { newMeta } from '../src/systems/meta';
import { newRun, serializeRun, deserializeRun } from '../src/systems/run';

describe('save (C083, C099)', () => {
  it('meta roundtrip versioned', () => { const s = new SaveStore(new MemoryKV()); const m = newMeta(); m.sapphires = 42; s.saveMeta(m); expect(s.loadMeta().sapphires).toBe(42); expect(JSON.parse(s.kv.getItem(META_KEY)!).v).toBe(2); });
  it('corrupt meta → defaults', () => { const kv = new MemoryKV(); kv.setItem(META_KEY, '{bad'); expect(new SaveStore(kv).loadMeta().sapphires).toBe(0); });
  it('legacy unversioned meta migrates', () => { const kv = new MemoryKV(); kv.setItem(META_KEY, JSON.stringify({ sapphires: 3 })); expect(new SaveStore(kv).loadMeta().sapphires).toBe(3); });
  it('run roundtrip & continue', () => {
    const s = new SaveStore(new MemoryKV()); const r = newRun(newMeta(), { seed: 9 }); r.money = 123;
    s.saveRun(serializeRun(r)); const back = deserializeRun(s.loadRun())!; expect(back.money).toBe(123); expect(back.floorData.nodes.length).toBe(9);
    s.clearRun(); expect(s.hasRun()).toBe(false);
  });
  it('wrong run version rejected', () => { const kv = new MemoryKV(); kv.setItem(RUN_KEY, JSON.stringify({ v: 1, data: {} })); expect(new SaveStore(kv).loadRun()).toBeNull(); });
});
