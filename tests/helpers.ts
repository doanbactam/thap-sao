import { registerArtifact, registerTablet } from '../src/systems/registry';
import type { ArtifactDef, TabletDef } from '../src/data/types';
export function art(id: string, p: Partial<ArtifactDef> = {}): string {
  registerArtifact({ id, name: id, desc: '', rarity: 'common', maxLevel: 3, shape: [[0, 0]], tags: [], effects: [{ kind: 'stat', stat: 'physical', base: 2, perLevel: 1 }], icon: 'x', price: 100, unlockedByDefault: true, ...p } as ArtifactDef);
  return id;
}
export function tab(id: string, targets: TabletDef['targets'], shape: TabletDef['shape'] = [[0, 0]]): string {
  registerTablet({ id, name: id, desc: '', rarity: 'common', shape, targets, icon: 'x', price: 80, unlockedByDefault: true });
  return id;
}
