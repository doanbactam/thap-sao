// Engine-owned fallback content. Used by src/systems/registry.ts only when the content agent's
// src/data/<name>.ts file is missing or empty. Generated procedurally so the game is always playable.
import type {
  ArtifactDef, TabletDef, ComboDef, WeaponDef, WeaponUpgradeDef, EnemyDef, BossDef, ChapterDef,
  MiracleDef, PotionDef, DestinyNode, TalentDef, CostumeDef, ComboId, Effect, Rarity, Shape, Constraint, WeaponId, StatKey,
} from '../../data/types';

const COMBOS: ComboId[] = ['glacier', 'ember', 'storm', 'guardian', 'shadow', 'lake', 'windsong', 'academy', 'companion', 'curse'];
const COMBO_VN: Record<ComboId, string> = {
  glacier: 'Băng Hà', ember: 'Than Hồng', storm: 'Mây Giông', guardian: 'Hộ Vệ', shadow: 'Bóng Đêm',
  lake: 'Hồ Thu', windsong: 'Gió Hát', academy: 'Học Viện', companion: 'Đồng Hành', curse: 'Lời Nguyền',
};

export const combos: ComboDef[] = COMBOS.map((id): ComboDef => {
  const t3 = id === 'companion' || id === 'curse';
  const counts = t3 ? [3, 5] : [2, 4, 6];
  const eff = (n: number): Effect[] => {
    switch (id) {
      case 'glacier': return [{ kind: 'onHit', chance: 0.1 * n, perLevel: 0, apply: 'frostbite', stacks: 1 }, { kind: 'stat', stat: 'ice', base: 3 * n, perLevel: 0 }];
      case 'ember': return [{ kind: 'onHit', chance: 0.1 * n, perLevel: 0, apply: 'burn', stacks: 1 }, { kind: 'stat', stat: 'fire', base: 3 * n, perLevel: 0 }];
      case 'storm': return [{ kind: 'onHit', chance: 0.08 * n, perLevel: 0, apply: 'shock' }, { kind: 'stat', stat: 'lightning', base: 3 * n, perLevel: 0 }];
      case 'guardian': return [{ kind: 'stat', stat: 'defense', base: 5 * n, perLevel: 0 }];
      case 'shadow': return [{ kind: 'stat', stat: 'evasion', base: 4 * n, perLevel: 0 }, { kind: 'stat', stat: 'dashRecovery', base: 10 * n, perLevel: 0 }];
      case 'lake': return [{ kind: 'stat', stat: 'maxMp', base: 10 * n, perLevel: 0 }, { kind: 'stat', stat: 'mpRegen', base: 1 * n, perLevel: 0 }];
      case 'windsong': return [{ kind: 'stat', stat: 'moveSpeed', base: 5 * n, perLevel: 0 }, { kind: 'onDash', action: 'shockwave', base: 6 * n, perLevel: 0 }];
      case 'academy': return [{ kind: 'stat', stat: 'magic', base: 4 * n, perLevel: 0 }, { kind: 'stat', stat: 'cooldownPct', base: 5 * n, perLevel: 0 }];
      case 'companion': return [{ kind: 'summon', companion: n > 1 ? 'cmp_wisp' : 'cmp_sprout', base: 6 * n, perLevel: 0 }];
      case 'curse': return [{ kind: 'stat', stat: 'damagePct', base: 6 * n, perLevel: 0 }, { kind: 'onHit', chance: 0.1 * n, perLevel: 0, apply: 'poison' }];
    }
  };
  return {
    id, name: COMBO_VN[id], desc: `Bộ ${COMBO_VN[id]}`, icon: `combo_${id}`,
    tiers: counts.map((count, i) => ({ count, text: `${count} món: cấp ${i + 1}`, effects: eff(i + 1) })),
  };
});

