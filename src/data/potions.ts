import type { PotionDef } from './types';

// action vocabulary (engine): heal (value = fraction of max HP), rage (value = +% damage), iron (value = +defense points),
// swift (value = +% move & attack speed), mana (value = fraction of max MP), mystery (random: one of the others or a
// bad effect; identified on first drink). duration in seconds for buffs.
const potions: PotionDef[] = [
  { id: 'heal', name: 'Bình Hồi Máu', desc: 'Hồi 40% HP tối đa.', icon: 'pot_heal', action: 'heal', value: 0.4 },
  { id: 'rage', name: 'Bình Cuồng Nộ', desc: 'Sát thương +30% trong 10 giây.', icon: 'pot_rage', action: 'rage', value: 30, duration: 10 },
  { id: 'iron', name: 'Bình Da Sắt', desc: 'Phòng thủ +30% trong 10 giây.', icon: 'pot_iron', action: 'iron', value: 30, duration: 10 },
  { id: 'swift', name: 'Bình Gió Lốc', desc: 'Tốc chạy và tốc đánh +25% trong 10 giây.', icon: 'pot_swift', action: 'swift', value: 25, duration: 10 },
  { id: 'mana', name: 'Bình Sương Lam', desc: 'Hồi 100% MP tối đa.', icon: 'pot_mana', action: 'mana', value: 1 },
  { id: 'mystery', name: 'Bình Bí Ẩn', desc: 'Chưa rõ tác dụng. Uống thử để biết!', icon: 'pot_mystery', action: 'mystery', value: 1, duration: 10 },
];
export default potions;
