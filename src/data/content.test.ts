import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ComboId, AiKind, Effect, Shape } from './types';
import artifacts from './artifacts';
import tablets from './tablets';
import combos from './combos';
import weapons from './weapons';
import weaponUpgrades from './weaponUpgrades';
import enemies from './enemies';
import bosses from './bosses';
import chapters from './chapters';
import miracles from './miracles';
import potions from './potions';
import destiny from './destiny';
import talents from './talents';
import costumes from './costumes';
import strings from './strings';

const COMBO_IDS: ComboId[] = ['glacier', 'ember', 'storm', 'guardian', 'shadow', 'lake', 'windsong', 'academy', 'companion', 'curse'];
const AI_KINDS: AiKind[] = ['chaser', 'charger', 'shooter', 'spread', 'ring', 'lobber', 'summoner', 'shielded', 'exploder', 'teleporter', 'turret', 'healer'];
const EFFECT_KINDS = ['stat', 'onHit', 'onKill', 'onDash', 'onHurt', 'periodic', 'conditional', 'spell', 'summon', 'special'];
const PATTERNS = ['ring', 'spiral', 'crossWave', 'aimedBurst', 'charge', 'slam', 'summon', 'laserSweep', 'rainMarkers', 'teleportStrike', 'shieldPhase', 'minefield'];
const MOD_KEYS = ['extraHit', 'specialCostPct', 'aspect', 'pierce', 'magazine', 'reloadPct', 'furyDuration', 'rangePct', 'arcPct', 'dashAttack',
  'guardCostPct', 'chargeSpeedPct', 'projectileCount', 'homing', 'critOnPerfect', 'knockbackPct', 'damagePct', 'attackSpeedPct'];
const GRANT_KEYS = ['homeRepair', 'talentPoints', 'seedMoney', 'startDice', 'bagCols', 'bagRows', 'sideBag', 'levelUpHeal', 'unlockWeapon',
  'unlockArtifacts', 'potionSlot', 'hardMode', 'pocketDimension', 'chestReroll'];
const ENEMY_IDS = [
  'slime_moss', 'mushroom_spore', 'beetle_charger', 'sprout_archer', 'bee_swarm',
  'rat_bandit', 'rat_bomber', 'rat_shield', 'mole_digger', 'rat_crossbow',
  'book_flyer', 'ink_blob', 'candle_mage', 'mirror_construct', 'quill_turret',
  'penguin_slider', 'ice_spirit', 'seal_lobber', 'frost_wolf', 'snow_golem_small',
  'gear_bot', 'steam_turret', 'raccoon_mechanic', 'drone_bomber', 'piston_brute',
  'star_shard', 'void_eye', 'comet_hound', 'nebula_healer', 'star_knight',
];
const BOSS_IDS = ['mb_thorn_boar', 'mb_rat_captain', 'mb_ink_golem', 'mb_yeti', 'mb_saw_crab', 'mb_dark_twin',
  'boss_mushroom_king', 'boss_rat_chief', 'boss_owl_librarian', 'boss_ice_walrus', 'boss_raccoon_golem', 'boss_fallen_star'];
const HERO_SPRITES = ['hero_bong', 'hero_scarecrow', 'hero_redcat', 'hero_frog', 'hero_fox', 'hero_knight'];

