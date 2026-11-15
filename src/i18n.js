import { save } from './save.js';

const STR = {
  en: {
    worldLabel: 'World 1', worldName: 'Maple Table',
    tabHome: 'Home', tabShop: 'Shop', tabMeta: 'Meta',
    cleared: 'cleared', statBest: 'Best', statLimit: 'Limit', statYours: 'Yours', statMoves: 'Moves',
    used: 'Best {b} · Used {u}', adShort: 'Ad',
    comingSoon: 'Coming soon',
    shopSoon: 'The shop is being stocked. Check back later!',
    metaSoon: 'Collections and upgrades will live here.',
    daily: 'Daily', event: 'Event', meta: 'Meta',
    play: 'Play', locked: 'Locked',
    level: 'Level {n}',
    points: 'Points', moves: 'Moves', top: 'Top',
    bestCase: 'Best: {n} moves',
    complete: 'Cleared', failed: 'Out of moves',
    failedSub: 'So close. Get 5 more moves or try again.',
    score: 'Score', movesUsed: '{n} moves · best {b}',
    earned: '+{n} Pips',
    next: 'Next', replay: 'Replay', map: 'Map',
    buyMoves: '+5 moves', watchAd: 'Watch ad · +5 moves',
    notEnough: 'Not enough Pips', alreadyBought: 'Already bought this attempt',
    adTitle: 'Rewarded ad', adBody: 'Ad placeholder — your reward arrives in {n}…',
    settings: 'Settings', sound: 'Sound', music: 'Music', vibration: 'Vibration',
    language: 'Language', controls: 'Controls',
    controlsHint: 'Swipe, or use WASD / arrow keys. One swipe is one move.',
    backToMap: 'Back to map', close: 'Close', reset: 'Reset',
    resetConfirm: 'Erase all progress and start again?',
    needAll: 'Solve all points first',
    allDone: 'All 30 levels cleared — more worlds are coming!',
    skip: 'Skip',
    tut1: 'Swipe to roll. The dice rolls until the road ends. Reach the flag.',
    tut2: 'A numbered point stops the dice. Stop on it, then reach the flag.',
    tut3: 'The top face must match the number. Take the loop.',
    tutMatch: 'Match. Point solved.',
    tutMiss: 'No match. Come back another way.',
  },
  vi: {
    worldLabel: 'Thế giới 1', worldName: 'Bàn Gỗ Phong',
    tabHome: 'Trang chủ', tabShop: 'Cửa hàng', tabMeta: 'Meta',
    cleared: 'đã qua', statBest: 'Tốt nhất', statLimit: 'Giới hạn', statYours: 'Của bạn', statMoves: 'Số lượt',
    used: 'Tốt nhất {b} · Đã dùng {u}', adShort: 'QC',
    comingSoon: 'Sắp ra mắt',
    shopSoon: 'Cửa hàng đang được chuẩn bị. Hãy quay lại sau nhé!',
    metaSoon: 'Bộ sưu tập và nâng cấp sẽ xuất hiện ở đây.',
    daily: 'Hằng ngày', event: 'Sự kiện', meta: 'Meta',
    play: 'Chơi', locked: 'Chưa mở khóa',
    level: 'Màn {n}',
    points: 'Điểm', moves: 'Lượt', top: 'Mặt trên',
    bestCase: 'Tốt nhất: {n} lượt',
    complete: 'Hoàn thành', failed: 'Hết lượt',
    failedSub: 'Suýt nữa rồi. Lấy thêm 5 lượt hoặc thử lại.',
    score: 'Điểm số', movesUsed: '{n} lượt · tốt nhất {b}',
    earned: '+{n} Pips',
    next: 'Tiếp', replay: 'Chơi lại', map: 'Bản đồ',
    buyMoves: '+5 lượt', watchAd: 'Xem quảng cáo · +5 lượt',
    notEnough: 'Không đủ Pips', alreadyBought: 'Đã mua trong lượt chơi này',
    adTitle: 'Quảng cáo thưởng', adBody: 'Quảng cáo mẫu — nhận thưởng sau {n}…',
    settings: 'Cài đặt', sound: 'Âm thanh', music: 'Nhạc', vibration: 'Rung',
    language: 'Ngôn ngữ', controls: 'Điều khiển',
    controlsHint: 'Vuốt, hoặc dùng WASD / phím mũi tên. Mỗi lần vuốt là một lượt.',
    backToMap: 'Về bản đồ', close: 'Đóng', reset: 'Xóa',
    resetConfirm: 'Xóa toàn bộ tiến trình và chơi lại từ đầu?',
    needAll: 'Giải hết các điểm trước',
    allDone: 'Đã qua cả 30 màn — thế giới mới sắp ra mắt!',
    skip: 'Bỏ qua',
    tut1: 'Vuốt để lăn. Xúc xắc lăn tới khi hết đường. Hãy tới lá cờ.',
    tut2: 'Ô số chặn xúc xắc lại. Dừng trên ô, rồi tới lá cờ.',
    tut3: 'Mặt trên phải trùng con số. Hãy đi đường vòng.',
    tutMatch: 'Khớp. Đã giải ô.',
    tutMiss: 'Chưa khớp. Quay lại theo đường khác.',
  },
};

export const LANGS = [['en', 'English'], ['vi', 'Tiếng Việt']];

export function t(key, vars) {
  const table = STR[save.settings.lang] || STR.en;
  let s = table[key] ?? STR.en[key] ?? key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}

/** Fill every [data-i18n] element under root. */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.documentElement.lang = save.settings.lang;
}