// ---------- artifacts ----------
const SHAPES: Shape[] = [
  [[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [1, 0], [2, 0]],
];
const RAR: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const RAR_PRICE: Record<Rarity, number> = { common: 120, rare: 240, epic: 420, legendary: 700 };
interface Tpl { name: string; tags: ComboId[]; eff: (r: number) => Effect[]; c?: Constraint }
const TPL: Tpl[] = [
  { name: 'Bông Tuyết', tags: ['glacier'], eff: r => [{ kind: 'onHit', chance: 0.12 + r * 0.04, perLevel: 0.03, apply: 'frostbite', stacks: 1 }] },
  { name: 'Than Đỏ', tags: ['ember'], eff: r => [{ kind: 'onHit', chance: 0.12 + r * 0.04, perLevel: 0.03, apply: 'burn', stacks: 1 }] },
  { name: 'Chuông Sấm', tags: ['storm'], eff: r => [{ kind: 'onHit', chance: 0.1 + r * 0.03, perLevel: 0.03, apply: 'shock' }] },
  { name: 'Khiên Gỗ', tags: ['guardian'], eff: r => [{ kind: 'stat', stat: 'defense', base: 4 + r * 2, perLevel: 2 }] },
  { name: 'Áo Choàng Đêm', tags: ['shadow'], eff: r => [{ kind: 'stat', stat: 'evasion', base: 3 + r * 2, perLevel: 1.5 }] },
  { name: 'Giọt Hồ', tags: ['lake'], eff: r => [{ kind: 'stat', stat: 'maxMp', base: 8 + r * 4, perLevel: 4 }] },
  { name: 'Lông Vũ', tags: ['windsong'], eff: r => [{ kind: 'stat', stat: 'moveSpeed', base: 4 + r * 2, perLevel: 2 }] },
  { name: 'Sách Phép', tags: ['academy'], eff: r => [{ kind: 'spell', spell: (['icebolt', 'fireball', 'chainLightning', 'arcaneMissiles'] as const)[r], mpCost: 12, cooldown: 2.5, base: 14 + r * 6, perLevel: 5 }] },
  { name: 'Hạt Mầm Bạn', tags: ['companion'], eff: r => [{ kind: 'summon', companion: ['cmp_sprout', 'cmp_bat', 'cmp_wisp', 'cmp_wisp'][r], base: 5 + r * 3, perLevel: 2 }] },
  { name: 'Bùa Đen', tags: ['curse'], eff: r => [{ kind: 'onHit', chance: 0.1 + r * 0.04, perLevel: 0.03, apply: 'poison' }] },
  { name: 'Răng Sói', tags: ['curse', 'shadow'], eff: r => [{ kind: 'onHit', chance: 0.1 + r * 0.03, perLevel: 0.02, apply: 'wound' }] },
  { name: 'Tim Đá', tags: ['guardian'], eff: r => [{ kind: 'stat', stat: 'maxHp', base: 8 + r * 4, perLevel: 4 }] },
  { name: 'Lưỡi Mài', tags: ['ember', 'windsong'], eff: r => [{ kind: 'stat', stat: 'physical', base: 3 + r * 2, perLevel: 1.5 }] },
  { name: 'Mắt Ưng', tags: ['shadow'], eff: r => [{ kind: 'stat', stat: 'critChance', base: 4 + r * 2, perLevel: 1.5 }] },
  { name: 'Răng Nanh', tags: ['curse'], eff: r => [{ kind: 'stat', stat: 'critDamage', base: 10 + r * 6, perLevel: 5 }] },
  { name: 'Chén Máu', tags: ['curse'], eff: r => [{ kind: 'stat', stat: 'lifesteal', base: 1 + r, perLevel: 0.5 }], c: { kind: 'cornerOnly' } },
  { name: 'Đồng Hồ Cát', tags: ['academy'], eff: r => [{ kind: 'stat', stat: 'attackSpeed', base: 5 + r * 3, perLevel: 2 }], c: { kind: 'touchEdge', edge: 'left' } },
  { name: 'Cỏ Bốn Lá', tags: ['companion'], eff: r => [{ kind: 'stat', stat: 'luck', base: 2 + r, perLevel: 1 }] },
  { name: 'Túi Tiền', tags: ['companion'], eff: r => [{ kind: 'onKill', action: 'money', base: 2 + r * 2, perLevel: 1 }, { kind: 'stat', stat: 'barter', base: 3 + r, perLevel: 1 }] },
  { name: 'Bình Sương', tags: ['glacier', 'lake'], eff: r => [{ kind: 'periodic', every: 6, action: 'frostRing', base: 10 + r * 6, perLevel: 4 }] },
  { name: 'Lõi Sét', tags: ['storm'], eff: r => [{ kind: 'periodic', every: 5, action: 'lightning', base: 12 + r * 6, perLevel: 4 }] },
  { name: 'Sao Băng Nhỏ', tags: ['ember'], eff: r => [{ kind: 'periodic', every: 7, action: 'meteor', base: 20 + r * 8, perLevel: 5 }], c: { kind: 'emptyNeighbor', dir: 'right' } },
  { name: 'Đèn Lồng Hồn', tags: ['academy', 'companion'], eff: r => [{ kind: 'periodic', every: 3, action: 'orb', base: 8 + r * 4, perLevel: 3 }] },
  { name: 'Lá Hồi Sinh', tags: ['lake'], eff: r => [{ kind: 'periodic', every: 8, action: 'heal', base: 2 + r, perLevel: 1 }] },
  { name: 'Giày Gió', tags: ['windsong'], eff: r => [{ kind: 'onDash', action: 'trail', base: 5 + r * 3, perLevel: 2 }] },
  { name: 'Vòng Sóng', tags: ['windsong', 'storm'], eff: r => [{ kind: 'onDash', action: 'shockwave', base: 10 + r * 5, perLevel: 3 }] },
  { name: 'Vảy Rồng', tags: ['guardian'], eff: r => [{ kind: 'onDash', action: 'shield', base: 6 + r * 3, perLevel: 2 }] },
  { name: 'Gai Nhím', tags: ['guardian', 'curse'], eff: r => [{ kind: 'onHurt', action: 'thorns', base: 8 + r * 4, perLevel: 3 }] },
  { name: 'Ngọc Nổ', tags: ['ember'], eff: r => [{ kind: 'onHurt', action: 'nova', base: 14 + r * 6, perLevel: 4 }, { kind: 'onKill', action: 'explode', base: 8 + r * 4, perLevel: 2 }] },
  { name: 'Huyết Ngọc', tags: ['curse'], eff: r => [{ kind: 'conditional', when: 'hpBelow50', inner: { kind: 'stat', stat: 'damagePct', base: 15 + r * 8, perLevel: 5 } }] },
  { name: 'Vương Miện', tags: ['guardian'], eff: r => [{ kind: 'conditional', when: 'fullHp', inner: { kind: 'stat', stat: 'critChance', base: 8 + r * 4, perLevel: 3 } }] },
  { name: 'Trăng Non', tags: ['lake', 'academy'], eff: r => [{ kind: 'conditional', when: 'mpAbove50', inner: { kind: 'stat', stat: 'magic', base: 6 + r * 4, perLevel: 3 } }] },
  { name: 'Bóng Cuối', tags: ['shadow'], eff: r => [{ kind: 'conditional', when: 'noDashLeft', inner: { kind: 'stat', stat: 'evasion', base: 10 + r * 5, perLevel: 3 } }] },
  { name: 'Huy Hiệu Săn', tags: ['guardian', 'ember'], eff: r => [{ kind: 'conditional', when: 'bossRoom', inner: { kind: 'stat', stat: 'damagePct', base: 10 + r * 5, perLevel: 4 } }], c: { kind: 'noOtherOfTag', tag: 'shadow' } },
  { name: 'Vỏ Ốc', tags: ['lake'], eff: r => [{ kind: 'onHurt', action: 'mp', base: 4 + r * 2, perLevel: 2 }, { kind: 'onKill', action: 'mp', base: 2 + r, perLevel: 1 }] },
  { name: 'Quả Mọng', tags: ['companion'], eff: r => [{ kind: 'onKill', action: 'heal', base: 1 + r, perLevel: 0.5 }] },
  { name: 'Bong Bóng Phép', tags: ['academy', 'guardian'], eff: r => [{ kind: 'spell', spell: r % 2 ? 'blink' : 'shieldBubble', mpCost: 15, cooldown: 5, base: 15 + r * 5, perLevel: 4 }] },
  { name: 'Mảnh Sao', tags: ['storm', 'academy'], eff: r => [{ kind: 'special', id: ['echoStrike', 'goldTouch', 'secondWind', 'starFall'][r], base: 10 + r * 5, perLevel: 4 }] },
];
export const artifacts: ArtifactDef[] = [];
TPL.forEach((t, i) => {
  for (let v = 0; v < 2; v++) {
    const r = Math.min(3, (i % 3) + v);
    const rarity = RAR[r];
    const id = `fx_${i}_${v}`;
    artifacts.push({
      id, name: v === 0 ? t.name : `${t.name} ${['Cũ', 'Sáng', 'Cổ', 'Thần'][r]}`,
      desc: `${t.name}: hiệu ứng {v}.`, rarity, maxLevel: 2 + r, shape: SHAPES[(i + v * 2) % SHAPES.length],
      tags: t.tags, effects: t.eff(r), constraint: v === 1 ? t.c : undefined,
      icon: `art_${id}`, price: RAR_PRICE[rarity], unlockedByDefault: r < 2,
    });
  }
});

// ---------- tablets ----------
type T = TabletDef['targets'];
const tdef = (id: string, name: string, rarity: Rarity, targets: T, shape: Shape = [[0, 0]]): TabletDef =>
  ({ id, name, desc: name, rarity, shape, targets, icon: `tab_${id}`, price: RAR_PRICE[rarity] - 40, unlockedByDefault: rarity === 'common' || rarity === 'rare' });
const L = (n: number) => ({ op: 'level' as const, amount: n });
export const tablets: TabletDef[] = [
  tdef('up_r', 'Mũi Tên Phải', 'common', [{ at: [1, 0], op: L(1) }]),
  tdef('up_l', 'Mũi Tên Trái', 'common', [{ at: [-1, 0], op: L(1) }]),
  tdef('up_u', 'Mũi Tên Lên', 'common', [{ at: [0, -1], op: L(1) }]),
  tdef('up_d', 'Mũi Tên Xuống', 'common', [{ at: [0, 1], op: L(1) }]),
  tdef('up_lr', 'Hai Ngả', 'rare', [{ at: [1, 0], op: L(1) }, { at: [-1, 0], op: L(1) }]),
  tdef('up_ud', 'Cột Đá', 'rare', [{ at: [0, 1], op: L(1) }, { at: [0, -1], op: L(1) }]),
  tdef('up_cross', 'Thập Tự', 'epic', [{ at: [1, 0], op: L(1) }, { at: [-1, 0], op: L(1) }, { at: [0, 1], op: L(1) }, { at: [0, -1], op: L(1) }]),
  tdef('up_diag', 'Chéo Góc', 'rare', [{ at: [1, 1], op: L(1) }, { at: [-1, -1], op: L(1) }]),
  tdef('up2_r', 'Đá Mạnh', 'epic', [{ at: [1, 0], op: L(2) }]),
  tdef('trade', 'Đổi Chác', 'rare', [{ at: [1, 0], op: L(2) }, { at: [-1, 0], op: L(-1) }]),
  tdef('sac', 'Hiến Tế', 'common', [{ at: [1, 0], op: L(3) }, { at: [0, 1], op: L(-2) }]),
  tdef('curse_r', 'Phiến Nứt', 'common', [{ at: [1, 0], op: L(-1) }]),
  tdef('free_r', 'Phá Xiềng', 'rare', [{ at: [1, 0], op: { op: 'ignoreConstraint' } }]),
  tdef('free_x', 'Tự Do', 'epic', [{ at: [1, 0], op: { op: 'ignoreConstraint' } }, { at: [-1, 0], op: { op: 'ignoreConstraint' } }]),
  tdef('max_r', 'Vươn Cao', 'rare', [{ at: [1, 0], op: { op: 'maxLevel', amount: 1 } }]),
  tdef('max_up', 'Đỉnh Sao', 'epic', [{ at: [0, -1], op: { op: 'maxLevel', amount: 2 } }, { at: [0, -1], op: L(1) }]),
  tdef('dbl_r', 'Gương Đôi', 'epic', [{ at: [1, 0], op: { op: 'doubleTags' } }]),
  tdef('dbl_d', 'Song Sinh', 'legendary', [{ at: [0, 1], op: { op: 'doubleTags' } }, { at: [0, -1], op: { op: 'doubleTags' } }]),
  tdef('copy', 'Tấm Gương', 'legendary', [{ at: [1, 0], op: { op: 'copy' } }]),
  tdef('long_r', 'Phiến Dài', 'rare', [{ at: [2, 0], op: L(1) }, { at: [-1, 0], op: L(1) }], [[0, 0], [1, 0]]),
  tdef('long_d', 'Phiến Đứng', 'rare', [{ at: [0, 2], op: L(1) }, { at: [0, -1], op: L(1) }], [[0, 0], [0, 1]]),
  tdef('ring', 'Vòng Tròn', 'legendary', [{ at: [1, 0], op: L(1) }, { at: [-1, 0], op: L(1) }, { at: [0, 1], op: L(1) }, { at: [0, -1], op: L(1) }, { at: [1, 1], op: L(1) }, { at: [-1, -1], op: L(1) }, { at: [1, -1], op: L(1) }, { at: [-1, 1], op: L(1) }]),
  tdef('far', 'Tầm Xa', 'rare', [{ at: [2, 0], op: L(1) }]),
  tdef('mix', 'Pha Trộn', 'epic', [{ at: [1, 0], op: L(1) }, { at: [0, 1], op: { op: 'ignoreConstraint' } }]),
];

// ---------- weapons ----------
export const weapons: WeaponDef[] = [
  { id: 'swordshield', name: 'Kiếm & Khiên', desc: 'Combo 3 đòn, đỡ đòn bằng khiên.', icon: 'wic_swordshield', sprite: 'wpn_swordshield', element: 'physical', baseCoef: [0.9, 1.0, 1.4], range: 58, arc: 100, attackInterval: 0.32, specialMp: 20, hasGuard: true },
  { id: 'greatsword', name: 'Đại Kiếm', desc: 'Hai nhát nặng, đẩy lùi mạnh.', icon: 'wic_greatsword', sprite: 'wpn_greatsword', element: 'physical', baseCoef: [1.8, 2.4], range: 78, arc: 160, attackInterval: 0.62, specialMp: 25 },
  { id: 'dagger', name: 'Dao Găm', desc: '4 nhát nhanh, tích Cuồng Nộ.', icon: 'wic_dagger', sprite: 'wpn_dagger', element: 'physical', baseCoef: [0.55, 0.55, 0.6, 0.9], range: 44, arc: 80, attackInterval: 0.17, specialMp: 15 },
  { id: 'katana', name: 'Kiếm Cong', desc: '3 đòn, đòn 3 lao tới. Rút kiếm Iaido.', icon: 'wic_katana', sprite: 'wpn_katana', element: 'physical', baseCoef: [1.0, 1.0, 1.5], range: 64, arc: 110, attackInterval: 0.34, specialMp: 20 },
  { id: 'crossbow', name: 'Nỏ', desc: 'Băng đạn 6, tự ngắm.', icon: 'wic_crossbow', sprite: 'wpn_crossbow', element: 'physical', baseCoef: [1.1], range: 520, arc: 0, attackInterval: 0.28, specialMp: 20, magazine: 6, reload: 1.2 },
  { id: 'staff', name: 'Gậy Phép', desc: 'Cầu phép tự dẫn, nổ nguyên tố.', icon: 'wic_staff', sprite: 'wpn_staff', element: 'fire', baseCoef: [1.0], range: 420, arc: 0, attackInterval: 0.42, specialMp: 30 },
];

const up = (weapon: WeaponId, n: number, tier: 1 | 2 | 3, name: string, mods: WeaponUpgradeDef['mods'], extra: Partial<WeaponUpgradeDef> = {}): WeaponUpgradeDef =>
  ({ id: `${weapon}_u${n}`, weapon, tier, name, desc: name, mods, ...extra });
const commonUps = (w: WeaponId): WeaponUpgradeDef[] => [
  up(w, 1, 1, 'Lưỡi Sắc', [{ key: 'damagePct', value: 0.15 }]),
  up(w, 2, 1, 'Tay Nhanh', [{ key: 'attackSpeedPct', value: 0.12 }]),
  up(w, 3, 1, 'Tiết Kiệm Phép', [{ key: 'specialCostPct', value: -0.3 }]),
  up(w, 4, 2, 'Hệ Lửa', [{ key: 'element', value: 'fire' }], { excludes: [`${w}_u5`, `${w}_u6`] }),
  up(w, 5, 2, 'Hệ Băng', [{ key: 'element', value: 'ice' }], { excludes: [`${w}_u4`, `${w}_u6`] }),
  up(w, 6, 2, 'Hệ Sét', [{ key: 'element', value: 'lightning' }], { excludes: [`${w}_u4`, `${w}_u5`] }),
  up(w, 7, 2, 'Lướt Chém', [{ key: 'dashAttackPct', value: 0.5 }]),
];
export const weaponUpgrades: WeaponUpgradeDef[] = [
  ...commonUps('swordshield'),
  up('swordshield', 8, 2, 'Đòn Thứ Tư', [{ key: 'extraHit', value: 1 }]),
  up('swordshield', 9, 3, 'Khiên Thép', [{ key: 'guardCostPct', value: -0.5 }], { requires: ['swordshield_u8'] }),
  ...commonUps('greatsword'),
  up('greatsword', 8, 2, 'Đẩy Mạnh', [{ key: 'knockbackPct', value: 0.6 }]),
  up('greatsword', 9, 3, 'Xoáy Dài', [{ key: 'spinDuration', value: 1 }], { requires: ['greatsword_u8'] }),
  ...commonUps('dagger'),
  up('dagger', 8, 2, 'Cuồng Nộ Dài', [{ key: 'furyDuration', value: 2 }]),
  up('dagger', 9, 3, 'Đâm Lén', [{ key: 'backstabMult', value: 1 }], { requires: ['dagger_u8'] }),
  ...commonUps('katana'),
  up('katana', 8, 2, 'Rút Kiếm Nhạy', [{ key: 'iaidoWindow', value: 0.1 }]),
  up('katana', 9, 3, 'Đòn Thứ Tư', [{ key: 'extraHit', value: 1 }], { requires: ['katana_u8'] }),
  ...commonUps('crossbow'),
  up('crossbow', 8, 1, 'Băng Đạn +3', [{ key: 'magazine', value: 3 }]),
  up('crossbow', 9, 2, 'Tên Xuyên', [{ key: 'pierce', value: 1 }]),
  up('crossbow', 10, 3, 'Ba Mũi', [{ key: 'multishot', value: 2 }], { requires: ['crossbow_u9'] }),
  ...commonUps('staff'),
  up('staff', 8, 2, 'Dẫn Đường', [{ key: 'homing', value: 1 }]),
  up('staff', 9, 3, 'Nổ Lớn', [{ key: 'novaRadiusPct', value: 0.5 }], { requires: ['staff_u8'] }),
];

// ---------- enemies ----------
const E = (id: string, name: string, chapter: number, ai: EnemyDef['ai'], hp: number, dmg: number, speed: number, radius = 16, params?: Record<string, number>): EnemyDef =>
  ({ id, name, chapter, ai, sprite: `en_${id}`, hp, damage: dmg, speed, xp: Math.round(hp / 6) + 2, money: [3 + chapter, 8 + chapter * 3], radius, params });
export const enemies: EnemyDef[] = [
  E('slime_moss', 'Slime Rêu', 1, 'chaser', 40, 6, 70),
  E('mushroom_spore', 'Nấm Bào Tử', 1, 'ring', 50, 5, 30, 16, { count: 8, cooldown: 2.6 }),
  E('beetle_charger', 'Bọ Húc', 1, 'charger', 60, 8, 60, 18),
  E('sprout_archer', 'Mầm Cung', 1, 'shooter', 36, 5, 50),
  E('bee_swarm', 'Ong Rừng', 1, 'exploder', 24, 10, 110, 12),
  E('rat_bandit', 'Chuột Cướp', 2, 'chaser', 70, 9, 90),
  E('rat_bomber', 'Chuột Bom', 2, 'lobber', 55, 10, 50),
  E('rat_shield', 'Chuột Khiên', 2, 'shielded', 110, 9, 55, 18),
  E('mole_digger', 'Chuột Chũi', 2, 'teleporter', 60, 9, 60),
  E('rat_crossbow', 'Chuột Nỏ', 2, 'spread', 55, 8, 45),
  E('book_flyer', 'Sách Bay', 3, 'chaser', 80, 10, 100, 14),
  E('ink_blob', 'Vũng Mực', 3, 'exploder', 70, 14, 80),
  E('candle_mage', 'Pháp Sư Nến', 3, 'ring', 85, 9, 40, 16, { count: 12, cooldown: 2.4 }),
  E('mirror_construct', 'Gương Máy', 3, 'teleporter', 100, 11, 60),
  E('quill_turret', 'Tháp Bút', 3, 'turret', 120, 8, 0, 18),
  E('penguin_slider', 'Cánh Cụt Trượt', 4, 'charger', 110, 12, 70),
  E('ice_spirit', 'Hồn Băng', 4, 'spread', 90, 11, 60),
  E('seal_lobber', 'Hải Cẩu Ném', 4, 'lobber', 120, 13, 40, 18),
  E('frost_wolf', 'Sói Sương', 4, 'chaser', 100, 13, 120),
  E('snow_golem_small', 'Người Tuyết', 4, 'summoner', 160, 10, 35, 20),
  E('gear_bot', 'Bánh Răng', 5, 'chaser', 130, 14, 95),
  E('steam_turret', 'Tháp Hơi', 5, 'turret', 170, 12, 0, 20),
  E('raccoon_mechanic', 'Gấu Mèo Thợ', 5, 'healer', 120, 10, 60),
  E('drone_bomber', 'Máy Bay Bom', 5, 'lobber', 110, 15, 70),
  E('piston_brute', 'Pít-tông', 5, 'shielded', 220, 16, 50, 22),
  E('star_shard', 'Mảnh Sao', 6, 'exploder', 120, 20, 120, 14),
  E('void_eye', 'Mắt Hư Không', 6, 'ring', 160, 14, 40, 18, { count: 14, cooldown: 2.2 }),
  E('comet_hound', 'Chó Sao Chổi', 6, 'charger', 170, 17, 90),
  E('nebula_healer', 'Tinh Vân', 6, 'healer', 150, 12, 55),
  E('star_knight', 'Hiệp Sĩ Sao', 6, 'shielded', 260, 18, 60, 20),
];

// ---------- bosses ----------
const A = (id: string, pattern: string, params: Record<string, number>, weight = 1) => ({ id, pattern, params, weight });
const mkBoss = (id: string, name: string, title: string, chapter: number, mini: boolean, hp: number, dmg: number, radius: number, summon: string[]): BossDef => ({
  id, name, title, chapter, mini, sprite: id, hp, damage: dmg, speed: mini ? 70 : 55, radius,
  phases: mini ? [
    { hpBelow: 1, attacks: [A('a', 'charge', { speed: 360, windup: 0.7 }), A('b', 'ring', { count: 10, speed: 160 })] },
    { hpBelow: 0.5, attacks: [A('a', 'charge', { speed: 420, windup: 0.6 }), A('c', 'spiral', { arms: 3, shots: 18, speed: 150 }), A('d', 'summon', { count: 2 })], summon },
  ] : [
    { hpBelow: 1, attacks: [A('a', 'ring', { count: 12 + chapter * 2, speed: 150 }), A('b', 'charge', { speed: 380, windup: 0.8 }), A('c', 'aimed', { count: 3, spread: 0.4, speed: 220 })] },
    { hpBelow: 0.66, attacks: [A('a', 'spiral', { arms: 3 + (chapter >> 1), shots: 24, speed: 150 }), A('b', 'cross', { waves: 3, speed: 200 }), A('c', 'summon', { count: 2 + (chapter >> 1) })], summon, onEnter: 'roar' },
    { hpBelow: 0.33, attacks: [A('a', 'hazard', { count: 4 + chapter, radius: 48, delay: 1.0 }), A('b', 'ring', { count: 18 + chapter * 2, speed: 180 }), A('c', 'charge', { speed: 460, windup: 0.6 }), A('d', 'spiral', { arms: 4, shots: 30, speed: 170 })], summon, onEnter: 'enrage' },
  ],
  reward: { sapphire: mini ? 3 + chapter : 10 + chapter * 4, money: mini ? 80 : 200 },
});
export const bosses: BossDef[] = [
  mkBoss('mb_thorn_boar', 'Lợn Gai', 'Kẻ Gác Rừng', 1, true, 420, 10, 34, ['slime_moss']),
  mkBoss('mb_rat_captain', 'Đội Trưởng Chuột', 'Tay Chém', 2, true, 640, 12, 34, ['rat_bandit']),
  mkBoss('mb_ink_golem', 'Golem Mực', 'Trang Sách Đen', 3, true, 860, 14, 38, ['ink_blob']),
  mkBoss('mb_yeti', 'Người Tuyết Lớn', 'Gió Bấc', 4, true, 1100, 16, 40, ['ice_spirit']),
  mkBoss('mb_saw_crab', 'Cua Cưa', 'Lưỡi Quay', 5, true, 1350, 18, 38, ['gear_bot']),
  mkBoss('mb_dark_twin', 'Bóng Song Sinh', 'Hình Phản Chiếu', 6, true, 1650, 20, 30, ['star_shard']),
  mkBoss('boss_mushroom_king', 'Nấm Chúa Già', 'Vua Rừng Rêu', 1, false, 1200, 12, 60, ['slime_moss', 'mushroom_spore']),
  mkBoss('boss_rat_chief', 'Thủ Lĩnh Chuột Cướp', 'Chúa Mỏ Đỏ', 2, false, 1800, 14, 60, ['rat_bandit', 'rat_bomber']),
  mkBoss('boss_owl_librarian', 'Cú Thủ Thư', 'Người Giữ Sách', 3, false, 2400, 16, 60, ['book_flyer']),
  mkBoss('boss_ice_walrus', 'Hải Mã Băng', 'Chúa Hồ Băng', 4, false, 3100, 18, 66, ['penguin_slider']),
  mkBoss('boss_raccoon_golem', 'Kỹ Sư Gấu Mèo & Golem', 'Xưởng Trưởng', 5, false, 3900, 20, 70, ['gear_bot', 'drone_bomber']),
  mkBoss('boss_fallen_star', 'Ngôi Sao Rơi', 'Lõi Tháp', 6, false, 5000, 22, 72, ['star_shard', 'void_eye']),
];

export const chapters: ChapterDef[] = [
  { id: 1, name: 'Rừng Rêu', tileset: 'ts_ch1', enemies: ['slime_moss', 'mushroom_spore', 'beetle_charger', 'sprout_archer', 'bee_swarm'], miniBoss: 'mb_thorn_boar', boss: 'boss_mushroom_king', tint: 0x98b466 },
  { id: 2, name: 'Mỏ Đá Đỏ', tileset: 'ts_ch2', enemies: ['rat_bandit', 'rat_bomber', 'rat_shield', 'mole_digger', 'rat_crossbow'], miniBoss: 'mb_rat_captain', boss: 'boss_rat_chief', tint: 0xc9805a },
  { id: 3, name: 'Thư Viện Bay', tileset: 'ts_ch3', enemies: ['book_flyer', 'ink_blob', 'candle_mage', 'mirror_construct', 'quill_turret'], miniBoss: 'mb_ink_golem', boss: 'boss_owl_librarian', tint: 0xa58bd0 },
  { id: 4, name: 'Hồ Băng', tileset: 'ts_ch4', enemies: ['penguin_slider', 'ice_spirit', 'seal_lobber', 'frost_wolf', 'snow_golem_small'], miniBoss: 'mb_yeti', boss: 'boss_ice_walrus', tint: 0xa9dbe8 },
  { id: 5, name: 'Xưởng Máy Hơi', tileset: 'ts_ch5', enemies: ['gear_bot', 'steam_turret', 'raccoon_mechanic', 'drone_bomber', 'piston_brute'], miniBoss: 'mb_saw_crab', boss: 'boss_raccoon_golem', tint: 0xb8a58a },
  { id: 6, name: 'Lõi Sao', tileset: 'ts_ch6', enemies: ['star_shard', 'void_eye', 'comet_hound', 'nebula_healer', 'star_knight'], miniBoss: 'mb_dark_twin', boss: 'boss_fallen_star', tint: 0x6a5a9a },
];

export const miracles: MiracleDef[] = [
  { id: 'm1', name: 'Phúc Lành Rừng', desc: '+25 máu tối đa', icon: 'mir_1', effects: [{ kind: 'stat', stat: 'maxHp', base: 25, perLevel: 0 }] },
  { id: 'm2', name: 'Lửa Thiêng', desc: '+20% sát thương', icon: 'mir_2', effects: [{ kind: 'stat', stat: 'damagePct', base: 20, perLevel: 0 }] },
  { id: 'm3', name: 'Bước Mây', desc: '+1 lượt lướt', icon: 'mir_3', effects: [{ kind: 'stat', stat: 'dashCount', base: 1, perLevel: 0 }] },
  { id: 'm4', name: 'Mắt Sao', desc: '+12% chí mạng', icon: 'mir_4', effects: [{ kind: 'stat', stat: 'critChance', base: 12, perLevel: 0 }] },
  { id: 'm5', name: 'Tim Băng', desc: 'Đòn đánh 20% gây Tê Cóng', icon: 'mir_5', effects: [{ kind: 'onHit', chance: 0.2, perLevel: 0, apply: 'frostbite', stacks: 1 }] },
  { id: 'm6', name: 'Mưa Sao', desc: 'Sao băng mỗi 4 giây', icon: 'mir_6', effects: [{ kind: 'periodic', every: 4, action: 'meteor', base: 30, perLevel: 0 }] },
  { id: 'm7', name: 'Hồi Xuân', desc: 'Hạ quái hồi 2 máu', icon: 'mir_7', effects: [{ kind: 'onKill', action: 'heal', base: 2, perLevel: 0 }] },
  { id: 'm8', name: 'Vận May', desc: '+8 may mắn', icon: 'mir_8', effects: [{ kind: 'stat', stat: 'luck', base: 8, perLevel: 0 }] },
];

export const potions: PotionDef[] = [
  { id: 'heal', name: 'Bình Hồi Máu', desc: 'Hồi 40% máu', icon: 'pot_heal', action: 'heal', value: 0.4 },
  { id: 'rage', name: 'Bình Cuồng Nộ', desc: '+40% sát thương 10s', icon: 'pot_rage', action: 'rage', value: 40, duration: 10 },
  { id: 'iron', name: 'Bình Da Sắt', desc: '+30 phòng thủ 10s', icon: 'pot_iron', action: 'iron', value: 30, duration: 10 },
  { id: 'swift', name: 'Bình Gió', desc: '+40% tốc chạy 10s', icon: 'pot_swift', action: 'swift', value: 25, duration: 10 },
  { id: 'mana', name: 'Bình Phép', desc: 'Hồi đầy MP', icon: 'pot_mana', action: 'mana', value: 1 },
  { id: 'mystery', name: 'Bình Bí Ẩn', desc: '???', icon: 'pot_mystery', action: 'mystery', value: 0 },
];

const D = (id: string, name: string, cost: number, requires: string[], pos: [number, number], key: string, value: number | string): DestinyNode =>
  ({ id, name, desc: name, cost, requires, pos, grant: { key, value } });
export const destiny: DestinyNode[] = [
  D('root', 'Sửa Nhà', 5, [], [0, 0], 'homeRepair', 1),
  D('tp1', 'Điểm Tài Năng I', 5, ['root'], [-1, 1], 'talentPoints', 5),
  D('tp2', 'Điểm Tài Năng II', 10, ['tp1'], [-1, 2], 'talentPoints', 5),
  D('tp3', 'Điểm Tài Năng III', 15, ['tp2'], [-1, 3], 'talentPoints', 5),
  D('tp4', 'Điểm Tài Năng IV', 20, ['tp3'], [-1, 4], 'talentPoints', 5),
  D('tp5', 'Điểm Tài Năng V', 30, ['tp4'], [-1, 5], 'talentPoints', 5),
  D('seed1', 'Vốn Liếng I', 6, ['root'], [1, 1], 'seedMoney', 200),
  D('seed2', 'Vốn Liếng II', 14, ['seed1'], [1, 2], 'seedMoney', 200),
  D('dice1', 'Xúc Xắc I', 5, ['root'], [0, 1], 'startDice', 2),
  D('dice2', 'Xúc Xắc II', 10, ['dice1'], [0, 2], 'startDice', 2),
  D('dice3', 'Xúc Xắc III', 18, ['dice2'], [0, 3], 'startDice', 2),
  D('bag1', 'Túi Mở Rộng I', 10, ['root'], [2, 1], 'bagCols', 1),
  D('bag2', 'Túi Mở Rộng II', 18, ['bag1'], [2, 2], 'bagRows', 1),
  D('bag3', 'Túi Mở Rộng III', 28, ['bag2'], [2, 3], 'bagCols', 1),
  D('side', 'Túi Phụ', 8, ['bag1'], [3, 2], 'sideBag', 1),
  D('lvheal', 'Lên Cấp Hồi Máu', 8, ['root'], [-2, 1], 'levelUpHeal', 20),
  D('w_great', 'Mở Đại Kiếm', 6, ['root'], [-3, 1], 'unlockWeapon', 'greatsword'),
  D('w_dagger', 'Mở Dao Găm', 8, ['w_great'], [-3, 2], 'unlockWeapon', 'dagger'),
  D('w_katana', 'Mở Kiếm Cong', 10, ['w_dagger'], [-3, 3], 'unlockWeapon', 'katana'),
  D('w_bow', 'Mở Nỏ', 10, ['w_great'], [-4, 2], 'unlockWeapon', 'crossbow'),
  D('w_staff', 'Mở Gậy Phép', 12, ['w_bow'], [-4, 3], 'unlockWeapon', 'staff'),
  D('pool1', 'Kho Cổ Vật I', 8, ['root'], [3, 1], 'unlockArtifacts', 15),
  D('pool2', 'Kho Cổ Vật II', 16, ['pool1'], [4, 2], 'unlockArtifacts', 15),
  D('pot1', 'Thắt Lưng Bình', 10, ['root'], [-2, 2], 'potionSlot', 1),
  D('hp1', 'Sức Bền I', 6, ['root'], [1, 3], 'startMaxHp', 10),
  D('hp2', 'Sức Bền II', 12, ['hp1'], [1, 4], 'startMaxHp', 10),
  D('luck1', 'Vận Đỏ', 10, ['seed1'], [2, 4], 'startLuck', 3),
  D('barter1', 'Mặc Cả', 10, ['seed1'], [3, 4], 'startBarter', 5),
  D('pocket', 'Không Gian Túi', 14, ['pool1'], [4, 3], 'pocketDimension', 1),
  D('hard', 'Cổng Khó', 40, ['tp2', 'seed2'], [0, 5], 'hardMode', 1),
  D('revive', 'Lông Phượng', 30, ['hp2'], [1, 5], 'revive', 1),
];

const TL = (id: string, name: string, stat: StatKey, perRank: number, maxRank = 5): TalentDef => ({ id, name, desc: name, maxRank, stat, perRank });
export const talents: TalentDef[] = [
  TL('t_hp', 'Thể Lực', 'maxHp', 5), TL('t_phys', 'Sức Mạnh', 'physical', 2), TL('t_fire', 'Lửa', 'fire', 2),
  TL('t_ice', 'Băng', 'ice', 2), TL('t_light', 'Sét', 'lightning', 2), TL('t_crit', 'Chí Mạng', 'critChance', 2),
  TL('t_mp', 'Tinh Thần', 'maxMp', 6), TL('t_dash', 'Lướt Nhanh', 'dashRecovery', 8), TL('t_luck', 'May Mắn', 'luck', 1),
  TL('t_barter', 'Buôn Bán', 'barter', 3),
];

export const costumes: CostumeDef[] = [
  { id: 'bong', name: 'Bông', desc: 'Nhà thám hiểm.', sprite: 'hero_bong', stats: {}, unlock: null },
  { id: 'scarecrow', name: 'Bù Nhìn', desc: 'Máu cố định 50, +30% sát thương.', sprite: 'hero_scarecrow', stats: { damagePct: 30 }, fixedHp: 50, unlock: { kind: 'runsStarted', value: 3, text: 'Đi 3 chuyến' } },
  { id: 'redcat', name: 'Mèo Áo Đỏ', desc: 'Khởi đầu với lửa.', sprite: 'hero_redcat', stats: { fire: 10 }, startItems: ['fx_1_0'], unlock: { kind: 'bossesKilled', value: 1, text: 'Hạ 1 trùm' } },
  { id: 'frog', name: 'Ếch', desc: 'Khởi đầu với sét.', sprite: 'hero_frog', stats: { lightning: 10 }, startItems: ['fx_2_0'], unlock: { kind: 'artifactsFound', value: 20, text: 'Khám phá 20 cổ vật' } },
  { id: 'fox', name: 'Cáo', desc: '+15% né, +1 lướt.', sprite: 'hero_fox', stats: { evasion: 15, dashCount: 1 }, unlock: { kind: 'chapterReached', value: 3, text: 'Đến chương 3' } },
  { id: 'knight', name: 'Hiệp Sĩ', desc: '+20 phòng thủ, chậm hơn.', sprite: 'hero_knight', stats: { defense: 20, moveSpeed: -10 }, unlock: { kind: 'winRuns', value: 1, text: 'Phá đảo 1 lần' } },
];

export const strings: Record<string, string> = {};
