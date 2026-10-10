import type { DestinyNode } from './types';

// Cây Định Mệnh. pos = [column, row] in tree grid units: column −4..4 (0 = trunk), row 0 = root at the bottom, rows grow
// upward. Suggested spacing on screen ≈ 110 × 72 px. Every node except the root requires at least one earlier node.
// grant keys: homeRepair, talentPoints, seedMoney, startDice, bagCols, bagRows, sideBag, levelUpHeal (% max HP restored on
// level-up), unlockWeapon:<id> (value = weapon id), unlockArtifacts (count added to the pool), potionSlot, hardMode,
// pocketDimension, chestReroll.
const N = (id: string, name: string, desc: string, cost: number, requires: string[], pos: [number, number], key: string, value: number | string): DestinyNode =>
  ({ id, name, desc, cost, requires, pos, grant: { key, value } });

const destiny: DestinyNode[] = [
  N('d_home_repair', 'Sửa Nhà', 'Sửa lại căn nhà ở Làng Mây. Mở khóa Gương Tài Năng.', 5, [], [0, 0], 'homeRepair', 1),
  // talents (left trunk) – 5 × 5 = 25 talent points
  N('d_talent_1', 'Hạt Giống Tài Năng I', '+5 điểm tài năng.', 10, ['d_home_repair'], [-1, 1], 'talentPoints', 5),
  N('d_talent_2', 'Hạt Giống Tài Năng II', '+5 điểm tài năng.', 20, ['d_talent_1'], [-2, 2], 'talentPoints', 5),
  N('d_talent_3', 'Hạt Giống Tài Năng III', '+5 điểm tài năng.', 35, ['d_talent_2'], [-2, 3], 'talentPoints', 5),
  N('d_talent_4', 'Hạt Giống Tài Năng IV', '+5 điểm tài năng.', 50, ['d_talent_3'], [-2, 4], 'talentPoints', 5),
  N('d_talent_5', 'Hạt Giống Tài Năng V', '+5 điểm tài năng.', 70, ['d_talent_4'], [-2, 5], 'talentPoints', 5),
  // survival (far left)
  N('d_levelup_heal_1', 'Hơi Thở Mới', 'Lên cấp hồi 30% HP.', 30, ['d_talent_1'], [-3, 2], 'levelUpHeal', 30),
  N('d_levelup_heal_2', 'Hơi Thở Sâu', 'Lên cấp hồi thêm 30% HP.', 60, ['d_levelup_heal_1'], [-4, 3], 'levelUpHeal', 30),
  N('d_potion_slot_1', 'Thắt Lưng Da', '+1 ô bình thuốc.', 35, ['d_levelup_heal_1'], [-3, 4], 'potionSlot', 1),
  N('d_potion_slot_2', 'Thắt Lưng Thợ Săn', '+1 ô bình thuốc.', 70, ['d_potion_slot_1'], [-4, 5], 'potionSlot', 1),
  // money / dice (right trunk)
  N('d_seed_money_1', 'Hũ Hạt Dẻ', 'Bắt đầu mỗi lượt với 200 Hạt Dẻ.', 15, ['d_home_repair'], [1, 1], 'seedMoney', 200),
  N('d_seed_money_2', 'Kho Hạt Dẻ', 'Bắt đầu mỗi lượt với thêm 400 Hạt Dẻ.', 40, ['d_seed_money_1'], [2, 2], 'seedMoney', 400),
  N('d_dice_1', 'Xúc Xắc Gỗ', 'Bắt đầu với 2 Xúc Xắc.', 10, ['d_home_repair'], [3, 1], 'startDice', 2),
  N('d_dice_2', 'Xúc Xắc Đá', 'Bắt đầu với thêm 2 Xúc Xắc.', 25, ['d_dice_1'], [4, 2], 'startDice', 2),
  N('d_dice_3', 'Xúc Xắc Ngọc', 'Bắt đầu với thêm 2 Xúc Xắc (tối đa 6).', 45, ['d_dice_2'], [4, 3], 'startDice', 2),
  N('d_chest_reroll', 'Rương May Mắn', 'Có thể đổ lại phần thưởng của rương tiền một lần mỗi tầng.', 35, ['d_dice_3'], [4, 4], 'chestReroll', 1),
  // weapons
  N('d_unlock_dagger', 'Dao Găm', 'Mở khóa vũ khí Dao Găm.', 20, ['d_seed_money_1'], [2, 3], 'unlockWeapon', 'dagger'),
  N('d_unlock_greatsword', 'Đại Kiếm', 'Mở khóa vũ khí Đại Kiếm.', 30, ['d_unlock_dagger'], [3, 4], 'unlockWeapon', 'greatsword'),
  N('d_unlock_katana', 'Kiếm Cong', 'Mở khóa vũ khí Kiếm Cong.', 45, ['d_unlock_dagger'], [2, 5], 'unlockWeapon', 'katana'),
  N('d_unlock_crossbow', 'Nỏ', 'Mở khóa vũ khí Nỏ.', 45, ['d_unlock_greatsword'], [3, 6], 'unlockWeapon', 'crossbow'),
  N('d_unlock_staff', 'Gậy Phép', 'Mở khóa vũ khí Gậy Phép.', 60, ['d_unlock_katana'], [2, 7], 'unlockWeapon', 'staff'),
  // bag (trunk)
  N('d_bag_col_1', 'Túi Mở Rộng I', 'Túi đồ +1 cột.', 30, ['d_home_repair'], [0, 2], 'bagCols', 1),
  N('d_bag_row_1', 'Túi Mở Rộng II', 'Túi đồ +1 hàng.', 50, ['d_bag_col_1'], [0, 3], 'bagRows', 1),
  N('d_bag_col_2', 'Túi Mở Rộng III', 'Túi đồ +1 cột (tối đa 7×5).', 80, ['d_bag_row_1'], [0, 5], 'bagCols', 1),
  N('d_side_bag', 'Túi Đeo Hông', 'Mở Túi Phụ 4 ô (đồ trong đó không có tác dụng).', 25, ['d_bag_col_1'], [-1, 3], 'sideBag', 4),
  // artifact pool
  N('d_artifacts_1', 'Kệ Cổ Vật I', 'Thêm 6 cổ vật vào kho có thể xuất hiện.', 15, ['d_bag_col_1'], [1, 3], 'unlockArtifacts', 6),
  N('d_artifacts_2', 'Kệ Cổ Vật II', 'Thêm 6 cổ vật vào kho có thể xuất hiện.', 30, ['d_artifacts_1'], [1, 4], 'unlockArtifacts', 6),
  N('d_artifacts_3', 'Kệ Cổ Vật III', 'Thêm 8 cổ vật vào kho có thể xuất hiện.', 50, ['d_artifacts_2'], [1, 6], 'unlockArtifacts', 8),
  N('d_artifacts_4', 'Kệ Cổ Vật IV', 'Thêm 10 cổ vật vào kho có thể xuất hiện.', 80, ['d_artifacts_3'], [1, 7], 'unlockArtifacts', 10),
  N('d_pocket_dimension', 'Túi Không Gian', 'Sự kiện Túi Không Gian có thể xuất hiện: dùng Ngọc Sao mở khóa cổ vật vĩnh viễn.', 40, ['d_artifacts_2'], [-1, 6], 'pocketDimension', 1),
  // capstone
  N('d_hard_mode', 'Thử Thách Sao Băng', 'Mở Chế Độ Khó (kẻ địch +40% HP và sát thương). Cần chiến thắng một lần.', 100, ['d_bag_col_2', 'd_unlock_staff'], [0, 8], 'hardMode', 1),
];
export default destiny;