const unique = (ids: Array<string | number>) => new Set(ids).size === ids.length;
function connected(shape: Shape): boolean {
  const key = (c: [number, number]) => `${c[0]},${c[1]}`;
  const all = new Set(shape.map(key)); if (all.size !== shape.length) return false;
  const seen = new Set([key(shape[0])]); const stack = [shape[0]];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`; if (all.has(k) && !seen.has(k)) { seen.add(k); stack.push([x + dx, y + dy]); }
    }
  }
  return seen.size === all.size;
}
function kinds(e: Effect, out: Set<string>) { out.add(e.kind); if (e.kind === 'conditional') kinds(e.inner, out); }

describe('artifacts', () => {
  it('≥72, unique ids, icon rule', () => {
    expect(artifacts.length).toBeGreaterThanOrEqual(72);
    expect(unique(artifacts.map((a) => a.id))).toBe(true);
    for (const a of artifacts) expect(a.icon).toBe(`art_${a.id}`);
  });
  it('valid tags, every family ≥8, all rarities', () => {
    const count: Record<string, number> = {};
    for (const a of artifacts) {
      expect(a.tags.length).toBeGreaterThanOrEqual(1); expect(a.tags.length).toBeLessThanOrEqual(2);
      for (const t of a.tags) { expect(COMBO_IDS).toContain(t); count[t] = (count[t] ?? 0) + 1; }
    }
    for (const c of COMBO_IDS) expect(count[c] ?? 0, c).toBeGreaterThanOrEqual(8);
    for (const r of ['common', 'rare', 'epic', 'legendary']) expect(artifacts.some((a) => a.rarity === r)).toBe(true);
  });
  it('shapes connected, levels and prices sane', () => {
    const range: Record<string, [number, number]> = { common: [60, 120], rare: [150, 250], epic: [300, 450], legendary: [600, 900] };
    for (const a of artifacts) {
      expect(connected(a.shape), a.id).toBe(true);
      expect(a.maxLevel).toBeGreaterThanOrEqual(1); expect(a.maxLevel).toBeLessThanOrEqual(5);
      const [lo, hi] = range[a.rarity]; expect(a.price, a.id).toBeGreaterThanOrEqual(lo); expect(a.price, a.id).toBeLessThanOrEqual(hi);
      expect(a.effects.length).toBeGreaterThan(0);
      if (a.constraint?.kind === 'noOtherOfTag') expect(COMBO_IDS).toContain(a.constraint.tag);
      for (const w of a.weaponBias ?? []) expect(weapons.map((x) => x.id)).toContain(w);
    }
  });
  it('uses every effect kind, ≥10 constraints, ~24 default unlocks', () => {
    const k = new Set<string>(); for (const a of artifacts) for (const e of a.effects) kinds(e, k);
    for (const kind of EFFECT_KINDS) expect(k.has(kind), kind).toBe(true);
    expect(artifacts.filter((a) => a.constraint).length).toBeGreaterThanOrEqual(10);
    const d = artifacts.filter((a) => a.unlockedByDefault).length; expect(d).toBeGreaterThanOrEqual(20); expect(d).toBeLessThanOrEqual(40);
  });
  it('spells only on academy, summons only on companion; onHit chances are probabilities', () => {
    for (const a of artifacts) for (const e of a.effects) {
      if (e.kind === 'spell') expect(a.tags).toContain('academy');
      if (e.kind === 'summon') { expect(a.tags).toContain('companion'); expect(e.companion).toMatch(/^cmp_(sprout|bat|wisp)$/); }
      if (e.kind === 'onHit') { expect(e.chance).toBeGreaterThan(0); expect(e.chance).toBeLessThan(1); }
    }
  });
});

describe('tablets', () => {
  it('≥24, unique ids, icon rule, shapes connected, targets outside own footprint', () => {
    expect(tablets.length).toBeGreaterThanOrEqual(24);
    expect(unique(tablets.map((t) => t.id))).toBe(true);
    expect(unique([...tablets.map((t) => t.id), ...artifacts.map((a) => a.id)])).toBe(true);
    const ops = new Set<string>();
    for (const t of tablets) {
      expect(t.icon).toBe(`tab_${t.id}`); expect(connected(t.shape)).toBe(true); expect(t.targets.length).toBeGreaterThan(0);
      const own = new Set(t.shape.map((c) => `${c[0]},${c[1]}`));
      for (const tg of t.targets) { expect(own.has(`${tg.at[0]},${tg.at[1]}`), t.id).toBe(false); ops.add(tg.op.op); }
    }
    for (const o of ['level', 'ignoreConstraint', 'maxLevel', 'doubleTags', 'copy']) expect(ops.has(o), o).toBe(true);
  });
});

describe('combos', () => {
  it('all 10 families, ascending thresholds, icon rule', () => {
    expect(combos.map((c) => c.id).sort()).toEqual([...COMBO_IDS].sort());
    for (const c of combos) {
      expect(c.icon).toBe(`combo_${c.id}`); expect(c.tiers.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < c.tiers.length; i++) expect(c.tiers[i].count).toBeGreaterThan(c.tiers[i - 1].count);
      for (const t of c.tiers) expect(t.effects.length).toBeGreaterThan(0);
      const family = artifacts.filter((a) => a.tags.includes(c.id)).length;
      expect(family).toBeGreaterThanOrEqual(c.tiers[c.tiers.length - 1].count);
    }
  });
});

describe('weapons & upgrades', () => {
  it('6 weapons with icon/sprite rules', () => {
    expect(weapons.map((w) => w.id).sort()).toEqual(['crossbow', 'dagger', 'greatsword', 'katana', 'staff', 'swordshield']);
    for (const w of weapons) { expect(w.icon).toBe(`wic_${w.id}`); expect(w.sprite).toBe(`wpn_${w.id}`); expect(w.baseCoef.length).toBeGreaterThan(0); }
  });
  it('≥8 upgrades per weapon, tiers 1–3, requires/excludes resolve, mod keys in vocabulary', () => {
    const ids = new Set(weaponUpgrades.map((u) => u.id)); expect(ids.size).toBe(weaponUpgrades.length);
    for (const w of weapons) {
      const list = weaponUpgrades.filter((u) => u.weapon === w.id); expect(list.length, w.id).toBeGreaterThanOrEqual(8);
      for (const tier of [1, 2, 3]) expect(list.some((u) => u.tier === tier), `${w.id} t${tier}`).toBe(true);
    }
    for (const u of weaponUpgrades) {
      for (const r of [...(u.requires ?? []), ...(u.excludes ?? [])]) {
        expect(ids.has(r), `${u.id} → ${r}`).toBe(true);
        expect(weaponUpgrades.find((x) => x.id === r)!.weapon).toBe(u.weapon);
      }
      for (const r of u.requires ?? []) expect(weaponUpgrades.find((x) => x.id === r)!.tier).toBeLessThan(u.tier);
      for (const m of u.mods) expect(MOD_KEYS, m.key).toContain(m.key);
    }
  });
});

describe('enemies, bosses, chapters', () => {
  it('exactly the 30 asset enemies, sprite rule, every AiKind', () => {
    expect(enemies.map((e) => e.id).sort()).toEqual([...ENEMY_IDS].sort());
    for (const e of enemies) { expect(e.sprite).toBe(`en_${e.id}`); expect(e.hp).toBeGreaterThan(0); expect(e.money[0]).toBeLessThanOrEqual(e.money[1]); }
    for (const k of AI_KINDS) expect(enemies.some((e) => e.ai === k), k).toBe(true);
  });
  it('12 bosses, sprite = id, phase rules, pattern vocabulary', () => {
    expect(bosses.map((b) => b.id).sort()).toEqual([...BOSS_IDS].sort());
    const enemyIds = new Set(enemies.map((e) => e.id));
    for (const b of bosses) {
      expect(b.sprite).toBe(b.id);
      expect(b.phases.length).toBe(b.mini ? 2 : 3);
      expect(b.phases[0].hpBelow).toBe(1);
      if (!b.mini) expect(b.phases.map((p) => p.hpBelow)).toEqual([1, 0.66, 0.33]);
      for (const p of b.phases) {
        expect(p.attacks.length).toBeGreaterThan(0);
        for (const a of p.attacks) expect(PATTERNS, `${b.id}.${a.id}`).toContain(a.pattern);
        for (const s of p.summon ?? []) expect(enemyIds.has(s), s).toBe(true);
        if (p.attacks.some((a) => a.pattern === 'summon')) expect((p.summon ?? []).length, `${b.id} summon list`).toBeGreaterThan(0);
      }
    }
    const used = new Set(bosses.flatMap((b) => b.phases.flatMap((p) => p.attacks.map((a) => a.pattern))));
    for (const p of PATTERNS) expect(used.has(p), p).toBe(true);
  });
  it('6 chapters reference existing enemies of that chapter and bosses', () => {
    expect(chapters.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const c of chapters) {
      expect(c.tileset).toBe(`ts_ch${c.id}`); expect(c.enemies.length).toBe(5);
      for (const id of c.enemies) { const e = enemies.find((x) => x.id === id); expect(e, id).toBeTruthy(); expect(e!.chapter).toBe(c.id); }
      const mb = bosses.find((b) => b.id === c.miniBoss); const bb = bosses.find((b) => b.id === c.boss);
      expect(mb?.mini).toBe(true); expect(bb?.mini).toBe(false); expect(mb!.chapter).toBe(c.id); expect(bb!.chapter).toBe(c.id);
    }
  });
});

describe('meta content', () => {
  it('miracles, potions', () => {
    expect(miracles.length).toBe(8); expect(unique(miracles.map((m) => m.id))).toBe(true);
    expect(miracles.map((m) => m.icon).sort()).toEqual(['mir_1', 'mir_2', 'mir_3', 'mir_4', 'mir_5', 'mir_6', 'mir_7', 'mir_8']);
    expect(potions.length).toBe(6);
    for (const p of potions) expect(['pot_heal', 'pot_rage', 'pot_iron', 'pot_swift', 'pot_mystery', 'pot_mana']).toContain(p.icon);
    expect(unique(potions.map((p) => p.icon))).toBe(true);
  });
  it('destiny tree: ≥30 nodes, requires resolve, single root, grant keys, 25 talent points, acyclic', () => {
    expect(destiny.length).toBeGreaterThanOrEqual(30);
    const ids = new Set(destiny.map((d) => d.id)); expect(ids.size).toBe(destiny.length);
    expect(destiny.filter((d) => d.requires.length === 0).length).toBe(1);
    const pos = new Set(destiny.map((d) => d.pos.join(','))); expect(pos.size).toBe(destiny.length);
    for (const d of destiny) {
      for (const r of d.requires) expect(ids.has(r), `${d.id} → ${r}`).toBe(true);
      expect(GRANT_KEYS, d.grant.key).toContain(d.grant.key);
      if (d.grant.key === 'unlockWeapon') expect(weapons.map((w) => w.id)).toContain(d.grant.value);
    }
    expect(destiny.filter((d) => d.grant.key === 'talentPoints').reduce((s, d) => s + Number(d.grant.value), 0)).toBe(25);
    const weaponsUnlocked = destiny.filter((d) => d.grant.key === 'unlockWeapon').map((d) => d.grant.value).sort();
    expect(weaponsUnlocked).toEqual(['crossbow', 'dagger', 'greatsword', 'katana', 'staff']);
    const byId = new Map(destiny.map((d) => [d.id, d])); const done = new Set<string>();
    const visit = (id: string, stack: Set<string>) => { if (done.has(id)) return; expect(stack.has(id), `cycle at ${id}`).toBe(false); stack.add(id); for (const r of byId.get(id)!.requires) visit(r, stack); stack.delete(id); done.add(id); };
    for (const d of destiny) visit(d.id, new Set());
  });
  it('talents ≥12 with ≥25 total ranks; costumes match hero sprites', () => {
    expect(talents.length).toBeGreaterThanOrEqual(12);
    expect(talents.reduce((s, t) => s + t.maxRank, 0)).toBeGreaterThanOrEqual(25);
    expect(costumes.map((c) => c.sprite).sort()).toEqual([...HERO_SPRITES].sort());
    const itemIds = new Set(artifacts.map((a) => a.id));
    for (const c of costumes) for (const s of c.startItems ?? []) expect(itemIds.has(s), s).toBe(true);
    expect(costumes.filter((c) => c.unlock === null).length).toBe(1);
  });
  it('strings: Vietnamese UI with core keys', () => {
    for (const k of ['game.title', 'hud.level', 'inv.title', 'node.roots', 'mod.derangement', 'ev.blood', 'tut.move', 'res.toHub'])
      expect(strings[k], k).toBeTruthy();
    for (const c of COMBO_IDS) expect(strings[`combo.${c}`]).toBeTruthy();
    expect(Object.keys(strings).length).toBeGreaterThan(200);
  });
});

describe('icons_items atlas', () => {
  it('has a 96×96 frame for every artifact and tablet icon and is registered in manifest.icons.json', () => {
    const base = fileURLToPath(new URL('../../public/assets/', import.meta.url));
    const atlasPath = base + 'sprites/icons_items.json';
    expect(existsSync(atlasPath)).toBe(true);
    const frames = JSON.parse(readFileSync(atlasPath, 'utf8')).frames;
    for (const icon of [...artifacts.map((a) => a.icon), ...tablets.map((t) => t.icon)]) {
      expect(frames[icon], icon).toBeTruthy(); expect(frames[icon].frame.w).toBe(96); expect(frames[icon].frame.h).toBe(96);
    }
    const man = JSON.parse(readFileSync(base + 'manifest.icons.json', 'utf8'));
    expect(man.icons_items).toEqual({ type: 'atlas', file: 'sprites/icons_items.png', atlas: 'sprites/icons_items.json' });
  });
});
