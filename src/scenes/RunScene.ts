// Room combat scene: player, weapons, enemies, bosses, projectiles, hazards, rewards, doors, events, training.
import Phaser from 'phaser';
import { G } from '../game/state';
import { Controls, SIM } from '../game/input';
import { tex, applyEntry, playAnim, PAL, entry, iconRef, RARITY_COLOR, face, ensureChapter, chapterKeys, MANIFEST, bakeTiles } from '../game/assets';
import { sfx } from '../game/audio';
import { txt, toast } from '../ui/kit';
import { t } from '../systems/i18n';
import { Rng } from '../systems/rng';
import type { Stats } from '../systems/stats';
import { moveSpeedPx, dashRechargeTime, regenMp, tickDash, DASH_TIME, DASH_DIST } from '../systems/stats';
import { computeDamage, spellDamage, incomingDamage, lifestealHeal } from '../systems/damage';
import { newStatus, applyStatus, tickStatus, isDisabled, expose, takenMult, woundBonus, chainTargets, type StatusState } from '../systems/status';
import { fireOnHit, fireOnKill, fireOnDash, fireOnHurt, tickPeriodic, quickSpells, castSpell, type Bundle, type Ctx, type SpellSlot } from '../systems/effects';
import { getSpecials, hitMultiplier, chainCount, isBehind, splitManaShield, doomMark, phoenix, spellCritChance, spellEchoes, companionSlots, companionMods, guardCounterDamage, galeDashDamage, procDamage, type Specials } from '../systems/specials';
import { buildWeapon, newWeaponState, tickWeapon, tryAttack, addFury, trySpecial, iaidoRelease, guardBlock, manualReload, chargedFor, PERFECT_GUARD, type WeaponConfig, type WeaponState } from '../systems/weapons';
import { SHAKE as CFX_SHAKE } from '../systems/combat';
import { newCombat, tickReal, timeScale, takeDash, onDash, onHurt, moveMul, beginMove, guardOpen, guardClose, consumeBonus, type CombatState, type Pending } from '../systems/combat';
import * as CFX from '../systems/combatFx';
import * as SKF from '../systems/skillFx'; // v2 skills polish (src/systems/skills.ts, docs/V2_SKILLS.md)
import { newCasts, CAST_MOVE_MUL, type CastState } from '../systems/skills';
import { newAgent, shieldBlocks, newBrain, bossThink, contactMult, AiWorld, type Agent, type BossBrain, type AiAction, type BossAction } from '../systems/ai';
import { eliteMods, SPLIT_HP, type Affix } from '../systems/director'; // v2 AI: encounter director + elites
import { planWaves, enemyScale, choicesFrom, type MapNode } from '../systems/floorgen';
import { buildRoom, roomKindFor, blockRects, resolveCircle, shotBlocked, safeSpawn, nearestFree as roomFree, walkable as roomWalkable, RoomNav, COLS as RCOLS, CellK, type RoomLayout } from '../systems/roomgen'; // v2 rooms (docs/V2_ROOMS.md)
import { runStats, runBundle, gainXp, enterNode, applyNodeReward, bossDefeated, endRun, drinkPotion, onLethal, tickBuffs, makeShop, resolveEvent, batReward, enchantTimes, makeChoice, type RunState } from '../systems/run';
import { getEnemy, getBoss, getChapter, getPotion, enemies as ENEMIES } from '../systems/registry';
import { discover, completeTraining } from '../systems/meta';
import type { BossDef, EnemyDef, Element, StatusId } from '../data/types';
import { openOverlay } from './Overlay';
import { DOOR_X } from '../ui/layout'; // v2 map: door slot per map column
import { HeroRig, playDash, playHurt, playCast, playAttack } from '../game/heroAnim';
import { syncEnemyPose, enemyPoseClear } from '../game/enemyAnim'; // v2 anim (docs/V2_ANIM.md)
import { fxAt as poolFx, floatText as poolText, acquireImage, releaseImage, EnemyBar } from '../game/fxPool'; // v2 perf pools (docs/V2_PERF.md)

export const ROOM = { x0: 62, x1: 1234, y0: 154, y1: 664, w: 1280, h: 720 };
const ELEMENT_STATUS: Record<Element, StatusId | null> = { physical: null, fire: 'burn', ice: 'frostbite', lightning: 'shock' };
const FAMILY_ELEMENT: Record<string, Element> = { glacier: 'ice', ember: 'fire', storm: 'lightning' };

interface Enemy {
  id: string; def: EnemyDef | null; boss: BossDef | null; agent: Agent; brain: BossBrain | null; sprite: Phaser.GameObjects.Sprite; key: string;
  hp: number; maxHp: number; dmg: number; radius: number; status: StatusState; kvx: number; kvy: number; flash: number; contactCd: number;
  armor: number; explodeOnDeath: boolean; dead: boolean; dummy?: boolean; bat?: boolean; minion?: boolean; chargeT: number; chargeA: number; chargeSpd: number;
  bar?: EnemyBar; hits: number; mark?: Phaser.GameObjects.Image; facing: number; decoy?: boolean;
  elite?: Affix; eliteG?: Phaser.GameObjects.Graphics; eliteLabel?: Phaser.GameObjects.Text;
}
interface Proj { x: number; y: number; vx: number; vy: number; r: number; dmg: number; from: 'player' | 'enemy'; sprite: Phaser.GameObjects.Image; life: number; pierce: number; hit: Set<Enemy>; homing: number; element: Element; status?: StatusId; coef?: number; spell?: boolean; explode?: number; magicShare?: number; crit?: boolean; hs?: number; shk?: number; shownCrit?: boolean }
interface Hazard { x: number; y: number; r: number; t: number; delay: number; dmg: number; g: Phaser.GameObjects.Graphics; kind: 'circle' | 'line' | 'laser' | 'mine' | 'trail' | 'tornado'; angle?: number; len?: number; width?: number; sweep?: number; dur?: number; beams?: number; life?: number; armed?: boolean; fromPlayer?: boolean; done?: boolean; tick?: number; status?: StatusId; follow?: Enemy; art?: Phaser.GameObjects.Sprite }
interface Pickup { x: number; y: number; kind: 'money' | 'xp'; value: number; sprite: Phaser.GameObjects.Image; t: number }
interface Interact { x: number; y: number; r: number; sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; use: () => void; used: boolean; auto?: boolean; id: string; hp?: number }
interface Door { x: number; y: number; target: number | 'gate' | 'exit' | 'hub'; sprite: Phaser.GameObjects.Image; icons: Phaser.GameObjects.Image[] }
interface Companion { key: string; sprite: Phaser.GameObjects.Sprite; dmg: number; cd: number; x: number; y: number; kind: string }

export interface RunData { mode?: 'run' | 'training'; weapon?: string; run?: RunState }

export class RunScene extends Phaser.Scene {
  constructor() { super('Run'); }
  run!: RunState; mode: 'run' | 'training' = 'run'; rng = new Rng(1);
  ctl!: Controls; stats!: Stats; bundle!: Bundle; sp: Specials = {}; ctx: Ctx = { hpPct: 1, mpPct: 1, dashLeft: 2, bossRoom: false };
  wcfg!: WeaponConfig; ws!: WeaponState; spells: SpellSlot[] = []; spellCd = [0, 0];
  // player
  px = 640; py = 560; pvx = 0; pvy = 0; facing = -Math.PI / 2; hero!: Phaser.GameObjects.Sprite; heroKey = 'hero_bong'; wpn!: Phaser.GameObjects.Image; shadow!: Phaser.GameObjects.Ellipse;
  rig: HeroRig | null = null; // v2 hero animation rig (src/game/heroAnim.ts)
  casts: CastState = newCasts(); // v2 skills: cooldowns, cast buffer, wind-up
  cs: CombatState = newCombat(); strikeCtx: CFX.StrikeCtx | null = null; // v2 combat feel (src/systems/combat.ts)
  dashes = 2; dashTimer = 0; dashT = 0; dashA = 0; iframes = 0; hurtT = 0; sinceSpend = 99; shield = 0; shieldT = 0; afterDash = 0; dashHit = new Set<Enemy>();
  specialHold = 0; spinT = 0; spinTick = 0; lastAttackHeld = false; lastSpecialHeld = false; lastGuardHeld = false; doomCounter = 0; novaCd = 0; secondWindUsed = false; companionShareCd = 0;
  // world
  enemies: Enemy[] = []; projs: Proj[] = []; hazards: Hazard[] = []; pickups: Pickup[] = []; interacts: Interact[] = []; doors: Door[] = []; comps: Companion[] = [];
  node: MapNode | null = null; isGate = false; waves: string[][] = []; waveIdx = 0; fighting = false; derange: string[] = []; miniBoss: string | undefined; pendingMiniDrop = false;
  waveElites: Array<Array<Affix | null>> = []; aiw: AiWorld | null = null; // v2 AI (src/systems/ai.ts, director.ts)
  periodicTimers: Record<string, number> = {}; statsT = 0; hitStop = 0; bossRef: Enemy | null = null; dmgDealtLog = 0; time0 = 0; trainingHits = 0;
  ready = false; blocks: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  layout: RoomLayout | null = null; nav: RoomNav | null = null; // v2 rooms: obstacles (src/systems/roomgen.ts)
  layer!: Phaser.GameObjects.Layer; fxLayer!: Phaser.GameObjects.Layer; banner: Phaser.GameObjects.Text | null = null; bossDmgTime = 0; trainingDone = false;

  passedRun: RunState | null = null;
  init(d: RunData) {
    this.passedRun = d?.run ?? null;
    this.ready = false; this.blocks = []; this.layout = null; this.nav = null; (this as any).hero = undefined; (this as any).wpn = undefined; this.rig = null; this.bossRef = null;
    this.mode = d?.mode ?? 'run';
    this.enemies = []; this.projs = []; this.hazards = []; this.pickups = []; this.interacts = []; this.doors = []; this.comps = [];
    this.aiw = null; this.waveElites = [];
    this.waveIdx = 0; this.fighting = false; this.bossRef = null; this.hitStop = 0; this.cs = newCombat(); this.casts = newCasts(); this.strikeCtx = null; this.trainingHits = 0; this.trainingDone = false; this.pendingMiniDrop = false;
    this.periodicTimers = {}; this.secondWindUsed = false; this.shield = 0; this.iframes = 0; this.dashT = 0; this.spinT = 0; this.specialHold = 0;
  }
  create() {
    if (this.passedRun) { G.run = this.passedRun; G.training = this.mode === 'training'; this.passedRun = null; }
    if (!G.run) { this.scene.start('Hub'); return; }
    this.run = G.run!;
    const ch = getChapter(this.run.chapter);
    const en = ch.enemies.map((id) => getEnemy(id)?.sprite ?? `en_${id}`);
    const bs = [ch.miniBoss, ch.boss].map((id) => getBoss(id)?.sprite ?? id);
    const loading = txt(this, 640, 360, 'Đang tải…', 30).setOrigin(0.5);
    ensureChapter(this, this.mode === 'training' ? (this.run.chapter) : this.run.chapter, chapterKeys(this.run.chapter, en, bs), () => { loading.destroy(); this.build(); });
  }
  build() {
    this.rng = new Rng((this.run.rngState ^ (this.run.visited.length * 7919) ^ (typeof this.run.pos === 'number' ? this.run.pos * 131 : 77)) >>> 0);
    this.ctl = new Controls(this);
    this.layer = this.add.layer(); this.fxLayer = this.add.layer(); this.fxLayer.setDepth(3000);
    this.refreshLoadout(true);
    this.drawRoom();
    this.spawnHero();
    this.setupRoom();
    this.scene.launch('Hud'); this.scene.bringToTop('Hud');
    this.events.on('resume', () => { this.ctl.clearPressed(); this.refreshLoadout(false); });
    this.events.once('shutdown', () => { this.ctl.destroy(); });
    this.cameras.main.resetFX(); this.cameras.main.fadeIn(250, 0, 0, 0);
    this.ready = true;
    G.logEvent('roomEnter', { pos: this.run.pos, chapter: this.run.chapter, floor: this.run.floor, mode: this.mode, node: this.node?.type, event: this.node?.event, modifier: this.node?.modifier });
  }

  // ---------------- loadout / stats ----------------
  refreshLoadout(fresh: boolean) {
    this.bundle = runBundle(this.run); this.sp = getSpecials(this.bundle);
    this.wcfg = buildWeapon(this.run.weapon, this.run.upgrades);
    if (fresh || !this.ws) { this.ws = newWeaponState(this.wcfg); if (this.casts) this.casts.slots.special.cd = 0; }
    else { this.ws.ammo = Math.min(this.ws.ammo, this.wcfg.magazine); }
    this.spells = quickSpells(this.bundle);
    this.recalcStats();
    if (fresh) this.dashes = this.stats.dashCount;
    if (this.hero) this.spawnCompanions();
    if (this.rig) this.rig.setWeapon(this.wcfg.def.sprite, this.wcfg.id); else if (this.wpn) this.wpn.setTexture(tex(this, this.wcfg.def.sprite, 'weapon').tex);
  }
  recalcStats() {
    const s0 = this.stats;
    this.ctx = { hpPct: s0 ? this.run.hp / s0.maxHp : 1, mpPct: s0 ? this.run.mp / Math.max(1, s0.maxMp) : 1, dashLeft: this.dashes, bossRoom: this.isGate && this.run.floor === 3 };
    this.stats = runStats(this.run, G.meta, this.ctx, this.bundle);
    this.run.hp = Math.min(this.run.hp, this.stats.maxHp); this.run.mp = Math.min(this.run.mp, this.stats.maxMp);
  }

