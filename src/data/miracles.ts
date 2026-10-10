import type { MiracleDef } from './types';

// Run-wide passives from the Tree Roots node (1 per run). Effects apply at level 0.
const miracles: MiracleDef[] = [
  { id: 'mir_starlight_blessing', name: 'Phúc Lành Ánh Sao', desc: 'Mọi sát thương +15%. HP tối đa +20.', icon: 'mir_1',
    effects: [{ kind: 'stat', stat: 'damagePct', base: 15, perLevel: 0 }, { kind: 'stat', stat: 'maxHp', base: 20, perLevel: 0 }] },
  { id: 'mir_second_heart', name: 'Trái Tim Thứ Hai', desc: 'Mỗi tầng một lần: khi gục, hồi sinh với 50% HP.', icon: 'mir_2',
    effects: [{ kind: 'special', id: 'phoenixRevive', base: 50, perLevel: 0 }] },
  { id: 'mir_falling_stars', name: 'Mưa Sao Băng', desc: 'Mỗi 3 giây một ngôi sao rơi vào kẻ địch, gây 45 sát thương.', icon: 'mir_3',
    effects: [{ kind: 'periodic', every: 3, action: 'meteor', base: 45, perLevel: 0 }] },
  { id: 'mir_golden_touch', name: 'Bàn Tay Vàng', desc: 'Hạ gục rơi thêm 4 Hạt Dẻ. Giá cửa hàng −15%.', icon: 'mir_4',
    effects: [{ kind: 'onKill', action: 'money', base: 4, perLevel: 0 }, { kind: 'stat', stat: 'barter', base: 15, perLevel: 0 }] },
  { id: 'mir_endless_wind', name: 'Gió Bất Tận', desc: 'Thêm 2 lượt lướt. Hồi lướt +50%.', icon: 'mir_5',
    effects: [{ kind: 'stat', stat: 'dashCount', base: 2, perLevel: 0 }, { kind: 'stat', stat: 'dashRecovery', base: 50, perLevel: 0 }] },
  { id: 'mir_blood_moon', name: 'Trăng Máu', desc: 'Hút máu +6%. Chí mạng +10%. HP tối đa −15.', icon: 'mir_6',
    effects: [{ kind: 'stat', stat: 'lifesteal', base: 6, perLevel: 0 }, { kind: 'stat', stat: 'critChance', base: 10, perLevel: 0 }, { kind: 'stat', stat: 'maxHp', base: -15, perLevel: 0 }] },
  { id: 'mir_deep_well', name: 'Giếng Sâu', desc: 'MP tối đa +40. Hồi MP gấp đôi. Phép thuật +10.', icon: 'mir_7',
    effects: [{ kind: 'stat', stat: 'maxMp', base: 40, perLevel: 0 }, { kind: 'stat', stat: 'mpRegen', base: 100, perLevel: 0, pct: true }, { kind: 'stat', stat: 'magic', base: 10, perLevel: 0 }] },
  { id: 'mir_iron_oath', name: 'Lời Thề Sắt', desc: 'Phòng thủ +15%. Bị đánh phát sóng gây 40 sát thương.', icon: 'mir_8',
    effects: [{ kind: 'stat', stat: 'defense', base: 15, perLevel: 0 }, { kind: 'onHurt', action: 'nova', base: 40, perLevel: 0 }] },
];
export default miracles;
