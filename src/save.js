// Local save: progress, stars, economy, meta and live-ops state (GDD 12).

const KEY = 'dice-the-way.save.v2';
const OLD_KEY = 'dice-the-way.save.v1';
export const STARTER_PIPS = 100;
export const BUY_MOVES_PRICE = 30;
export const EXTRA_MOVES = 5;

function defaultLang() {
  try { return (navigator.language || '').toLowerCase().startsWith('vi') ? 'vi' : 'en'; } catch { return 'en'; }
}

function defaults() {
  return {
    unlocked: 1,
    stars: {},      // levelId -> 1..3
    bestMoves: {},  // levelId -> fewest moves used
    pips: STARTER_PIPS,
    tutorialSkipped: false,
    inventory: { undo: 3, hint: 2 },
    skins: { owned: ['ivory'], equipped: 'ivory' },
    chests: [],                 // star milestones already opened
    seen: {},                   // intro cards already shown (mechanics, boosters, features)
    winStreak: 0,
    daily: { last: '', streak: 0 },               // login calendar
    missions: { day: '', list: [], bonus: false },
    challenge: { day: '', done: false, streak: 0, lastDone: '' },
    event: { week: '', tokens: 0, claimed: [] },
    shop: { day: '', freeAds: 0 },
    stats: { wins: 0, points: 0, perfect: 0, moves: 0, challenges: 0 },
    settings: { sound: true, music: true, vibration: true, lang: defaultLang() },
  };
}

function load() {
  const d = defaults();
  try {
    let raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw) raw = JSON.parse(localStorage.getItem(OLD_KEY) || 'null'); // v1 -> v2 migration
    if (raw && typeof raw === 'object') {
      for (const k of Object.keys(d)) {
        if (!(k in raw)) continue;
        const v = raw[k];
        d[k] = v && typeof v === 'object' && !Array.isArray(v) && d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])
          ? { ...d[k], ...v } : v;
      }
    }
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return d;
}

export const save = load();

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

export function resetProgress() {
  const keep = save.settings;
  Object.assign(save, defaults(), { settings: keep });
  persist();
}

export function totalStars() {
  return Object.values(save.stars).reduce((a, b) => a + b, 0);
}

/** Pips for a result: 10 per star, paid only for stars not earned before. */
export function rewardFor(levelId, stars) {
  return Math.max(0, stars - (save.stars[levelId] || 0)) * 10;
}
