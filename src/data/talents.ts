import type { TalentDef } from './types';

// Gương Tài Năng. Total max ranks = 40 (> 25 talent points obtainable, so builds must choose). Free respec.
const talents: TalentDef[] = [
  { id: 'tal_vitality', name: 'Sức Sống', desc: 'HP tối đa +5 mỗi bậc.', maxRank: 5, stat: 'maxHp', perRank: 5 },
  { id: 'tal_might', name: 'Sức Mạnh', desc: 'Sát thương Vật lý +2 mỗi bậc.', maxRank: 4, stat: 'physical', perRank: 2 },
  { id: 'tal_flame', name: 'Lửa Nội Tâm', desc: 'Sát thương Lửa +2 mỗi bậc.', maxRank: 3, stat: 'fire', perRank: 2 },
  { id: 'tal_frost', name: 'Hơi Thở Lạnh', desc: 'Sát thương Băng +2 mỗi bậc.', maxRank: 3, stat: 'ice', perRank: 2 },
  { id: 'tal_spark', name: 'Tĩnh Điện', desc: 'Sát thương Sét +2 mỗi bậc.', maxRank: 3, stat: 'lightning', perRank: 2 },
  { id: 'tal_arcane', name: 'Tri Thức', desc: 'Phép thuật +2 mỗi bậc.', maxRank: 3, stat: 'magic', perRank: 2 },
  { id: 'tal_keen', name: 'Mắt Tinh', desc: 'Chí mạng +2% mỗi bậc.', maxRank: 4, stat: 'critChance', perRank: 2 },
  { id: 'tal_brutal', name: 'Tàn Bạo', desc: 'Sát thương chí mạng +8% mỗi bậc.', maxRank: 3, stat: 'critDamage', perRank: 8 },
  { id: 'tal_mind', name: 'Tâm Trí', desc: 'MP tối đa +5 mỗi bậc.', maxRank: 3, stat: 'maxMp', perRank: 5 },
  { id: 'tal_nimble', name: 'Nhanh Nhẹn', desc: 'Hồi lướt +8% mỗi bậc.', maxRank: 3, stat: 'dashRecovery', perRank: 8 },
  { id: 'tal_fortune', name: 'Vận May', desc: 'May mắn +2 mỗi bậc.', maxRank: 3, stat: 'luck', perRank: 2 },
  { id: 'tal_haggle', name: 'Mặc Cả', desc: 'Mặc cả +3 mỗi bậc (giá mua rẻ hơn, bán đắt hơn).', maxRank: 3, stat: 'barter', perRank: 3 },
];
export default talents;
