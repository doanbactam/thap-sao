// UI strings: content agent's src/data/strings.ts overrides these engine defaults key by key.
import { contentStrings } from './registry';

export const DEFAULT_STRINGS: Record<string, string> = {
  'game.title': 'Tháp Sao', 'game.subtitle': 'Hành trình của Bông',
  'menu.play': 'Chơi', 'menu.continue': 'Tiếp tục', 'menu.newRun': 'Chuyến mới', 'menu.settings': 'Cài đặt', 'menu.back': 'Quay lại',
  'menu.close': 'Đóng', 'menu.resume': 'Tiếp tục', 'menu.quit': 'Lưu & về làng', 'menu.abandon': 'Bỏ cuộc', 'menu.pause': 'Tạm dừng',
  'cur.money': 'Hạt Dẻ', 'cur.sapphire': 'Ngọc Sao', 'cur.dice': 'Xúc Xắc',
  'hub.name': 'Làng Mây', 'hub.destiny': 'Cây Định Mệnh', 'hub.talents': 'Gương Tài Năng', 'hub.costumes': 'Tủ Trang Phục',
  'hub.weapons': 'Kệ Vũ Khí', 'hub.destinyShort': 'Cây Sao', 'hub.journal': 'Nhật Ký', 'hub.training': 'Sân Tập', 'hub.portal': 'Cổng Tháp', 'hub.settings': 'Cài Đặt',
  'hub.interact': 'Nhấn E / chạm để dùng', 'hub.hard': 'Chế độ Khó',
  'inv.title': 'Túi Đồ', 'inv.side': 'Túi Phụ', 'inv.combos': 'Bộ Kích Hoạt', 'inv.sell': 'Bán', 'inv.discard': 'Vứt', 'inv.rotate': 'Xoay',
  'inv.disabled': 'Vô hiệu', 'inv.inactive': 'Chưa kích hoạt', 'inv.level': 'Cấp', 'inv.full': 'Túi đầy!',
  'choice.title': 'Chọn 1 trong 3', 'choice.reroll': 'Đổi (1 xúc xắc)', 'choice.skip': 'Bỏ qua', 'choice.take': 'Lấy',
  'choice.artifact': 'Cổ Vật', 'choice.tablet': 'Phiến Đá', 'choice.miracle': 'Phép Màu', 'choice.upgrade': 'Đe Rèn',
  'shop.title': 'Cửa Hàng', 'shop.buy': 'Mua', 'shop.sold': 'Đã bán', 'shop.reroll': 'Đổi hàng', 'shop.sellHint': 'Kéo đồ vào ô Bán để bán',
  'enchant.title': 'Bàn Thờ Cường Hóa', 'enchant.hint': 'Chọn cổ vật để tăng cấp', 'enchant.left': 'Lượt còn lại',
  'map.title': 'Bản Đồ Tầng', 'map.start': 'Khởi đầu', 'map.gate': 'Cửa Ải', 'map.boss': 'Trùm',
  // v2 map overlay / mini-map (docs/V2_MAP.md)
  'map.legend': 'Chú giải', 'map.you': 'Bạn ở đây', 'map.cleared': 'Đã dọn', 'map.reachable': 'Đi tiếp được', 'map.ahead': 'Phía trước',
  'map.skipped': 'Không còn tới được', 'map.elite': 'Tinh Anh (rủi ro cao, thưởng hiếm)', 'map.derange': 'Hỗn Loạn (quái mạnh hơn)',
  'map.path': 'Đường đã đi', 'map.rooms': 'Loại phòng', 'map.closeHint': 'M / Esc / chạm để đóng', 'map.chapterBoss': 'Trùm chương (tầng 3)',
  'map.tapHint': 'Chạm: bản đồ', 'map.collapse': 'Thu gọn', 'map.expand': 'Mở rộng',
  'node.levelup': 'Lên Cấp', 'node.artifact': 'Cổ Vật', 'node.enchant': 'Cường Hóa', 'node.tablet': 'Phiến Đá', 'node.money': 'Rương Tiền',
  'node.heart': 'Tim Xanh', 'node.anvil': 'Đe Rèn', 'node.dice': 'Xúc Xắc', 'node.shop': 'Cửa Hàng', 'node.roots': 'Rễ Cây Cổ',
  'mod.derangement': 'Hỗn Loạn', 'mod.miniboss': 'Trùm Nhỏ', 'mod.none': '',
  'ev.arena': 'Đấu Trường', 'ev.secret': 'Phòng Bí Mật', 'ev.clover': 'Cỏ May Mắn', 'ev.merchant': 'Thương Nhân Lang Thang',
  'ev.obelisk': 'Bia Đá', 'ev.fountain': 'Đài Phun', 'ev.companion': 'Quầy Bạn Đồng Hành', 'ev.blood': 'Bàn Thờ Máu', 'ev.pocket': 'Không Gian Túi',
  'ev.clover.hp': '+6 Máu tối đa', 'ev.clover.def': '+4 Phòng thủ', 'ev.fountain.green': 'Uống nước xanh (KN)', 'ev.fountain.gold': 'Nước vàng (Hạt Dẻ)',
  'ev.fountain.red': 'Nước đỏ (quái vật!)', 'ev.blood.pay': 'Hiến 33% máu lấy cổ vật', 'ev.blood.bat': 'Đánh dơi lấy bình', 'ev.companion.pay': 'Trả 500 Hạt Dẻ',
  'ev.pocket.pay': 'Dùng 5 Ngọc Sao mở khóa cổ vật', 'ev.obelisk.touch': 'Chạm vào bia đá', 'ev.leave': 'Rời đi', 'ev.secret.hint': 'Có bức tường nứt… hãy đánh nó!',
  'room.cleared': 'Phòng đã dọn sạch!', 'room.wave': 'Đợt', 'room.locked': 'Cửa đã khóa',
  'hud.level': 'Cấp', 'hud.boss': 'Trùm', 'hud.reload': 'Nạp đạn',
  'res.title': 'Kết Thúc Chuyến Đi', 'res.dead': 'Bông đã gục ngã…', 'res.win': 'Chiến thắng!', 'res.sapphires': 'Ngọc Sao nhận được',
  'res.floors': 'Tầng đã qua', 'res.bosses': 'Trùm đã hạ', 'res.kills': 'Quái đã hạ', 'res.toHub': 'Về Làng Mây',
  'end.title': 'Lõi Sao đã được thanh tẩy!', 'end.text': 'Ngôi sao rơi đã yên nghỉ. Làng Mây lại bình yên.', 'end.hard': 'Đã mở khóa Chế độ Khó!',
  'end.credits': 'Thiết kế & lập trình: Đội Tháp Sao\nÂm thanh: tổng hợp WebAudio\nCảm ơn bạn đã chơi!',
  'destiny.title': 'Cây Định Mệnh', 'destiny.buy': 'Khắc', 'destiny.owned': 'Đã khắc', 'destiny.locked': 'Chưa mở',
  'talent.title': 'Gương Tài Năng', 'talent.points': 'Điểm', 'talent.respec': 'Đặt lại (miễn phí)', 'talent.needRepair': 'Cần Sửa Nhà ở Cây Định Mệnh',
  'costume.title': 'Tủ Trang Phục', 'costume.wear': 'Mặc', 'costume.worn': 'Đang mặc', 'costume.locked': 'Chưa mở khóa',
  'weapon.title': 'Kệ Vũ Khí', 'weapon.equip': 'Trang bị', 'weapon.equipped': 'Đang dùng', 'weapon.train': 'Vào phòng tập', 'weapon.locked': 'Mở ở Cây Định Mệnh',
  'journal.title': 'Nhật Ký', 'journal.artifacts': 'Cổ Vật', 'journal.tablets': 'Phiến Đá', 'journal.enemies': 'Quái Vật', 'journal.miracles': 'Phép Màu',
  'training.title': 'Sân Tập', 'training.spawn': 'Lấy cổ vật', 'training.hint': 'Đánh hình nộm để thử sức', 'training.weaponDone': 'Đã thành thạo vũ khí!',
  'settings.title': 'Cài Đặt', 'settings.mute': 'Tắt tiếng', 'settings.unmute': 'Bật tiếng', 'settings.damage': 'Số sát thương', 'settings.reset': 'Xóa dữ liệu',
  'pot.identified': 'Đã nhận ra', 'levelup': 'Lên cấp!', 'chapter': 'Chương', 'floor': 'Tầng',
  'rar.common': 'Thường', 'rar.rare': 'Hiếm', 'rar.epic': 'Sử Thi', 'rar.legendary': 'Huyền Thoại',
};
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = contentStrings[key] ?? DEFAULT_STRINGS[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}
