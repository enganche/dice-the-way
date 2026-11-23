// Meta progression and live-ops (GDD 8, 9, 13): worlds, feature unlocks, boosters,
// win streak, star road chests, dice skins, daily login gift, daily missions,
// daily challenge, weekly event pass, shop. All state lives in save.js.

import { save, persist, totalStars } from './save.js';

// ---------- worlds ----------
export const WORLDS = [
  { id: 1, from: 1, to: 10, mech: null },
  { id: 2, from: 11, to: 20, mech: 'stop' },
  { id: 3, from: 21, to: 30, mech: 'arrow' },
  { id: 4, from: 31, to: 40, mech: 'portal' },
  { id: 5, from: 41, to: 50, mech: 'crumble' },
];
export const worldOf = (id) => WORLDS.find((w) => id >= w.from && id <= w.to) || WORLDS[0];

// ---------- progressive feature unlocks (level that must be cleared first) ----------
export const UNLOCK = { daily: 2, undo: 4, missions: 5, hint: 6, event: 8, streak: 9, challenge: 12 };
export const isUnlocked = (f) => save.unlocked > (UNLOCK[f] || 0);

// ---------- rewards ----------
/** Reward = { pips?, undo?, hint?, tokens?, skin? }. Applies it and saves. */
export function grant(r) {
  if (!r) return r;
  if (r.pips) save.pips += r.pips;
  if (r.undo) save.inventory.undo += r.undo;
  if (r.hint) save.inventory.hint += r.hint;
  if (r.tokens) { ensureEvent(); save.event.tokens += r.tokens; }
  if (r.skin && !save.skins.owned.includes(r.skin)) save.skins.owned.push(r.skin);
  persist();
  return r;
}