  // ---------------- room construction ----------------
  drawRoom() {
    const ch = getChapter(this.run.chapter); const ts = this.mode === 'training' ? 'ts_hub' : (MANIFEST[ch.tileset] ? ch.tileset : `ts_ch${this.run.chapter}`);
    const T = tex(this, ts, 'tile').tex; const r = new Rng(this.run.chapter * 1000 + (typeof this.run.pos === 'number' ? this.run.pos : 99) + this.run.floor * 37);
    // (no full-screen bg fill: the baked tile layer covers the whole 1280×720 view)
    const cells: Array<[number, number, number]> = [];
    const put = (col: number, row: number, f: number) => { cells.push([col, row, f]); };
    for (let row = 0; row < 15; row++) for (let col = 0; col < 27; col++) {
      const east = col === 26, west = col === 0;
      if (row === 0) put(col, row, west ? 17 : east ? 18 : 16);
      else if (row === 1) put(col, row, west ? 17 : east ? 18 : 22);
      else if (row === 2) put(col, row, west ? 17 : east ? 18 : 23);
      else if (row === 14) put(col, row, west ? 20 : east ? 21 : 19);
      else if (west) put(col, row, 17); else if (east) put(col, row, 18);
      else { put(col, row, r.int(0, 7)); if (r.chance(0.1)) put(col, row, 8 + r.int(0, 7)); }
    }
    // v2 rooms: obstacle layout (rocks / pillars / bushes / low walls block movement + shots, liquid blocks movement)
    if (this.mode === 'run') {
      const pos = this.run.pos; const node = typeof pos === 'number' ? this.run.floorData.nodes[pos] : null;
      const seed = (this.run.floorData.seed ^ Math.imul(typeof pos === 'number' ? pos + 1 : pos === 'start' ? 97 : 98, 0x9e3779b1)) >>> 0;
      const L = buildRoom({ kind: roomKindFor(pos, node), chapter: this.run.chapter, seed, miniBoss: node?.modifier === 'miniboss', event: node?.event ?? null });
      this.layout = L; this.nav = new RoomNav(L);
      const k = (c: number, rr: number) => L.grid[rr * RCOLS + c];
      for (let row = 3; row <= 13; row++) for (let col = 1; col <= 25; col++) {
        const v = k(col, row);
        if (v === CellK.Liquid) put(col, row, k(col, row - 1) !== CellK.Liquid ? 26 : k(col, row + 1) !== CellK.Liquid ? 27 : 24 + ((col + row) % 2));
        else if (v === CellK.Wall) put(col, row, 22 + ((col + row) % 2));
        else if (v === CellK.Edge) put(col, row, k(col + 1, row) !== CellK.Edge ? 17 : k(col - 1, row) !== CellK.Edge ? 18 : 16);
      }
      this.blocks = blockRects(L, { x: 12, top: 6, bottom: 4 }); // hero feet vs obstacle cells
    }
    this.layer.add(bakeTiles(this, T, cells, 1296, 720, 0));
    // decorative props (no collision), kept away from the centre/doors
    const props = Object.keys(MANIFEST).filter((k) => k.startsWith(`prop_ch${this.run.chapter}_`) && !k.endsWith('breakable'));
    const spots: Array<[number, number]> = [[120, 250], [1160, 310], [140, 560], [1140, 600], [330, 640], [930, 650], [260, 200], [790, 215], [100, 410], [1185, 450]]; // kept clear of doors and the mini-map panel
    if (this.layout) for (const o of this.layout.obstacles) { // colliding props (one per obstacle cell)
      if (!o.key || !MANIFEST[o.key]) continue;
      const x = o.c * 48 + 24 + r.int(-3, 3), y = o.r * 48 + 46;
      const sh = this.add.ellipse(x, y - 4, 46, 16, 0x281808, 0.22).setDepth(1); this.layer.add(sh);
      const im = this.add.image(x, y, tex(this, o.key, 'prop').tex); applyEntry(im, o.key, 64, [0.5, 1]);
      const w = im.width || 100; im.setScale(Math.min(0.5, (o.kind === 'pillar' ? 54 : 60) / w)); if (r.chance(0.5)) im.setFlipX(true);
      im.setDepth(y); this.layer.add(im);
    }
    else if (this.mode !== 'training' && props.length) for (const [x, y] of spots) { if (r.chance(0.25) || this.blocked(x, y) || this.blocked(x, y - 30)) continue; const k = r.pick(props); const im = this.add.image(x + r.int(-20, 20), y + r.int(-10, 10), tex(this, k, 'prop').tex); applyEntry(im, k, 64, [0.5, 1]); im.setDepth(im.y); this.layer.add(im); }
    if (this.mode === 'training') for (const [k, x, y] of [['hub_tree_a', 120, 300], ['hub_tree_b', 1160, 320], ['prop_fence', 400, 640], ['prop_fence', 880, 640], ['hub_flowers', 300, 250], ['hub_mushrooms', 990, 230]] as Array<[string, number, number]>) { const im = this.add.image(x, y, tex(this, k, 'prop').tex); applyEntry(im, k, 64, [0.5, 1]); im.setDepth(y); this.layer.add(im); }
  }
  spawnHero() {
    const ck = this.costumeSprite(this.run.costume);
    this.heroKey = ck;
    tex(this, ck, 'char');
    this.shadow = this.add.ellipse(this.px, this.py, 30, 10, 0x281808, 0.35);
    this.hero = this.add.sprite(this.px, this.py, ck); applyEntry(this.hero, ck, 46, [0.5, 0.92]); playAnim(this.hero, ck, 'idle');
    this.rig = new HeroRig(this, this.hero, ck, this.wcfg.def.sprite, this.wcfg.id); this.wpn = this.rig.wpn; // weapon on a hand pivot
    this.spawnCompanions();
  }
  costumeSprite(id: string) { return require_costume(id) ?? 'hero_bong'; }
  setupRoom() {
    const run = this.run; const pos = run.pos;
    if (this.mode === 'training') { this.setupTraining(); return; }
    if (pos === 'start') {
      this.px = 640; this.py = 600;
      if (run.floorData.startShop) {
        this.addInteract('shop_stall', 480, 360, 70, t('shop.title'), () => { if (!run.shop) makeShop(run, G.meta, 4, 0, this.stats.luck, this.stats.barter); this.openShop(); });
        this.spawnDummy(820, 360);
      }
      this.banner = txt(this, 640, 236, `${t('chapter')} ${run.chapter} · ${getChapter(run.chapter).name} — ${t('floor')} ${run.floor}`, 30).setOrigin(0.5).setDepth(4000);
      this.tweens.add({ targets: this.banner, alpha: 0, delay: 1800, duration: 800 });
      run.roomCleared = true; this.openDoors();
      return;
    }
    if (pos === 'gate') { this.isGate = true; this.px = 640; this.py = 620; this.recalcStats(); this.startBoss(); return; }
    const n = run.floorData.nodes[pos]; this.node = n; this.px = 640; this.py = 640;
    if (run.roomCleared) { this.spawnReward(); this.openDoors(); return; }
    if (n.type === 'shop' || n.type === 'roots') { run.roomCleared = true; this.spawnReward(); this.openDoors(); return; }
    const seed = (run.floorData.seed + n.id * 977) >>> 0;
    const plan = planWaves(seed, run.chapter, run.floor, n.depth, n.modifier, n.event, run.hard);
    this.waves = plan.waves; this.waveElites = plan.elites ?? []; this.derange = plan.derangement ?? []; this.miniBoss = plan.miniBoss; this.pendingMiniDrop = !!plan.miniBoss;
    if (n.event === 'arena') toast(this, t('ev.arena'), '#ffcb6b', 260);
    if (n.event === 'secret') this.spawnSecretWall();
    if (n.modifier === 'derangement') toast(this, t('mod.derangement'), '#ff7a66', 300);
    this.fighting = true; this.lockDoors();
    this.time.delayedCall(500, () => this.spawnWave());
  }
  setupTraining() {
    this.px = 640; this.py = 560; this.run.roomCleared = true;
    this.spawnDummy(640, 330);
    this.addInteract('shop_stall', 360, 420, 70, t('training.spawn'), () => openOverlay(this, 'Picker', { onClose: () => this.refreshLoadout(false) }), false, 'picker');
    this.addDoor(640, ROOM.y0 - 40, 'hub', 'node_start');
    this.banner = txt(this, 640, 230, t('training.hint'), 24).setOrigin(0.5).setDepth(4000);
  }
  spawnDummy(x: number, y: number) {
    const e = this.makeEnemy('training_dummy', x, y, null, null, 999999, 0, 0, 22); e.dummy = true; return e;
  }

