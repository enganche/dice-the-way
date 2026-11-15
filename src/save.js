// Local save: progress, stars, pips, settings (GDD 12).

const KEY = 'dice-the-way.save.v1';
export const STARTER_PIPS = 60;
export const BUY_MOVES_PRICE = 30;
export const EXTRA_MOVES = 5;

function defaults() {
  return {
    unlocked: 1,
    stars: {},      // levelId -> 1..3
    bestMoves: {},  // levelId -> fewest moves used
    pips: STARTER_PIPS,
    tutorialSkipped: false,
    settings: { sound: true, music: true, vibration: true, lang: 'en' },
  };
}

function load() {
  const d = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      Object.assign(d, raw);
      d.settings = { ...defaults().settings, ...(raw.settings || {}) };
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
