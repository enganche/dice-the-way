// DOM UI (GDD 10): home (world map, live-ops rails, level card), shop, collection,
// in-game HUD (moves, points, dice compass, boosters, tutorial coach), pop-ups,
// toast and confetti.

import { t, applyI18n, LANGS } from './i18n.js';
import { save, persist, totalStars, resetProgress, BUY_MOVES_PRICE } from './save.js';
import { sfx, syncMusic } from './audio.js';
import { roll } from './core/dice.js';
import { parseLevel } from './core/rules.js';
import * as meta from './meta.js';

const $ = (sel, root = document) => root.querySelector(sel);

// Thin line icons (24px grid, stroked via CSS).
const ICONS = {
  star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.8 6.3.8-4.7 4.3 1.3 6.2L12 17l-5.6 3.1 1.3-6.2L3 9.6l6.3-.8z"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.6"/><path d="M12 2.6v2.8M12 18.6v2.8M2.6 12h2.8M18.6 12h2.8M5.4 5.4l2 2M16.6 16.6l2 2M5.4 18.6l2-2M16.6 7.4l2-2"/></svg>',
  replay: '<svg viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 107.5-7.5H7.5"/><path d="M10.5 1.5l-3 3 3 3"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5.5" y="10.5" width="13" height="10" rx="1.5"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M5 12h13M12.5 6l6 6-6 6"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9h-5.5v-5.5h-5V20H4z"/></svg>',
  cart: '<svg viewBox="0 0 24 24"><path d="M3 4.5h2.5l2.2 10h10l2.3-7.5H7"/><circle cx="9.5" cy="18.8" r="1.3"/><circle cx="16.5" cy="18.8" r="1.3"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M11 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/></svg>',
  gift: '<svg viewBox="0 0 24 24"><path d="M4.5 11h15v9.5h-15zM3.5 7.5h17V11h-17zM12 7.5v13M12 7.5c-1.5-4-6-3.5-5-1s5 1 5 1zm0 0c1.5-4 6-3.5 5-1s-5 1-5 1z"/></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M6 21.5V3M6 4l12 4.2-12 4.3"/></svg>',
  pip: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/></svg>',
  video: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="12.5" height="12" rx="1.5"/><path d="M15.5 10.5l5.5-3v9l-5.5-3z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  exit: '<svg viewBox="0 0 24 24"><path d="M14 4.5H6.5v15H14M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5.5v13M5.5 12h13"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></svg>',
  bulb: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0012 3z"/></svg>',
  flame: '<svg viewBox="0 0 24 24"><path d="M12 21.5c-4 0-6.5-2.6-6.5-6.2 0-3.6 3-5.8 3.6-9.8 2.4 1.5 3.7 3.7 3.9 6 1-.8 1.6-2 1.7-3.4 2.3 1.8 3.8 4.3 3.8 7.2 0 3.6-2.5 6.2-6.5 6.2z"/></svg>',
  chest: '<svg viewBox="0 0 24 24"><path d="M3.5 10.5h17v9h-17zM3.5 10.5c0-3.5 2-6 4.5-6h8c2.5 0 4.5 2.5 4.5 6M10 10.5v3h4v-3"/></svg>',
  ticket: '<svg viewBox="0 0 24 24"><path d="M3.5 7.5h17v3a2 2 0 000 4v3h-17v-3a2 2 0 000-4zM14.5 7.5v10" stroke-dasharray="0"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M10 6.5h10M10 12h10M10 17.5h10M3.8 6.5l1.4 1.4 2.3-2.6M3.8 12l1.4 1.4 2.3-2.6M4 17.5h3"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M10.5 14.5l1.5 1.5 3-3"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8.5 5.5v13M15.5 5.5v13"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  dice: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M7.5 4h9v5a4.5 4.5 0 01-9 0zM7.5 6H4.5a3 3 0 003 4M16.5 6h3a3 3 0 01-3 4M12 13.5V17M8.5 20.5h7M9.5 17h5v3.5h-5z"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
};
const icon = (name, cls = '') => `<span class="ico ${cls}">${ICONS[name]}</span>`;

/** Ring button with a caption, used for every pop-up action. */
function cbtn(action, iconName, label, { primary = false, disabled = false, sub = '' } = {}) {
  return `<button class="cbtn ${primary ? 'primary' : ''}" data-a="${action}" ${disabled ? 'disabled' : ''}>
    <span class="ring">${icon(iconName)}</span><span class="cap">${label}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</button>`;
}
const pill = (action, label, { cls = '', disabled = false, ico = '' } = {}) =>
  `<button class="pill-btn ${cls}" data-a="${action}" ${disabled ? 'disabled' : ''}>${ico ? icon(ico, 'solid') : ''}${label}</button>`;
const fact = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;

const FACE_CELLS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const faceHtml = (n, cls = '', style = '') => `<span class="face ${cls}" style="${style}">${Array.from({ length: 9 }, (_, i) => `<i class="${FACE_CELLS[n].includes(i) ? 'on' : ''}"></i>`).join('')}</span>`;
const skinFace = (s, n = 5) => faceHtml(n, 'skinned' + (s.sparkle ? ' sparkle' : ''), `--body:${s.body};--pipc:${s.pip}`);

/** Chips that list a reward: pips, boosters, event tokens, skins. */
function rewardChips(r, big = false) {
  if (!r) return '';
  const out = [];
  if (r.pips) out.push(`<span class="rw pips">${icon('pip')}${r.pips}</span>`);
  if (r.undo) out.push(`<span class="rw">${icon('undo')}×${r.undo}</span>`);
  if (r.hint) out.push(`<span class="rw">${icon('bulb')}×${r.hint}</span>`);
  if (r.tokens) out.push(`<span class="rw tok">${icon('ticket')}${r.tokens}</span>`);
  if (r.skin) out.push(`<span class="rw skin">${skinFace(meta.skinById(r.skin))}${t('skin_' + r.skin)}</span>`);
  return `<span class="rewards ${big ? 'big' : ''}">${out.join('')}</span>`;
}