  // ---------------- doors ----------------
  lockDoors() { this.run.roomCleared = false; this.drawDoors(false); }
  openDoors() { this.drawDoors(true); }
  drawDoors(open: boolean) {
    for (const d of this.doors) { d.sprite.destroy(); d.icons.forEach((i) => i.destroy()); } this.doors = [];
    const ch = choicesFrom(this.run.floorData, this.run.pos === 'gate' ? 'start' : this.run.pos as any);
    if (this.run.pos === 'gate') return;
    if (ch === 'gate') { this.addDoor(640, ROOM.y0 - 40, 'gate', this.run.floor === 3 ? 'node_boss' : 'node_boss', open, true); return; }
    // v2 map: each door sits in its map column's slot (left lane = left door), matching the mini-map (docs/V2_MAP.md)
    ch.forEach((id) => { const n = this.run.floorData.nodes[id]; this.addDoor(DOOR_X[n.col] ?? 640, ROOM.y0 - 40, id, `node_${n.type}`, open, false, n.modifier !== 'none' ? `mod_${n.modifier}` : undefined); });
  }
  addDoor(x: number, y: number, target: Door['target'], icon: string, open = true, boss = false, mod?: string) {
    const k = boss ? 'door_boss' : open ? 'door_open' : 'door_closed';
    const s = this.add.image(x, 148, tex(this, k, 'prop').tex); applyEntry(s, k, 96, [0.5, 1]); s.setDepth(10);
    if (!open) s.setTint(0x9a8a7a);
    const icons: Phaser.GameObjects.Image[] = [];
    const disc = this.add.circle(x, 96, 24, PAL.cream, 0.95).setStrokeStyle(3, PAL.outline).setDepth(11); icons.push(disc as any);
    const ir = iconRef(this, icon); icons.push(this.add.image(x, 96, ir.tex, ir.frame).setDisplaySize(40, 40).setDepth(12));
    if (mod) { const mr = iconRef(this, mod); icons.push(this.add.image(x + 26, 126, mr.tex, mr.frame).setDisplaySize(30, 30).setDepth(12)); }
    this.doors.push({ x, y: 148, target, sprite: s, icons });
  }
  useDoor(d: Door) {
    if (!this.run.roomCleared) return;
    sfx('door');
    if (d.target === 'hub') { this.leaveTraining(); return; }
    if (d.target === 'exit') { this.transition(() => {}); return; }
    const r = enterNode(this.run, d.target as any);
    if (!r) return;
    G.logEvent('enterNode', { target: d.target });
    this.transition(() => { G.saveRun(); });
  }
  transition(before: () => void) {
    this.fighting = false; this.ctl.clearPressed();
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => { before(); this.scene.restart({ mode: this.mode }); });
  }
  leaveTraining() { G.run = null; G.training = false; this.scene.stop('Hud'); this.scene.start('Hub'); }

  // ---------------- interactables / rewards ----------------
  addInteract(key: string, x: number, y: number, r: number, label: string, use: () => void, auto = false, id = key): Interact {
    const s = this.add.sprite(x, y, tex(this, key, 'prop').tex); applyEntry(s, key, 72, [0.5, 0.85]); s.setDepth(y); playAnim(s, key, 'idle');
    const l = txt(this, x, y - (s.displayHeight || 60) - 8, label, 16).setOrigin(0.5).setDepth(4000);
    const it: Interact = { x, y, r, sprite: s, label: l, use, used: false, auto, id };
    this.interacts.push(it); return it;
  }
  consumeInteract(it: Interact) { it.used = true; this.tweens.add({ targets: [it.sprite, it.label], alpha: 0, duration: 300, onComplete: () => { it.sprite.destroy(); it.label.destroy(); } }); }
  spawnReward() {
    const n = this.node; if (!n) return;
    const run = this.run; const s = this.stats;
    const claimed = (run as any).claimed ?? ((run as any).claimed = {} as Record<string, boolean>);
    const key = `${run.chapter}-${run.floor}-${n.id}-${run.visited.length}`;
    if (this.pendingMiniDrop && !claimed[key + 'mb']) {
      this.addInteract('chest_money', 520, 420, 60, t('mod.miniboss'), () => { claimed[key + 'mb'] = true; this.consumeInteract(it0); makeChoice(run, G.meta, 'artifact', 'miniboss', s.luck, 1); this.openChoice(); }, false, 'miniboss_drop');
      const it0 = this.interacts[this.interacts.length - 1];
    }
    if (n.event && !claimed[key + 'ev']) this.spawnEvent(n, () => { claimed[key + 'ev'] = true; });
    if (claimed[key]) return;
    const done = () => { claimed[key] = true; };
    const X = 640, Y = 420;
    const nodeKey: Record<string, string> = { levelup: 'orb_levelup', artifact: 'chest_money', enchant: `altar_enchant_${['s', 'm', 'l'][(n.altarSize ?? 1) - 1]}`, tablet: 'chest_money', money: 'chest_money', heart: 'heart_green', anvil: 'anvil', dice: 'dice_pickup', shop: 'shop_stall', roots: 'roots_tree' };
    const it = this.addInteract(nodeKey[n.type], X, Y, 64, t(`node.${n.type}`), () => {
      const res = applyNodeReward(run, G.meta, n, s.luck, s.barter);
      G.logEvent('reward', { type: n.type, res });
      if (n.type !== 'shop') { done(); this.consumeInteract(it); }
      if (res === 'levelup') { this.levelUpFx(); }
      else if (res === 'money') { sfx('coin'); this.burstCoins(X, Y, 10); }
      else if (res === 'heart' || res === 'dice') { sfx('pickup'); toast(this, res === 'heart' ? '+15 HP' : '+2 Xúc Xắc', '#a6e070'); this.recalcStats(); }
      else if (res === 'choice') this.openChoice();
      else if (res === 'shop') this.openShop();
      else if (res === 'enchant') openOverlay(this, 'Enchant', { times: enchantTimes(n, G.meta), onClose: () => this.refreshLoadout(false) });
      else if (res === 'none') toast(this, '…');
      G.saveRun();
    }, n.type === 'levelup' || n.type === 'heart' || n.type === 'dice', `reward_${n.type}`);
  }
  openChoice() { openOverlay(this, 'Choice', { onClose: () => { this.refreshLoadout(false); G.saveRun(); } }); }
  openShop() { openOverlay(this, 'Shop', { onClose: () => { this.refreshLoadout(false); G.saveRun(); } }); }
  spawnEvent(n: MapNode, done: () => void) {
    const ev = n.event!; const run = this.run; const X = 400, Y = 470;
    const keyMap: Record<string, string> = { arena: '', secret: '', clover: 'clover', merchant: 'merchant_rat', obelisk: 'obelisk', fountain: `fountain_${['green', 'gold', 'red'][n.id % 3]}`, companion: 'shop_stall', blood: 'blood_altar', pocket: 'pocket_portal' };
    if (ev === 'arena' || ev === 'secret') { done(); return; }
    const it = this.addInteract(keyMap[ev], X, Y, 64, t(`ev.${ev}`), () => {
      openOverlay(this, 'Event', {
        event: ev, fountain: ['green', 'gold', 'red'][n.id % 3],
        onClose: (opt?: string) => {
          if (!opt || opt === 'leave') return;
          const res = resolveEvent(run, G.meta, ev, opt, { luck: this.stats.luck, barter: this.stats.barter, maxHp: this.stats.maxHp });
          G.logEvent('event', { ev, opt, res: res.text, ok: res.ok });
          if (!res.ok) { toast(this, res.text === 'no_money' ? 'Không đủ Hạt Dẻ' : res.text === 'no_sapphire' ? 'Không đủ Ngọc Sao' : res.text, '#ff7a66'); sfx('deny'); return; }
          done(); this.consumeInteract(it); this.refreshLoadout(false); G.saveMeta();
          if (res.choice) this.openChoice();
          else if (res.shop) this.openShop();
          else if (res.fight === 'waves') { this.waveElites = []; this.waves = planWaves(this.rng.int(1, 1e9), run.chapter, run.floor, 2, 'none', null).waves.slice(0, 2); this.waveIdx = 0; this.fighting = true; this.lockDoors(); this.spawnWave(); }
          else if (res.fight === 'bat') { const b = this.makeEnemy('cmp_bat', 640, 300, { ...(ENEMIES[0]), id: 'bat', ai: 'chaser', hp: 60 + run.chapter * 30, speed: 110 } as EnemyDef, null); b.bat = true; this.fighting = true; this.waves = []; this.waveIdx = 0; this.lockDoors(); }
          else toast(this, t(`ev.${ev}`) + ' ✓', '#a6e070');
          G.saveRun();
        },
      });
    }, false, `event_${ev}`);
  }
  spawnSecretWall() {
    const it = this.addInteract('prop_cracked_wall', ROOM.x1 - 10, 300, 50, '', () => {}, false, 'secret_wall');
    it.hp = 3; it.label.setText(t('ev.secret.hint')).setFontSize(13);
  }

  // ---------------- enemies ----------------
  makeEnemy(key: string, x: number, y: number, def: EnemyDef | null, boss: BossDef | null, hp?: number, dmg?: number, speed?: number, radius?: number): Enemy {
    if (this.layout && !roomWalkable(this.layout, x, y)) ({ x, y } = roomFree(this.layout, x, y)); // never inside an obstacle
    const sk = def?.sprite ?? boss?.sprite ?? key; tex(this, sk, boss ? 'boss' : 'enemy');
    const scale = enemyScale(this.run.chapter, this.run.floor, this.run.hard);
    const H = hp ?? (boss ? boss.hp * (this.run.hard ? 1.4 : 1) : Math.round((def?.hp ?? 40) * scale.hp));
    const D = dmg ?? (boss ? boss.damage * (this.run.hard ? 1.4 : 1) : (def?.damage ?? 6) * scale.dmg);
    const sp = speed ?? boss?.speed ?? def?.speed ?? 60;
    const rad = radius ?? boss?.radius ?? def?.radius ?? 16;
    const s = this.add.sprite(x, y, sk); applyEntry(s, sk, boss ? (boss.mini ? 110 : 190) : (def?.elite ? 64 : 46), [0.5, 0.9]); playAnim(s, sk, 'idle');
    const agent = newAgent(def?.ai ?? 'chaser', x, y, sp, H, { ...(def?.params ?? {}) });
    const e: Enemy = { id: def?.id ?? boss?.id ?? key, def, boss, agent, brain: boss ? newBrain() : null, sprite: s, key: sk, hp: H, maxHp: H, dmg: D, radius: rad, status: newStatus(), kvx: 0, kvy: 0, flash: 0, contactCd: 0, armor: 0, explodeOnDeath: false, dead: false, chargeT: 0, chargeA: 0, chargeSpd: 0, hits: 0, facing: Math.PI / 2 };
    if (!boss) { e.bar = new EnemyBar(this); }
    this.enemies.push(e);
    const fx = this.add.image(x, y - 20, tex(this, 'fx_spawn', 'fx').tex).setDisplaySize(60, 60).setAlpha(0.8); this.tweens.add({ targets: fx, alpha: 0, scale: fx.scale * 1.5, duration: 400, onComplete: () => fx.destroy() });
    if (def) { discover(G.meta, 'enemies', def.id); }
    return e;
  }
  spawnWave() {
    if (this.waveIdx >= this.waves.length) return;
    const ids = this.waves[this.waveIdx]; this.waveIdx++;
    toast(this, `${t('room.wave')} ${this.waveIdx}/${this.waves.length}`, '#ffffff', 200);
    const used: Array<{ x: number; y: number }> = [];
    ids.forEach((id, i) => {
      const def = getEnemy(id); if (!def) return;
      const n = def.params?.swarmSize ? Math.max(1, Math.round(def.params.swarmSize)) : 1;
      for (let k = 0; k < n; k++) {
        const a = (i / ids.length) * Math.PI * 2 + k * 0.3; const x = Phaser.Math.Clamp(640 + Math.cos(a) * 380 + k * 14, ROOM.x0 + 30, ROOM.x1 - 30), y = Phaser.Math.Clamp(400 + Math.sin(a) * 180, ROOM.y0 + 30, ROOM.y1 - 30);
        let sx = x, sy = y; if (Math.hypot(sx - this.px, sy - this.py) < 220) { sx = this.px < 640 ? ROOM.x1 - 120 - k * 20 : ROOM.x0 + 120 + k * 20; sy = ROOM.y0 + 80 + (i * 53) % 300; }
        if (this.layout) { const q = k === 0 || !used.length ? safeSpawn(this.layout, { x: sx, y: sy }, { x: this.px, y: this.py }, 220, used) : used[used.length - 1]; if (k === 0) used.push(q); sx = q.x + k * 6; sy = q.y + (k % 2) * 6; } // v2 rooms: free, reachable, away from the hero
        const e = this.makeEnemy(id, sx, sy, def, null);
        for (const d of this.derange) { if (d === 'haste') e.agent.speed *= 1.4; if (d === 'armor') e.armor = 30; if (d === 'explode') e.explodeOnDeath = true; }
        if (this.derange.length) e.sprite.setTint(0xffb0a0);
        const af = this.waveElites[this.waveIdx - 1]?.[i]; if (af && k === 0) this.makeElite(e, af);
      }
    });
    if (this.waveIdx === this.waves.length && this.miniBoss) { const b = getBoss(this.miniBoss); if (b) { const e = this.makeEnemy(b.id, 640, 300, null, b); e.hp = e.maxHp = Math.round(b.hp * 0.6 * (this.run.hard ? 1.4 : 1)); this.bossRef = e; sfx('boss'); } }
  }
  /** v2 elite promotion (director.ts affix) with a visible marker: pulsing coloured ring + label */
  makeElite(e: Enemy, af: Affix) {
    const m = eliteMods(af); e.elite = af;
    e.hp = e.maxHp = Math.round(e.maxHp * m.hpMul); e.dmg *= m.dmgMul; e.agent.speed *= m.speedMul; e.agent.cdMul = m.cdMul; e.armor = Math.max(e.armor, m.armor); if (m.explodeOnDeath) e.explodeOnDeath = true;
    e.sprite.setScale(e.sprite.scaleX * m.scale, e.sprite.scaleY * m.scale); e.radius = Math.round(e.radius * 1.1);
    e.eliteG = this.add.graphics().setDepth(2);
    e.eliteLabel = txt(this, e.agent.x, e.agent.y, m.label, 13, '#' + m.color.toString(16).padStart(6, '0')).setOrigin(0.5).setDepth(3600);
    G.logEvent('elite', { id: e.id, affix: af });
  }
  drawElite(e: Enemy) {
    const m = eliteMods(e.elite!); const g = e.eliteG!; g.clear(); const a = 0.55 + 0.35 * Math.sin(this.time.now / 160);
    g.fillStyle(m.color, 0.18).fillEllipse(e.agent.x, e.agent.y, e.radius * 2.8, e.radius * 1.4).lineStyle(3, m.color, a).strokeEllipse(e.agent.x, e.agent.y, e.radius * 2.8, e.radius * 1.4);
    e.eliteLabel?.setPosition(e.agent.x, e.agent.y - (e.sprite.displayHeight || 50) - 24);
  }
  startBoss() {
    const f = this.run.floorData; const b = getBoss(f.bossId) ?? getBoss(getChapter(this.run.chapter).boss);
    this.lockDoors(); this.fighting = true; this.waves = []; this.waveIdx = 0;
    if (!b) { this.run.roomCleared = true; return; }
    this.time.delayedCall(600, () => { const e = this.makeEnemy(b.id, 640, 330, null, b); this.bossRef = e; sfx('boss'); this.cameras.main.shake(300, 0.006); G.logEvent('bossSpawn', { id: b.id, mini: b.mini }); for (const s of b.phases[0].summon ?? []) this.spawnMinion(s); });
    this.ctx.bossRoom = !b.mini;
  }
  spawnMinion(id: string, x?: number, y?: number) {
    const def = getEnemy(id) ?? getEnemy(getChapter(this.run.chapter).enemies[0]); if (!def) return;
    if (this.enemies.filter((e) => !e.dead && e.minion).length >= 8) return;
    const e = this.makeEnemy(def.id, x ?? this.rng.range(ROOM.x0 + 60, ROOM.x1 - 60), y ?? this.rng.range(ROOM.y0 + 60, ROOM.y0 + 200), def, null); e.minion = true;
  }

  // ---------------- main loop ----------------
  update(_t: number, dms: number) {
    if (!this.ready) return;
    let dt = Math.min(0.05, dms / 1000);
    this.ctl.update(this.px, this.py - 20);
    if (this.hitStop > 0) { this.hitStop -= dt; return; }
    tickReal(this.cs, dt); dt *= timeScale(this.cs); // perfect-dodge slow-mo
    if (this.run.dead) return;
    this.handleGlobalInput();
    if (!this.scene.isActive()) return;
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateProjs(dt);
    this.updateHazards(dt);
    this.updatePickups(dt);
    this.updateCompanions(dt);
    this.updateEffects(dt);
    this.updateInteracts();
    this.checkRoom();
    this.depthSort();
  }
  handleGlobalInput() {
    const c = this.ctl;
    if (c.consume('pause')) { openOverlay(this, 'Pause', {}); return; }
    if (c.consume('inventory')) { openOverlay(this, 'Inventory', { onClose: () => { this.refreshLoadout(false); G.saveRun(); } }); return; }
    if (c.consume('map') && this.mode === 'run') { openOverlay(this, 'Map', {}); return; }
    if (c.consume('potion')) this.drinkFirstPotion();
    if (c.consume('spell1')) this.castSpellSlot(0); // simulated taps (SIM queue); real keys/touch go through SKF.frame
    if (c.consume('spell2')) this.castSpellSlot(1);
    if (c.consume('reload')) manualReload(this.ws, this.wcfg);
  }
  drinkFirstPotion() {
    const i = this.run.potions.findIndex((p) => p); if (i < 0) { sfx('deny'); return; }
    const id = this.run.potions[i]!; const r = drinkPotion(this.run, G.meta, i);
    if (r) { sfx('magic'); this.fxAt('fx_heal', this.px, this.py - 20, 70); toast(this, (r.identified ? `${t('pot.identified')}: ` : '') + (getPotion(id)?.name ?? id), '#a6e070'); this.recalcStats(); G.logEvent('potion', { id, action: r.action, identified: r.identified }); }
  }

  updatePlayer(dt: number) {
    const c = this.ctl; const s = this.stats; const run = this.run;
    // timers
    this.iframes = Math.max(0, this.iframes - dt); this.hurtT = Math.max(0, this.hurtT - dt); this.afterDash = Math.max(0, this.afterDash - dt);
    this.sinceSpend += dt; this.novaCd = Math.max(0, this.novaCd - dt); this.companionShareCd = Math.max(0, this.companionShareCd - dt);
    if (this.shieldT > 0) { this.shieldT -= dt; if (this.shieldT <= 0) this.shield = 0; }
    this.spellCd[0] = this.casts.slots.spell1.cd; this.spellCd[1] = this.casts.slots.spell2.cd; // mirror (legacy readers)
    run.mp = regenMp(run.mp, s.maxMp, s.mpRegen, this.sinceSpend, dt);
    const dd = tickDash(this.dashes, this.dashTimer, s.dashCount, dashRechargeTime(s), dt); this.dashes = dd.charges; this.dashTimer = dd.timer;
    tickWeapon(this.ws, this.wcfg, dt);
    CFX.frame(this as any, dt);
    SKF.frame(this as any, dt); // skills: input, buffer, wind-up, cancel, aim preview, VFX
    tickBuffs(run, dt);
    this.statsT -= dt; if (this.statsT <= 0) { this.statsT = 0.25; this.recalcStats(); }
    if (c.aimSet) this.facing = c.aim;
    else if (Math.hypot(c.moveX, c.moveY) > 0.1) this.facing = Math.atan2(c.moveY, c.moveX);
    // auto aim for ranged weapons when no mouse aim
    if (!c.aimSet && (this.wcfg.arc === 0)) { const n = this.nearestEnemy(this.px, this.py, 600); if (n) this.facing = Math.atan2(n.agent.y - this.py, n.agent.x - this.px); }
    // dash
    if (this.dashT > 0) {
      this.dashT -= dt; const v = DASH_DIST / DASH_TIME;
      this.moveBy(Math.cos(this.dashA) * v * dt, Math.sin(this.dashA) * v * dt);
      if (this.wcfg.dashAttack || this.sp.dashStrike) for (const e of this.enemies) if (!e.dead && !this.dashHit.has(e) && this.dist(e.agent, { x: this.px, y: this.py }) < e.radius + 22) { this.dashHit.add(e); this.hitEnemy(e, { coef: this.wcfg.dashAttackCoef, isDash: true, knock: this.dashA }); }
      if (this.dashT <= 0) this.endDash();
    } else if (!this.ws.charging && takeDash(this.cs, this.dashes > 0)) {
      this.startDash(Math.hypot(c.moveX, c.moveY) > 0.1 ? Math.atan2(c.moveY, c.moveX) : this.facing);
    } else {
      // guard
      const guarding = this.wcfg.hasGuard && c.guard;
      if (guarding && !this.ws.guarding) { this.ws.guarding = true; this.ws.guardT = guardOpen(this.cs, PERFECT_GUARD); }
      if (!guarding && this.ws.guarding) { this.ws.guarding = false; guardClose(this.cs); }
      // special (input/charge/release handled in SKF.frame; this ticks the greatsword spin)
      this.updateSpecial(dt);
      // move
      let spd = moveSpeedPx(s) * (this.ws.guarding ? 0.45 : 1) * (this.ws.charging || this.spinT > 0 ? 0.5 : 1) * (this.casts.phase === 'windup' ? CAST_MOVE_MUL : 1) * moveMul(this.cs, chargedFor(this.wcfg).moveMul);
      this.moveBy(c.moveX * spd * dt, c.moveY * spd * dt);
      // attack
      CFX.attackInput(this as any, dt); // tap = light (buffered), hold = charged attack
    }
    this.lastAttackHeld = c.attack;
    // visuals
    const moving = Math.hypot(c.moveX, c.moveY) > 0.1;
    if (this.dashT > 0) playAnim(this.hero, this.heroKey, 'dash'); else if (this.hurtT > 0.15) playAnim(this.hero, this.heroKey, 'hurt'); else if (!this.hero.anims.isPlaying || ['idle', 'run'].some((a) => this.hero.anims.currentAnim?.key.endsWith(':' + a))) playAnim(this.hero, this.heroKey, moving ? 'run' : 'idle');
    this.shadow.setPosition(this.px, this.py);
    const heroAlpha = this.iframes > 0 && this.dashT <= 0 ? (Math.floor(this.iframes * 20) % 2 ? 0.5 : 1) : 1; this.hero.setAlpha(heroAlpha);
    if (this.rig) { // facing, squash/stretch, lean and the weapon hand pivot (src/game/heroAnim.ts)
      this.rig.update(dt, { x: this.px, y: this.py, facing: this.facing, moving, guarding: this.ws.guarding, charge: this.ws.charging ? this.ws.charge : (this.cs.charging ? this.cs.charge : -1), spinning: this.spinT > 0, dashing: this.dashT > 0, combat: this.cs as any, weapon: this.wcfg.id, arc: this.wcfg.arc || 60 });
      this.rig.setAlpha(heroAlpha);
    } else { face(this.hero, this.heroKey, Math.cos(this.facing) < 0); this.hero.setPosition(this.px, this.py); }
  }
  blocked(x: number, y: number) { return this.blocks.some((b) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1); }
  moveBy(dx: number, dy: number) {
    const nx = Phaser.Math.Clamp(this.px + dx, ROOM.x0 + 14, ROOM.x1 - 14), ny = Phaser.Math.Clamp(this.py + dy, ROOM.y0 + 10, ROOM.y1 - 6);
    if (!this.blocked(nx, this.py)) this.px = nx; if (!this.blocked(this.px, ny)) this.py = ny;
    for (const d of this.doors) if (this.run.roomCleared && Math.abs(this.px - d.x) < 34 && this.py < ROOM.y0 + 24) { this.useDoor(d); return; }
  }
  startDash(a: number) {
    onDash(this.cs); this.dashes--; this.dashT = DASH_TIME; this.dashA = a; this.iframes = Math.max(this.iframes, DASH_TIME + 0.05); this.dashHit.clear(); this.ws.guarding = false;
    sfx('dash'); this.fxAt('fx_dash_dust', this.px, this.py, 50); playDash(this, a, DASH_TIME * 1000);
    for (const act of fireOnDash(this.bundle, this.ctx)) this.doAction('dash:' + act.action, act.amount, act.source);
    if (this.sp.galeDash) this.addTornado(this.px, this.py, galeDashDamage(this.sp));
    G.logEvent('dash', {});
  }
  endDash() { this.afterDash = 0.18; }
  // ---- attacks ----
  doAttack() {
    if (this.ws.charging || this.spinT > 0) return;
    const dashAtk = this.afterDash > 0;
    const h = tryAttack(this.ws, this.wcfg, this.stats.attackSpeed);
    if (!h) return;
    G.logEvent('attack', { hit: h.hit, weapon: this.wcfg.id });
    playAnim(this.hero, this.heroKey, 'attack', false);
    const pend: Pending = { kind: 'light', hit: h.hit, coef: h.coef, last: h.last, lunge: h.lunge, angle: this.facing, power: 0, dash: dashAtk };
    if (beginMove(this.cs, h.move, h.scale, pend)) this.strike(pend); // startup > 0: CFX.frame performs it later
  }
  /** Perform a light/charged strike (frame data in src/systems/combat.ts; lunge, arc and range per hit). */
  strike(p: Pending) {
    const m = this.cs.move; if (!m) return;
    if (m.feint === false) this.facing = p.angle; // committed moves keep the angle they were started with
    const dashAtk = !!p.dash; const coef = p.coef * (dashAtk ? this.wcfg.dashAttackCoef : 1);
    if (this.wcfg.arc > 0) {
      const R = this.wcfg.range * m.range, A = Math.min(360, this.wcfg.arc * m.arc);
      if (m.lunge) this.moveBy(Math.cos(this.facing) * m.lunge, Math.sin(this.facing) * m.lunge);
      this.swingFx(R, A, m.finisher || this.wcfg.id === 'greatsword', m.sweep);
      this.strikeCtx = CFX.strikeCtx(this as any, m, p);
      this.meleeHit(this.facing, R, A, coef, { isDash: dashAtk });
      if (this.strikeCtx.bonusPct || this.strikeCtx.forceCrit) consumeBonus(this.cs);
      this.strikeCtx = null;
    } else {
      sfx('shoot');
      const n = 1 + this.wcfg.multishot;
      for (let i = 0; i < n; i++) {
        const a = this.facing + (i - (n - 1) / 2) * (12 * Math.PI / 180);
        if (this.wcfg.id === 'staff') this.spawnProj('pj_orb_magic', this.px, this.py - 20, a, 380, 10, coef, { homing: Math.max(0.3, this.wcfg.homing), magicShare: this.wcfg.magicShare, pierce: this.wcfg.pierce });
        else this.spawnProj('pj_bolt', this.px, this.py - 20, a, 620, 8, coef, { pierce: this.wcfg.pierce, homing: this.wcfg.homing });
      }
    }
  }
  meleeHit(angle: number, range: number, arcDeg: number, coef: number, o: { isDash?: boolean; forceCrit?: boolean; stun?: number; knockMul?: number } = {}) {
    let any = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.agent.x - this.px, dy = (e.agent.y - 10) - (this.py - 14); const d = Math.hypot(dx, dy);
      if (d > range + e.radius) continue;
      let da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - angle));
      if (da > (arcDeg * Math.PI / 180) / 2 + Math.atan2(e.radius, Math.max(1, d))) continue;
      this.hitEnemy(e, { coef, isDash: o.isDash, forceCrit: o.forceCrit, knock: angle, knockMul: o.knockMul, melee: true });
      if (o.stun) applyStatus(e.status, 'stun', 1, 0, o.stun);
      any = true;
    }
    // secret wall
    for (const it of this.interacts) if (it.id === 'secret_wall' && !it.used && Math.hypot(it.x - this.px, it.y - this.py) < range + 50) {
      it.hp = (it.hp ?? 3) - 1; this.cameras.main.shake(80, 0.004); sfx('hit');
      if (it.hp <= 0) { this.consumeInteract(it); const r = resolveEvent(this.run, G.meta, 'secret', ''); G.logEvent('event', { ev: 'secret', res: r.text }); toast(this, t('ev.secret'), '#ffcb6b'); this.openChoice(); }
    }
    void any; // hit-stop is per hit now (CFX.impact)
  }
  swingFx(range: number, arc: number, big: boolean, sweep: 1 | -1 = 1) {
    const k = big ? 'fx_slash_big' : 'fx_slash_small';
    const s = this.add.sprite(this.px + Math.cos(this.facing) * range * 0.5, this.py - 16 + Math.sin(this.facing) * range * 0.5, tex(this, k, 'fx').tex);
    s.setRotation(this.facing).setDisplaySize(range * 1.3, range * (Math.min(arc, 200) / 100)).setDepth(3000).setAlpha(0.9).setFlipY(sweep < 0);
    if (this.anims.exists(`${k}:play`)) s.play(`${k}:play`); else if (entry(k)?.anims) { const first = Object.keys(entry(k)!.anims!)[0]; playAnim(s, k, first); }
    this.tweens.add({ targets: s, alpha: 0, duration: 160, onComplete: () => s.destroy() });
    void sweep; // the weapon swing itself is animated by the hero rig (src/game/heroAnim.ts)
  }
  // ---- specials ----
  updateSpecial(dt: number) {
    if (this.spinT > 0) {
      this.spinT -= dt; this.spinTick -= dt; this.facing += dt * 14;
      if (this.spinTick <= 0) { this.spinTick = 0.2; this.meleeHit(0, this.wcfg.range * 1.1, 360, this.wcfg.coefs[0] * 0.7); this.swingFx(this.wcfg.range, 160, true); }
    }
  }
  spendMp(n: number) { if (n > 0) { this.run.mp = Math.max(0, this.run.mp - n); this.sinceSpend = 0; } }
  // ---- spells ----
  /** Tap a spell slot (simulated input); real presses go through SKF.frame (hold = aim, release = cast). */
  castSpellSlot(i: number) { SKF.request(this as any, i ? 'spell2' : 'spell1'); }
  doSpell(sl: SpellSlot) { SKF.doSpell(this as any, sl, this.facing); }

  // ---------------- damage to enemies ----------------
  hitEnemy(e: Enemy, o: { coef?: number; flat?: number; isDash?: boolean; forceCrit?: boolean; knock?: number; knockMul?: number; status?: StatusId; element?: Element; spell?: boolean; melee?: boolean; magicShare?: number; ignoreDef?: boolean; fromX?: number; fromY?: number; noTrigger?: boolean; shownCrit?: boolean; hs?: number; shk?: number }) {
    if (e.dead) return 0;
    const el = o.element ?? this.wcfg.element;
    const behind = isBehind(e.agent.angle, e.agent.x, e.agent.y, o.fromX ?? this.px, o.fromY ?? this.py);
    const mult = hitMultiplier(this.sp, { frozen: e.status.frozenT > 0, shocked: e.status.shockT > 0, anyStatus: e.status.burn.stacks + e.status.frost.stacks + e.status.poison.stacks + e.status.wound.stacks > 0 || e.status.shockT > 0 || e.status.frozenT > 0 || e.status.stunT > 0, behind }, !!o.isDash);
    let amt: number; let crit = false;
    if (o.flat !== undefined) { amt = Math.round(o.flat * (1 + takenMult(e.status)) * mult); crit = !!o.shownCrit; } // spell crits are rolled by the caster
    else {
      const sk = o.melee ? this.strikeCtx : null;
      const r = computeDamage({ stats: { ...this.stats, critChance: this.stats.critChance + this.wcfg.critBonus + (sk?.critBonus ?? 0) }, element: el, coef: o.coef ?? 1, bonusPct: this.wcfg.damagePct + (sk?.bonusPct ?? 0), magicShare: o.magicShare ?? this.wcfg.magicShare, targetDefense: e.armor, targetTakenPct: takenMult(e.status), forceCrit: o.forceCrit || sk?.forceCrit });
      amt = Math.round(r.amount * mult); crit = r.crit;
    }
    amt += woundBonus(e.status, amt);
    if (e.agent.ai === 'shielded' && shieldBlocks(e.agent, { x: o.fromX ?? this.px, y: o.fromY ?? this.py }) && !o.spell) { amt = Math.max(1, Math.round(amt * 0.2)); this.floatText(e.agent.x, e.agent.y - 50, 'Đỡ!', '#cfd8e3'); sfx('guard'); }
    if (e.brain && e.brain.shieldT > 0) { amt = 0; this.floatText(e.agent.x, e.agent.y - 80, 'Khiên!', '#9be4ff'); }
    const [doom, dc] = doomMark(this.sp, this.doomCounter); this.doomCounter = dc; amt += doom;
    if (G.god && e.boss) amt = Math.max(amt, 1);
    e.hp -= amt; e.flash = 0.08; this.dmgDealtLog += amt; if (e.boss) this.bossDmgTime = this.time.now;
    if (e.dummy) { e.hp = e.maxHp; this.trainingHits++; this.checkTraining(); }
    this.floatText(e.agent.x + Phaser.Math.Between(-10, 10), e.agent.y - 44, String(amt), crit ? '#ffcb3a' : '#ffffff', crit ? 26 : 20);
    sfx(crit ? 'crit' : 'hit');
    if (o.hs) this.hitStop = Math.max(this.hitStop, o.hs); if (o.shk) this.cameras.main.shake(...CFX_SHAKE[Math.min(3, o.shk) as 1 | 2 | 3]); // skill feel (src/systems/skills.ts)
    CFX.impact(this as any, e, o, amt, crit, o.melee ? this.strikeCtx : null); // spark, hit-stop, shake tier, poise/weight knockback
    if (this.stats.lifesteal > 0) this.healPlayer(lifestealHeal(amt, this.stats.lifesteal), false);
    if (!o.noTrigger) {
      if (o.status) applyStatus(e.status, o.status, 1, this.stats[ELEMENT_FROM[o.status] ?? 'fire'] * 0.15);
      if (this.wcfg.element !== 'physical' && !o.spell && Math.random() < 0.15) { const st = ELEMENT_STATUS[this.wcfg.element]!; this.applyEnemyStatus(e, st, 1); }
      for (const a of fireOnHit(this.bundle, this.ctx, Math.random)) this.applyEnemyStatus(e, a.status, a.stacks);
      if (o.melee || !o.spell) if (addFury(this.ws, this.wcfg)) { toast(this, 'Cuồng Nộ!', '#ff7a66', 220); sfx('levelup'); G.logEvent('fury', {}); }
    }
    G.logEvent('hit', { id: e.id, amt, crit, boss: !!e.boss });
    if (e.hp <= 0 && !e.dummy) this.killEnemy(e);
    return amt;
  }
  applyEnemyStatus(e: Enemy, st: StatusId, stacks: number) {
    const power = Math.max(2, (this.stats[ELEMENT_FROM[st] ?? 'physical'] ?? 20) * 0.15);
    const ev = applyStatus(e.status, st, stacks, power);
    if (ev.includes('freeze')) { this.fxAt('fx_freeze', e.agent.x, e.agent.y - 20, 60); this.floatText(e.agent.x, e.agent.y - 60, 'Đóng băng!', '#9be4ff'); }
    if (ev.includes('chain')) { const others = chainTargets(e.agent as any, this.enemies.filter((x) => !x.dead && x !== e).map((x) => x.agent as any), chainCount(this.sp)) as any[]; for (const c of others) { const t2 = this.enemies.find((x) => x.agent === c)!; this.zap(e.agent.x, e.agent.y - 20, t2.agent.x, t2.agent.y - 20); this.hitEnemy(t2, { flat: Math.round(this.stats.lightning * 0.4 + (this.sp.lightningRod ?? 0) * 0.2), noTrigger: true, element: 'lightning' }); t2.status.shockT = 3; } }
    if (st === 'burn') this.fxAt('fx_burn', e.agent.x, e.agent.y - 20, 40);
    if (st === 'poison') this.fxAt('fx_poison', e.agent.x, e.agent.y - 20, 40);
  }
  killEnemy(e: Enemy) {
    if (e.dead) return; e.dead = true; enemyPoseClear(e.sprite); e.bar?.destroy(); e.mark?.destroy(); e.eliteG?.destroy(); e.eliteLabel?.destroy();
    playAnim(e.sprite, e.key, 'die', false);
    this.tweens.add({ targets: e.sprite, alpha: 0, duration: 450, delay: 150, onComplete: () => e.sprite.destroy() });
    this.fxAt('fx_explosion', e.agent.x, e.agent.y - 16, e.boss ? 160 : 50);
    this.run.kills++;
    G.logEvent('kill', { id: e.id, boss: !!e.boss, mini: e.boss?.mini });
    if (e.explodeOnDeath) this.addCircleHazard(e.agent.x, e.agent.y, 60, 0.6, e.dmg, false);
    if (e.elite === 'splitting' && e.def) for (let k = 0; k < eliteMods('splitting').split; k++) { const c = this.makeEnemy(e.def.id, e.agent.x + (k ? 26 : -26), e.agent.y + 8, e.def, null); c.hp = c.maxHp = Math.max(1, Math.round(e.maxHp * SPLIT_HP)); c.sprite.setScale(c.sprite.scaleX * 0.8, c.sprite.scaleY * 0.8); c.radius = Math.round(c.radius * 0.85); c.agent.cd = 0.8; }
    if (e.bat) { const p = batReward(this.run); toast(this, p ? `+ ${getPotion(p)?.name}` : t('inv.full'), '#a6e070'); }
    if (!e.dummy) {
      const money = e.def ? Phaser.Math.Between(e.def.money[0], e.def.money[1]) : 0;
      if (money) this.dropPickup(e.agent.x, e.agent.y, 'money', money);
      const xp = e.def?.xp ?? (e.boss ? 40 : 3); this.dropPickup(e.agent.x + 8, e.agent.y, 'xp', xp);
      for (const act of fireOnKill(this.bundle, this.ctx)) this.doAction('kill:' + act.action, act.amount, act.source, e.agent.x, e.agent.y);
    }
    if (e.boss) this.onBossKilled(e);
  }
  onBossKilled(e: Enemy) {
    const b = e.boss!; sfx('win'); this.cameras.main.shake(400, 0.01); this.cameras.main.flash(300, 255, 240, 200);
    for (const x of this.enemies) if (!x.dead && x !== e && (x.minion || this.isGate)) this.killEnemy(x);
    if (!this.isGate) { this.bossRef = null; return; } // mini boss in a node room: drop handled by reward
    G.meta.journal.enemies.includes(b.id) || G.meta.journal.enemies.push(b.id);
    const res = bossDefeated(this.run, G.meta, b.mini, b.reward);
    G.logEvent('bossDefeated', { id: b.id, mini: b.mini, res, chapter: this.run.chapter, floor: this.run.floor });
    this.fighting = false; this.bossRef = null;
    G.saveMeta();
    if (res === 'win') { this.time.delayedCall(1200, () => this.winRun()); return; }
    if (b.mini) { makeChoice(this.run, G.meta, 'artifact', 'gate', this.stats.luck, 1); this.time.delayedCall(700, () => this.openChoice()); }
    G.saveRun();
    this.time.delayedCall(500, () => {
      const it = this.addInteract('portal_exit', 640, 420, 60, res === 'nextChapter' ? `${t('chapter')} ${this.run.chapter}` : `${t('floor')} ${this.run.floor}`, () => { this.consumeInteract(it); this.transition(() => G.saveRun()); }, true, 'portal');
    });
  }
  winRun() {
    const s = endRun(this.run, G.meta, true); G.saveMeta(); G.clearRun();
    G.logEvent('runWon', { sapphires: s });
    this.scene.stop('Hud'); this.scene.start('Ending', { sapphires: s });
  }
  dieRun() {
    if (this.run.dead !== true) return;
    sfx('death'); playAnim(this.hero, this.heroKey, 'die', false);
    const s = endRun(this.run, G.meta, false); G.saveMeta(); G.clearRun();
    G.logEvent('runLost', { sapphires: s });
    const summary = { sapphires: s, floors: this.run.floorsCleared, bosses: this.run.bossesKilled, kills: this.run.kills, chapter: this.run.chapter, floor: this.run.floor };
    this.time.delayedCall(900, () => { this.scene.stop('Hud'); this.scene.start('Results', summary); });
  }
  checkTraining() {
    if (this.mode !== 'training' || this.trainingDone) return;
    if (this.trainingHits >= 10 && !G.meta.trained.includes(this.run.weapon)) {
      if (completeTraining(G.meta, this.run.weapon)) { this.trainingDone = true; G.saveMeta(); toast(this, t('training.weaponDone'), '#a6e070'); sfx('levelup'); G.logEvent('trainingDone', { weapon: this.run.weapon }); }
    }
  }

  // ---------------- player damage ----------------
  hurtPlayer(raw: number, fromX: number, fromY: number, src?: Enemy) {
    if (this.iframes > 0 || this.dashT > 0 || this.run.dead) { if (!this.run.dead) CFX.dodged(this as any, src); return; }
    if (G.god) return;
    const g = guardBlock(this.ws, this.wcfg, this.facing, Math.atan2(fromY - this.py, fromX - this.px), this.run.mp);
    if (g.blocked) {
      this.spendMp(g.mpCost); sfx('guard'); this.fxAt('fx_hit', this.px + Math.cos(this.facing) * 20, this.py - 20, 40);
      G.logEvent('guard', { perfect: g.perfect });
      if (g.perfect) { this.floatText(this.px, this.py - 60, 'Đỡ hoàn hảo!', '#ffcb6b'); CFX.parried(this as any, src); if (this.sp.guardCounter) for (const e of this.enemies) if (!e.dead && this.dist(e.agent, { x: this.px, y: this.py }) < 90) this.hitEnemy(e, { flat: guardCounterDamage(this.sp), forceCrit: this.wcfg.critOnPerfect }); }
      return;
    }
    const r = incomingDamage(raw, this.stats);
    if (r.evaded) { this.floatText(this.px, this.py - 60, 'Né!', '#cfe8ff'); this.iframes = 0.2; return; }
    let dmg = r.amount;
    if (this.shield > 0) { const a = Math.min(this.shield, dmg); this.shield -= a; dmg -= a; }
    const ms = splitManaShield(this.sp, dmg, this.run.mp); if (ms.mp) this.spendMp(ms.mp); dmg = ms.hp;
    if (dmg <= 0) return;
    this.run.hp -= dmg; this.iframes = 0.6; this.hurtT = 0.3; onHurt(this.cs, this.wcfg.superArmor); SKF.onHurt(this as any); sfx('hurt'); this.cameras.main.shake(120, 0.006);
    this.floatText(this.px, this.py - 56, `-${dmg}`, '#ff6a5a', 22);
    playHurt(this, Math.atan2(fromY - this.py, fromX - this.px));
    this.hero.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL); this.time.delayedCall(90, () => { this.hero.setTint(0xff9090).setTintMode(Phaser.TintModes.MULTIPLY); this.time.delayedCall(120, () => this.hero.clearTint()); });
    G.logEvent('hurt', { dmg, hp: this.run.hp });
    for (const act of fireOnHurt(this.bundle, this.ctx)) this.doAction('hurt:' + act.action, act.amount, act.source, src?.agent.x, src?.agent.y, src);
    if (this.run.hp <= 0) {
      const ph = phoenix(this.sp, this.run.phoenixUsed, this.stats.maxHp);
      if (ph) { this.run.phoenixUsed = true; this.run.hp = ph; this.iframes = 1.5; toast(this, 'Phượng Hoàng!', '#ffcb6b'); this.fxAt('fx_levelup', this.px, this.py - 20, 120); return; }
      if (this.mode === 'training') { this.run.hp = this.stats.maxHp; return; }
      if (onLethal(this.run, this.stats.maxHp)) { toast(this, 'Hồi sinh!', '#ffcb6b'); this.iframes = 1.5; return; }
      this.dieRun();
    }
  }
  healPlayer(n: number, show = true) { if (n <= 0) return; const b = this.run.hp; this.run.hp = Math.min(this.stats.maxHp, this.run.hp + n); if (show && this.run.hp - b >= 1) this.floatText(this.px, this.py - 60, `+${Math.round(this.run.hp - b)}`, '#7cf07c'); }

  // ---------------- effect actions ----------------
  doAction(kind: string, v: number, source: string, x = this.px, y = this.py, src?: Enemy) {
    const pd = procDamage(kind, v, source, this.stats, this.run.level); v = pd.v; const el: Element = pd.el; // V2: elemental procs scale with element stat
    switch (kind) {
      case 'kill:heal': case 'dash:heal': this.healPlayer(v); break;
      case 'kill:mp': case 'hurt:mp': this.run.mp = Math.min(this.stats.maxMp, this.run.mp + v); break;
      case 'kill:money': this.dropPickup(x, y, 'money', Math.round(v)); break;
      case 'kill:explode': this.radialDamage(x, y, 60, v, el, 'fx_explosion'); break;
      case 'dash:trail': this.addTrail(x, y, v, el); break;
      case 'dash:shockwave': this.radialDamage(this.px, this.py, 70, v, el, 'fx_dash_dust', true); break;
      case 'dash:shield': this.shield = Math.max(this.shield, v); this.shieldT = 2; break;
      case 'hurt:thorns': if (src && !src.dead) this.hitEnemy(src, { flat: v, noTrigger: true }); break;
      case 'hurt:nova': if (this.novaCd <= 0) { this.novaCd = 3; this.radialDamage(this.px, this.py, 90, v, el, 'fx_explosion', true); } break;
      case 'periodic:orb': { const n = this.nearestEnemy(this.px, this.py, 700); if (n) this.spawnProj('pj_orb_magic', this.px, this.py - 30, Math.atan2(n.agent.y - this.py, n.agent.x - this.px), 300, 9, 0, { flat: v, homing: 1.4, element: 'ice' }); break; }
      case 'periodic:lightning': { const alive = this.enemies.filter((e) => !e.dead && !e.dummy || (e.dummy && this.mode === 'training')); if (alive.length) { const e = alive[Math.floor(Math.random() * alive.length)]; this.zap(e.agent.x, e.agent.y - 300, e.agent.x, e.agent.y - 20); this.fxAt('fx_shock', e.agent.x, e.agent.y - 20, 60); this.hitEnemy(e, { flat: v, status: 'shock', element: 'lightning', noTrigger: false, spell: true }); } break; }
      case 'periodic:meteor': { const n = this.nearestEnemy(this.px, this.py, 900); if (n) this.addCircleHazard(n.agent.x, n.agent.y, 56, 0.6, v, true, 'burn'); break; }
      case 'periodic:heal': this.healPlayer(v); break;
      case 'periodic:frostRing': { this.radialDamage(this.px, this.py, 90, v, 'ice', 'fx_freeze'); for (const e of this.enemies) if (!e.dead && this.dist(e.agent, { x: this.px, y: this.py }) < 90 + e.radius) this.applyEnemyStatus(e, 'frostbite', 1); break; }
    }
    G.logEvent('effect', { kind, v: Math.round(v), source });
  }
  radialDamage(x: number, y: number, r: number, v: number, el: Element, fx: string, knock = false) {
    this.fxAt(fx, x, y - 10, r * 2);
    for (const e of this.enemies) if (!e.dead && Math.hypot(e.agent.x - x, e.agent.y - y) < r + e.radius) this.hitEnemy(e, { flat: v, element: el, noTrigger: true, knock: knock ? Math.atan2(e.agent.y - y, e.agent.x - x) : undefined });
  }
  addTrail(x: number, y: number, v: number, el: Element) {
    const g = this.add.graphics().setDepth(5); const h: Hazard = { x, y, r: 26, t: 0, delay: 0, dmg: v, g, kind: 'trail', life: 1.5, fromPlayer: true, tick: 0, status: ELEMENT_STATUS[el] ?? undefined };
    g.fillStyle(el === 'ice' ? 0x9be4ff : el === 'fire' ? 0xff8a3a : el === 'lightning' ? 0xfff07a : 0xe8dcc0, 0.45).fillCircle(x, y, 26); this.hazards.push(h);
  }
  addTornado(x: number, y: number, v: number) { const g = this.add.graphics().setDepth(5); this.hazards.push({ x, y, r: 50, t: 0, delay: 0, dmg: v, g, kind: 'tornado', life: 1.5, fromPlayer: true, tick: 0 }); }
  addCircleHazard(x: number, y: number, r: number, delay: number, dmg: number, fromPlayer = false, status?: StatusId) {
    const g = this.add.graphics().setDepth(4); this.hazards.push({ x, y, r, t: 0, delay, dmg, g, kind: 'circle', fromPlayer, status });
  }

  // ---------------- enemies update ----------------
  updateEnemies(dt: number) {
    const P = { x: this.px, y: this.py };
    if (!this.aiw) { this.aiw = new AiWorld(this.run.chapter, this.run.hard, ROOM); this.aiw.nav = this.nav; }
    const aiw = this.aiw; aiw.beginFrame(dt, this.enemies.filter((e) => !e.dead && !e.dummy).map((e) => ({ agent: e.agent, radius: e.radius })));
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dot = tickStatus(e.status, dt);
      if (dot > 0 && !e.dummy) { e.hp -= dot; (e as any).dotAcc = ((e as any).dotAcc ?? 0) + dot; if ((e as any).dotAcc >= 4) { this.floatText(e.agent.x, e.agent.y - 40, String(Math.round((e as any).dotAcc)), '#ffa04a', 16); (e as any).dotAcc = 0; } if (e.hp <= 0) { this.killEnemy(e); continue; } }
      if (e.dummy) { e.sprite.setPosition(e.agent.x, e.agent.y); this.drawEnemyBar(e); continue; }
      e.flash = Math.max(0, e.flash - dt); e.contactCd = Math.max(0, e.contactCd - dt);
      let acts: Array<AiAction | BossAction> = [];
      if (!isDisabled(e.status)) {
        if (e.chargeT > 0) { e.chargeT -= dt; e.agent.vx = Math.cos(e.chargeA) * e.chargeSpd; e.agent.vy = Math.sin(e.chargeA) * e.chargeSpd; }
        else if (e.boss && e.brain) acts = bossThink(e.brain, e.boss, e.hp / e.maxHp, e.agent, P, { w: ROOM.w, h: ROOM.h }, dt, this.rng, aiw);
        else acts = aiw.think(e.agent, P, dt, this.rng);
      } else if (!e.boss) aiw.think(e.agent, P, dt, this.rng, true); else { e.agent.vx = 0; e.agent.vy = 0; }
      if (e.agent.exposedT > 0) expose(e.status, e.agent.exposedT); // recovery / stagger punish window
      for (const a of acts) this.execAction(e, a);
      if (e.dead) continue;
      const slow = e.status.frost.stacks > 0 ? 1 - e.status.frost.stacks * 0.08 : 1;
      e.agent.x += (e.agent.vx * slow + e.kvx) * dt; e.agent.y += (e.agent.vy * slow + e.kvy) * dt;
      e.kvx *= Math.pow(0.0005, dt); e.kvy *= Math.pow(0.0005, dt);
      const bounced = e.agent.x < ROOM.x0 + e.radius || e.agent.x > ROOM.x1 - e.radius || e.agent.y < ROOM.y0 + e.radius * 0.5 || e.agent.y > ROOM.y1 - 4;
      e.agent.x = Phaser.Math.Clamp(e.agent.x, ROOM.x0 + e.radius, ROOM.x1 - e.radius); e.agent.y = Phaser.Math.Clamp(e.agent.y, ROOM.y0 + e.radius * 0.5, ROOM.y1 - 4);
      if (bounced && e.chargeT > 0) e.chargeT = 0;
      if (this.layout) { const rc = resolveCircle(this.layout, e.agent.x, e.agent.y, Math.min(e.radius * 0.7, 20)); if (rc.hit) { e.agent.x = rc.x; e.agent.y = rc.y; if (e.chargeT > 0) e.chargeT = 0; } } // v2 rooms: slide along obstacles
      // separation
      for (const o of this.enemies) if (o !== e && !o.dead && !o.dummy) { const dx = e.agent.x - o.agent.x, dy = e.agent.y - o.agent.y; const d = Math.hypot(dx, dy) || 1; const m = e.radius + o.radius; if (d < m * 0.9) { e.agent.x += dx / d * (m * 0.9 - d) * 0.5; e.agent.y += dy / d * (m * 0.9 - d) * 0.5; } }
      // contact
      const dP = Math.hypot(e.agent.x - this.px, (e.agent.y - this.py)); const cm = contactMult(e.agent, !!e.boss, e.chargeT > 0); if (cm > 0 && dP < e.radius + 14 && e.contactCd <= 0 && e.dmg > 0) { e.contactCd = e.def?.params?.contactCooldown ?? 0.8; this.hurtPlayer(e.dmg * cm, e.agent.x, e.agent.y, e); }
      // visuals
      const s = e.sprite; s.setPosition(e.agent.x, e.agent.y);
      face(s, e.key, this.px < e.agent.x);
      const moving = Math.hypot(e.agent.vx, e.agent.vy) > 5; if (!s.anims.isPlaying || s.anims.currentAnim?.key.match(/:(idle|run)$/)) playAnim(s, e.key, moving ? 'run' : 'idle');
      if (e.flash > 0) s.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL); else if (e.status.frozenT > 0) s.setTint(0x9be4ff).setTintMode(Phaser.TintModes.MULTIPLY); else if (e.status.burn.stacks) s.setTint(0xffb080).setTintMode(Phaser.TintModes.MULTIPLY); else if (this.derange.length && !e.boss) s.setTint(0xffb0a0).setTintMode(Phaser.TintModes.MULTIPLY); else s.clearTint();
      if (e.brain && e.brain.shieldT > 0) s.setTint(0x9be4ff).setTintMode(Phaser.TintModes.MULTIPLY);
      if (e.flash <= 0 && !e.status.frozenT) { if (e.agent.state === 'blink') s.setTint(Math.sin(this.time.now / 45) > 0 ? 0xff8070 : 0xffffff).setTintMode(Phaser.TintModes.MULTIPLY); else if (e.status.exposedT > 0) s.setTint(0xffe9a0).setTintMode(Phaser.TintModes.MULTIPLY); } // v2: windup flash / exposed
      syncEnemyPose(s, e.agent, isDisabled(e.status), e.boss ? 0.6 : e.elite ? 1.3 : 1); // wind-up / recovery pose (src/game/enemyAnim.ts)
      if (e.eliteG) this.drawElite(e);
      this.drawEnemyBar(e);
      if (e.agent.ai === 'exploder' && e.agent.state === 'done') this.killEnemy(e);
    }
    this.enemies = this.enemies.filter((e) => !e.dead || e.sprite.active);
  }
  drawEnemyBar(e: Enemy) {
    const b = e.bar; if (!b) return; if (e.dummy || (e.hp >= e.maxHp && !e.status.shockT)) { b.clear(); return; }
    const w = 36, x = e.agent.x - w / 2, y = e.agent.y - (e.sprite.displayHeight || 40) - 8; const st = e.status;
    b.begin(x, y, e.hp / e.maxHp); // image quads, no per-frame tessellation / arrays (src/game/fxPool.ts EnemyBar)
    if (st.burn.stacks > 0) b.dot(0xff8a3a); if (st.frost.stacks > 0 || st.frozenT > 0) b.dot(0x9be4ff); if (st.shockT > 0) b.dot(0xfff07a); if (st.poison.stacks > 0) b.dot(0x8fd14e);
    if (st.wound.stacks > 0) b.dot(0xc2352d); if (st.stunT > 0) b.dot(0xffffff); if ((st as any).exposedT > 0) b.dot(0xffcb3a);
    b.end();
  }
  execAction(e: Enemy, a: AiAction | BossAction) {
    const ex = e.agent.x, ey = e.agent.y - (e.boss ? 40 : 14); const dmg = e.dmg;
    switch (a.type) {
      case 'shoot': { const n = Math.max(1, a.count); for (let i = 0; i < n; i++) { const an = a.angle + (n > 1 ? (i / (n - 1) - 0.5) * a.spread : 0); this.spawnEnemyProj(ex, ey, an, a.speed, dmg, a.kind === 'arrow' ? 'pj_enemy_arrow' : 'pj_enemy_orb'); } break; }
      case 'ring': for (let i = 0; i < a.count; i++) this.spawnEnemyProj(ex, ey, a.offset + i / a.count * Math.PI * 2, a.speed, dmg, a.kind === 'star' ? 'pj_star' : 'pj_enemy_orb'); break;
      case 'telegraphLine': { const g = this.add.graphics().setDepth(3); this.hazards.push({ x: ex, y: e.agent.y, r: 0, t: 0, delay: a.time, dmg: 0, g, kind: 'line', angle: a.angle, len: a.length, width: e.radius * 1.6, follow: e }); break; }
      case 'telegraphCircle': { const g = this.add.graphics().setDepth(3); this.hazards.push({ x: a.x, y: a.y, r: a.radius, t: 0, delay: a.time, dmg: 0, g, kind: 'circle', done: false, life: -1 }); break; }
      case 'lob': { this.addCircleHazard(a.x, a.y, a.radius, a.delay, dmg); const b = this.add.image(ex, ey, tex(this, 'pj_bomb', 'proj').tex).setDisplaySize(20, 20).setDepth(3100); this.tweens.add({ targets: b, x: a.x, y: a.y, duration: a.delay * 1000, ease: 'Quad.easeIn', onComplete: () => b.destroy() }); break; }
      case 'summon': { const ids = a.ids?.length ? a.ids : [getChapter(this.run.chapter).enemies.find((id) => ['chaser', 'exploder'].includes(getEnemy(id)?.ai ?? '')) ?? getChapter(this.run.chapter).enemies[0]]; for (let i = 0; i < a.count; i++) this.spawnMinion(ids[i % ids.length], ex + Math.cos(i * 2.1) * 60, ey + 40 + Math.sin(i * 2.1) * 40); break; }
      case 'heal': for (const o of this.enemies) if (!o.dead && o !== e && !o.dummy && Math.hypot(o.agent.x - e.agent.x, o.agent.y - e.agent.y) < a.radius) { o.hp = Math.min(o.maxHp, o.hp + (a.amount ?? o.maxHp * a.pct)); this.fxAt('fx_heal', o.agent.x, o.agent.y - 20, 40); } break;
      case 'teleport': this.fxAt('fx_spawn', e.agent.x, e.agent.y - 20, 50); e.agent.x = Phaser.Math.Clamp(a.x, ROOM.x0 + 30, ROOM.x1 - 30); e.agent.y = Phaser.Math.Clamp(a.y, ROOM.y0 + 30, ROOM.y1 - 20); if (this.layout && !roomWalkable(this.layout, e.agent.x, e.agent.y)) { const f = roomFree(this.layout, e.agent.x, e.agent.y); e.agent.x = f.x; e.agent.y = f.y; } this.fxAt('fx_spawn', e.agent.x, e.agent.y - 20, 50); break;
      case 'explode': this.fxAt('fx_explosion', e.agent.x, e.agent.y - 10, a.radius * 2); sfx('explode'); if (Math.hypot(this.px - e.agent.x, this.py - e.agent.y) < a.radius) this.hurtPlayer(dmg * 1.5, e.agent.x, e.agent.y, e); e.agent.state = 'done'; break;
      case 'charge': e.chargeT = a.duration; e.chargeA = a.angle; e.chargeSpd = a.speed; playAnim(e.sprite, e.key, 'attack', false); break;
      case 'hazard': this.addCircleHazard(a.x, a.y, a.radius, a.delay, dmg); break;
      case 'phase': this.onBossPhase(e, a.index, a.onEnter, a.summon); this.floatText(e.agent.x, e.agent.y - 130, 'Choáng!', '#ffcb3a', 24); break;
      case 'enrage': toast(this, 'Cuồng nộ!', '#ff5a3a', 220); this.cameras.main.shake(220, 0.006); G.logEvent('bossEnrage', { id: e.id }); break;
      case 'laser': { const g = this.add.graphics().setDepth(3); this.hazards.push({ x: e.agent.x, y: e.agent.y - 40, r: 0, t: 0, delay: a.telegraph, dmg, g, kind: 'laser', angle: a.angle, sweep: a.sweep, dur: a.duration, width: a.width, beams: a.beams, len: 1400, follow: e, tick: 0 }); playAnim(e.sprite, e.key, 'attack2', false); break; }
      case 'mine': { const g = this.add.graphics().setDepth(3); this.hazards.push({ x: a.x, y: a.y, r: a.radius, t: 0, delay: a.arm, dmg, g, kind: 'mine', life: a.life }); break; }
      case 'shield': this.floatText(e.agent.x, e.agent.y - 120, 'Khiên!', '#9be4ff', 26); (e as any).reflect = a.reflect; this.time.delayedCall(a.duration * 1000, () => ((e as any).reflect = false)); break;
      case 'slam': { const r = a.radius; if (a.telegraph > 0) this.addCircleHazard(e.agent.x, e.agent.y, r, a.telegraph, dmg * a.mult); else { this.fxAt('fx_explosion', e.agent.x, e.agent.y, r * 2); if (Math.hypot(this.px - e.agent.x, this.py - e.agent.y) < r) this.hurtPlayer(dmg * a.mult, e.agent.x, e.agent.y, e); } playAnim(e.sprite, e.key, 'attack', false); break; }
    }
    if (a.type === 'shoot' || a.type === 'ring') { playAnim(e.sprite, e.key, 'attack', false); }
  }
  onBossPhase(e: Enemy, idx: number, onEnter?: string, summon?: string[]) {
    G.logEvent('bossPhase', { id: e.id, phase: idx, onEnter });
    playAnim(e.sprite, e.key, 'phase', false); sfx('boss'); this.cameras.main.flash(250, 255, 220, 200); this.cameras.main.shake(250, 0.008);
    toast(this, onEnter === 'enrage' ? 'Nổi giận!' : `Giai đoạn ${idx + 1}`, '#ff7a66', 200);
    for (const s of summon ?? []) this.spawnMinion(s);
    switch (onEnter) {
      case 'splitShadow': { const d = this.makeEnemy(e.key, e.agent.x + 80, e.agent.y, null, null, 1, e.dmg * 0.5, e.agent.speed, e.radius); d.decoy = true; d.sprite.setAlpha(0.6); d.minion = true; break; }
      case 'rootsArena': for (let i = 0; i < 8; i++) this.addCircleHazard(ROOM.x0 + 60 + i * 150, ROOM.y1 - 30, 40, 1.2, e.dmg); break;
      case 'shelvesFall': for (let i = 0; i < 3; i++) this.addCircleHazard(this.px + (i - 1) * 120, this.py, 60, 1.2, e.dmg * 1.2); break;
      case 'iceCrack': case 'blizzard': this.cameras.main.flash(400, 200, 230, 255); break;
      case 'supernova': if (e.brain) e.brain.shieldT = 1; this.cameras.main.flash(600, 255, 255, 255); break;
    }
  }
  spawnEnemyProj(x: number, y: number, a: number, speed: number, dmg: number, key = 'pj_enemy_orb') {
    if (this.projs.length > 500) return;
    const s = acquireImage(this, key, 18, x, y, a); // pooled
    this.projs.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 8, dmg, from: 'enemy', sprite: s, life: 5, pierce: 0, hit: NO_HITS, homing: 0, element: 'physical' });
  }
  spawnProj(key: string, x: number, y: number, a: number, speed: number, r: number, coef: number, o: { pierce?: number; homing?: number; flat?: number; status?: StatusId; spell?: boolean; explode?: number; element?: Element; magicShare?: number; hs?: number; shk?: number; shownCrit?: boolean } = {}) {
    const s = acquireImage(this, key, r * 2.4, x, y, a); // pooled
    const p: Proj = { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, dmg: o.flat ?? 0, coef, from: 'player', sprite: s, life: 1.8, pierce: o.pierce ?? 0, hit: new Set(), homing: o.homing ?? 0, element: o.element ?? this.wcfg.element, status: o.status, spell: o.spell, explode: o.explode, magicShare: o.magicShare, hs: o.hs, shk: o.shk, shownCrit: o.shownCrit };
    this.projs.push(p); return p;
  }
  updateProjs(dt: number) {
    for (const p of this.projs) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.homing > 0 && p.from === 'player') { const n = this.nearestEnemy(p.x, p.y, 400, p.hit); if (n) { const want = Math.atan2(n.agent.y - 14 - p.y, n.agent.x - p.x); const cur = Math.atan2(p.vy, p.vx); const sp = Math.hypot(p.vx, p.vy); const na = cur + Phaser.Math.Angle.Wrap(want - cur) * Math.min(1, p.homing * 4 * dt); p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp; p.sprite.setRotation(na); } }
      p.x += p.vx * dt; p.y += p.vy * dt; p.sprite.setPosition(p.x, p.y);
      if (p.x < ROOM.x0 - 20 || p.x > ROOM.x1 + 20 || p.y < ROOM.y0 - 40 || p.y > ROOM.y1 + 20) { p.life = 0; continue; }
      if (this.layout && shotBlocked(this.layout, p.x, p.y + 18)) { p.life = 0; this.fxAt('fx_hit', p.x, p.y, 26); continue; } // v2 rooms: cover stops shots (liquid does not)
      if (p.from === 'enemy') {
        if (Math.hypot(p.x - this.px, p.y - (this.py - 16)) < p.r + 12) {
          if (this.ws.guarding && this.wcfg.hasGuard) { const g = guardBlock(this.ws, this.wcfg, this.facing, Math.atan2(p.y - this.py, p.x - this.px), this.run.mp); if (g.blocked) { this.spendMp(g.mpCost); sfx('guard'); p.life = 0; G.logEvent('guard', { perfect: g.perfect, proj: true }); if (g.perfect) { this.floatText(this.px, this.py - 60, 'Đỡ hoàn hảo!', '#ffcb6b'); CFX.reflect(this as any, p); } continue; } }
          if (this.iframes <= 0 && this.dashT <= 0) { this.hurtPlayer(p.dmg, p.x - p.vx * 0.05, p.y - p.vy * 0.05); p.life = 0; } else if (this.dashT > 0) CFX.dodged(this as any);
        }
      } else {
        for (const e of this.enemies) {
          if (e.dead || p.hit.has(e)) continue;
          if (Math.hypot(p.x - e.agent.x, p.y - (e.agent.y - 14)) < p.r + e.radius) {
            if (e.brain && (e as any).reflect) { p.from = 'enemy'; p.vx *= -1; p.vy *= -1; p.dmg = e.dmg; p.life = 3; break; }
            p.hit.add(e);
            if (p.explode) { this.radialDamage(p.x, p.y, p.explode, p.dmg * 0.6, p.element, 'fx_explosion'); }
            const hs = p.hit.size === 1 ? p.hs : undefined, shk = p.hit.size === 1 ? p.shk : undefined; // skill feel on the first hit only
            this.hitEnemy(e, p.dmg ? { flat: p.dmg, status: p.status, element: p.element, spell: p.spell, shownCrit: p.shownCrit, hs, shk, fromX: p.x - p.vx * 0.1, fromY: p.y - p.vy * 0.1 } : { coef: p.coef, magicShare: p.magicShare, hs, shk, fromX: p.x - p.vx * 0.1, fromY: p.y - p.vy * 0.1, knock: Math.atan2(p.vy, p.vx), knockMul: 0.5 });
            if (p.pierce-- <= 0) { p.life = 0; break; }
          }
        }
      }
    }
    let n = 0; for (const p of this.projs) { if (p.life > 0) this.projs[n++] = p; else if (p.sprite.active) releaseImage(p.sprite); } this.projs.length = n; // in-place, pooled
  }
  updateHazards(dt: number) {
    for (const h of this.hazards) {
      h.t += dt; const g = h.g; g.clear();
      this.telegraphArt(h);
      switch (h.kind) {
        case 'circle': {
          if (h.dmg === 0 && h.life === -1) { const p = Math.min(1, h.t / h.delay); g.lineStyle(3, 0xe2483d, 0.9).strokeCircle(h.x, h.y, h.r).fillStyle(0xe2483d, 0.15 + p * 0.25).fillCircle(h.x, h.y, h.r * p); if (h.t >= h.delay) h.done = true; break; }
          const p = Math.min(1, h.t / Math.max(0.01, h.delay));
          const col = h.fromPlayer ? 0xffb040 : 0xe2483d;
          g.fillStyle(col, 0.18).fillCircle(h.x, h.y, h.r).fillStyle(col, 0.35).fillCircle(h.x, h.y, h.r * p).lineStyle(3, col, 0.95).strokeCircle(h.x, h.y, h.r);
          if (h.t >= h.delay) {
            h.done = true; this.fxAt('fx_explosion', h.x, h.y - 10, h.r * 2); sfx('explode');
            if (h.fromPlayer) { for (const e of this.enemies) if (!e.dead && Math.hypot(e.agent.x - h.x, e.agent.y - h.y) < h.r + e.radius) { this.hitEnemy(e, { flat: h.dmg, status: h.status, element: 'fire', noTrigger: true }); if (h.status) this.applyEnemyStatus(e, h.status, 1); } }
            else if (Math.hypot(this.px - h.x, this.py - h.y) < h.r + 8) this.hurtPlayer(h.dmg, h.x, h.y);
          }
          break;
        }
        case 'line': {
          const e = h.follow; if (e && !e.dead) { h.x = e.agent.x; h.y = e.agent.y; }
          const x2 = h.x + Math.cos(h.angle!) * h.len!, y2 = h.y + Math.sin(h.angle!) * h.len!;
          g.lineStyle(h.width!, 0xe2483d, 0.25 + 0.3 * Math.min(1, h.t / h.delay)).lineBetween(h.x, h.y, x2, y2);
          if (h.t >= h.delay) h.done = true; break;
        }
        case 'laser': {
          const e = h.follow; if (e && !e.dead) { h.x = e.agent.x; h.y = e.agent.y - 40; } else if (e?.dead) { h.done = true; break; }
          const firing = h.t >= h.delay; const k = firing ? Math.min(1, (h.t - h.delay) / h.dur!) : 0;
          for (let b = 0; b < (h.beams ?? 1); b++) {
            const a = h.angle! + h.sweep! * k + b * (Math.PI * 2 / (h.beams ?? 1));
            const x2 = h.x + Math.cos(a) * h.len!, y2 = h.y + Math.sin(a) * h.len!;
            if (!firing) g.lineStyle(2, 0xe2483d, 0.8).lineBetween(h.x, h.y, x2, y2);
            else { g.lineStyle(h.width!, 0xff6a5a, 0.85).lineBetween(h.x, h.y, x2, y2).lineStyle(h.width! * 0.4, 0xffffff, 0.9).lineBetween(h.x, h.y, x2, y2); if (this.segDist(this.px, this.py - 16, h.x, h.y, x2, y2) < h.width! / 2 + 8) this.hurtPlayer(h.dmg, h.x, h.y); }
          }
          if (firing && h.t >= h.delay + h.dur!) h.done = true; break;
        }
        case 'mine': {
          const armed = h.t >= h.delay; g.fillStyle(armed ? 0xe2483d : 0x8a6a4a, 1).fillCircle(h.x, h.y, 9).lineStyle(2, PAL.outline, 1).strokeCircle(h.x, h.y, 9);
          if (armed) g.lineStyle(1, 0xe2483d, 0.4 + 0.3 * Math.sin(h.t * 10)).strokeCircle(h.x, h.y, h.r);
          if ((armed && Math.hypot(this.px - h.x, this.py - h.y) < h.r * 0.6) || h.t >= h.life!) { h.done = true; this.fxAt('fx_explosion', h.x, h.y, h.r * 2); sfx('explode'); if (Math.hypot(this.px - h.x, this.py - h.y) < h.r) this.hurtPlayer(h.dmg, h.x, h.y); }
          break;
        }
        case 'trail': case 'tornado': {
          const a = Math.max(0, 1 - h.t / h.life!);
          if (h.kind === 'trail') g.fillStyle(h.status === 'frostbite' ? 0x9be4ff : h.status === 'burn' ? 0xff8a3a : h.status === 'shock' ? 0xfff07a : 0xe8dcc0, 0.4 * a).fillCircle(h.x, h.y, h.r);
          else { g.lineStyle(4, 0xdff6ff, 0.8 * a); for (let i = 0; i < 3; i++) g.strokeCircle(h.x, h.y - 10, h.r * (0.4 + 0.3 * i) * (1 + 0.1 * Math.sin(h.t * 12 + i))); }
          h.tick! -= dt;
          if (h.tick! <= 0) { h.tick = 0.5; for (const e of this.enemies) if (!e.dead && !e.dummy && Math.hypot(e.agent.x - h.x, e.agent.y - h.y) < h.r + e.radius) { this.hitEnemy(e, { flat: h.dmg, noTrigger: true, status: h.status }); if (h.kind === 'tornado' && !e.boss) { e.kvx += (h.x - e.agent.x) * 2; e.kvy += (h.y - e.agent.y) * 2; } } }
          if (h.t >= h.life!) h.done = true; break;
        }
      }
    }
    for (const h of this.hazards) if (h.done) { h.g.destroy(); h.art?.destroy(); }
    this.hazards = this.hazards.filter((h) => !h.done);
  }
  /** Art telegraph sprites (fx_telegraph_circle centred; fx_telegraph_line anchored [0,0.5] and stretched along X) over the graphics marker. */
  telegraphArt(h: Hazard) {
    const tele = (h.kind === 'circle' && h.t < h.delay && !h.fromPlayer) || h.kind === 'line';
    if (!tele) { if (h.art) { h.art.destroy(); h.art = undefined; } return; }
    const key = h.kind === 'line' ? 'fx_telegraph_line' : 'fx_telegraph_circle';
    if (!h.art) {
      if (!MANIFEST[key] || !this.textures.exists(key)) return;
      h.art = this.add.sprite(h.x, h.y, key).setDepth(4).setAlpha(0.9); applyEntry(h.art, key, 0, h.kind === 'line' ? [0, 0.5] : [0.5, 0.5]); playAnim(h.art, key, 'loop');
    }
    if (h.kind === 'line') h.art.setPosition(h.x, h.y).setRotation(h.angle!).setDisplaySize(h.len!, Math.max(24, h.width!));
    else h.art.setPosition(h.x, h.y).setDisplaySize(h.r * 2, h.r * 2);
  }
  dropPickup(x: number, y: number, kind: 'money' | 'xp', value: number) {
    const k = kind === 'money' ? 'ic_money' : 'orb_levelup'; const r = iconRef(this, k);
    const s = this.add.image(x + Phaser.Math.Between(-12, 12), y + Phaser.Math.Between(-8, 8), r.tex, r.frame).setDisplaySize(kind === 'money' ? 22 : 14, kind === 'money' ? 22 : 14).setDepth(6);
    if (kind === 'xp') s.setTint(0x9be47a);
    this.pickups.push({ x: s.x, y: s.y, kind, value, sprite: s, t: 0 });
  }
  burstCoins(x: number, y: number, n: number) { for (let i = 0; i < n; i++) { const r = iconRef(this, 'ic_money'); const s = this.add.image(x, y, r.tex, r.frame).setDisplaySize(20, 20).setDepth(4000); this.tweens.add({ targets: s, x: x + Phaser.Math.Between(-80, 80), y: y - Phaser.Math.Between(20, 90), alpha: 0, duration: 600, onComplete: () => s.destroy() }); } }
  updatePickups(dt: number) {
    for (const p of this.pickups) {
      p.t += dt; const d = Math.hypot(p.x - this.px, p.y - this.py);
      if (p.t > 0.3 && (d < 140 || !this.fighting)) { const a = Math.atan2(this.py - p.y, this.px - p.x); const sp = 520; p.x += Math.cos(a) * sp * dt; p.y += Math.sin(a) * sp * dt; p.sprite.setPosition(p.x, p.y); }
      if (d < 20) {
        p.t = -99; p.sprite.destroy();
        if (p.kind === 'money') { const bonus = 1; this.run.money += Math.round(p.value * bonus); sfx('coin'); }
        else { const ups = gainXp(this.run, G.meta, p.value); sfx('pickup'); if (ups > 0) { this.recalcStats(); this.levelUpFx(); } }
      }
    }
    this.pickups = this.pickups.filter((p) => p.t >= 0);
  }
  levelUpFx() { sfx('levelup'); this.fxAt('fx_levelup', this.px, this.py - 20, 110); toast(this, `${t('levelup')} ${t('hud.level')} ${this.run.level}`, '#ffcb6b'); this.recalcStats(); G.logEvent('levelUp', { level: this.run.level }); }

  // ---------------- companions ----------------
  spawnCompanions() {
    for (const c of this.comps) c.sprite.destroy(); this.comps = [];
    const sums = this.bundle.summons; if (!sums.length || !this.hero) return;
    const n = companionSlots(this.sp, sums.length);
    for (let i = 0; i < n; i++) {
      const s = sums[i % sums.length]; const k = s.e.companion; tex(this, k, 'npc');
      const sp = this.add.sprite(this.px - 30 - i * 20, this.py, k); applyEntry(sp, k, 30, [0.5, 0.9]); playAnim(sp, k, 'idle');
      this.comps.push({ key: k, sprite: sp, dmg: s.value, cd: 1 + i * 0.3, x: this.px - 30 - i * 20, y: this.py, kind: k });
    }
  }
  updateCompanions(dt: number) {
    const cm = companionMods(this.sp);
    this.comps.forEach((c, i) => {
      const tx = this.px - Math.cos(this.time.now / 700 + i * 2) * 46, ty = this.py - 20 + Math.sin(this.time.now / 700 + i * 2) * 26;
      c.x += (tx - c.x) * Math.min(1, dt * 4); c.y += (ty - c.y) * Math.min(1, dt * 4); c.sprite.setPosition(c.x, c.y).setDepth(c.y);
      c.cd -= dt * cm.haste;
      if (c.cd <= 0) {
        const n = this.nearestEnemy(c.x, c.y, 380); if (!n || n.dummy && this.mode !== 'training') { c.cd = 0.3; return; }
        c.cd = c.kind === 'cmp_bat' ? 0.8 : 1.2;
        const crit = Math.random() * 100 < cm.crit; const dmg = Math.round(c.dmg * cm.damage * (crit ? 1.5 : 1));
        if (c.kind === 'cmp_sprout') this.spawnProj('pj_orb_magic', c.x, c.y, Math.atan2(n.agent.y - c.y, n.agent.x - c.x), 380, 7, 0, { flat: dmg, element: 'physical' });
        else if (c.kind === 'cmp_bat') { this.tweens.add({ targets: c, x: n.agent.x, y: n.agent.y - 14, duration: 120, yoyo: true }); this.hitEnemy(n, { flat: dmg, noTrigger: true }); this.healPlayer(dmg * 0.2, false); }
        else { this.zap(c.x, c.y, n.agent.x, n.agent.y - 14); this.hitEnemy(n, { flat: dmg, noTrigger: true, element: 'lightning' }); }
        if (cm.healPct && this.companionShareCd <= 0) { this.companionShareCd = 1; this.healPlayer(this.stats.maxHp * cm.healPct / 100, false); }
      }
    });
  }
  updateEffects(dt: number) {
    if (!this.fighting && this.mode !== 'training') return;
    for (const a of tickPeriodic(this.periodicTimers, this.bundle, this.ctx, dt, this.stats.cooldownPct)) this.doAction('periodic:' + a.action, a.amount, a.source);
  }
  updateInteracts() {
    const c = this.ctl; let near: Interact | null = null;
    for (const it of this.interacts) { if (it.used) continue; const d = Math.hypot(it.x - this.px, it.y - this.py); if (it.id === 'secret_wall') continue; if (d < it.r + 20) { near = it; break; } }
    for (const it of this.interacts) if (!it.used) it.label.setColor(it === near ? '#ffcb6b' : '#ffffff');
    const want = c.consume('interact');
    if (near && (near.auto || want)) { if (near.auto) near.auto = false; G.logEvent('interact', { id: near.id }); near.use(); }
  }
  checkRoom() {
    if (!this.fighting) return;
    const alive = this.enemies.filter((e) => !e.dead && !e.dummy && !e.decoy).length;
    if (alive > 0) return;
    if (this.isGate) return;
    // integration fix: wave 1 is spawned by the 500 ms delayed call in room setup; spawning it here as well made
    // waves 1 and 2 arrive together (v2 rooms always have 2+ waves)
    if (this.waveIdx === 0 && this.waves.length > 0) return;
    if (this.waveIdx < this.waves.length) { this.spawnWave(); return; }
    this.fighting = false; this.run.roomCleared = true; this.bossRef = null;
    for (const e of this.enemies) if (e.decoy && !e.dead) this.killEnemy(e);
    sfx('door'); toast(this, t('room.cleared'), '#a6e070');
    G.logEvent('roomCleared', { pos: this.run.pos });
    this.spawnReward(); this.openDoors(); G.saveRun();
  }
  depthSort() {
    this.hero.setDepth(this.py); this.shadow.setDepth(this.py - 2);
    for (const e of this.enemies) if (!e.dead) e.sprite.setDepth(e.agent.y);
  }

  // ---------------- helpers ----------------
  nearestEnemy(x: number, y: number, range: number, exclude?: Set<Enemy>): Enemy | null {
    let best: Enemy | null = null, bd = range;
    for (const e of this.enemies) { if (e.dead || (exclude && exclude.has(e))) continue; if (e.dummy && this.mode !== 'training') continue; const d = Math.hypot(e.agent.x - x, e.agent.y - y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  dist(a: { x: number; y: number }, b: { x: number; y: number }) { return Math.hypot(a.x - b.x, a.y - b.y); }
  segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) { const dx = x2 - x1, dy = y2 - y1; const l = dx * dx + dy * dy || 1; const tt = Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / l, 0, 1); return Math.hypot(px - (x1 + tt * dx), py - (y1 + tt * dy)); }
  fxAt(key: string, x: number, y: number, size: number) {
    poolFx(this, key, x, y, size); // pooled + capped (src/game/fxPool.ts)
  }
  zap(x1: number, y1: number, x2: number, y2: number) { SKF.bolt(this as any, x1, y1, x2, y2); } // pooled (one Graphics, src/systems/skillFx.ts)
  floatText(x: number, y: number, s: string, color: string, size = 20) {
    poolText(this, x, y, s, color, size); // pooled; digits use a runtime bitmap font (src/game/fxPool.ts)
  }
  // debug helpers
  debugClear() { for (const e of this.enemies) if (!e.dead && !e.dummy) this.killEnemy(e); this.waveIdx = this.waves.length; }
  debugKillBoss(): boolean { const b = this.enemies.find((e) => e.boss && !e.dead); if (!b) return false; b.hp = 0; this.killEnemy(b); return true; }
}
/** shared empty hit-set for enemy projectiles (only player projectiles record hits) — avoids a Set per bullet */
const NO_HITS: Set<any> = new Set();
const ELEMENT_FROM: Partial<Record<StatusId, Element>> = { burn: 'fire', frostbite: 'ice', shock: 'lightning', poison: 'physical', wound: 'physical' };
import { getCostume } from '../systems/registry';
function require_costume(id: string): string | null { return getCostume(id)?.sprite ?? null; }
void RARITY_COLOR; void SIM;
