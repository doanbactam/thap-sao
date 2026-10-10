import type { WeaponUpgradeDef, WeaponId } from './types';

// Mod key vocabulary (see docs/CONTENT.md): extraHit, specialCostPct, aspect, pierce, magazine, reloadPct,
// furyDuration, rangePct, arcPct, dashAttack, guardCostPct, chargeSpeedPct, projectileCount, homing,
// critOnPerfect, knockbackPct, damagePct, attackSpeedPct.
type U = Omit<WeaponUpgradeDef, 'weapon'>;
const ASPECTS = ['fire', 'ice', 'lightning'] as const;
const ASPECT_VN: Record<string, string> = { fire: 'Lửa', ice: 'Băng', lightning: 'Sét' };

/** 3 mutually-exclusive tier-2 element aspects for a weapon. */
function aspects(prefix: string): U[] {
  const ids = ASPECTS.map((a) => `${prefix}_aspect_${a}`);
  return ASPECTS.map((a, i) => ({
    id: ids[i], tier: 2 as const, name: `Hệ ${ASPECT_VN[a]}`,
    desc: `Chuyển sát thương vũ khí sang hệ ${ASPECT_VN[a]} (dùng chỉ số ${ASPECT_VN[a]}).`,
    excludes: ids.filter((x) => x !== ids[i]), mods: [{ key: 'aspect', value: a }],
  }));
}

