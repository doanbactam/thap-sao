import type { EnemyDef, AiKind } from './types';

// Chapter scaling applied to the chapter-1-equivalent base values below.
export const HP_SCALE = [1, 1.5, 2.2, 3.1, 4.3, 6.0];
export const DMG_SCALE = [1, 1.35, 1.75, 2.2, 2.75, 3.4];
export const MONEY_SCALE = [1, 1.25, 1.5, 1.8, 2.1, 2.5];

interface Base { id: string; name: string; chapter: number; ai: AiKind; hp: number; damage: number; speed: number; xp: number;
  money: [number, number]; radius: number; params?: Record<string, number>; elite?: boolean }

const B: Base[] = [
  // ch1 Rừng Rêu
  { id: 'slime_moss', name: 'Nhớt Rêu', chapter: 1, ai: 'chaser', hp: 40, damage: 6, speed: 60, xp: 3, money: [2, 5], radius: 14,
    params: { contactCooldown: 0.8, hopInterval: 0.9 } },
  { id: 'mushroom_spore', name: 'Nấm Phun Bào Tử', chapter: 1, ai: 'ring', hp: 55, damage: 5, speed: 30, xp: 4, money: [3, 6], radius: 15,
    params: { bulletCount: 8, bulletSpeed: 110, fireRate: 3.2, telegraph: 0.6, keepDistance: 120 } },
  { id: 'beetle_charger', name: 'Bọ Sừng Húc', chapter: 1, ai: 'charger', hp: 70, damage: 9, speed: 55, xp: 5, money: [3, 7], radius: 17,
    params: { chargeSpeed: 420, telegraph: 0.7, chargeDuration: 0.55, cooldown: 2.4, stunOnWall: 1.0 } },
  { id: 'sprout_archer', name: 'Mầm Xạ Thủ', chapter: 1, ai: 'shooter', hp: 35, damage: 6, speed: 50, xp: 4, money: [2, 6], radius: 13,
    params: { bulletSpeed: 200, fireRate: 2.0, telegraph: 0.4, keepDistance: 200, bulletCount: 1 } },
  { id: 'bee_swarm', name: 'Đàn Ong Rừng', chapter: 1, ai: 'chaser', hp: 18, damage: 4, speed: 115, xp: 2, money: [1, 3], radius: 10,
    params: { contactCooldown: 0.6, swarmSize: 3, jitter: 30 } },
  // ch2 Mỏ Đá Đỏ
  { id: 'rat_bandit', name: 'Chuột Cướp', chapter: 2, ai: 'chaser', hp: 50, damage: 7, speed: 85, xp: 4, money: [3, 7], radius: 14,
    params: { contactCooldown: 0.7, lungeRange: 70, lungeSpeed: 300, telegraph: 0.35 } },
  { id: 'rat_bomber', name: 'Chuột Ném Bom', chapter: 2, ai: 'lobber', hp: 45, damage: 10, speed: 55, xp: 5, money: [4, 8], radius: 14,
    params: { fireRate: 2.6, telegraph: 0.9, aoeRadius: 52, lobRange: 280, keepDistance: 180 } },
  { id: 'rat_shield', name: 'Chuột Khiên Sắt', chapter: 2, ai: 'shielded', hp: 85, damage: 8, speed: 50, xp: 6, money: [4, 9], radius: 16,
    params: { shieldArc: 120, turnSpeed: 2.2, contactCooldown: 0.9, bashTelegraph: 0.6 } },
  { id: 'mole_digger', name: 'Chuột Chũi Đào Hầm', chapter: 2, ai: 'teleporter', hp: 60, damage: 8, speed: 40, xp: 5, money: [3, 8], radius: 15,
    params: { teleportInterval: 3.0, telegraph: 0.8, emergeRadius: 60, bulletCount: 6, bulletSpeed: 120 } },
  { id: 'rat_crossbow', name: 'Chuột Nỏ Ba Phát', chapter: 2, ai: 'spread', hp: 40, damage: 7, speed: 55, xp: 5, money: [3, 8], radius: 14,
    params: { bulletCount: 3, spreadDeg: 30, bulletSpeed: 220, fireRate: 2.4, telegraph: 0.5, keepDistance: 220 } },
  // ch3 Thư Viện Bay
  { id: 'book_flyer', name: 'Sách Biết Bay', chapter: 3, ai: 'chaser', hp: 38, damage: 6, speed: 100, xp: 4, money: [2, 6], radius: 13,
    params: { contactCooldown: 0.7, swoopInterval: 2.0, swoopSpeed: 260 } },
  { id: 'ink_blob', name: 'Giọt Mực Nổ', chapter: 3, ai: 'exploder', hp: 30, damage: 14, speed: 90, xp: 4, money: [2, 5], radius: 13,
    params: { fuse: 0.8, triggerRange: 40, aoeRadius: 60, telegraph: 0.8 } },
  { id: 'candle_mage', name: 'Pháp Sư Nến', chapter: 3, ai: 'healer', hp: 48, damage: 5, speed: 45, xp: 6, money: [4, 9], radius: 14,
    params: { healAmount: 12, healRadius: 140, healInterval: 3.5, keepDistance: 220, bulletSpeed: 150, fireRate: 3.0 } },
  { id: 'mirror_construct', name: 'Gương Phản Chiếu', chapter: 3, ai: 'summoner', hp: 90, damage: 6, speed: 25, xp: 7, money: [5, 10], radius: 18,
    params: { summonInterval: 5.0, summonCount: 2, maxMinions: 4, telegraph: 1.0 } },
  { id: 'quill_turret', name: 'Tháp Bút Lông', chapter: 3, ai: 'turret', hp: 70, damage: 6, speed: 0, xp: 5, money: [3, 7], radius: 16,
    params: { bulletCount: 4, spiralStep: 15, bulletSpeed: 140, fireRate: 0.35, telegraph: 0.5 } },
  // ch4 Hồ Băng
  { id: 'penguin_slider', name: 'Chim Cánh Cụt Trượt', chapter: 4, ai: 'charger', hp: 55, damage: 9, speed: 60, xp: 5, money: [3, 8], radius: 15,
    params: { chargeSpeed: 380, telegraph: 0.6, chargeDuration: 0.9, cooldown: 2.0, bounces: 2 } },
  { id: 'ice_spirit', name: 'Hồn Băng', chapter: 4, ai: 'teleporter', hp: 45, damage: 7, speed: 50, xp: 5, money: [3, 8], radius: 13,
    params: { teleportInterval: 2.6, telegraph: 0.6, emergeRadius: 140, bulletCount: 3, bulletSpeed: 170, applyFrostbite: 1 } },
  { id: 'seal_lobber', name: 'Hải Cẩu Ném Tuyết', chapter: 4, ai: 'lobber', hp: 65, damage: 9, speed: 35, xp: 5, money: [4, 8], radius: 17,
    params: { fireRate: 2.2, telegraph: 1.0, aoeRadius: 58, lobRange: 300, keepDistance: 200, shards: 4 } },
  { id: 'frost_wolf', name: 'Sói Sương', chapter: 4, ai: 'chaser', hp: 60, damage: 8, speed: 125, xp: 5, money: [3, 8], radius: 15,
    params: { contactCooldown: 0.6, circleRadius: 110, lungeSpeed: 340, telegraph: 0.4 } },
  { id: 'snow_golem_small', name: 'Người Tuyết Gác', chapter: 4, ai: 'shielded', hp: 120, damage: 10, speed: 40, xp: 8, money: [5, 10], radius: 19,
    params: { shieldArc: 140, turnSpeed: 1.6, slamTelegraph: 0.8, slamRadius: 70 }, elite: true },
  // ch5 Xưởng Máy Hơi
  { id: 'gear_bot', name: 'Rô-bốt Bánh Răng', chapter: 5, ai: 'exploder', hp: 35, damage: 13, speed: 105, xp: 4, money: [2, 6], radius: 12,
    params: { fuse: 0.7, triggerRange: 44, aoeRadius: 56, telegraph: 0.7 } },
  { id: 'steam_turret', name: 'Tháp Pháo Hơi', chapter: 5, ai: 'turret', hp: 80, damage: 7, speed: 0, xp: 6, money: [4, 9], radius: 17,
    params: { bulletCount: 5, spreadDeg: 50, bulletSpeed: 200, fireRate: 1.8, telegraph: 0.6 } },
  { id: 'raccoon_mechanic', name: 'Gấu Mèo Thợ Máy', chapter: 5, ai: 'summoner', hp: 70, damage: 6, speed: 60, xp: 7, money: [5, 11], radius: 15,
    params: { summonInterval: 4.5, summonCount: 1, maxMinions: 3, telegraph: 0.9, keepDistance: 200 } },
  { id: 'drone_bomber', name: 'Máy Bay Thả Bom', chapter: 5, ai: 'lobber', hp: 40, damage: 11, speed: 90, xp: 5, money: [3, 8], radius: 13,
    params: { fireRate: 1.8, telegraph: 0.8, aoeRadius: 48, lobRange: 120, hover: 1 } },
  { id: 'piston_brute', name: 'Gã Pít-tông', chapter: 5, ai: 'charger', hp: 140, damage: 13, speed: 45, xp: 9, money: [6, 12], radius: 20,
    params: { chargeSpeed: 360, telegraph: 0.9, chargeDuration: 0.7, cooldown: 2.8, slamRadius: 80 }, elite: true },
  // ch6 Lõi Sao
  { id: 'star_shard', name: 'Mảnh Sao Vỡ', chapter: 6, ai: 'spread', hp: 40, damage: 7, speed: 80, xp: 5, money: [3, 8], radius: 12,
    params: { bulletCount: 5, spreadDeg: 60, bulletSpeed: 210, fireRate: 2.2, telegraph: 0.45, keepDistance: 180 } },
  { id: 'void_eye', name: 'Mắt Hư Không', chapter: 6, ai: 'shooter', hp: 60, damage: 8, speed: 40, xp: 6, money: [4, 9], radius: 16,
    params: { bulletSpeed: 260, fireRate: 1.6, telegraph: 0.7, keepDistance: 240, bulletCount: 3, burstGap: 0.12 } },
  { id: 'comet_hound', name: 'Chó Sao Chổi', chapter: 6, ai: 'charger', hp: 65, damage: 10, speed: 90, xp: 6, money: [4, 9], radius: 15,
    params: { chargeSpeed: 480, telegraph: 0.5, chargeDuration: 0.5, cooldown: 1.8, trailFire: 1 } },
  { id: 'nebula_healer', name: 'Tinh Vân Chữa Lành', chapter: 6, ai: 'healer', hp: 55, damage: 5, speed: 55, xp: 7, money: [5, 10], radius: 15,
    params: { healAmount: 20, healRadius: 160, healInterval: 3.0, keepDistance: 240, shieldAllies: 1 } },
  { id: 'star_knight', name: 'Hiệp Sĩ Sao', chapter: 6, ai: 'shielded', hp: 150, damage: 12, speed: 60, xp: 10, money: [6, 13], radius: 19,
    params: { shieldArc: 120, turnSpeed: 2.6, slashTelegraph: 0.6, slashRange: 70, bulletCount: 8, bulletSpeed: 140 }, elite: true },
];

const enemies: EnemyDef[] = B.map((b) => {
  const i = b.chapter - 1;
  return {
    ...b,
    sprite: `en_${b.id}`,
    hp: Math.round(b.hp * HP_SCALE[i]),
    damage: Math.round(b.damage * DMG_SCALE[i]),
    money: [Math.round(b.money[0] * MONEY_SCALE[i]), Math.round(b.money[1] * MONEY_SCALE[i])] as [number, number],
    xp: Math.round(b.xp * (1 + i * 0.4)),
  };
});
export default enemies;
