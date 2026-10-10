// Versioned localStorage persistence for meta + mid-run saves. Storage is injectable for tests.
import { migrateMeta, newMeta, type MetaState } from './meta';

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
export const META_KEY = 'thapsao.meta', RUN_KEY = 'thapsao.run';
export const RUN_VERSION = 3;
export class MemoryKV implements KV { m = new Map<string, string>(); getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; } setItem(k: string, v: string) { this.m.set(k, v); } removeItem(k: string) { this.m.delete(k); } }
function defaultKV(): KV { try { if (typeof localStorage !== 'undefined') return localStorage; } catch { /* ignore */ } return new MemoryKV(); }

export class SaveStore {
  constructor(public kv: KV = defaultKV()) {}
  loadMeta(): MetaState {
    try { const raw = this.kv.getItem(META_KEY); if (!raw) return newMeta(); const env = JSON.parse(raw); return migrateMeta(env && env.data ? { ...env.data, version: env.v ?? env.data.version } : env); }
    catch { return newMeta(); }
  }
  saveMeta(m: MetaState) { this.kv.setItem(META_KEY, JSON.stringify({ v: m.version, data: m })); }
  saveRun(run: any) { this.kv.setItem(RUN_KEY, JSON.stringify({ v: RUN_VERSION, savedAt: Date.now(), data: run })); }
  loadRun<T = any>(): T | null {
    try { const raw = this.kv.getItem(RUN_KEY); if (!raw) return null; const env = JSON.parse(raw); if (!env || env.v !== RUN_VERSION) return null; return env.data as T; }
    catch { return null; }
  }
  hasRun() { return this.loadRun() !== null; }
  clearRun() { this.kv.removeItem(RUN_KEY); }
}
