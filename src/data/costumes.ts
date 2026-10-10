import type { CostumeDef } from './types';

// unlock.kind vocabulary (meta system): runsStarted, chapterReached, bossesKilled, artifactsFound, comboTier6, winRuns, totalSapphires.
const costumes: CostumeDef[] = [
  { id: 'bong', name: 'Bông', desc: 'Nhà thám hiểm nhỏ của Làng Mây. Không có điểm mạnh hay yếu.', sprite: 'hero_bong', stats: {}, unlock: null },
  { id: 'scarecrow', name: 'Bù Nhìn', desc: 'HP luôn cố định 50, không tăng khi lên cấp. Sát thương +15%. Bắt đầu với Đinh Gỉ Sét và Đồng Xu Nguyền.', sprite: 'hero_scarecrow',
    stats: { damagePct: 15 }, fixedHp: 50, startItems: ['cu_rusty_nail', 'cu_cursed_coin'],
    unlock: { kind: 'bossesKilled', value: 3, text: 'Đánh bại 3 trùm.' } },
  { id: 'redcat', name: 'Mèo Áo Đỏ', desc: 'Bắt đầu với Hòn Than Ấm và Hộp Diêm Nhỏ. Lửa +5, Băng −5.', sprite: 'hero_redcat',
    stats: { fire: 5, ice: -5 }, startItems: ['e_ember_coal', 'e_matchbox'],
    unlock: { kind: 'chapterReached', value: 2, text: 'Đến Mỏ Đá Đỏ (chương 2).' } },
  { id: 'frog', name: 'Ếch Mưa Giông', desc: 'Bắt đầu với Hạt Tia Điện và Cuộn Dây Đồng. Sét +5, tốc chạy +5%.', sprite: 'hero_frog',
    stats: { lightning: 5, moveSpeed: 5 }, startItems: ['s_spark_bead', 's_copper_coil'],
    unlock: { kind: 'chapterReached', value: 3, text: 'Đến Thư Viện Bay (chương 3).' } },
  { id: 'fox', name: 'Cáo Lãng Du', desc: 'Né tránh +8%, May mắn +3, HP tối đa −10. Bắt đầu với Chuông Mèo Mun.', sprite: 'hero_fox',
    stats: { evasion: 8, luck: 3, maxHp: -10 }, startItems: ['sh_cat_bell'],
    unlock: { kind: 'artifactsFound', value: 40, text: 'Khám phá 40 cổ vật khác nhau.' } },
  { id: 'knight', name: 'Hiệp Sĩ Mây', desc: 'Phòng thủ +10%, HP tối đa +20, tốc chạy −10%. Bắt đầu với Khiên Gỗ Tí Hon và Mũ Sắt Méo.', sprite: 'hero_knight',
    stats: { defense: 10, maxHp: 20, moveSpeed: -10 }, startItems: ['gd_wooden_buckler', 'gd_iron_helm'],
    unlock: { kind: 'winRuns', value: 1, text: 'Chiến thắng Ngôi Sao Rơi một lần.' } },
];
export default costumes;