// ---------- dates (local time) ----------
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => dateKey(new Date());
export function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return dateKey(d); }
export function dayIndex() { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
export function msToMidnight() { const d = new Date(); const m = new Date(d); m.setHours(24, 0, 0, 0); return m - d; }
function weekStart() { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
export const weekKey = () => dateKey(weekStart());
export function msToWeekEnd() { const e = weekStart(); e.setDate(e.getDate() + 7); return e - new Date(); }

export function formatTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${m}m ${pad(s % 60)}s`;
}

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- boosters ----------
export const BOOSTER_PRICE = { undo: 20, hint: 30 }; // pips for one, when out of stock

// ---------- win streak ----------
export const streakBonus = () => (isUnlocked('streak') ? Math.min(3, save.winStreak) : 0);
export function breakStreak() { if (save.winStreak) { save.winStreak = 0; persist(); } }

// ---------- star road ----------
export const STAR_CHESTS = [
  { stars: 8, reward: { pips: 50 } },
  { stars: 20, reward: { undo: 2, hint: 1 } },
  { stars: 35, reward: { skin: 'ruby', pips: 50 } },
  { stars: 50, reward: { pips: 120 } },
  { stars: 70, reward: { hint: 3, undo: 3 } },
  { stars: 90, reward: { skin: 'jade', pips: 80 } },
  { stars: 110, reward: { pips: 200 } },
  { stars: 130, reward: { skin: 'gold', hint: 3 } },
  { stars: 150, reward: { skin: 'galaxy', pips: 300 } },
];
export const chestClaimable = (i) => totalStars() >= STAR_CHESTS[i].stars && !save.chests.includes(i);
export const claimableChests = () => STAR_CHESTS.map((_, i) => i).filter(chestClaimable);
export function nextChest() {
  const i = STAR_CHESTS.findIndex((_, k) => !save.chests.includes(k));
  return i < 0 ? null : { index: i, ...STAR_CHESTS[i] };
}
export function claimChest(i) {
  if (!chestClaimable(i)) return null;
  save.chests.push(i);
  return grant(STAR_CHESTS[i].reward);
}

// ---------- dice skins ----------
export const SKINS = [
  { id: 'ivory', body: '#f8f1df', pip: '#2b2433', price: 0 },
  { id: 'mint', body: '#8fe8c8', pip: '#17473a', price: 250 },
  { id: 'ocean', body: '#3c8fe6', pip: '#ffffff', price: 300 },
  { id: 'candy', body: '#ff9fcf', pip: '#7a1f52', price: 400 },
  { id: 'midnight', body: '#25283d', pip: '#ffc93c', price: 600 },
  { id: 'ruby', body: '#e2384c', pip: '#ffffff', source: 'chest' },
  { id: 'jade', body: '#1f9e6e', pip: '#f4ffe9', source: 'chest' },
  { id: 'sunset', body: '#ff8a3d', pip: '#fff6e0', source: 'event' },
  { id: 'gold', body: '#f0bf48', pip: '#5a3a00', metal: 0.55, source: 'chest' },
  { id: 'galaxy', body: '#40257e', pip: '#ffffff', sparkle: true, source: 'chest' },
];
export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];
export const equippedSkin = () => skinById(save.skins.equipped);
export function buySkin(id) {
  const s = skinById(id);
  if (!s.price || save.skins.owned.includes(id) || save.pips < s.price) return false;
  save.pips -= s.price; save.skins.owned.push(id); save.skins.equipped = id; persist();
  return true;
}
export function equipSkin(id) { if (save.skins.owned.includes(id)) { save.skins.equipped = id; persist(); } }

// ---------- daily login gift (7-day calendar) ----------
export const DAILY_REWARDS = [{ pips: 20 }, { undo: 1 }, { pips: 30 }, { hint: 1 }, { pips: 40 }, { undo: 2 }, { pips: 80, hint: 2 }];
export function dailyState() {
  const d = save.daily, now = today();
  const claimedToday = d.last === now;
  const continuing = d.last === yesterday();
  const streak = claimedToday || continuing ? d.streak : 0;
  return { canClaim: !claimedToday, next: streak % 7, streak, claimedToday };
}
export function claimDaily() {
  const st = dailyState();
  if (!st.canClaim) return null;
  save.daily = { last: today(), streak: st.streak + 1 };
  return { day: st.next, reward: grant(DAILY_REWARDS[st.next]) };
}

// ---------- daily missions ----------
export const MISSION_POOL = [
  { id: 'win', goal: 3, reward: { pips: 30 } },
  { id: 'stars', goal: 6, reward: { pips: 30 } },
  { id: 'perfect', goal: 2, reward: { pips: 40 } },
  { id: 'points', goal: 8, reward: { pips: 25 } },
  { id: 'moves', goal: 40, reward: { pips: 20 } },
  { id: 'clean', goal: 2, reward: { undo: 1 } },
  { id: 'streak', goal: 3, reward: { pips: 40 }, needs: 'streak' },
  { id: 'challenge', goal: 1, reward: { hint: 1 }, needs: 'challenge' },
];
export const MISSION_BONUS = { pips: 50, hint: 1 };
export function ensureMissions() {
  const now = today();
  if (save.missions.day === now && save.missions.list.length) return save.missions;
  const rng = seeded(dayIndex() * 2654435761);
  const pool = MISSION_POOL.filter((m) => !m.needs || isUnlocked(m.needs));
  const list = [];
  while (list.length < 3 && pool.length) list.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  save.missions = { day: now, bonus: false, list: list.map((m) => ({ id: m.id, goal: m.goal, progress: 0, claimed: false })) };
  persist();
  return save.missions;
}
export const missionDef = (id) => MISSION_POOL.find((m) => m.id === id);
/** Add progress to missions of a type. `max` = progress is a high-water mark (streak). */
export function recordMission(id, amount = 1, max = false) {
  if (!isUnlocked('missions')) return;
  ensureMissions();
  for (const m of save.missions.list) {
    if (m.id !== id || m.claimed) continue;
    m.progress = Math.min(m.goal, max ? Math.max(m.progress, amount) : m.progress + amount);
  }
  persist();
}
export function claimMission(i) {
  const m = save.missions.list[i];
  if (!m || m.claimed || m.progress < m.goal) return null;
  m.claimed = true;
  return grant(missionDef(m.id).reward);
}
export const missionBonusReady = () => save.missions.list.length > 0 && save.missions.list.every((m) => m.claimed) && !save.missions.bonus;
export function claimMissionBonus() {
  if (!missionBonusReady()) return null;
  save.missions.bonus = true;
  return grant(MISSION_BONUS);
}

// ---------- weekly event: Dice Pass ----------
export const EVENT_TIERS = [
  { need: 3, reward: { pips: 20 } }, { need: 7, reward: { undo: 1 } }, { need: 12, reward: { pips: 40 } },
  { need: 18, reward: { hint: 1 } }, { need: 25, reward: { pips: 60 } }, { need: 33, reward: { undo: 2 } },
  { need: 42, reward: { pips: 80 } }, { need: 52, reward: { hint: 2 } }, { need: 63, reward: { pips: 120 } },
  { need: 75, reward: { skin: 'sunset', pips: 100 } },
];
export function ensureEvent() {
  const wk = weekKey();
  if (save.event.week !== wk) { save.event = { week: wk, tokens: 0, claimed: [] }; persist(); }
  return save.event;
}
export const tierClaimable = (i) => { ensureEvent(); return save.event.tokens >= EVENT_TIERS[i].need && !save.event.claimed.includes(i); };
export function claimTier(i) {
  if (!tierClaimable(i)) return null;
  save.event.claimed.push(i);
  return grant(EVENT_TIERS[i].reward);
}

// ---------- daily challenge ----------
export const CHALLENGE_REWARD = { pips: 60, tokens: 5 };
export function challengeForToday(pool) { return pool[dayIndex() % pool.length]; }
export const challengeDone = () => save.challenge.day === today() && save.challenge.done;
export function completeChallenge() {
  if (challengeDone()) return null;
  const c = save.challenge;
  const streak = c.lastDone === yesterday() ? c.streak + 1 : 1;
  save.challenge = { day: today(), done: true, streak, lastDone: today() };
  save.stats.challenges++;
  recordMission('challenge');
  const bonus = Math.min(streak - 1, 5) * 10; // consecutive days pay a little more
  return grant({ pips: CHALLENGE_REWARD.pips + bonus, tokens: isUnlocked('event') ? CHALLENGE_REWARD.tokens : 0 });
}

// ---------- shop ----------
export const SHOP_PACKS = [
  { id: 'undo3', give: { undo: 3 }, price: 50 },
  { id: 'hint3', give: { hint: 3 }, price: 80 },
  { id: 'bundle', give: { undo: 5, hint: 5 }, price: 200, best: true },
];
export const IAP_PACKS = [
  { id: 'pips_s', pips: 500, price: '$0.99' },
  { id: 'pips_m', pips: 1200, price: '$1.99', tag: '+20%' },
  { id: 'pips_l', pips: 3000, price: '$4.99', tag: '+50%' },
];
export const FREE_AD_PIPS = 25, FREE_ADS_PER_DAY = 3;
export function freeAdsLeft() {
  if (save.shop.day !== today()) { save.shop = { day: today(), freeAds: 0 }; persist(); }
  return FREE_ADS_PER_DAY - save.shop.freeAds;
}
export function takeFreeAd() {
  if (freeAdsLeft() <= 0) return null;
  save.shop.freeAds++;
  return grant({ pips: FREE_AD_PIPS });
}
export function buyPack(id) {
  const p = SHOP_PACKS.find((k) => k.id === id);
  if (!p || save.pips < p.price) return null;
  save.pips -= p.price;
  return grant(p.give);
}

// ---------- level results ----------
/**
 * Called once a campaign level is won. Updates streak, stats, missions and event tokens.
 * Returns the extra rewards to show on the result screen.
 */
export function onLevelWin({ stars, firstClear, points, moves, usedBoosters }) {
  save.winStreak++;
  save.stats.wins++; save.stats.points += points; save.stats.moves += moves;
  if (stars === 3) save.stats.perfect++;
  recordMission('win'); recordMission('stars', stars); recordMission('points', points); recordMission('moves', moves);
  if (stars === 3) recordMission('perfect');
  if (!usedBoosters) recordMission('clean');
  recordMission('streak', save.winStreak, true);
  let tokens = 0;
  if (isUnlocked('event')) { tokens = firstClear ? stars : 1; grant({ tokens }); }
  persist();
  return { tokens, streak: save.winStreak };
}

export function onLevelFail(moves) {
  save.stats.moves += moves;
  recordMission('moves', moves);
  persist();
}

/** Red-dot counts for every live-ops / meta entry point. */
export function badges() {
  const missions = isUnlocked('missions')
    ? ensureMissions().list.filter((m) => !m.claimed && m.progress >= m.goal).length + (missionBonusReady() ? 1 : 0) : 0;
  const event = isUnlocked('event') ? EVENT_TIERS.filter((_, i) => tierClaimable(i)).length : 0;
  const chests = claimableChests().length;
  return {
    daily: isUnlocked('daily') && dailyState().canClaim,
    missions, event, chests,
    challenge: isUnlocked('challenge') && !challengeDone(),
    shop: freeAdsLeft() > 0 ? 1 : 0,
    collection: chests + SKINS.filter((s) => s.price && !save.skins.owned.includes(s.id) && save.pips >= s.price).length,
  };
}