const FEATURES = [
  { id: 'daily', icon: 'gift', side: 'left' },
  { id: 'missions', icon: 'list', side: 'left' },
  { id: 'challenge', icon: 'calendar', side: 'left' },
  { id: 'event', icon: 'ticket', side: 'right' },
  { id: 'chest', icon: 'chest', side: 'right' },
];
const WORLD_COLORS = { 1: '#35a583', 2: '#3f8ccf', 3: '#8a5cc9', 4: '#2b3f7a', 5: '#c2603e' };

export class UI {
  constructor(levels, challenges, handlers) {
    this.levels = levels; this.challenges = challenges;
    this.h = handlers; // { onPlay(id, mode), onReplay(), onQuit(), onSettingsChanged(), onSkipTutorial(), onUndo(), onHint(), tileImage(key) }
    this.modalOpen = false;
    this.selected = null;
    this.queue = [];
    document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = ICONS[el.dataset.icon]; });
    applyI18n();

    this.home = $('#screen-home'); this.game = $('#screen-game');
    this.modalRoot = $('#modal-root'); this.toastEl = $('#toast');

    document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { sfx.tap(); this.showTab(b.dataset.tab); }));
    $('#home-settings').addEventListener('click', () => { sfx.tap(); this.showSettings(); });
    $('#cap-pips').addEventListener('click', () => { sfx.tap(); this.showTab('shop'); });
    $('#cap-stars').addEventListener('click', () => { sfx.tap(); this.showTab('meta'); });
    $('#btn-pause').addEventListener('click', () => { sfx.tap(); this.showPause(); });
    $('#btn-replay').addEventListener('click', () => { sfx.tap(); this.h.onReplay(); });
    $('#btn-skip').addEventListener('click', () => { sfx.tap(); this.h.onSkipTutorial(); });
    $('#btn-undo').addEventListener('click', () => { sfx.tap(); this.h.onUndo(); });
    $('#btn-hint').addEventListener('click', () => { sfx.tap(); this.h.onHint(); });
    this.buildRails();
    window.addEventListener('resize', () => { if (!this.home.hidden && !$('#tab-home').hidden) this.renderMap(false); });
    setInterval(() => this.tickTimers(), 1000);
  }

  // ---------- screens ----------
  showHome() {
    this.game.hidden = true; this.home.hidden = false;
    this.selected = null;
    this.showTab('home');
    this.checkFeatureUnlocks();
  }
  showGame(mode, level) {
    this.home.hidden = true; this.game.hidden = false;
    this.game.dataset.world = mode === 'challenge' ? 0 : level.def.world;
  }

  showTab(name) {
    this.tab = name;
    for (const n of ['home', 'shop', 'meta']) $('#tab-' + n).hidden = n !== name;
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    this.renderTop();
    if (name === 'home') this.renderMap(true);
    else if (name === 'shop') this.renderShop();
    else this.renderCollection();
  }

  renderTop() {
    const n = this.levels.length;
    $('#home-stars').textContent = `${totalStars()}/${n * 3}`;
    $('#home-pips').textContent = save.pips;
    const w = meta.worldOf(this.currentLevel());
    $('#world-label').textContent = t('worldN', { n: w.id });
    $('#world-name').textContent = t('world' + w.id);
    $('#profile-face').innerHTML = skinFace(meta.equippedSkin());
    const b = meta.badges();
    $('[data-tab="shop"]').classList.toggle('dot', !!b.shop);
    $('[data-tab="meta"]').classList.toggle('dot', !!b.collection);
    this.renderRails(b);
  }

  /** The level the player should play next. */
  currentLevel() { return Math.min(save.unlocked, this.levels.length); }

  // ---------- live-ops rails ----------
  buildRails() {
    for (const f of FEATURES) {
      const b = document.createElement('button');
      b.className = 'side-btn'; b.dataset.feature = f.id;
      b.innerHTML = `<span class="ring">${icon(f.icon)}<i class="badge-dot"></i></span><small class="cap"></small><small class="sub" data-timer="${f.id}"></small>`;
      b.addEventListener('click', () => this.openFeature(f.id));
      $('#rail-' + f.side).appendChild(b);
    }
  }

  renderRails(b = meta.badges()) {
    for (const f of FEATURES) {
      const el = $(`[data-feature="${f.id}"]`);
      const unlocked = f.id === 'chest' || meta.isUnlocked(f.id);
      el.classList.toggle('locked', !unlocked);
      $('.cap', el).textContent = t('feat_' + f.id);
      let dot = false;
      if (unlocked) {
        dot = f.id === 'daily' ? b.daily : f.id === 'missions' ? b.missions > 0 : f.id === 'event' ? b.event > 0 : f.id === 'chest' ? b.chests > 0 : b.challenge;
      }
      el.classList.toggle('dot', !!dot);
      $('.ring', el).innerHTML = (unlocked ? icon(f.icon) : icon('lock')) + '<i class="badge-dot"></i>';
      el.classList.toggle('glow', !!dot);
    }
    this.tickTimers();
  }

  tickTimers() {
    if (this.home.hidden) { this.tickModalTimers(); return; }
    const set = (id, txt) => { const el = $(`[data-timer="${id}"]`); if (el) el.textContent = txt; };
    for (const f of FEATURES) {
      const unlocked = f.id === 'chest' || meta.isUnlocked(f.id);
      if (!unlocked) { set(f.id, t('lvShort', { n: meta.UNLOCK[f.id] + 1 })); continue; }
      if (f.id === 'event') set('event', meta.formatTime(meta.msToWeekEnd()));
      else if (f.id === 'challenge') set('challenge', meta.challengeDone() ? meta.formatTime(meta.msToMidnight()) : t('new'));
      else if (f.id === 'missions') { const l = meta.ensureMissions().list; set('missions', `${l.filter((m) => m.claimed).length}/${l.length}`); }
      else if (f.id === 'daily') set('daily', meta.dailyState().canClaim ? t('claim') : meta.formatTime(meta.msToMidnight()));
      else if (f.id === 'chest') { const c = meta.nextChest(); set('chest', c ? `${Math.min(totalStars(), c.stars)}/${c.stars}` : '✓'); }
    }
    this.tickModalTimers();
  }
  tickModalTimers() {
    document.querySelectorAll('[data-countdown]').forEach((el) => {
      const ms = el.dataset.countdown === 'week' ? meta.msToWeekEnd() : meta.msToMidnight();
      el.textContent = meta.formatTime(ms);
    });
  }

  openFeature(id) {
    sfx.tap();
    if (id !== 'chest' && !meta.isUnlocked(id)) { sfx.buzz(); this.toast(t('unlocksAt', { n: meta.UNLOCK[id] }), 'lock'); return; }
    if (id === 'daily') this.showDaily();
    else if (id === 'missions') this.showMissions();
    else if (id === 'challenge') this.showChallenge();
    else if (id === 'event') this.showEvent();
    else if (id === 'chest') this.showTab('meta');
  }

  /** New-feature cards, shown once when the player reaches the unlock level. */
  checkFeatureUnlocks() {
    const order = ['daily', 'undo', 'missions', 'hint', 'event', 'streak', 'challenge'];
    const fresh = order.filter((f) => meta.isUnlocked(f) && !save.seen['feat_' + f] && !['undo', 'hint'].includes(f));
    const next = fresh[0];
    if (!next || this.modalOpen) return;
    save.seen['feat_' + next] = true; persist();
    const ic = { daily: 'gift', missions: 'list', event: 'ticket', streak: 'flame', challenge: 'calendar' }[next];
    const m = this.openModal(`
      <div class="ribbon">${t('newFeature')}</div>
      <div class="feature-art">${icon(ic)}</div>
      <h2>${t('feat_' + next)}</h2>
      <p>${t('featBody_' + next)}</p>
      <div class="actions">${pill('go', next === 'streak' ? t('gotIt') : t('open'), { cls: 'primary' })}</div>`);
    sfx.open();
    this._actions(m, { go: () => { if (next !== 'streak') this.openFeature(next); setTimeout(() => this.checkFeatureUnlocks(), 50); } });
  }

  // ---------- world map ----------
  renderMap(scrollToSelected) {
    const n = this.levels.length;
    if (!this.selected || this.selected > save.unlocked) this.selected = this.currentLevel();

    const scroll = $('#map-scroll'), map = $('#map');
    const width = Math.min(scroll.clientWidth || 360, 460);
    const step = 96, padTop = 90, padBottom = 70, bannerGap = 120;
    const banners = meta.WORLDS.length - 1;
    const height = padTop + padBottom + (n - 1) * step + banners * bannerGap;
    map.style.width = width + 'px'; map.style.height = height + 'px';
    const yOf = (i) => height - padBottom - i * step - Math.floor(i / 10) * bannerGap;
    const pos = (i) => ({ x: width / 2 + Math.sin(i * 0.9) * width * 0.2, y: yOf(i) });
    const pts = this.levels.map((_, i) => pos(i));
    const line = (from, to) => pts.slice(from, to).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const current = this.currentLevel();
    let bands = '';
    for (const w of meta.WORLDS) {
      const top = w.to < n ? yOf(w.to - 1) - bannerGap / 2 - step / 2 : 0;
      const bottom = w.from === 1 ? height : yOf(w.from - 1) + step / 2 + (w.from === 1 ? 0 : 0);
      bands += `<rect x="0" y="${top}" width="${width}" height="${bottom - top}" fill="${WORLD_COLORS[w.id]}" opacity=".13"/>`;
    }
    let html = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${bands}
      <polyline points="${line(0, n)}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round"/>
      <polyline points="${line(0, current)}" fill="none" stroke="#2fc4dd" stroke-width="3" stroke-linecap="round"/></svg>`;
    for (const w of meta.WORLDS) {
      if (w.from === 1) continue;
      const y = yOf(w.from - 1) + step / 2 + bannerGap / 2 - 6;
      const locked = w.from > save.unlocked;
      const img = this.h.tileImage(w.mech === 'portal' ? 'portalT' : w.mech);
      html += `<div class="world-banner ${locked ? 'locked' : ''}" style="top:${y}px;--wc:${WORLD_COLORS[w.id]}">
        ${img ? `<img src="${img}" alt="">` : ''}<div><small>${t('worldN', { n: w.id })}</small><b>${t('world' + w.id)}</b><span>${t('mech_' + w.mech)}${w.id === 5 ? ' · ' + t('mech_gate') : ''}</span></div>
        ${locked ? icon('lock') : ''}</div>`;
    }
    html += `<div class="world-banner start" style="top:${height - 30}px;--wc:${WORLD_COLORS[1]}"><div><small>${t('worldN', { n: 1 })}</small><b>${t('world1')}</b></div></div>`;
    this.levels.forEach((lv, i) => {
      const id = lv.id, p = pts[i];
      const got = save.stars[id] || 0;
      const locked = id > save.unlocked;
      const cls = [locked ? 'locked' : got ? 'done' : 'current', id === this.selected ? 'selected' : '', lv.intro ? 'intro' : ''].join(' ');
      const starRow = got ? `<span class="stars">${[1, 2, 3].map((s) => `<i class="${got >= s ? 'on' : ''}"></i>`).join('')}</span>` : '';
      html += `<button class="node ${cls}" data-level="${id}" style="left:${p.x}px;top:${p.y}px;--wc:${WORLD_COLORS[lv.world]}" aria-label="${t('level', { n: id })}">
        <span class="gem"></span><span class="num">${locked ? icon('lock') : id}</span>${starRow}${lv.intro && !locked && !got ? '<span class="new-tag">NEW</span>' : ''}</button>`;
    });
    map.innerHTML = html;
    map.querySelectorAll('.node').forEach((b) => b.addEventListener('click', () => {
      const id = +b.dataset.level;
      if (id > save.unlocked) { sfx.buzz(); this.toast(t('locked'), 'lock'); return; }
      sfx.tap();
      if (id === this.selected) { this.h.onPlay(id); return; }
      this.selected = id;
      map.querySelectorAll('.node').forEach((nd) => nd.classList.toggle('selected', +nd.dataset.level === id));
      this.renderLevelCard();
    }));
    this.renderLevelCard();
    if (scrollToSelected) scroll.scrollTop = pts[this.selected - 1].y - scroll.clientHeight * 0.55;
  }

  /** Summary of the selected level with the Play button. */
  renderLevelCard() {
    const lv = this.levels.find((l) => l.id === this.selected);
    const got = save.stars[lv.id] || 0;
    const uses = parseLevel(lv).uses;
    const tags = uses.map((u) => `<img class="tag-img" src="${this.h.tileImage(u === 'portal' ? 'portalT' : u === 'gate' ? 'g3' : u)}" alt="${t('mech_' + u)}" title="${t('mech_' + u)}">`).join('');
    const bonus = meta.streakBonus();
    const card = $('#level-card');
    card.innerHTML = `
      <div class="card-info">
        <small>${t('worldN', { n: lv.world })} · ${t('world' + lv.world)}</small>
        <h2>${t('level', { n: lv.id })}</h2>
        <span class="card-row"><span class="card-stars">${[1, 2, 3].map((s) => icon('star', got >= s ? 'on' : '')).join('')}</span>${tags}
        ${bonus && !got ? `<span class="streak-chip">${icon('flame', 'solid')}+${bonus}</span>` : ''}</span>
      </div>
      <button class="play-btn">${icon('play', 'solid')}${t(got ? 'replay' : 'play')}</button>`;
    $('.play-btn', card).addEventListener('click', () => { sfx.tap(); this.h.onPlay(lv.id); });
  }

  // ---------- shop ----------
  renderShop() {
    const left = meta.freeAdsLeft();
    const el = $('#shop');
    el.innerHTML = `
      <h3 class="sec">${t('shopFree')}</h3>
      <div class="shop-card free">
        <span class="shop-art">${icon('video')}</span>
        <div class="shop-info"><b>${t('freePips', { n: meta.FREE_AD_PIPS })}</b><small>${t('leftToday', { n: left })}</small></div>
        ${pill('free', t('watch'), { cls: 'primary', disabled: left <= 0, ico: 'play' })}
      </div>
      <h3 class="sec">${t('shopBoosters')}</h3>
      ${meta.SHOP_PACKS.map((p) => `
      <div class="shop-card ${p.best ? 'best' : ''}">
        ${p.best ? `<span class="corner">${t('bestValue')}</span>` : ''}
        <span class="shop-art">${icon(p.give.hint && !p.give.undo ? 'bulb' : p.give.undo && p.give.hint ? 'gift' : 'undo')}</span>
        <div class="shop-info"><b>${t('pack_' + p.id)}</b>${rewardChips(p.give)}</div>
        <button class="pill-btn price" data-buy="${p.id}" ${save.pips < p.price ? 'disabled' : ''}>${icon('pip')}${p.price}</button>
      </div>`).join('')}
      <h3 class="sec">${t('shopPips')}</h3>
      <div class="iap-row">${meta.IAP_PACKS.map((p, i) => `
        <button class="iap" data-iap="${p.id}">${p.tag ? `<span class="corner">${p.tag}</span>` : ''}
          <span class="coins c${i}">${icon('pip')}${icon('pip')}${icon('pip')}</span><b>${p.pips}</b><span class="price">${p.price}</span></button>`).join('')}
      </div>
      <p class="fine">${t('iapNote')}</p>`;
    $('[data-a="free"]', el).addEventListener('click', () => {
      sfx.tap();
      this.showAd(() => { const r = meta.takeFreeAd(); if (r) this.showReward(r, t('freeGift')); this.renderTop(); this.renderShop(); });
    });
    el.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
      const r = meta.buyPack(b.dataset.buy);
      if (!r) { sfx.buzz(); this.toast(t('notEnough')); return; }
      sfx.coin(); this.showReward(r, t('purchased'));
      this.renderTop(); this.renderShop();
    }));
    el.querySelectorAll('[data-iap]').forEach((b) => b.addEventListener('click', () => { sfx.tap(); this.toast(t('iapDisabled')); }));
  }

  // ---------- collection (meta) ----------
  renderCollection() {
    const stars = totalStars();
    const el = $('#collection');
    const road = meta.STAR_CHESTS.map((c, i) => {
      const claimed = save.chests.includes(i), ready = meta.chestClaimable(i);
      return `<div class="road-step ${claimed ? 'claimed' : ready ? 'ready' : ''}">
        <span class="road-star">${icon('star', 'on')}${c.stars}</span>
        <button class="chest-btn" data-chest="${i}" ${ready ? '' : 'disabled'}>${icon(claimed ? 'check' : 'chest')}</button>
        ${rewardChips(c.reward)}</div>`;
    }).join('');
    const nc = meta.nextChest();
    const prevNeed = nc && nc.index > 0 ? meta.STAR_CHESTS[nc.index - 1].stars : 0;
    const pct = nc ? Math.min(100, ((stars - prevNeed) / (nc.stars - prevNeed)) * 100) : 100;
    el.innerHTML = `
      <h3 class="sec">${t('starRoad')}</h3>
      <div class="progress-card">
        <div class="pc-head"><span>${icon('star', 'on')} <b>${stars}</b> / ${this.levels.length * 3}</span><small>${meta.claimableChests().length ? t('chestsReady', { n: meta.claimableChests().length }) : nc ? t('nextChestAt', { n: nc.stars }) : t('allChests')}</small></div>
        <div class="bar"><i style="width:${Math.max(0, pct)}%"></i></div>
      </div>
      <div class="road">${road}</div>
      <h3 class="sec">${t('diceSkins')}</h3>
      <div class="skin-grid">${meta.SKINS.map((s) => {
        const owned = save.skins.owned.includes(s.id), on = save.skins.equipped === s.id;
        const action = on ? `<span class="tag on">${t('equipped')}</span>`
          : owned ? `<button class="pill-btn sm" data-equip="${s.id}">${t('equip')}</button>`
          : s.price ? `<button class="pill-btn sm price" data-skin="${s.id}" ${save.pips < s.price ? 'disabled' : ''}>${icon('pip')}${s.price}</button>`
          : `<span class="tag">${t('src_' + s.source)}</span>`;
        return `<div class="skin ${on ? 'on' : ''} ${owned ? '' : 'not-owned'}"><div class="skin-dice">${skinFace(s, 5)}</div><b>${t('skin_' + s.id)}</b>${action}</div>`;
      }).join('')}</div>
      <h3 class="sec">${t('stats')}</h3>
      <dl class="facts stats">${fact(t('statWins'), save.stats.wins)}${fact(t('statPerfect'), save.stats.perfect)}${fact(t('statPoints'), save.stats.points)}${fact(t('statChallenges'), save.stats.challenges)}</dl>`;
    el.querySelectorAll('[data-chest]').forEach((b) => b.addEventListener('click', () => {
      const r = meta.claimChest(+b.dataset.chest);
      if (r) { this.showReward(r, t('chestOpened')); this.renderTop(); this.renderCollection(); }
    }));
    el.querySelectorAll('[data-equip]').forEach((b) => b.addEventListener('click', () => { sfx.tap(); meta.equipSkin(b.dataset.equip); this.renderTop(); this.renderCollection(); }));
    el.querySelectorAll('[data-skin]').forEach((b) => b.addEventListener('click', () => {
      const s = meta.skinById(b.dataset.skin);
      const m = this.openModal(`<h2>${t('skin_' + s.id)}</h2><div class="skin-dice big">${skinFace(s, 6)}</div>
        <p>${t('buySkinQ', { n: s.price })}</p><div class="actions">${pill('no', t('cancel'))}${pill('yes', `${icon('pip')}${s.price}`, { cls: 'primary' })}</div>`);
      this._actions(m, { yes: () => { if (meta.buySkin(s.id)) { sfx.coin(); this.toast(t('skinEquipped')); } this.renderTop(); this.renderCollection(); } });
    }));
  }

  // ---------- HUD ----------
  setLevelHud(level, mode) {
    $('#hud-level').textContent = mode === 'challenge' ? t('feat_challenge') : t('level', { n: level.id });
    $('#hud-world').textContent = mode === 'challenge' ? meta.today() : t('world' + level.def.world);
    $('#point-chips').innerHTML = level.points.map((p) => `<span class="chip" data-p="${p.index}">${p.n}</span>`).join('');
    $('#stat-points').hidden = !level.points.length;
    $('#btn-undo').hidden = !(meta.isUnlocked('undo') || mode === 'challenge');
    $('#btn-hint').hidden = !(meta.isUnlocked('hint') || mode === 'challenge');
    $('#btn-replay').hidden = !!level.def.tutorial && !save.tutorialSkipped;
  }

  updateHud({ movesLeft, mask, o, used, best, undo, hint, canUndo }) {
    const mv = $('#moves-left');
    if (mv.textContent !== String(movesLeft)) {
      mv.textContent = movesLeft;
      this._pop($('#stat-moves'));
    }
    $('#stat-moves').classList.toggle('low', movesLeft <= 2);
    document.querySelectorAll('#point-chips .chip').forEach((c) => {
      const done = !!(mask & (1 << +c.dataset.p));
      if (done && !c.classList.contains('done')) this._pop(c);
      c.classList.toggle('done', done);
    });
    this.setTopFace(o);
    $('#status-text').textContent = t('used', { u: used, b: best });
    const setB = (id, n) => {
      const b = $(id);
      $('.count', b).textContent = n > 0 ? n : '+';
      b.classList.toggle('empty', n <= 0);
    };
    setB('#btn-undo', undo); setB('#btn-hint', hint);
    $('#btn-undo').classList.toggle('disabled', !canUndo);
  }

  /** Dice compass: top face in the middle, next top face for each direction around it. */
  setTopFace(o) {
    const el = $('#compass');
    const key = o.join('');
    if (el.dataset.o === key) return;
    el.dataset.o = key;
    $('.c-face', el).innerHTML = faceHtml(o[0]);
    for (const d of ['U', 'D', 'L', 'R']) $(`.c-${d}`, el).textContent = roll(o, d)[0];
    this._pop($('.c-face', el));
  }

  _pop(el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

  /** Pixel space taken by the HUD at the top and the footer at the bottom. */
  insets() {
    const top = $('#hud').getBoundingClientRect().bottom;
    const foot = $('#game-foot').getBoundingClientRect();
    return { top: top + 6, bottom: Math.max(60, window.innerHeight - foot.top + 6) };
  }

  // ---------- tutorial coach ----------
  /** Show the coach bubble + swipe hand, or hide it with null. */
  coach(c) {
    const box = $('#coach'), hand = $('#hand');
    document.querySelectorAll('.spot').forEach((e) => e.classList.remove('spot'));
    if (!c) { box.hidden = true; hand.hidden = true; return; }
    $('#coach-text').textContent = c.text;
    $('#btn-skip').hidden = !c.skip;
    box.hidden = false;
    if (c.spot) $(c.spot)?.classList.add('spot');
    if (c.dir && c.at) {
      const v = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }[c.dir];
      hand.style.left = c.at.x + 'px'; hand.style.top = c.at.y + 'px';
      hand.style.setProperty('--dx', v[0] * 70 + 'px'); hand.style.setProperty('--dy', v[1] * 70 + 'px');
      hand.hidden = false;
      hand.style.animation = 'none'; void hand.offsetWidth; hand.style.animation = '';
    } else hand.hidden = true;
  }
  nudgeCoach() { this._pop($('#coach')); }

  // ---------- pop-ups ----------
  openModal(html, cls = '') {
    this.modalOpen = true;
    this.modalRoot.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
    this.modalRoot.hidden = false;
    this.tickModalTimers();
    return this.modalRoot.firstElementChild;
  }
  closeModal() { this.modalOpen = false; this.modalRoot.hidden = true; this.modalRoot.innerHTML = ''; }

  /** Card for a new tile type or booster. Resolves when dismissed. */
  showIntro(kind, img) {
    return new Promise((resolve) => {
      const art = img ? `<img class="intro-img" src="${img}" alt="">` : `<div class="feature-art">${icon(kind === 'undo' ? 'undo' : 'bulb')}</div>`;
      const m = this.openModal(`
        <div class="ribbon">${t(kind === 'undo' || kind === 'hint' ? 'newBooster' : 'newTile')}</div>
        ${art}
        <h2>${t('intro_' + kind)}</h2>
        <p>${t('introBody_' + kind)}</p>
        ${kind === 'undo' || kind === 'hint' ? rewardChips({ [kind]: save.inventory[kind] }, true) : ''}
        <div class="actions">${pill('ok', t('gotIt'), { cls: 'primary' })}</div>`, 'intro');
      sfx.open();
      this._actions(m, { ok: resolve });
    });
  }

  showComplete({ score, stars, moves, best, pips, tokens, streak, isLast, nextWorld, nextId }, on) {
    const m = this.openModal(`
      <h2>${t('complete')}</h2>
      <div class="big-stars">${[1, 2, 3].map((s) => `<span class="ico ${stars >= s ? 'on' : ''}" style="animation-delay:${0.15 + s * 0.22}s">${ICONS.star}</span>`).join('')}</div>
      <div class="score-big">${score}<small>%</small></div>
      <dl class="facts">${fact(t('statMoves'), moves)}${fact(t('statBest'), best)}</dl>
      ${pips || tokens ? `<div class="earned"><small>${t('earned')}</small>${rewardChips({ pips, tokens }, true)}</div>` : ''}
      ${streak ? `<div class="streak-banner">${icon('flame', 'solid')}<span>${t('streakNow', { n: streak, b: Math.min(3, streak) })}</span></div>` : ''}
      ${nextWorld ? `<div class="world-next">${t('worldUnlocked', { w: t('world' + meta.worldOf(nextId).id) })}</div>` : ''}
      <div class="actions">
        ${cbtn('replay', 'replay', t('replay'))}
        ${isLast ? cbtn('map', 'home', t('tabHome'), { primary: true }) : cbtn('next', 'next', t('next'), { primary: true })}
        ${isLast ? '' : cbtn('map', 'home', t('tabHome'))}
      </div>`);
    for (let s = 0; s < stars; s++) setTimeout(() => sfx.star(s), 150 + (s + 1) * 220);
    if (pips) setTimeout(() => sfx.coin(), 1100);
    this._actions(m, on);
  }

  showChallengeComplete({ moves, best, reward, streak }, on) {
    const m = this.openModal(`
      <div class="ribbon gold">${t('feat_challenge')}</div>
      <div class="feature-art gold">${icon('trophy')}</div>
      <h2>${t('challengeDone')}</h2>
      <dl class="facts">${fact(t('statMoves'), moves)}${fact(t('statBest'), best)}${fact(t('dayStreak'), streak)}</dl>
      ${reward ? `<div class="earned"><small>${t('earned')}</small>${rewardChips(reward, true)}</div>` : `<p>${t('challengeAgain')}</p>`}
      <div class="actions">${cbtn('map', 'home', t('tabHome'), { primary: true })}</div>`);
    sfx.open();
    this._actions(m, on);
  }

  showFail({ canBuy, canAd, solved, total, streak }, on) {
    const afford = save.pips >= BUY_MOVES_PRICE;
    const note = !canBuy ? t('alreadyBought') : !afford ? t('notEnough') : '';
    const m = this.openModal(`
      <h2>${t('failed')}</h2>
      <p>${t('failedSub')}</p>
      <dl class="facts">${fact(t('points'), `${solved}/${total}`)}${fact('Pips', save.pips)}</dl>
      ${streak ? `<div class="streak-banner warn">${icon('flame', 'solid')}<span>${t('streakAtRisk', { n: streak })}</span></div>` : ''}
      ${note ? `<span class="note">${note}</span>` : ''}
      <div class="actions">
        ${cbtn('buy', 'plus', t('buyMoves'), { disabled: !(canBuy && afford), sub: `${icon('pip')}${BUY_MOVES_PRICE}` })}
        ${cbtn('ad', 'video', t('buyMoves'), { primary: true, disabled: !canAd, sub: t('adShort') })}
        ${cbtn('replay', 'replay', t('replay'))}
      </div>
      <button class="link-btn" data-a="map">${t('giveUp')}</button>`);
    this._actions(m, on);
  }

  showBuyBooster(kind, price, on) {
    const m = this.openModal(`
      <div class="feature-art">${icon(kind === 'undo' ? 'undo' : 'bulb')}</div>
      <h2>${t('intro_' + kind)}</h2>
      <p>${t('outOf', { b: t('intro_' + kind) })}</p>
      <dl class="facts">${fact('Pips', save.pips)}</dl>
      <div class="actions">${pill('close', t('cancel'))}${pill('buy', `+1 · ${icon('pip')}${price}`, { cls: 'primary', disabled: save.pips < price })}</div>`);
    this._actions(m, on);
  }

  /** Placeholder rewarded ad (GDD 12: web ads are a placeholder in v1). */
  showAd(onDone) {
    let n = 3;
    const m = this.openModal(`<h2>${t('adTitle')}</h2><div class="ad-box"><b id="ad-count">${n}</b></div><p id="ad-text">${t('adBody', { n })}</p>`);
    const timer = setInterval(() => {
      n--;
      if (n <= 0) { clearInterval(timer); this.closeModal(); onDone(); return; }
      $('#ad-count', m).textContent = n; $('#ad-text', m).textContent = t('adBody', { n });
    }, 800);
  }

  /** Reward reveal (chests, claims, purchases). */
  showReward(r, title) {
    const m = this.openModal(`
      <div class="burst"></div>
      <div class="feature-art gold pop-in">${icon('chest')}</div>
      <h2>${title || t('reward')}</h2>
      ${rewardChips(r, true)}
      <div class="actions">${pill('ok', t('collect'), { cls: 'primary' })}</div>`, 'reward');
    sfx.open(); setTimeout(() => sfx.coin(), 350);
    this._actions(m, { ok: () => { this.renderTop(); if (!this.home.hidden) { if (this.tab === 'home') this.renderLevelCard(); } } });
  }

  showDaily() {
    const st = meta.dailyState();
    const tiles = meta.DAILY_REWARDS.map((r, i) => {
      const claimed = i < st.next || (st.claimedToday && i === (st.streak - 1) % 7);
      const today = st.canClaim && i === st.next;
      return `<div class="day ${claimed ? 'claimed' : ''} ${today ? 'today' : ''} ${i === 6 ? 'big' : ''}">
        <small>${t('dayN', { n: i + 1 })}</small>${rewardChips(r)}${claimed ? `<span class="tick">${icon('check')}</span>` : ''}</div>`;
    }).join('');
    const m = this.openModal(`
      <div class="ribbon">${t('feat_daily')}</div>
      <p>${t('dailyBody')}</p>
      <div class="days">${tiles}</div>
      ${st.canClaim ? pill('claim', t('claim'), { cls: 'primary wide', ico: 'gift' }) : `<p class="timer-line">${icon('clock')} ${t('nextIn')} <b data-countdown="day"></b></p>`}
      <button class="link-btn" data-a="close">${t('close')}</button>`, 'wide');
    this._actions(m, {
      claim: () => { const res = meta.claimDaily(); if (res) this.showReward(res.reward, t('dayN', { n: res.day + 1 })); this.renderTop(); },
    });
  }

  showMissions() {
    const ms = meta.ensureMissions();
    const rows = ms.list.map((m, i) => {
      const def = meta.missionDef(m.id);
      const done = m.progress >= m.goal;
      return `<div class="mission ${m.claimed ? 'claimed' : done ? 'ready' : ''}">
        <div class="m-info"><b>${t('mis_' + m.id, { n: m.goal })}</b>
          <div class="bar"><i style="width:${(m.progress / m.goal) * 100}%"></i></div><small>${m.progress}/${m.goal}</small></div>
        <div class="m-reward">${rewardChips(def.reward)}
          ${m.claimed ? `<span class="tag on">${icon('check')}</span>` : `<button class="pill-btn sm primary" data-claim="${i}" ${done ? '' : 'disabled'}>${t('claim')}</button>`}</div>
      </div>`;
    }).join('');
    const bonusReady = meta.missionBonusReady();
    const m = this.openModal(`
      <div class="ribbon">${t('feat_missions')}</div>
      <p class="timer-line">${icon('clock')} ${t('resetsIn')} <b data-countdown="day"></b></p>
      <div class="missions">${rows}</div>
      <div class="mission bonus ${ms.bonus ? 'claimed' : bonusReady ? 'ready' : ''}">
        <div class="m-info"><b>${t('misBonus')}</b></div>
        <div class="m-reward">${rewardChips(meta.MISSION_BONUS)}
        ${ms.bonus ? `<span class="tag on">${icon('check')}</span>` : `<button class="pill-btn sm primary" data-bonus ${bonusReady ? '' : 'disabled'}>${icon('chest')}</button>`}</div>
      </div>
      <button class="link-btn" data-a="close">${t('close')}</button>`, 'wide');
    m.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', () => {
      const r = meta.claimMission(+b.dataset.claim);
      if (r) { sfx.coin(); this.renderTop(); this.showMissions(); this.toast(t('claimed'), 'check'); }
    }));
    m.querySelector('[data-bonus]')?.addEventListener('click', () => {
      const r = meta.claimMissionBonus();
      if (r) { this.showReward(r, t('misBonus')); this.renderTop(); }
    });
    this._actions(m, {});
  }

  showChallenge() {
    const lv = meta.challengeForToday(this.challenges);
    const done = meta.challengeDone();
    const uses = parseLevel(lv).uses;
    const tags = uses.map((u) => `<span class="mech-tag"><img src="${this.h.tileImage(u === 'portal' ? 'portalT' : u === 'gate' ? 'g3' : u)}" alt="">${t('mech_' + u)}</span>`).join('');
    const m = this.openModal(`
      <div class="ribbon gold">${t('feat_challenge')}</div>
      <div class="feature-art gold">${icon('calendar')}</div>
      <p>${t('challengeBody', { n: lv.limit })}</p>
      <div class="mech-tags">${tags}</div>
      <dl class="facts">${fact(t('statBest'), lv.best)}${fact(t('statLimit'), lv.limit)}${fact(t('dayStreak'), save.challenge.lastDone === meta.today() || save.challenge.lastDone === meta.yesterday() ? save.challenge.streak : 0)}</dl>
      ${done ? `<p class="timer-line">${icon('check')} ${t('challengeDoneToday')} · ${t('nextIn')} <b data-countdown="day"></b></p>`
        : `<div class="earned"><small>${t('reward')}</small>${rewardChips({ ...meta.CHALLENGE_REWARD, tokens: meta.isUnlocked('event') ? meta.CHALLENGE_REWARD.tokens : 0 }, true)}</div>`}
      <div class="actions">${pill('close', t('close'))}${pill('play', t(done ? 'replay' : 'play'), { cls: 'primary', ico: 'play' })}</div>`);
    this._actions(m, { play: () => this.h.onPlay(lv.id, 'challenge') });
  }

  showEvent() {
    const ev = meta.ensureEvent();
    const tiers = meta.EVENT_TIERS.map((tier, i) => {
      const claimed = ev.claimed.includes(i), ready = meta.tierClaimable(i);
      const reached = ev.tokens >= tier.need;
      return `<div class="tier ${claimed ? 'claimed' : ready ? 'ready' : reached ? '' : 'locked'}">
        <span class="tier-need">${icon('ticket')}${tier.need}</span>
        ${rewardChips(tier.reward)}
        ${claimed ? `<span class="tag on">${icon('check')}</span>` : `<button class="pill-btn sm primary" data-tier="${i}" ${ready ? '' : 'disabled'}>${reached ? t('claim') : icon('lock')}</button>`}
      </div>`;
    }).join('');
    const last = meta.EVENT_TIERS[meta.EVENT_TIERS.length - 1].need;
    const m = this.openModal(`
      <div class="ribbon purple">${t('eventName')}</div>
      <p>${t('eventBody')}</p>
      <div class="progress-card">
        <div class="pc-head"><span>${icon('ticket')} <b>${ev.tokens}</b> / ${last}</span><small>${icon('clock')} <b data-countdown="week"></b></small></div>
        <div class="bar purple"><i style="width:${Math.min(100, (ev.tokens / last) * 100)}%"></i></div>
      </div>
      <div class="tiers">${tiers}</div>
      <button class="link-btn" data-a="close">${t('close')}</button>`, 'wide');
    m.querySelectorAll('[data-tier]').forEach((b) => b.addEventListener('click', () => {
      const r = meta.claimTier(+b.dataset.tier);
      if (r) { this.showReward(r, t('eventName')); this.renderTop(); }
    }));
    this._actions(m, {});
  }

  /** In-game pause menu. */
  showPause() {
    const s = save.settings;
    const streak = meta.isUnlocked('streak') && save.winStreak > 0;
    const m = this.openModal(`
      <h2>${t('paused')}</h2>
      <div class="quick-toggles">${['sound', 'music', 'vibration'].map((k) => `<button class="qt ${s[k] ? 'on' : ''}" data-toggle="${k}">${t(k)}</button>`).join('')}</div>
      <p class="controls-hint"><b>${t('controls')}</b>${t('controlsHint')}</p>
      ${streak ? `<div class="streak-banner warn">${icon('flame', 'solid')}<span>${t('quitStreak', { n: save.winStreak })}</span></div>` : ''}
      <div class="actions">
        ${cbtn('quit', 'exit', t('tabHome'))}
        ${cbtn('close', 'play', t('resume'), { primary: true })}
        ${cbtn('replay', 'replay', t('replay'))}
      </div>`);
    this._toggles(m);
    this._actions(m, { quit: () => this.h.onQuit(), replay: () => this.h.onReplay() });
  }

  showSettings() {
    const s = save.settings;
    const row = (key) => `<div class="setting-row"><span>${t(key)}</span><button class="switch ${s[key] ? 'on' : ''}" data-toggle="${key}" role="switch" aria-checked="${s[key]}" aria-label="${t(key)}"></button></div>`;
    const m = this.openModal(`
      <h2>${t('settings')}</h2>
      <div class="settings">
        ${row('sound')}${row('music')}${row('vibration')}
        <div class="setting-row"><span>${t('language')}</span><div class="seg">${LANGS.map(([c, name]) => `<button data-lang="${c}" class="${s.lang === c ? 'on' : ''}">${name}</button>`).join('')}</div></div>
        <div class="setting-row"><span>${t('tutorial')}</span><button class="pill-btn sm" data-replay-tut>${t('replayTut')}</button></div>
        <p class="controls-hint"><b>${t('controls')}</b>${t('controlsHint')}</p>
      </div>
      <div class="actions">
        ${cbtn('close', 'close', t('close'), { primary: true })}
        ${cbtn('reset', 'replay', t('reset'))}
      </div>`);
    this._toggles(m);
    m.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
      s.lang = b.dataset.lang; persist();
      applyI18n(); this.h.onSettingsChanged();
      this.showSettings();
    }));
    m.querySelector('[data-replay-tut]').addEventListener('click', () => {
      save.tutorialSkipped = false; persist(); this.closeModal(); this.h.onPlay(1);
    });
    this._actions(m, {
      reset: () => { if (confirm(t('resetConfirm'))) { resetProgress(); this.selected = null; this.showTab('home'); } },
    });
  }

  _toggles(m) {
    const s = save.settings;
    m.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.toggle;
      s[k] = !s[k]; persist();
      b.classList.toggle('on', s[k]); b.setAttribute('aria-checked', s[k]);
      if (k === 'music') syncMusic();
      sfx.tap();
    }));
  }

  _actions(modal, on) {
    modal.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
      sfx.tap();
      this.closeModal();
      on[b.dataset.a]?.();
      if (!this.home.hidden && !this.modalOpen) { this.renderTop(); this.checkFeatureUnlocks(); }
    }));
  }

  toast(text, ico) {
    const el = this.toastEl;
    el.innerHTML = (ico ? icon(ico, 'solid') : '') + `<span>${text}</span>`; el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.hidden = true; }, 2000);
  }

  // ---------- confetti ----------
  confetti() {
    const c = $('#confetti'), g = c.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = c.clientWidth, H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ['#ffc93c', '#2fc4dd', '#6fe0b6', '#ffffff', '#f59331'];
    const parts = Array.from({ length: 110 }, (_, i) => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.45,
      vx: (Math.random() - 0.5) * W * 1.5, vy: -H * (0.5 + Math.random() * 0.75),
      r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 12, s: 5 + Math.random() * 6, c: colors[i % colors.length],
    }));
    const t0 = performance.now(); let last = t0;
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const age = (now - t0) / 1000;
      g.clearRect(0, 0, W, H);
      if (age > 2.6) return;
      for (const p of parts) {
        p.vy += H * 1.5 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, Math.min(1, 2.6 - age));
        g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
