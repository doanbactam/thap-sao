// window.__TS debug API (dev builds and ?debug=1). Used by tools/smoke.mjs.
import Phaser from 'phaser';
import { G } from './state';
import { SIM, type SimInput } from './input';
import { BUTTONS } from '../ui/kit';
import { addItem, place, resolve } from '../systems/inventory';
import { newRun, setChapter as setCh, enterNode, runStats } from '../systems/run';
import { getArtifact, getTablet, getUpgrade, sources, artifacts, tablets, destiny } from '../systems/registry';
import { placeholders, MANIFEST, loadedChapter } from './assets';
import { sfxLog } from './audio';
import type { RunScene } from '../scenes/RunScene';

export function installDebug(game: Phaser.Game) {
  const sm = () => game.scene;
  const runScene = () => { const s = sm().getScene('Run') as RunScene; return s && sm().isActive('Run') || (s && sm().isPaused('Run')) ? s : null; };
  const restartRun = () => { const keys = ['Inventory', 'Choice', 'Shop', 'Enchant', 'Map', 'Pause', 'Event', 'Picker']; for (const k of keys) if (sm().isActive(k) || sm().isPaused(k)) sm().stop(k); const rs = sm().getScene('Run'); if (sm().isActive('Run') || sm().isPaused('Run')) rs.scene.restart({ mode: G.training ? 'training' : 'run' }); else { sm().stop('Hub'); sm().start('Run', { mode: 'run' }); } };
  const canvas = () => game.canvas;
  const api = {
    G, sources,
    scenes: () => sm().getScenes(true).map((s) => s.scene.key),
    getState() {
      const rs = runScene(); const r = G.run;
      return {
        scenes: api.scenes(), sapphires: G.meta.sapphires, meta: { destiny: G.meta.destinyOwned.length, weapon: G.meta.weapon, trained: G.meta.trained, costume: G.meta.costume, stats: G.meta.stats, hardModeUnlocked: G.meta.hardModeUnlocked, journal: Object.fromEntries(Object.entries(G.meta.journal).map(([k, v]) => [k, v.length])), mute: G.meta.settings.mute },
        run: r ? { chapter: r.chapter, floor: r.floor, pos: r.pos, cleared: r.roomCleared, hp: r.hp, mp: r.mp, money: r.money, dice: r.dice, level: r.level, weapon: r.weapon, upgrades: r.upgrades, items: (() => { const rs0 = resolve(r.grid); return r.grid.items.map((i) => ({ uid: i.uid, id: i.id, x: i.x, y: i.y, rot: i.rot, kind: i.kind, level: rs0.arts.get(i.uid)?.level, active: rs0.arts.get(i.uid)?.active })); })(), side: r.grid.side.filter(Boolean).length, grid: [r.grid.cols, r.grid.rows], combos: resolve(r.grid).activeCombos, miracles: r.miracles, potions: r.potions, choice: r.choice, shop: r.shop, bosses: r.bossesKilled, minis: r.minisKilled, won: r.won, dead: r.dead, node: typeof r.pos === 'number' ? r.floorData.nodes[r.pos] : null, nodes: r.floorData.nodes.map((n) => ({ id: n.id, type: n.type, mod: n.modifier, ev: n.event, next: n.next, depth: n.depth })), startShop: r.floorData.startShop, gate: r.floorData.gate, bossId: r.floorData.bossId } : null,
        room: rs && rs.stats ? { px: rs.px, py: rs.py, fighting: rs.fighting, waves: rs.waves.length, waveIdx: rs.waveIdx, enemies: rs.enemies.filter((e) => !e.dead).map((e) => ({ id: e.id, x: Math.round(e.agent.x), y: Math.round(e.agent.y), hp: Math.round(e.hp), maxHp: e.maxHp, boss: !!e.boss, dummy: !!e.dummy })), boss: rs.bossRef && !rs.bossRef.dead ? { id: rs.bossRef.id, hp: rs.bossRef.hp, maxHp: rs.bossRef.maxHp, phase: rs.bossRef.brain?.phase } : null, interacts: rs.interacts.filter((i) => !i.used).map((i) => ({ id: i.id, x: i.x, y: i.y })), doors: rs.doors.map((d) => ({ x: d.x, y: d.y, target: d.target })), dashes: rs.dashes, stats: { maxHp: rs.stats.maxHp, physical: rs.stats.physical, defense: rs.stats.defense }, dmgDealt: rs.dmgDealtLog, projectiles: rs.projs.length, layout: rs.layout ? { template: rs.layout.template, kind: rs.layout.kind, trim: rs.layout.trim, obstacles: rs.layout.obstacles.length, hash: Array.from(rs.layout.grid).join('') } : null, hazards: rs.hazards.length, mode: rs.mode, weapon: { ammo: rs.ws.ammo, fury: rs.ws.fury, furyT: rs.ws.furyT } } : null,
        placeholders: [...placeholders], fps: Math.round(game.loop.actualFps), manifestKeys: Object.keys(MANIFEST).length, loadedChapter: loadedChapter.ch, textures: game.textures.getTextureKeys().length, sfx: sfxLog.slice(-20),
      };
    },
    godMode(b = true) { G.god = b; return b; },
    giveArtifact(id: string) { if (!G.run || !getArtifact(id)) return null; const p = addItem(G.run.grid, id); runScene()?.refreshLoadout(false); return p; },
    giveTablet(id: string) { if (!G.run || !getTablet(id)) return null; const p = addItem(G.run.grid, id); runScene()?.refreshLoadout(false); return p; },
    placeItem(id: string, x: number, y: number, rot = 0) { if (!G.run) return null; const p = place(G.run.grid, id, x, y, rot); runScene()?.refreshLoadout(false); return p; },
    clearBag() { if (G.run) { G.run.grid.items = []; runScene()?.refreshLoadout(false); } },
    setWeapon(id: any) { if (!G.run) { G.meta.weapon = id; return; } G.run.weapon = id; G.run.upgrades = []; const rs = runScene(); if (rs) rs.refreshLoadout(true); return id; },
    addUpgrade(id: string) { if (!G.run || !getUpgrade(id)) return false; G.run.upgrades.push(id); runScene()?.refreshLoadout(false); return true; },
    gotoNode(i: number | 'gate' | 'start') { if (!G.run) return false; if (i === 'start') { G.run.pos = 'start'; G.run.roomCleared = true; } else enterNode(G.run, i, true); restartRun(); return true; },
    clearRoom() { const rs = runScene(); if (!rs) return false; rs.debugClear(); return true; },
    killBoss() { const rs = runScene(); return rs ? rs.debugKillBoss() : false; },
    startRun(seed?: number) { G.clearRun(); G.run = newRun(G.meta, { seed, weapon: G.meta.weapon, hard: G.meta.hardMode }); G.training = false; for (const k of ['Hub', 'Results', 'Ending']) sm().stop(k); restartRun(); return G.run.seed; },
    setChapter(c: number, f: number) { if (!G.run) return false; setCh(G.run, c, f); restartRun(); return true; },
    addCurrency(kind: string, n: number) { if (kind === 'sapphire') { G.meta.sapphires += n; G.saveMeta(); } else if (G.run) { if (kind === 'money') G.run.money += n; if (kind === 'dice') G.run.dice += n; } return true; },
    heal() { if (G.run) { G.run.hp = runStats(G.run, G.meta).maxHp; G.run.mp = 999; } },
    simulateInput(spec: Partial<SimInput>, ms = 300) { SIM.cur = { ...spec, until: performance.now() + ms } as SimInput; if (spec.press) SIM.queue.push(...spec.press); return true; },
    press(...acts: any[]) { SIM.queue.push(...acts); },
    log(type?: string) { return type ? G.log.filter((l) => l.type === type) : G.log; },
    clearLog() { G.log.length = 0; },
    /** visible buttons with page coordinates (for real mouse clicks) */
    buttons() {
      const r = canvas().getBoundingClientRect(); const sx = r.width / 1280, sy = r.height / 720; const out: any[] = [];
      for (const b of BUTTONS) { if (!b.active || !b.visible || !b.scene || !b.scene.sys.isActive()) continue; const m = b.getWorldTransformMatrix(); out.push({ id: b.btnId, label: b.label?.text, enabled: b.enabled, scene: b.scene.scene.key, x: r.left + m.tx * sx, y: r.top + m.ty * sy }); }
      return out;
    },
    /** v2 rooms (smoke bot): heading toward (tx,ty) around obstacles — straight when a hero-wide line is walkable, else
     *  the BFS flow-field step of the room nav. */
    navStep(tx: number, ty: number) { const rs = runScene(); if (!rs) return null; const nav = rs.nav; if (!nav || nav.clear(rs.px, rs.py, tx, ty, 14)) return { straight: true, a: Math.atan2(ty - rs.py, tx - rs.px) }; const a = nav.flowDir(rs.px, rs.py, tx, ty); return { straight: a === null, a: a ?? Math.atan2(ty - rs.py, tx - rs.px) }; },
    toPage(x: number, y: number) { const r = canvas().getBoundingClientRect(); return { x: r.left + x * r.width / 1280, y: r.top + y * r.height / 720 }; },
    destinyNodes: () => destiny.map((d) => ({ id: d.id, key: d.grant.key, value: d.grant.value, cost: d.cost, requires: d.requires, pos: d.pos })),
    grantNode(key: string) { const d = destiny.find((x) => x.grant.key === key); if (d && !G.meta.destinyOwned.includes(d.id)) G.meta.destinyOwned.push(d.id); return d?.id; },
    artifactIds: () => artifacts.map((a) => a.id), tabletIds: () => tablets.map((a) => a.id),
  };
  (window as any).__TS = api;
  return api;
}
