import type { ArtifactDef, Shape, Effect } from './types';

// Footprints (cell offsets at rotation 0)
const S1: Shape = [[0, 0]];
const H2: Shape = [[0, 0], [1, 0]];
const V2: Shape = [[0, 0], [0, 1]];
const H3: Shape = [[0, 0], [1, 0], [2, 0]];
const V3: Shape = [[0, 0], [0, 1], [0, 2]];
const SQ: Shape = [[0, 0], [1, 0], [0, 1], [1, 1]];
const L3: Shape = [[0, 0], [0, 1], [1, 1]];
const L4: Shape = [[0, 0], [0, 1], [0, 2], [1, 2]];
const T4: Shape = [[0, 0], [1, 0], [2, 0], [1, 1]];
const S4: Shape = [[1, 0], [2, 0], [0, 1], [1, 1]];
const Z4: Shape = [[0, 0], [1, 0], [1, 1], [2, 1]];

// effect helpers (keep the data table compact)
const stat = (s: any, base: number, perLevel: number, pct?: boolean): Effect =>
  pct ? { kind: 'stat', stat: s, base, perLevel, pct: true } : { kind: 'stat', stat: s, base, perLevel };
// onHit: authored in percent for readability, stored as 0..1 probability (chance + perLevel*level)
const onHit = (apply: any, chancePct: number, perLevelPct: number, stacks?: number): Effect => {
  const e: Effect = { kind: 'onHit', apply, chance: chancePct / 100, perLevel: perLevelPct / 100 };
  if (stacks) (e as any).stacks = stacks;
  return e;
};
const special = (id: string, base: number, perLevel: number): Effect => ({ kind: 'special', id, base, perLevel });

