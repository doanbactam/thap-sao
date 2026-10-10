// SHARED CONTRACT between engine (src/systems, src/scenes) and content (src/data/*).
// Change only by appending optional fields; never rename. Engine reads data only through these types.

export type Element = 'physical' | 'fire' | 'ice' | 'lightning';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ComboId =
  | 'glacier' | 'ember' | 'storm' | 'guardian' | 'shadow'
  | 'lake' | 'windsong' | 'academy' | 'companion' | 'curse';
export type WeaponId = 'swordshield' | 'greatsword' | 'dagger' | 'katana' | 'crossbow' | 'staff';
export type StatKey =
  | 'maxHp' | 'maxMp' | 'mpRegen' | 'physical' | 'fire' | 'ice' | 'lightning' | 'magic'
  | 'defense' | 'evasion' | 'critChance' | 'critDamage' | 'attackSpeed' | 'moveSpeed'
  | 'dashCount' | 'dashRecovery' | 'luck' | 'barter' | 'lifesteal' | 'damagePct' | 'cooldownPct';

/** Cell offsets [x,y] relative to the piece origin at rotation 0. */
export type Shape = Array<[number, number]>;

/** Generic effect description interpreted by src/systems/effects.ts. Scaled by level where noted. */
export type Effect =
  | { kind: 'stat'; stat: StatKey; base: number; perLevel: number; pct?: boolean }
  | { kind: 'onHit'; chance: number; perLevel: number; apply: StatusId; stacks?: number }
  | { kind: 'onKill'; action: 'heal' | 'mp' | 'money' | 'explode'; base: number; perLevel: number }
  | { kind: 'onDash'; action: 'trail' | 'shockwave' | 'shield' | 'heal'; base: number; perLevel: number }
  | { kind: 'onHurt'; action: 'thorns' | 'nova' | 'mp'; base: number; perLevel: number }
  | { kind: 'periodic'; every: number; action: 'orb' | 'lightning' | 'meteor' | 'heal' | 'frostRing'; base: number; perLevel: number }
  | { kind: 'conditional'; when: 'hpBelow50' | 'fullHp' | 'mpAbove50' | 'noDashLeft' | 'bossRoom'; inner: Effect }
  | { kind: 'spell'; spell: SpellId; mpCost: number; cooldown: number; base: number; perLevel: number }
  | { kind: 'summon'; companion: string; base: number; perLevel: number }
  | { kind: 'special'; id: string; base: number; perLevel: number }; // engine-implemented unique hook

export type StatusId = 'burn' | 'frostbite' | 'shock' | 'poison' | 'wound' | 'stun';
export type SpellId = 'icebolt' | 'fireball' | 'chainLightning' | 'arcaneMissiles' | 'shieldBubble' | 'blink';

export type Constraint =
  | { kind: 'touchEdge'; edge: 'left' | 'right' | 'top' | 'bottom' }
  | { kind: 'emptyNeighbor'; dir: 'left' | 'right' | 'up' | 'down' }
  | { kind: 'cornerOnly' }
  | { kind: 'noOtherOfTag'; tag: ComboId };

export interface ArtifactDef {
  id: string; name: string; desc: string;           // VN text; desc may use {v} for current scaled value
  rarity: Rarity; maxLevel: number; shape: Shape;
  tags: ComboId[]; effects: Effect[]; constraint?: Constraint;
  icon: string;                                      // asset key in ASSETS manifest (icons atlas frame)
  price: number; weaponBias?: WeaponId[]; unlockedByDefault?: boolean;
}

export type TabletOp =
  | { op: 'level'; amount: number }          // +1, +2, -1
  | { op: 'ignoreConstraint' }
  | { op: 'maxLevel'; amount: number }
  | { op: 'doubleTags' }
  | { op: 'copy' };                           // target copies effects of the artifact opposite the tablet
export interface TabletDef {
  id: string; name: string; desc: string; rarity: Rarity; shape: Shape;
  /** relative cells (at rotation 0, from tablet origin) and the op applied to the artifact occupying them */
  targets: Array<{ at: [number, number]; op: TabletOp }>;
  icon: string; price: number; unlockedByDefault?: boolean;
}

export interface ComboDef {
  id: ComboId; name: string; desc: string; icon: string;
  tiers: Array<{ count: number; text: string; effects: Effect[] }>;
}

export interface WeaponUpgradeDef {
  id: string; weapon: WeaponId; tier: 1 | 2 | 3; name: string; desc: string;
  requires?: string[]; excludes?: string[];
  mods: Array<{ key: string; value: number | string | boolean }>; // read by weapon code, e.g. {key:'extraHit',value:1}
}

export interface WeaponDef {
  id: WeaponId; name: string; desc: string; icon: string; sprite: string;
  element: Element; baseCoef: number[];        // per combo hit
  range: number; arc: number; attackInterval: number; specialMp: number;
  hasGuard?: boolean; magazine?: number; reload?: number;
}

export type AiKind = 'chaser' | 'charger' | 'shooter' | 'spread' | 'ring' | 'lobber' | 'summoner'
  | 'shielded' | 'exploder' | 'teleporter' | 'turret' | 'healer';
export interface EnemyDef {
  id: string; name: string; chapter: number; ai: AiKind; sprite: string;
  hp: number; damage: number; speed: number; xp: number; money: [number, number];
  radius: number; params?: Record<string, number>; elite?: boolean;
}

export interface BossAttack { id: string; pattern: string; params: Record<string, number>; weight: number }
export interface BossDef {
  id: string; name: string; title: string; chapter: number; mini: boolean; sprite: string;
  hp: number; damage: number; speed: number; radius: number;
  phases: Array<{ hpBelow: number; attacks: BossAttack[]; summon?: string[]; onEnter?: string }>;
  reward: { sapphire: number; money: number };
}

export type NodeType = 'levelup' | 'artifact' | 'enchant' | 'tablet' | 'money' | 'heart' | 'anvil' | 'dice' | 'shop' | 'roots';
export type NodeModifier = 'none' | 'derangement' | 'miniboss';
export type EventId = 'arena' | 'secret' | 'clover' | 'merchant' | 'obelisk' | 'fountain' | 'companion' | 'blood' | 'pocket';

export interface ChapterDef {
  id: number; name: string; tileset: string; music?: string;
  enemies: string[]; miniBoss: string; boss: string; tint?: number;
}

export interface MiracleDef { id: string; name: string; desc: string; icon: string; effects: Effect[] }
export interface PotionDef { id: string; name: string; desc: string; icon: string; action: string; value: number; duration?: number }

export interface DestinyNode {
  id: string; name: string; desc: string; cost: number; requires: string[];
  pos: [number, number];                        // layout on the tree screen
  grant: { key: string; value: number | string }; // read by meta system e.g. {key:'talentPoints',value:5}
}
export interface TalentDef { id: string; name: string; desc: string; maxRank: number; stat: StatKey; perRank: number; pct?: boolean }
export interface CostumeDef {
  id: string; name: string; desc: string; sprite: string;
  stats: Partial<Record<StatKey, number>>; fixedHp?: number;
  startItems?: string[]; unlock: { kind: string; value: number; text: string } | null;
}
