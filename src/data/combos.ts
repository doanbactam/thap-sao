import type { ComboDef, Effect } from './types';

// Tier effects are applied at level 0 (engine passes level 0), so only `base` matters; perLevel is 0.
const st = (stat: any, base: number, pct?: boolean): Effect => (pct ? { kind: 'stat', stat, base, perLevel: 0, pct: true } : { kind: 'stat', stat, base, perLevel: 0 });
const hit = (apply: any, chance: number, stacks?: number): Effect => (stacks ? { kind: 'onHit', apply, chance, perLevel: 0, stacks } : { kind: 'onHit', apply, chance, perLevel: 0 });
const sp = (id: string, base: number): Effect => ({ kind: 'special', id, base, perLevel: 0 });

const combos: ComboDef[] = [
  { id: 'glacier', name: 'Băng Hà', desc: 'Làm chậm và đóng băng kẻ địch.', icon: 'combo_glacier', tiers: [
    { count: 2, text: 'Băng +4. Đòn đánh 10% gây Tê Cóng.', effects: [st('ice', 4), hit('frostbite', 0.1)] },
    { count: 4, text: 'Băng +15%. Đòn đánh 20% gây Tê Cóng. Kẻ địch đóng băng nhận thêm 20% sát thương.', effects: [st('ice', 15, true), hit('frostbite', 0.2), sp('freezeShatter', 20)] },
    { count: 6, text: 'Băng +30%. Tê Cóng gây 2 tầng. Mỗi 5 giây phát vòng băng 40 sát thương.', effects: [st('ice', 30, true), hit('frostbite', 0.25, 2), { kind: 'periodic', every: 5, action: 'frostRing', base: 40, perLevel: 0 }] },
  ] },
  { id: 'ember', name: 'Than Hồng', desc: 'Thiêu đốt kẻ địch bằng Bỏng cộng dồn.', icon: 'combo_ember', tiers: [
    { count: 2, text: 'Lửa +4. Đòn đánh 10% gây Bỏng.', effects: [st('fire', 4), hit('burn', 0.1)] },
    { count: 4, text: 'Lửa +15%. Đòn đánh 20% gây Bỏng. Kẻ địch bị hạ phát nổ 25 sát thương.', effects: [st('fire', 15, true), hit('burn', 0.2), { kind: 'onKill', action: 'explode', base: 25, perLevel: 0 }] },
    { count: 6, text: 'Lửa +30%. Bỏng gây 2 tầng. Mỗi 6 giây một thiên thạch 60 sát thương.', effects: [st('fire', 30, true), hit('burn', 0.25, 2), { kind: 'periodic', every: 6, action: 'meteor', base: 60, perLevel: 0 }] },
  ] },
  { id: 'storm', name: 'Mây Giông', desc: 'Sét lan giữa đám đông.', icon: 'combo_storm', tiers: [
    { count: 2, text: 'Sét +4. Đòn đánh 8% gây Giật.', effects: [st('lightning', 4), hit('shock', 0.08)] },
    { count: 4, text: 'Sét +15%. Mỗi 4 giây sét đánh 30 sát thương.', effects: [st('lightning', 15, true), hit('shock', 0.15), { kind: 'periodic', every: 4, action: 'lightning', base: 30, perLevel: 0 }] },
    { count: 6, text: 'Sét +30%. Giật lan thêm 2 mục tiêu. Tốc đánh +10%.', effects: [st('lightning', 30, true), sp('lightningRod', 40), st('attackSpeed', 10)] },
  ] },
  { id: 'guardian', name: 'Hộ Vệ', desc: 'Phòng thủ vững chắc và phản đòn.', icon: 'combo_guardian', tiers: [
    { count: 2, text: 'Phòng thủ +5%. HP tối đa +10.', effects: [st('defense', 5), st('maxHp', 10)] },
    { count: 4, text: 'Phòng thủ +12%. Bị đánh phản 20 sát thương.', effects: [st('defense', 12), { kind: 'onHurt', action: 'thorns', base: 20, perLevel: 0 }] },
    { count: 6, text: 'Phòng thủ +20%. HP tối đa +30. Đỡ hoàn hảo phản 60 sát thương.', effects: [st('defense', 20), st('maxHp', 30), sp('guardCounter', 60)] },
  ] },
  { id: 'shadow', name: 'Bóng Đêm', desc: 'Né tránh và lướt liên tục.', icon: 'combo_shadow', tiers: [
    { count: 2, text: 'Né tránh +5%.', effects: [st('evasion', 5)] },
    { count: 4, text: 'Né tránh +10%. Hồi lướt +25%. Chí mạng +5%.', effects: [st('evasion', 10), st('dashRecovery', 25), st('critChance', 5)] },
    { count: 6, text: 'Né tránh +18%. Thêm 1 lượt lướt. Đánh sau lưng +40% sát thương.', effects: [st('evasion', 18), st('dashCount', 1), sp('backstab', 40)] },
  ] },
  { id: 'lake', name: 'Hồ Thu', desc: 'Kho MP dồi dào cho phép và chiêu đặc biệt.', icon: 'combo_lake', tiers: [
    { count: 2, text: 'MP tối đa +15.', effects: [st('maxMp', 15)] },
    { count: 4, text: 'MP tối đa +30. Hồi MP +40%.', effects: [st('maxMp', 30), st('mpRegen', 40, true)] },
    { count: 6, text: 'MP tối đa +50. Hồi MP +80%. 25% sát thương nhận vào trừ vào MP.', effects: [st('maxMp', 50), st('mpRegen', 80, true), sp('manaShield', 25)] },
  ] },
  { id: 'windsong', name: 'Gió Hát', desc: 'Tốc độ và đòn lướt.', icon: 'combo_windsong', tiers: [
    { count: 2, text: 'Tốc chạy +8%.', effects: [st('moveSpeed', 8)] },
    { count: 4, text: 'Tốc chạy +15%. Lướt tạo sóng gió 20 sát thương.', effects: [st('moveSpeed', 15), { kind: 'onDash', action: 'shockwave', base: 20, perLevel: 0 }] },
    { count: 6, text: 'Tốc chạy +25%. Thêm 1 lượt lướt. Đòn lướt chém +50% sát thương.', effects: [st('moveSpeed', 25), st('dashCount', 1), sp('dashStrike', 50)] },
  ] },
  { id: 'academy', name: 'Học Viện', desc: 'Phép thuật mạnh và hồi chiêu nhanh.', icon: 'combo_academy', tiers: [
    { count: 2, text: 'Phép thuật +5.', effects: [st('magic', 5)] },
    { count: 4, text: 'Phép thuật +12. Hồi chiêu −10%. Phép chí mạng +10%.', effects: [st('magic', 12), st('cooldownPct', 10), sp('spellCrit', 10)] },
    { count: 6, text: 'Phép thuật +25. Hồi chiêu −20%. 25% phép tự lặp lại.', effects: [st('magic', 25), st('cooldownPct', 20), sp('spellEcho', 25)] },
  ] },
  { id: 'companion', name: 'Đồng Hành', desc: 'Bạn đồng hành chiến đấu bên cạnh.', icon: 'combo_companion', tiers: [
    { count: 3, text: 'Triệu hồi thêm Mầm Xanh. Bạn đồng hành +20% sát thương.', effects: [{ kind: 'summon', companion: 'cmp_sprout', base: 12, perLevel: 0 }, sp('companionDamage', 20)] },
    { count: 5, text: 'Triệu hồi thêm Đom Đóm. Bạn đồng hành +50% sát thương, nhanh hơn 25%.', effects: [{ kind: 'summon', companion: 'cmp_wisp', base: 20, perLevel: 0 }, sp('companionDamage', 50), sp('companionHaste', 25)] },
  ] },
  { id: 'curse', name: 'Lời Nguyền', desc: 'Hiệu ứng xấu mạnh hơn, đánh đổi bằng máu.', icon: 'combo_curse', tiers: [
    { count: 3, text: 'Đánh kẻ địch dính hiệu ứng xấu +20%. Đòn đánh 10% gây Độc.', effects: [sp('debuffAmp', 20), hit('poison', 0.1)] },
    { count: 5, text: 'Đánh kẻ địch dính hiệu ứng xấu +45%. Sát thương +10%. Hút máu +3%.', effects: [sp('debuffAmp', 45), st('damagePct', 10), st('lifesteal', 3)] },
  ] },
];
export default combos;
