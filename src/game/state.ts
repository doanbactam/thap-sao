// Global game state shared by scenes: meta save, current run, save store, event log.
import { SaveStore } from '../systems/save';
import type { MetaState } from '../systems/meta';
import type { RunState } from '../systems/run';
import { serializeRun, deserializeRun } from '../systems/run';

export interface LogEntry { t: number; type: string; data?: any }
class GameState {
  store = new SaveStore();
  meta: MetaState = this.store.loadMeta();
  run: RunState | null = null;
  log: LogEntry[] = [];
  god = false;
  training = false;
  debug = false;
  logEvent(type: string, data?: any) { this.log.push({ t: Math.round(performance.now()), type, data }); if (this.log.length > 3000) this.log.splice(0, 1000); }
  saveMeta() { this.store.saveMeta(this.meta); }
  saveRun() { if (this.run && !this.training && !this.run.dead && !this.run.won) { this.store.saveRun(serializeRun(this.run)); this.logEvent('runSaved', { chapter: this.run.chapter, floor: this.run.floor, pos: this.run.pos }); } }
  loadRun(): RunState | null { return deserializeRun(this.store.loadRun()); }
  clearRun() { this.store.clearRun(); }
}
export const G = new GameState();