const BY_WEAPON: Record<WeaponId, U[]> = {
  swordshield: [
    { id: 'ss_fourth_hit', tier: 1, name: 'Nhát Thứ Tư', desc: 'Chuỗi đòn thêm 1 nhát.', mods: [{ key: 'extraHit', value: 1 }] },
    { id: 'ss_light_guard', tier: 1, name: 'Khiên Nhẹ', desc: 'Đỡ đòn tốn ít hơn 40% MP.', mods: [{ key: 'guardCostPct', value: -40 }] },
    { id: 'ss_cheap_bash', tier: 1, name: 'Húc Tiết Kiệm', desc: 'Chiêu đặc biệt tốn ít hơn 30% MP.', mods: [{ key: 'specialCostPct', value: -30 }] },
    { id: 'ss_wide_swing', tier: 1, name: 'Vung Rộng', desc: 'Góc chém +25%.', mods: [{ key: 'arcPct', value: 25 }] },
    ...aspects('ss'),
    { id: 'ss_dash_bash', tier: 2, name: 'Lướt Húc', desc: 'Lướt kèm cú húc khiên gây sát thương.', mods: [{ key: 'dashAttack', value: true }] },
    { id: 'ss_counter_crit', tier: 3, name: 'Phản Kích Hoàn Hảo', desc: 'Đòn ngay sau đỡ hoàn hảo luôn chí mạng.', requires: ['ss_light_guard'], mods: [{ key: 'critOnPerfect', value: true }] },
    { id: 'ss_heavy_bash', tier: 3, name: 'Húc Sấm Sét', desc: 'Húc khiên đẩy lùi +60% và gây thêm 40% sát thương.', requires: ['ss_dash_bash'], mods: [{ key: 'knockbackPct', value: 60 }, { key: 'damagePct', value: 40 }] },
  ],
  greatsword: [
    { id: 'gs_long_blade', tier: 1, name: 'Lưỡi Dài', desc: 'Tầm chém +20%.', mods: [{ key: 'rangePct', value: 20 }] },
    { id: 'gs_quick_charge', tier: 1, name: 'Tụ Lực Nhanh', desc: 'Tích lực nhanh hơn 35%.', mods: [{ key: 'chargeSpeedPct', value: 35 }] },
    { id: 'gs_shove', tier: 1, name: 'Đẩy Văng', desc: 'Đẩy lùi +50%.', mods: [{ key: 'knockbackPct', value: 50 }] },
    { id: 'gs_cheap_spin', tier: 1, name: 'Xoay Tiết Kiệm', desc: 'Chiêu đặc biệt tốn ít hơn 30% MP.', mods: [{ key: 'specialCostPct', value: -30 }] },
    ...aspects('gs'),
    { id: 'gs_third_swing', tier: 2, name: 'Nhát Thứ Ba', desc: 'Chuỗi đòn thêm 1 nhát bổ dọc.', mods: [{ key: 'extraHit', value: 1 }] },
    { id: 'gs_whirlwind', tier: 3, name: 'Gió Lốc Thép', desc: 'Xoay chém rộng hơn 40% và gây thêm 30% sát thương.', requires: ['gs_quick_charge'], mods: [{ key: 'arcPct', value: 40 }, { key: 'damagePct', value: 30 }] },
    { id: 'gs_lunge', tier: 3, name: 'Bổ Nhào', desc: 'Lướt kết thúc bằng cú bổ xuống.', requires: ['gs_long_blade'], mods: [{ key: 'dashAttack', value: true }, { key: 'damagePct', value: 15 }] },
  ],
  dagger: [
    { id: 'dg_fury_long', tier: 1, name: 'Cuồng Nộ Bền', desc: 'Cuồng Nộ kéo dài thêm 2 giây.', mods: [{ key: 'furyDuration', value: 2 }] },
    { id: 'dg_swift', tier: 1, name: 'Tay Nhanh', desc: 'Tốc đánh +15%.', mods: [{ key: 'attackSpeedPct', value: 15 }] },
    { id: 'dg_cheap_step', tier: 1, name: 'Bước Bóng Rẻ', desc: 'Chiêu đặc biệt tốn ít hơn 30% MP.', mods: [{ key: 'specialCostPct', value: -30 }] },
    { id: 'dg_reach', tier: 1, name: 'Lưỡi Dài Hơn', desc: 'Tầm đâm +20%.', mods: [{ key: 'rangePct', value: 20 }] },
    ...aspects('dg'),
    { id: 'dg_fifth_hit', tier: 2, name: 'Nhát Thứ Năm', desc: 'Chuỗi đòn thêm 1 nhát.', mods: [{ key: 'extraHit', value: 1 }] },
    { id: 'dg_dash_cut', tier: 2, name: 'Lướt Cắt', desc: 'Lướt cứa trúng kẻ địch trên đường đi.', mods: [{ key: 'dashAttack', value: true }] },
    { id: 'dg_frenzy', tier: 3, name: 'Điên Cuồng', desc: 'Cuồng Nộ thêm 3 giây; trong lúc đó sát thương +25%.', requires: ['dg_fury_long'], mods: [{ key: 'furyDuration', value: 3 }, { key: 'damagePct', value: 25 }] },
  ],
  katana: [
    { id: 'kt_perfect_draw', tier: 1, name: 'Rút Kiếm Chuẩn', desc: 'Thả đúng lúc khi rút kiếm luôn chí mạng.', mods: [{ key: 'critOnPerfect', value: true }] },
    { id: 'kt_fast_draw', tier: 1, name: 'Rút Nhanh', desc: 'Tụ kiếm nhanh hơn 30%.', mods: [{ key: 'chargeSpeedPct', value: 30 }] },
    { id: 'kt_cheap_draw', tier: 1, name: 'Tâm Tĩnh', desc: 'Chiêu đặc biệt tốn ít hơn 30% MP.', mods: [{ key: 'specialCostPct', value: -30 }] },
    { id: 'kt_long_lunge', tier: 1, name: 'Đâm Xa', desc: 'Tầm chém +20%.', mods: [{ key: 'rangePct', value: 20 }] },
    ...aspects('kt'),
    { id: 'kt_dash_slash', tier: 2, name: 'Lướt Trảm', desc: 'Lướt kèm nhát chém.', mods: [{ key: 'dashAttack', value: true }] },
    { id: 'kt_fourth_hit', tier: 2, name: 'Nhát Thứ Tư', desc: 'Chuỗi đòn thêm 1 nhát.', mods: [{ key: 'extraHit', value: 1 }] },
    { id: 'kt_thousand_cuts', tier: 3, name: 'Thiên Trảm', desc: 'Rút kiếm gây thêm 50% sát thương và xuyên mọi kẻ địch.', requires: ['kt_perfect_draw'], mods: [{ key: 'damagePct', value: 50 }, { key: 'pierce', value: 99 }] },
  ],
  crossbow: [
    { id: 'cb_pierce', tier: 1, name: 'Mũi Xuyên', desc: 'Mũi tên xuyên thêm 1 kẻ địch.', mods: [{ key: 'pierce', value: 1 }] },
    { id: 'cb_magazine', tier: 1, name: 'Băng Đạn Lớn', desc: 'Băng đạn +3.', mods: [{ key: 'magazine', value: 3 }] },
    { id: 'cb_reload', tier: 1, name: 'Nạp Nhanh', desc: 'Nạp đạn nhanh hơn 30%.', mods: [{ key: 'reloadPct', value: -30 }] },
    { id: 'cb_cheap_heavy', tier: 1, name: 'Tên Nặng Rẻ', desc: 'Chiêu đặc biệt tốn ít hơn 30% MP.', mods: [{ key: 'specialCostPct', value: -30 }] },
    ...aspects('cb'),
    { id: 'cb_twin', tier: 2, name: 'Song Tiễn', desc: 'Mỗi phát bắn 2 mũi tên (mỗi mũi −30% sát thương).', mods: [{ key: 'projectileCount', value: 1 }, { key: 'damagePct', value: -30 }] },
    { id: 'cb_seeker', tier: 2, name: 'Tên Tìm Mồi', desc: 'Mũi tên tự dẫn nhẹ.', mods: [{ key: 'homing', value: 0.5 }] },
    { id: 'cb_volley', tier: 3, name: 'Mưa Tên', desc: 'Thêm 2 mũi tên mỗi phát, băng đạn +3.', requires: ['cb_twin', 'cb_magazine'], mods: [{ key: 'projectileCount', value: 2 }, { key: 'magazine', value: 3 }] },
    { id: 'cb_ballista', tier: 3, name: 'Nỏ Công Thành', desc: 'Mũi tên xuyên thêm 3, sát thương +35%, tốc bắn −15%.', requires: ['cb_pierce'], excludes: ['cb_volley'], mods: [{ key: 'pierce', value: 3 }, { key: 'damagePct', value: 35 }, { key: 'attackSpeedPct', value: -15 }] },
  ],
  staff: [
    { id: 'st_split', tier: 1, name: 'Cầu Đôi', desc: 'Bắn thêm 1 cầu phép.', mods: [{ key: 'projectileCount', value: 1 }, { key: 'damagePct', value: -20 }] },
    { id: 'st_seek', tier: 1, name: 'Dẫn Đường', desc: 'Cầu phép tự dẫn mạnh hơn.', mods: [{ key: 'homing', value: 1 }] },
    { id: 'st_cheap_nova', tier: 1, name: 'Nổ Tiết Kiệm', desc: 'Chiêu đặc biệt tốn ít hơn 30% MP.', mods: [{ key: 'specialCostPct', value: -30 }] },
    { id: 'st_far', tier: 1, name: 'Tầm Xa', desc: 'Tầm bắn +25%.', mods: [{ key: 'rangePct', value: 25 }] },
    ...aspects('st'),
    { id: 'st_quick_cast', tier: 2, name: 'Niệm Nhanh', desc: 'Tốc đánh +20%.', mods: [{ key: 'attackSpeedPct', value: 20 }] },
    { id: 'st_pierce', tier: 2, name: 'Cầu Xuyên', desc: 'Cầu phép xuyên thêm 2 kẻ địch.', mods: [{ key: 'pierce', value: 2 }] },
    { id: 'st_archmage', tier: 3, name: 'Đại Pháp Sư', desc: 'Vụ nổ nguyên tố lớn hơn 50% và gây thêm 40% sát thương.', requires: ['st_cheap_nova'], mods: [{ key: 'rangePct', value: 50 }, { key: 'damagePct', value: 40 }] },
  ],
};

const weaponUpgrades: WeaponUpgradeDef[] = (Object.keys(BY_WEAPON) as WeaponId[]).flatMap((w) => BY_WEAPON[w].map((u) => ({ ...u, weapon: w })));
export default weaponUpgrades;