const ART: Omit<ArtifactDef, 'icon'>[] = [
  // ───────────── Băng Hà (glacier) ─────────────
  { id: 'g_frost_shard', name: 'Mảnh Sương Giá', desc: 'Sát thương Băng +{v}. Đòn đánh có 8% cơ hội gây Tê Cóng.', rarity: 'common', maxLevel: 3, shape: S1,
    tags: ['glacier'], effects: [stat('ice', 3, 2), onHit('frostbite', 8, 2)], price: 70, unlockedByDefault: true },
  { id: 'g_snow_charm', name: 'Bùa Bông Tuyết', desc: 'Đòn đánh có {v}% cơ hội gây Tê Cóng.', rarity: 'common', maxLevel: 3, shape: H2,
    tags: ['glacier'], effects: [onHit('frostbite', 15, 5)], price: 90, unlockedByDefault: true },
  { id: 'g_ice_lantern', name: 'Đèn Băng Lam', desc: 'Mỗi 6 giây phát ra vòng băng gây {v} sát thương Băng.', rarity: 'common', maxLevel: 3, shape: V2,
    tags: ['glacier'], effects: [{ kind: 'periodic', every: 6, action: 'frostRing', base: 15, perLevel: 6 }], price: 110, unlockedByDefault: true },
  { id: 'g_cold_mittens', name: 'Găng Tay Lạnh', desc: 'Sát thương Băng +{v}%. Đòn đánh có 15% cơ hội gây Tê Cóng.', rarity: 'rare', maxLevel: 4, shape: SQ,
    tags: ['glacier'], effects: [stat('ice', 10, 4, true), onHit('frostbite', 15, 4)], price: 180 },
  { id: 'g_glacier_heart', name: 'Tim Sông Băng', desc: 'Kẻ địch bị Đóng Băng nhận thêm {v}% sát thương. Trong phòng trùm: Băng +20%.', rarity: 'epic', maxLevel: 4, shape: T4,
    tags: ['glacier'], effects: [special('freezeShatter', 30, 10), { kind: 'conditional', when: 'bossRoom', inner: stat('ice', 20, 8, true) }], price: 380 },
  { id: 'g_icicle_spear', name: 'Giáo Nhũ Băng', desc: 'Chí mạng +{v}%. Đòn đánh có 20% cơ hội gây Tê Cóng. Phải chạm mép dưới túi.', rarity: 'rare', maxLevel: 3, shape: V3,
    tags: ['glacier'], effects: [stat('critChance', 4, 2), onHit('frostbite', 20, 5)], constraint: { kind: 'touchEdge', edge: 'bottom' },
    price: 200, weaponBias: ['katana', 'crossbow'] },
  { id: 'g_polar_compass', name: 'La Bàn Phương Bắc', desc: 'Lướt để lại vệt băng gây {v} sát thương. Tốc chạy +6%.', rarity: 'legendary', maxLevel: 5, shape: L3,
    tags: ['glacier', 'windsong'], effects: [{ kind: 'onDash', action: 'trail', base: 12, perLevel: 5 }, stat('moveSpeed', 6, 2, true)], price: 760 },
  { id: 'g_frozen_tear', name: 'Giọt Lệ Đóng Băng', desc: 'MP tối đa +{v}. Hạ gục hồi 3 MP. Chỉ đặt ở góc túi.', rarity: 'epic', maxLevel: 2, shape: S1,
    tags: ['glacier', 'lake'], effects: [stat('maxMp', 12, 6), { kind: 'onKill', action: 'mp', base: 3, perLevel: 1 }], constraint: { kind: 'cornerOnly' }, price: 320 },

  // ───────────── Than Hồng (ember) ─────────────
  { id: 'e_ember_coal', name: 'Hòn Than Ấm', desc: 'Sát thương Lửa +{v}. Đòn đánh có 8% cơ hội gây Bỏng.', rarity: 'common', maxLevel: 3, shape: S1,
    tags: ['ember'], effects: [stat('fire', 3, 2), onHit('burn', 8, 2)], price: 70, unlockedByDefault: true },
  { id: 'e_matchbox', name: 'Hộp Diêm Nhỏ', desc: 'Đòn đánh có {v}% cơ hội gây Bỏng.', rarity: 'common', maxLevel: 3, shape: H2,
    tags: ['ember'], effects: [onHit('burn', 15, 5)], price: 90, unlockedByDefault: true },
  { id: 'e_pepper_pouch', name: 'Túi Ớt Cay', desc: 'Tốc đánh +{v}%. Lửa +2.', rarity: 'common', maxLevel: 3, shape: V2,
    tags: ['ember'], effects: [stat('attackSpeed', 5, 3, true), stat('fire', 2, 1)], price: 100, unlockedByDefault: true },
  { id: 'e_forge_bellows', name: 'Ống Bễ Lò Rèn', desc: 'Sát thương Lửa +{v}%. Kẻ địch bị hạ phát nổ gây 20 sát thương.', rarity: 'rare', maxLevel: 4, shape: SQ,
    tags: ['ember'], effects: [stat('fire', 10, 4, true), { kind: 'onKill', action: 'explode', base: 20, perLevel: 8 }], price: 210, weaponBias: ['greatsword'] },
  { id: 'e_phoenix_feather', name: 'Lông Hỏa Điểu', desc: 'Mỗi tầng một lần: khi gục, hồi sinh với {v}% HP. Lửa +5.', rarity: 'legendary', maxLevel: 5, shape: L3,
    tags: ['ember', 'windsong'], effects: [special('phoenixRevive', 30, 8), stat('fire', 5, 3)], price: 860 },
  { id: 'e_lava_lamp', name: 'Đèn Dung Nham', desc: 'Mỗi 8 giây một thiên thạch rơi xuống kẻ địch gần nhất, gây {v} sát thương Lửa.', rarity: 'rare', maxLevel: 3, shape: V3,
    tags: ['ember'], effects: [{ kind: 'periodic', every: 8, action: 'meteor', base: 25, perLevel: 10 }], price: 220 },
  { id: 'e_burning_crown', name: 'Vương Miện Rực Cháy', desc: 'Khi HP dưới 50%: sát thương +{v}%. Đòn đánh có 10% gây Bỏng. Phải chạm mép trên.', rarity: 'epic', maxLevel: 4, shape: T4,
    tags: ['ember', 'curse'], effects: [{ kind: 'conditional', when: 'hpBelow50', inner: stat('damagePct', 15, 7) }, onHit('burn', 10, 3)],
    constraint: { kind: 'touchEdge', edge: 'top' }, price: 400 },
  { id: 'e_kiln_brick', name: 'Gạch Lò Nung', desc: 'Phòng thủ +{v}. Khi bị đánh, phản 6 sát thương.', rarity: 'common', maxLevel: 2, shape: H3,
    tags: ['ember', 'guardian'], effects: [stat('defense', 2, 1), { kind: 'onHurt', action: 'thorns', base: 6, perLevel: 3 }], price: 70 },

  // ───────────── Mây Giông (storm) ─────────────
  { id: 's_spark_bead', name: 'Hạt Tia Điện', desc: 'Sát thương Sét +{v}. Đòn đánh có 5% cơ hội gây Giật.', rarity: 'common', maxLevel: 3, shape: S1,
    tags: ['storm'], effects: [stat('lightning', 3, 2), onHit('shock', 5, 1)], price: 70, unlockedByDefault: true },
  { id: 's_copper_coil', name: 'Cuộn Dây Đồng', desc: 'Đòn đánh có {v}% cơ hội gây Giật.', rarity: 'common', maxLevel: 3, shape: H2,
    tags: ['storm'], effects: [onHit('shock', 12, 4)], price: 90, unlockedByDefault: true },
  { id: 's_thunder_drum', name: 'Trống Sấm', desc: 'Mỗi 4 giây sét đánh một kẻ địch ngẫu nhiên, gây {v} sát thương Sét.', rarity: 'rare', maxLevel: 4, shape: SQ,
    tags: ['storm'], effects: [{ kind: 'periodic', every: 4, action: 'lightning', base: 20, perLevel: 8 }], price: 210 },
  { id: 's_storm_kite', name: 'Diều Giông', desc: 'Lướt tạo sóng xung kích gây {v} sát thương Sét.', rarity: 'rare', maxLevel: 3, shape: V3,
    tags: ['storm', 'windsong'], effects: [{ kind: 'onDash', action: 'shockwave', base: 15, perLevel: 6 }], price: 190 },
  { id: 's_lightning_rod', name: 'Cột Thu Lôi', desc: 'Giật lan thêm 1 mục tiêu và gây thêm {v}% sát thương. Sét +15%. Ô phía trên phải trống.', rarity: 'epic', maxLevel: 4, shape: V2,
    tags: ['storm'], effects: [special('lightningRod', 25, 10), stat('lightning', 15, 5, true)], constraint: { kind: 'emptyNeighbor', dir: 'up' }, price: 360 },
  { id: 's_static_sock', name: 'Tất Tĩnh Điện', desc: 'Tốc chạy +{v}%. Đòn đánh có 4% gây Giật.', rarity: 'common', maxLevel: 3, shape: S1,
    tags: ['storm'], effects: [stat('moveSpeed', 4, 2, true), onHit('shock', 4, 2)], price: 70, unlockedByDefault: true },
  { id: 's_tempest_eye', name: 'Mắt Bão Tố', desc: 'Mỗi 2,5 giây sét đánh gây {v} sát thương. Chí mạng +5%.', rarity: 'legendary', maxLevel: 5, shape: T4,
    tags: ['storm'], effects: [{ kind: 'periodic', every: 2.5, action: 'lightning', base: 30, perLevel: 10 }, stat('critChance', 5, 2)], price: 880 },
  { id: 's_battery_jar', name: 'Bình Ắc Quy', desc: 'Hồi MP +{v}%. Hạ gục hồi 5 MP.', rarity: 'epic', maxLevel: 3, shape: L3,
    tags: ['storm', 'lake'], effects: [stat('mpRegen', 20, 10, true), { kind: 'onKill', action: 'mp', base: 5, perLevel: 2 }], price: 340 },

  // ───────────── Hộ Vệ (guardian) ─────────────
  { id: 'gd_wooden_buckler', name: 'Khiên Gỗ Tí Hon', desc: 'Phòng thủ +{v}%.', rarity: 'common', maxLevel: 3, shape: S1,
    tags: ['guardian'], effects: [stat('defense', 3, 2)], price: 70, unlockedByDefault: true, weaponBias: ['swordshield'] },
  { id: 'gd_iron_helm', name: 'Mũ Sắt Méo', desc: 'HP tối đa +{v}.', rarity: 'common', maxLevel: 3, shape: H2,
    tags: ['guardian'], effects: [stat('maxHp', 8, 4)], price: 90, unlockedByDefault: true },
  { id: 'gd_thorn_vest', name: 'Áo Gai Nhím', desc: 'Khi bị đánh, phản {v} sát thương. Phòng thủ +3%.', rarity: 'rare', maxLevel: 4, shape: SQ,
    tags: ['guardian'], effects: [{ kind: 'onHurt', action: 'thorns', base: 15, perLevel: 6 }, stat('defense', 3, 1)], price: 200 },
  { id: 'gd_bastion_tower', name: 'Tháp Canh Tí Hon', desc: 'Phòng thủ +{v}%. Khi đầy HP: sát thương +10%. Phải chạm mép trái.', rarity: 'epic', maxLevel: 4, shape: V3,
    tags: ['guardian'], effects: [stat('defense', 8, 3), { kind: 'conditional', when: 'fullHp', inner: stat('damagePct', 10, 5) }],
    constraint: { kind: 'touchEdge', edge: 'left' }, price: 380 },
  { id: 'gd_turtle_shell', name: 'Mai Rùa Già', desc: 'Lướt tạo khiên chặn {v} sát thương trong 2 giây.', rarity: 'rare', maxLevel: 4, shape: L3,
    tags: ['guardian'], effects: [{ kind: 'onDash', action: 'shield', base: 10, perLevel: 5 }], price: 180 },
  { id: 'gd_bandage_roll', name: 'Cuộn Băng Vải', desc: 'Mỗi 10 giây hồi {v} HP.', rarity: 'common', maxLevel: 3, shape: V2,
    tags: ['guardian'], effects: [{ kind: 'periodic', every: 10, action: 'heal', base: 2, perLevel: 1 }], price: 100 },
  { id: 'gd_oath_banner', name: 'Cờ Lời Thề', desc: 'Đỡ hoàn hảo phản đòn gây {v} sát thương. Phòng thủ +5%.', rarity: 'legendary', maxLevel: 5, shape: T4,
    tags: ['guardian'], effects: [special('guardCounter', 40, 15), stat('defense', 5, 2)], price: 800, weaponBias: ['swordshield'] },
  { id: 'gd_stone_amulet', name: 'Bùa Đá Cuội', desc: 'Khi bị đánh, phóng sóng đẩy lùi gây {v} sát thương (hồi 3 giây).', rarity: 'common', maxLevel: 2, shape: S1,
    tags: ['guardian'], effects: [{ kind: 'onHurt', action: 'nova', base: 16, perLevel: 8 }], price: 110 },

  // ───────────── Bóng Đêm (shadow) ─────────────
  { id: 'sh_cat_bell', name: 'Chuông Mèo Mun', desc: 'Né tránh +{v}%.', rarity: 'common', maxLevel: 3, shape: S1,
    tags: ['shadow'], effects: [stat('evasion', 3, 2)], price: 80, unlockedByDefault: true },
  { id: 'sh_smoke_pellet', name: 'Viên Khói Mù', desc: 'Hồi lượt lướt nhanh hơn {v}%. Khi hết lượt lướt: né tránh +10%.', rarity: 'common', maxLevel: 3, shape: H2,
    tags: ['shadow'], effects: [stat('dashRecovery', 8, 4, true), { kind: 'conditional', when: 'noDashLeft', inner: stat('evasion', 10, 4) }], price: 90, unlockedByDefault: true },
  { id: 'sh_moon_dagger', name: 'Dao Trăng Khuyết', desc: 'Chí mạng +{v}%.', rarity: 'rare', maxLevel: 3, shape: V2,
    tags: ['shadow'], effects: [stat('critChance', 6, 3)], price: 190, weaponBias: ['dagger'] },
  { id: 'sh_night_cloak', name: 'Áo Choàng Đêm', desc: 'Né tránh +{v}%. Khi hết lượt lướt: né tránh thêm 15%.', rarity: 'rare', maxLevel: 4, shape: SQ,
    tags: ['shadow'], effects: [stat('evasion', 4, 2), { kind: 'conditional', when: 'noDashLeft', inner: stat('evasion', 15, 5) }], price: 230 },
  { id: 'sh_shadow_mask', name: 'Mặt Nạ Bóng', desc: 'Đánh từ phía sau gây thêm {v}% sát thương. Sát thương chí mạng +10%.', rarity: 'epic', maxLevel: 4, shape: T4,
    tags: ['shadow'], effects: [special('backstab', 30, 10), stat('critDamage', 10, 5)], price: 420, weaponBias: ['dagger', 'katana'] },
  { id: 'sh_raven_feather', name: 'Lông Quạ Đen', desc: 'Tốc chạy +{v}%. Né tránh +2%.', rarity: 'common', maxLevel: 3, shape: V2,
    tags: ['shadow', 'windsong'], effects: [stat('moveSpeed', 3, 2, true), stat('evasion', 2, 1)], price: 100 },
  { id: 'sh_eclipse_ring', name: 'Nhẫn Nhật Thực', desc: 'Chí mạng +{v}%. Đòn đánh có 15% gây Rách. Không hoạt động nếu có cổ vật Hộ Vệ.', rarity: 'legendary', maxLevel: 5, shape: S1,
    tags: ['shadow', 'curse'], effects: [stat('critChance', 8, 3), onHit('wound', 15, 5)], constraint: { kind: 'noOtherOfTag', tag: 'guardian' }, price: 820 },
  { id: 'sh_unlit_hood', name: 'Đèn Lồng Tắt', desc: 'Thêm 1 lượt lướt. Lướt hồi {v} HP.', rarity: 'epic', maxLevel: 3, shape: L3,
    tags: ['shadow'], effects: [stat('dashCount', 1, 0), { kind: 'onDash', action: 'heal', base: 1, perLevel: 1 }], price: 350 },

  // ───────────── Hồ Thu (lake) ─────────────
  { id: 'l_dew_drop', name: 'Giọt Sương Mai', desc: 'MP tối đa +{v}.', rarity: 'common', maxLevel: 3, shape: S1,
    tags: ['lake'], effects: [stat('maxMp', 6, 3)], price: 70, unlockedByDefault: true },
  { id: 'l_lotus_pin', name: 'Trâm Hoa Sen', desc: 'Hồi MP +{v}%.', rarity: 'common', maxLevel: 3, shape: H2,
    tags: ['lake'], effects: [stat('mpRegen', 15, 8, true)], price: 90, unlockedByDefault: true },
  { id: 'l_moon_pond_mirror', name: 'Gương Ao Trăng', desc: 'MP tối đa +{v}. Khi MP trên 50%: Phép thuật +5.', rarity: 'rare', maxLevel: 4, shape: SQ,
    tags: ['lake'], effects: [stat('maxMp', 15, 6), { kind: 'conditional', when: 'mpAbove50', inner: stat('magic', 5, 3) }], price: 210 },
  { id: 'l_water_jug', name: 'Bình Nước Suối', desc: 'Hạ gục hồi {v} MP.', rarity: 'common', maxLevel: 3, shape: V2,
    tags: ['lake'], effects: [{ kind: 'onKill', action: 'mp', base: 3, perLevel: 2 }], price: 100, unlockedByDefault: true },
  { id: 'l_clam_pearl', name: 'Ngọc Trai Sò', desc: 'Khi bị đánh hồi {v} MP. Phòng thủ +2%.', rarity: 'rare', maxLevel: 4, shape: L3,
    tags: ['lake'], effects: [{ kind: 'onHurt', action: 'mp', base: 5, perLevel: 3 }, stat('defense', 2, 1)], price: 170 },
  { id: 'l_rain_bell', name: 'Chuông Gọi Mưa', desc: 'Mỗi 5 giây bắn một quả cầu nước gây {v} sát thương. Hồi chiêu −5%.', rarity: 'epic', maxLevel: 4, shape: V3,
    tags: ['lake', 'academy'], effects: [{ kind: 'periodic', every: 5, action: 'orb', base: 18, perLevel: 7 }, stat('cooldownPct', 5, 3)], price: 340 },
  { id: 'l_tide_crown', name: 'Vương Miện Thủy Triều', desc: '{v}% sát thương nhận vào trừ vào MP trước. MP tối đa +20.', rarity: 'legendary', maxLevel: 5, shape: T4,
    tags: ['lake'], effects: [special('manaShield', 30, 8), stat('maxMp', 20, 8)], price: 860 },
  { id: 'l_koi_charm', name: 'Bùa Cá Chép', desc: 'Triệu hồi Đom Đóm gây {v} sát thương mỗi phát. Phải chạm mép dưới.', rarity: 'rare', maxLevel: 3, shape: H3,
    tags: ['lake', 'companion'], effects: [{ kind: 'summon', companion: 'cmp_wisp', base: 14, perLevel: 5 }], constraint: { kind: 'touchEdge', edge: 'bottom' }, price: 230 },

  // ───────────── Gió Hát (windsong) ─────────────
  { id: 'w_paper_fan', name: 'Quạt Giấy Lá', desc: 'Tốc chạy +{v}%.', rarity: 'common', maxLevel: 3, shape: S1,
    tags: ['windsong'], effects: [stat('moveSpeed', 4, 2, true)], price: 80, unlockedByDefault: true },
  { id: 'w_swift_sandals', name: 'Dép Cỏ Có Cánh', desc: 'Hồi lượt lướt nhanh hơn {v}%.', rarity: 'common', maxLevel: 3, shape: H2,
    tags: ['windsong'], effects: [stat('dashRecovery', 10, 5, true)], price: 90, unlockedByDefault: true },
  { id: 'w_wind_whistle', name: 'Còi Gió', desc: 'Lướt tạo luồng gió đẩy lùi gây {v} sát thương.', rarity: 'common', maxLevel: 3, shape: V2,
    tags: ['windsong'], effects: [{ kind: 'onDash', action: 'shockwave', base: 10, perLevel: 4 }], price: 100 },
  { id: 'w_cloud_boots', name: 'Ủng Mây Bông', desc: 'Thêm 1 lượt lướt. Tốc chạy +{v}%.', rarity: 'rare', maxLevel: 3, shape: SQ,
    tags: ['windsong'], effects: [stat('dashCount', 1, 0), stat('moveSpeed', 5, 2, true)], price: 240 },
  { id: 'w_pinwheel', name: 'Chong Chóng Tre', desc: 'Đòn lướt chém gây thêm {v}% sát thương. Tốc đánh +5%.', rarity: 'rare', maxLevel: 4, shape: V2,
    tags: ['windsong'], effects: [special('dashStrike', 25, 10), stat('attackSpeed', 5, 2, true)], price: 190, weaponBias: ['katana', 'dagger'] },
  { id: 'w_bamboo_flute', name: 'Sáo Trúc Gió', desc: 'Lướt hồi {v} HP. Hồi lượt lướt +15%.', rarity: 'epic', maxLevel: 4, shape: L3,
    tags: ['windsong'], effects: [{ kind: 'onDash', action: 'heal', base: 2, perLevel: 1 }, stat('dashRecovery', 15, 5, true)], price: 360 },
  { id: 'w_gale_scarf', name: 'Khăn Bão Lốc', desc: 'Lướt để lại lốc xoáy cuốn kẻ địch, gây {v} sát thương. Ô bên phải phải trống.', rarity: 'legendary', maxLevel: 5, shape: S4,
    tags: ['windsong'], effects: [special('galeDash', 40, 15)], constraint: { kind: 'emptyNeighbor', dir: 'right' }, price: 780 },
  { id: 'w_dandelion_seed', name: 'Hạt Bồ Công Anh', desc: 'May mắn +{v}.', rarity: 'common', maxLevel: 3, shape: S1,
    tags: ['windsong', 'companion'], effects: [stat('luck', 3, 2)], price: 70 },

  // ───────────── Học Viện (academy) ─────────────
  { id: 'a_icebolt_tome', name: 'Sách Băng Tiễn', desc: 'Phép: bắn mũi băng gây {v} sát thương Băng (12 MP).', rarity: 'common', maxLevel: 3, shape: V2,
    tags: ['academy', 'glacier'], effects: [{ kind: 'spell', spell: 'icebolt', mpCost: 12, cooldown: 1.5, base: 40, perLevel: 14 }], price: 100, unlockedByDefault: true },
  { id: 'a_fireball_tome', name: 'Sách Cầu Lửa', desc: 'Phép: ném cầu lửa nổ gây {v} sát thương Lửa (15 MP).', rarity: 'common', maxLevel: 3, shape: V2,
    tags: ['academy', 'ember'], effects: [{ kind: 'spell', spell: 'fireball', mpCost: 15, cooldown: 2, base: 52, perLevel: 16 }], price: 110, unlockedByDefault: true },
  { id: 'a_chain_scroll', name: 'Cuộn Sét Nhảy', desc: 'Phép: tia sét nảy giữa 4 kẻ địch, gây {v} sát thương (18 MP).', rarity: 'rare', maxLevel: 4, shape: H2,
    tags: ['academy', 'storm'], effects: [{ kind: 'spell', spell: 'chainLightning', mpCost: 18, cooldown: 2.5, base: 38, perLevel: 13 }], price: 200 },
  { id: 'a_arcane_quill', name: 'Bút Lông Huyền Bí', desc: 'Phép: 5 tia bí thuật tự dẫn, mỗi tia {v} sát thương (10 MP).', rarity: 'rare', maxLevel: 4, shape: S1,
    tags: ['academy'], effects: [{ kind: 'spell', spell: 'arcaneMissiles', mpCost: 10, cooldown: 1.2, base: 12, perLevel: 4 }], price: 230 },
  { id: 'a_bubble_primer', name: 'Sách Bong Bóng', desc: 'Phép: bong bóng chặn {v} sát thương trong 4 giây (20 MP).', rarity: 'rare', maxLevel: 3, shape: SQ,
    tags: ['academy', 'guardian'], effects: [{ kind: 'spell', spell: 'shieldBubble', mpCost: 20, cooldown: 8, base: 25, perLevel: 10 }], price: 210 },
  { id: 'a_blink_card', name: 'Thẻ Dịch Chuyển', desc: 'Phép: dịch chuyển {v} px theo hướng nhắm, bất tử trong lúc đó (10 MP).', rarity: 'epic', maxLevel: 3, shape: S1,
    tags: ['academy', 'shadow'], effects: [{ kind: 'spell', spell: 'blink', mpCost: 10, cooldown: 3, base: 140, perLevel: 20 }], price: 320 },
  { id: 'a_scholar_glasses', name: 'Kính Học Giả', desc: 'Phép thuật +{v}. Phép có thêm 5% chí mạng.', rarity: 'common', maxLevel: 3, shape: H2,
    tags: ['academy'], effects: [stat('magic', 4, 2), special('spellCrit', 5, 3)], price: 90, unlockedByDefault: true },
  { id: 'a_grand_grimoire', name: 'Đại Pháp Điển', desc: 'Phép thuật +{v}. Hồi chiêu −10%. 15% cơ hội phép tự lặp lại. Phải chạm mép phải.', rarity: 'legendary', maxLevel: 5, shape: SQ,
    tags: ['academy'], effects: [stat('magic', 10, 4), stat('cooldownPct', 10, 4), special('spellEcho', 15, 5)],
    constraint: { kind: 'touchEdge', edge: 'right' }, price: 880 },
  { id: 'a_ink_pot', name: 'Lọ Mực Sao', desc: 'Phép thuật +{v}%. Hạ gục hồi 4 MP.', rarity: 'epic', maxLevel: 4, shape: L4,
    tags: ['academy'], effects: [stat('magic', 15, 5, true), { kind: 'onKill', action: 'mp', base: 4, perLevel: 1 }], price: 330 },

  // ───────────── Đồng Hành (companion) ─────────────
  { id: 'c_sprout_pot', name: 'Chậu Mầm Non', desc: 'Triệu hồi Mầm Xanh bắn hạt gây {v} sát thương.', rarity: 'common', maxLevel: 3, shape: V2,
    tags: ['companion'], effects: [{ kind: 'summon', companion: 'cmp_sprout', base: 8, perLevel: 3 }], price: 110, unlockedByDefault: true },
  { id: 'c_bat_whistle', name: 'Còi Dơi Con', desc: 'Triệu hồi Dơi Nhỏ lao cắn gây {v} sát thương và hút máu.', rarity: 'rare', maxLevel: 4, shape: H2,
    tags: ['companion'], effects: [{ kind: 'summon', companion: 'cmp_bat', base: 12, perLevel: 4 }], price: 220 },
  { id: 'c_wisp_lantern', name: 'Lồng Đom Đóm', desc: 'Triệu hồi Đom Đóm bắn tia sáng gây {v} sát thương.', rarity: 'rare', maxLevel: 4, shape: V2,
    tags: ['companion'], effects: [{ kind: 'summon', companion: 'cmp_wisp', base: 10, perLevel: 4 }], price: 230 },
  { id: 'c_acorn_snack', name: 'Túi Hạt Sồi', desc: 'Bạn đồng hành gây thêm {v}% sát thương.', rarity: 'common', maxLevel: 3, shape: S1,
    tags: ['companion'], effects: [special('companionDamage', 10, 5)], price: 70, unlockedByDefault: true },
  { id: 'c_friend_badge', name: 'Huy Hiệu Bạn Thân', desc: 'HP tối đa +{v}. Bạn đồng hành hành động nhanh hơn 10%.', rarity: 'common', maxLevel: 3, shape: H2,
    tags: ['companion'], effects: [stat('maxHp', 5, 3), special('companionHaste', 10, 5)], price: 90 },
  { id: 'c_nest_hat', name: 'Mũ Tổ Chim', desc: 'Triệu hồi Dơi Nhỏ ({v} sát thương). Thêm 1 chỗ cho bạn đồng hành.', rarity: 'epic', maxLevel: 4, shape: T4,
    tags: ['companion'], effects: [{ kind: 'summon', companion: 'cmp_bat', base: 15, perLevel: 5 }, special('extraCompanion', 1, 0)], price: 400 },
  { id: 'c_root_heart', name: 'Rễ Cây Tâm Giao', desc: 'Mỗi đòn của bạn đồng hành hồi {v}% HP cho bạn (tối đa 1 lần/giây). Triệu hồi Mầm Xanh.', rarity: 'legendary', maxLevel: 5, shape: Z4,
    tags: ['companion'], effects: [special('companionShare', 1, 0.5), { kind: 'summon', companion: 'cmp_sprout', base: 15, perLevel: 6 }], price: 850 },
  { id: 'c_paw_print', name: 'Dấu Chân Mèo Con', desc: 'Bạn đồng hành có {v}% chí mạng. Né tránh +2%. Ô bên trái phải trống.', rarity: 'rare', maxLevel: 3, shape: S1,
    tags: ['companion', 'shadow'], effects: [special('companionCrit', 10, 5), stat('evasion', 2, 1)], constraint: { kind: 'emptyNeighbor', dir: 'left' }, price: 160 },

  // ───────────── Lời Nguyền (curse) ─────────────
  { id: 'cu_rusty_nail', name: 'Đinh Gỉ Sét', desc: 'Đòn đánh có {v}% cơ hội gây Rách.', rarity: 'common', maxLevel: 3, shape: S1,
    tags: ['curse'], effects: [onHit('wound', 12, 4)], price: 80, unlockedByDefault: true },
  { id: 'cu_toad_vial', name: 'Lọ Nước Cóc', desc: 'Đòn đánh có {v}% cơ hội gây Độc.', rarity: 'common', maxLevel: 3, shape: V2,
    tags: ['curse'], effects: [onHit('poison', 15, 5)], price: 90, unlockedByDefault: true },
  { id: 'cu_hex_doll', name: 'Búp Bê Rơm', desc: 'Gây thêm {v}% sát thương lên kẻ địch đang dính hiệu ứng xấu.', rarity: 'rare', maxLevel: 4, shape: V2,
    tags: ['curse'], effects: [special('debuffAmp', 15, 5)], price: 220 },
  { id: 'cu_witch_candle', name: 'Nến Phù Thủy', desc: 'Hút máu +{v}%. Khi HP dưới 50%: hút máu thêm 2%. Hạ gục hồi 1 HP.', rarity: 'rare', maxLevel: 3, shape: H2,
    tags: ['curse'], effects: [stat('lifesteal', 1, 1), { kind: 'conditional', when: 'hpBelow50', inner: stat('lifesteal', 2, 1) },
      { kind: 'onKill', action: 'heal', base: 1, perLevel: 0.5 }], price: 200 },
  { id: 'cu_bone_dice', name: 'Xúc Xắc Xương', desc: 'May mắn +{v}. Sát thương chí mạng +15%. Chỉ đặt ở góc túi.', rarity: 'epic', maxLevel: 3, shape: S1,
    tags: ['curse'], effects: [stat('luck', 5, 2), stat('critDamage', 15, 5)], constraint: { kind: 'cornerOnly' }, price: 330 },
  { id: 'cu_cursed_coin', name: 'Đồng Xu Nguyền', desc: 'Hạ gục rơi thêm {v} Hạt Dẻ. HP tối đa −5.', rarity: 'common', maxLevel: 3, shape: H2,
    tags: ['curse'], effects: [{ kind: 'onKill', action: 'money', base: 2, perLevel: 1 }, stat('maxHp', -5, 0)], price: 70, unlockedByDefault: true },
  { id: 'cu_plague_mask', name: 'Mặt Nạ Dịch Hạch', desc: 'Kẻ địch bị hạ nổ khí độc gây {v} sát thương. Đòn đánh có 10% gây Độc.', rarity: 'epic', maxLevel: 4, shape: T4,
    tags: ['curse'], effects: [{ kind: 'onKill', action: 'explode', base: 25, perLevel: 10 }, onHit('poison', 10, 5)], price: 380 },
  { id: 'cu_doom_clock', name: 'Đồng Hồ Tận Thế', desc: 'Mỗi đòn thứ 10 gây thêm {v} sát thương nguyền. Sát thương +8%. Không hoạt động nếu có cổ vật Đồng Hành.', rarity: 'legendary', maxLevel: 5, shape: Z4,
    tags: ['curse'], effects: [special('doomMark', 50, 20), stat('damagePct', 8, 3)], constraint: { kind: 'noOtherOfTag', tag: 'companion' }, price: 900 },
];

const artifacts: ArtifactDef[] = ART.map((a) => ({ ...a, icon: `art_${a.id}` }));
export default artifacts;
