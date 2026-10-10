import type { TabletDef, TabletOp } from './types';

// Coordinates: x → right, y → down (so "up" is [0,-1]). All patterns are at rotation 0; tablets rotate like artifacts.
const R: [number, number] = [1, 0], L: [number, number] = [-1, 0], U: [number, number] = [0, -1], D: [number, number] = [0, 1];
const lv = (amount: number): TabletOp => ({ op: 'level', amount });
const at = (cells: Array<[number, number]>, op: TabletOp) => cells.map((c) => ({ at: c, op }));

const TAB: Omit<TabletDef, 'icon'>[] = [
  // ── single direction ──
  { id: 't_arrow', name: 'Phiến Mũi Tên', desc: 'Cổ vật bên phải +1 cấp.', rarity: 'common', shape: [[0, 0]],
    targets: at([R], lv(1)), price: 60, unlockedByDefault: true },
  { id: 't_rise', name: 'Phiến Ngước Lên', desc: 'Cổ vật phía trên +1 cấp.', rarity: 'common', shape: [[0, 0]],
    targets: at([U], lv(1)), price: 60, unlockedByDefault: true },
  { id: 't_leap', name: 'Phiến Nhảy Cóc', desc: 'Cổ vật cách 1 ô bên phải +1 cấp.', rarity: 'common', shape: [[0, 0]],
    targets: at([[2, 0]], lv(1)), price: 70, unlockedByDefault: true },
  { id: 't_push_two', name: 'Phiến Tiến Đôi', desc: 'Cổ vật bên phải +2 cấp.', rarity: 'rare', shape: [[0, 0]],
    targets: at([R], lv(2)), price: 180 },
  // ── two sides ──
  { id: 't_twin_side', name: 'Phiến Song Hành', desc: 'Cổ vật bên trái và bên phải +1 cấp.', rarity: 'common', shape: [[0, 0]],
    targets: at([L, R], lv(1)), price: 100, unlockedByDefault: true },
  { id: 't_twin_vert', name: 'Phiến Trên Dưới', desc: 'Cổ vật phía trên và phía dưới +1 cấp.', rarity: 'common', shape: [[0, 0]],
    targets: at([U, D], lv(1)), price: 100, unlockedByDefault: true },
  { id: 't_corner', name: 'Phiến Góc Vuông', desc: 'Cổ vật bên phải và phía dưới +1 cấp.', rarity: 'common', shape: [[0, 0]],
    targets: at([R, D], lv(1)), price: 90, unlockedByDefault: true },
  { id: 't_line_two', name: 'Phiến Đường Thẳng', desc: 'Hai ô liền bên phải: mỗi cổ vật +1 cấp.', rarity: 'rare', shape: [[0, 0]],
    targets: at([R, [2, 0]], lv(1)), price: 170 },
  // ── cross / diagonal ──
  { id: 't_cross', name: 'Phiến Thập Tự', desc: 'Cổ vật ở bốn hướng +1 cấp.', rarity: 'rare', shape: [[0, 0]],
    targets: at([U, R, D, L], lv(1)), price: 230 },
  { id: 't_diagonal', name: 'Phiến Đường Chéo', desc: 'Cổ vật ở góc trên-phải và dưới-trái +1 cấp.', rarity: 'rare', shape: [[0, 0]],
    targets: at([[1, -1], [-1, 1]], lv(1)), price: 160 },
  { id: 't_x_mark', name: 'Phiến Chữ X', desc: 'Cổ vật ở bốn góc chéo +1 cấp.', rarity: 'epic', shape: [[0, 0]],
    targets: at([[1, -1], [1, 1], [-1, 1], [-1, -1]], lv(1)), price: 340 },
  { id: 't_triangle', name: 'Phiến Tam Giác', desc: 'Cổ vật phía trên, dưới-trái và dưới-phải +1 cấp.', rarity: 'rare', shape: [[0, 0]],
    targets: at([U, [-1, 1], [1, 1]], lv(1)), price: 200 },
  // ── trade-offs ──
  { id: 't_gamble', name: 'Phiến Đánh Cược', desc: 'Bên phải +2 cấp, bên trái −1 cấp.', rarity: 'common', shape: [[0, 0]],
    targets: [...at([R], lv(2)), ...at([L], lv(-1))], price: 90, unlockedByDefault: true },
  { id: 't_scale', name: 'Phiến Cán Cân', desc: 'Phía trên +2 cấp, phía dưới −1 cấp.', rarity: 'rare', shape: [[0, 0]],
    targets: [...at([U], lv(2)), ...at([D], lv(-1))], price: 150 },
  { id: 't_heavy', name: 'Phiến Nặng Trĩu', desc: 'Trái và phải +2 cấp; trên và dưới −1 cấp.', rarity: 'epic', shape: [[0, 0]],
    targets: [...at([L, R], lv(2)), ...at([U, D], lv(-1))], price: 380 },
  { id: 't_sacrifice', name: 'Phiến Hiến Tế', desc: 'Bên phải +3 cấp; bên trái và phía trên −2 cấp (dễ vô hiệu hóa).', rarity: 'legendary', shape: [[0, 0]],
    targets: [...at([R], lv(3)), ...at([L, U], lv(-2))], price: 650 },
  // ── special ops ──
  { id: 't_unchain', name: 'Phiến Phóng Khoáng', desc: 'Cổ vật bên phải bỏ qua điều kiện đặt.', rarity: 'rare', shape: [[0, 0]],
    targets: at([R], { op: 'ignoreConstraint' }), price: 160 },
  { id: 't_unchain_ring', name: 'Phiến Tháo Xích', desc: 'Cổ vật ở bốn hướng bỏ qua điều kiện đặt.', rarity: 'epic', shape: [[0, 0]],
    targets: at([U, R, D, L], { op: 'ignoreConstraint' }), price: 340 },
  { id: 't_star', name: 'Phiến Thêm Sao', desc: 'Cổ vật bên phải +1 cấp tối đa.', rarity: 'rare', shape: [[0, 0]],
    targets: at([R], { op: 'maxLevel', amount: 1 }), price: 200 },
  { id: 't_star_pair', name: 'Phiến Sao Đôi', desc: 'Cổ vật bên trái và phải +1 cấp tối đa.', rarity: 'epic', shape: [[0, 0]],
    targets: at([L, R], { op: 'maxLevel', amount: 1 }), price: 360 },
  { id: 't_ascend', name: 'Phiến Thăng Hoa', desc: 'Cổ vật phía trên +2 cấp và +1 cấp tối đa.', rarity: 'legendary', shape: [[0, 0]],
    targets: [...at([U], lv(2)), ...at([U], { op: 'maxLevel', amount: 1 })], price: 720 },
  { id: 't_echo', name: 'Phiến Vọng Âm', desc: 'Cổ vật bên phải được tính gấp đôi số thẻ Bộ.', rarity: 'epic', shape: [[0, 0]],
    targets: at([R], { op: 'doubleTags' }), price: 400 },
  { id: 't_chord', name: 'Phiến Hợp Âm', desc: 'Cổ vật phía trên và phía dưới được tính gấp đôi số thẻ Bộ.', rarity: 'legendary', shape: [[0, 0]],
    targets: at([U, D], { op: 'doubleTags' }), price: 760 },
  { id: 't_mirror', name: 'Phiến Gương Soi', desc: 'Cổ vật bên phải sao chép hiệu ứng của cổ vật bên trái.', rarity: 'legendary', shape: [[0, 0]],
    targets: at([R], { op: 'copy' }), price: 800 },
  // ── 1×2 slabs ──
  { id: 't_long', name: 'Phiến Dài', desc: 'Phiến 1×2: cổ vật ở hai đầu +1 cấp.', rarity: 'rare', shape: [[0, 0], [1, 0]],
    targets: at([L, [2, 0]], lv(1)), price: 190 },
  { id: 't_pillar', name: 'Phiến Cột Đá', desc: 'Phiến 2×1 đứng: bốn ô hai bên +1 cấp.', rarity: 'epic', shape: [[0, 0], [0, 1]],
    targets: at([L, R, [-1, 1], [1, 1]], lv(1)), price: 360 },
];

const tablets: TabletDef[] = TAB.map((t) => ({ ...t, icon: `tab_${t.id}` }));
export default tablets;
