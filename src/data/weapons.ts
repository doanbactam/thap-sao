import type { WeaponDef } from './types';

// range / arc in on-screen px and degrees; attackInterval = seconds between combo hits at 100% attack speed.
const weapons: WeaponDef[] = [
  { id: 'swordshield', name: 'Kiếm & Khiên', desc: 'Chuỗi 3 đòn cận chiến. Giữ để đỡ đòn phía trước; đỡ hoàn hảo gây choáng. Đặc biệt: lao khiên húc.',
    icon: 'wic_swordshield', sprite: 'wpn_swordshield', element: 'physical', baseCoef: [1.0, 1.0, 1.4],
    range: 58, arc: 100, attackInterval: 0.32, specialMp: 16, hasGuard: true },
  { id: 'greatsword', name: 'Đại Kiếm', desc: 'Hai nhát chém nặng, tầm rộng, đẩy lùi mạnh, không bị ngắt đòn khi vung. Đặc biệt: giữ để xoay chém tích lực.',
    icon: 'wic_greatsword', sprite: 'wpn_greatsword', element: 'physical', baseCoef: [1.8, 2.4],
    range: 78, arc: 160, attackInterval: 0.62, specialMp: 22 },
  { id: 'dagger', name: 'Dao Găm', desc: 'Chuỗi 4 nhát nhanh. Trúng đòn tích Cuồng Nộ: đầy thì tốc đánh +50% trong 5 giây. Đặc biệt: bước bóng ra sau lưng mục tiêu và đâm lén.',
    icon: 'wic_dagger', sprite: 'wpn_dagger', element: 'physical', baseCoef: [0.6, 0.6, 0.7, 1.0],
    range: 44, arc: 80, attackInterval: 0.16, specialMp: 14 },
  { id: 'katana', name: 'Kiếm Cong', desc: 'Chuỗi 3 đòn, đòn cuối là cú đâm lao tới. Đặc biệt: giữ tụ kiếm rồi rút kiếm lướt chém thành đường; thả đúng lúc là chí mạng.',
    icon: 'wic_katana', sprite: 'wpn_katana', element: 'physical', baseCoef: [1.0, 1.1, 1.6],
    range: 66, arc: 110, attackInterval: 0.3, specialMp: 18 },
  { id: 'crossbow', name: 'Nỏ', desc: 'Bắn từng mũi tên tự nhắm, băng đạn 6, nạp lại 1,2 giây. Đặc biệt: mũi tên nặng xuyên thấu.',
    icon: 'wic_crossbow', sprite: 'wpn_crossbow', element: 'physical', baseCoef: [0.9],
    range: 420, arc: 0, attackInterval: 0.28, specialMp: 18, magazine: 6, reload: 1.2 },
  { id: 'staff', name: 'Gậy Phép', desc: 'Bắn cầu phép hơi tự dẫn, một phần dùng chỉ số Phép thuật. Đặc biệt: vụ nổ nguyên tố quanh người.',
    icon: 'wic_staff', sprite: 'wpn_staff', element: 'fire', baseCoef: [0.85],
    range: 360, arc: 0, attackInterval: 0.42, specialMp: 24 },
];
export default weapons;
