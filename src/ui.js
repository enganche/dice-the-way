// DOM UI: home (level map + level card), tabs, HUD, pop-ups, toast, confetti (GDD 10).

import { t, applyI18n, LANGS } from './i18n.js';
import { save, persist, totalStars, resetProgress, BUY_MOVES_PRICE } from './save.js';
import { sfx, syncMusic } from './audio.js';

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
  cart: '<svg viewBox="0 0 24 24"><path d="M3 4.5h2.5l2.2 10h10l2.300-7.500H7"/><circle cx="9.500" cy="18.800" r="1.300"/><circle cx="16.500" cy="18.800" r="1.300"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M11 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM18.500 15l.9 2.100 2.100.9-2.100.9-.9 2.100-.9-2.100-2.100-.9 2.100-.9z"/></svg>',
  gift: '<svg viewBox="0 0 24 24"><path d="M4.500 11h15v9.500h-15zM3.500 7.500h17V11h-17zM12 7.500v13M12 7.500c-1.500-4-6-3.500-5-1s5 1 5 1zm0 0c1.500-4 6-3.500 5-1s-5 1-5 1z"/></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M6 21.500V3M6 4l12 4.200-12 4.300"/></svg>',
  pip: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.600" fill="currentColor"/></svg>',
  video: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="12.500" height="12" rx="1.500"/><path d="M15.500 10.500l5.500-3v9l-5.500-3z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6.500 6.500l11 11M17.500 6.500l-11 11"/></svg>',
  exit: '<svg viewBox="0 0 24 24"><path d="M14 4.500H6.500v15H14M10.500 12h10M17 8.500l3.500 3.500-3.500 3.500"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5.500v13M5.500 12h13"/></svg>',
};
const icon = (name, cls = '') => `<span class="ico ${cls}">${ICONS[name]}</span>`;

/** Ring button with a caption, used for every pop-up action. */
function cbtn(action, iconName, label, { primary = false, disabled = false, sub = '' } = {}) {
  return `<button class="cbtn ${primary ? 'primary' : ''}" data-a="${action}" ${disabled ? 'disabled' : ''}>
    <span class="ring">${icon(iconName)}</span><span class="cap">${label}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</button>`;
}

const fact = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;

const FACE_CELLS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export class UI {
  constructor(levels, handlers) {
    this.levels = levels;
    this.h = handlers; // { onPlay(id), onReplay(), onBackToMap(), onSettingsChanged(), onSkipTutorial() }
    this.modalOpen = false;
    this.selected = null;
    document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = ICONS[el.dataset.icon]; });
    applyI18n();

    this.home = $('#screen-home'); this.game = $('#screen-game');
    this.modalRoot = $('#modal-root'); this.toastEl = $('#toast');

    document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { sfx.tap(); this.showTab(b.dataset.tab); }));
    document.querySelectorAll('[data-soon]').forEach((b) => b.addEventListener('click', () => { sfx.tap(); this.toast(t('comingSoon')); }));
    $('#meta-shortcut').addEventListener('click', () => { sfx.tap(); this.showTab('meta'); });
    $('#home-settings').addEventListener('click', () => { sfx.tap(); this.showSettings(false); });
    $('#btn-settings').addEventListener('click', () => { sfx.tap(); this.showSettings(true); });
    $('#btn-replay').addEventListener('click', () => { sfx.tap(); this.h.onReplay(); });
    $('#btn-skip').addEventListener('click', () => { sfx.tap(); this.h.onSkipTutorial(); });
    window.addEventListener('resize', () => { if (!this.home.hidden) this.renderMap(false); });
  }

  // ---------- screens ----------
  showHome() {
    this.game.hidden = true; this.home.hidden = false;
    this.selected = null;
    this.showTab('home');
    this.renderMap(true);
  }
  showGame() { this.home.hidden = true; this.game.hidden = false; }

  showTab(name) {
    for (const n of ['home', 'shop', 'meta']) $('#tab-' + n).hidden = n !== name;
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    if (name === 'home') this.renderMap(true);
  }

  /** The level the player should play next. */
  currentLevel() { return Math.min(save.unlocked, this.levels.length); }

  renderMap(scrollToSelected) {
    const n = this.levels.length;
    const stars = totalStars();
    $('#world-stars').textContent = `${stars}/${n * 3}`;
    $('#home-pips').textContent = save.pips;
    if (!this.selected || this.selected > save.unlocked) this.selected = this.currentLevel();

    const scroll = $('#map-scroll'), map = $('#map');
    const width = Math.min(scroll.clientWidth || 360, 460);
    const step = 108, padTop = 80, padBottom = 80;
    const height = padTop + padBottom + (n - 1) * step;
    map.style.width = width + 'px'; map.style.height = height + 'px';
    const pos = (i) => ({ x: width / 2 + Math.sin(i * 0.9) * width * 0.24 - 22, y: height - padBottom - i * step });
    const pts = this.levels.map((_, i) => pos(i));
    const line = (upTo) => pts.slice(0, upTo).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const current = this.currentLevel();
    let html = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <polyline points="${line(n)}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1.5" stroke-dasharray="3 7"/>
      <polyline points="${line(current)}" fill="none" stroke="#2fc4dd" stroke-width="2"/></svg>`;
    this.levels.forEach((lv, i) => {
      const id = lv.id, p = pts[i];
      const got = save.stars[id] || 0;
      const locked = id > save.unlocked;
      const cls = [locked ? 'locked' : got ? 'done' : 'current', id === this.selected ? 'selected' : ''].join(' ');
      const starRow = got ? `<span class="stars">${[1, 2, 3].map((s) => `<i class="${got >= s ? 'on' : ''}"></i>`).join('')}</span>` : '';
      html += `<button class="node ${cls}" data-level="${id}" style="left:${p.x}px;top:${p.y}px" aria-label="${t('level', { n: id })}">
        <span class="gem"></span><span class="num">${locked ? icon('lock') : id}</span>${starRow}</button>`;
    });
    map.innerHTML = html;
    map.querySelectorAll('.node').forEach((b) => b.addEventListener('click', () => {
      const id = +b.dataset.level;
      if (id > save.unlocked) { sfx.buzz(); this.toast(t('locked')); return; }
      sfx.tap();
      if (id === this.selected) { this.h.onPlay(id); return; }
      this.selected = id;
      map.querySelectorAll('.node').forEach((nd) => nd.classList.toggle('selected', +nd.dataset.level === id));
      this.renderLevelCard();
    }));
    this.renderLevelCard();
    if (scrollToSelected) scroll.scrollTop = pts[this.selected - 1].y - scroll.clientHeight * 0.5;
  }

  /** Summary of the selected level with the Play button. */
  renderLevelCard() {
    const lv = this.levels.find((l) => l.id === this.selected);
    const got = save.stars[lv.id] || 0;
    const card = $('#level-card');
    card.innerHTML = `
      <div class="card-info"><h2>${t('level', { n: lv.id })}</h2>
        <span class="card-stars">${[1, 2, 3].map((s) => icon('star', got >= s ? 'on' : '')).join('')}</span></div>
      <button class="play-btn">${icon('play', 'solid')}${t(got ? 'replay' : 'play')}</button>`;
    $('.play-btn', card).addEventListener('click', () => { sfx.tap(); this.h.onPlay(lv.id); });
  }

  // ---------- HUD ----------
  setLevelHud(level) {
    $('#hud-level').textContent = t('level', { n: level.id });
    $('#point-chips').innerHTML = level.points.map((p) => `<span class="chip" data-p="${p.index}">${p.n}</span>`).join('');
    $('#stat-points').hidden = !level.points.length;
  }

  updateHud({ movesLeft, mask, top }) {
    const mv = $('#moves-left');
    if (mv.textContent !== String(movesLeft)) {
      mv.textContent = movesLeft;
      this._pop($('#stat-moves'));
    }
    $('#stat-moves').classList.toggle('low', movesLeft <= 2);
    document.querySelectorAll('#point-chips .chip').forEach((c) => {
      const done = !!(mask & (1 << +c.dataset.p));
      c.classList.toggle('done', done);
    });
    this.setTopFace(top);
  }

  setTopFace(n) {
    const el = $('#top-face');
    if (el.dataset.n === String(n)) return;
    el.dataset.n = n;
    el.innerHTML = Array.from({ length: 9 }, (_, i) => `<i class="${FACE_CELLS[n].includes(i) ? 'on' : ''}"></i>`).join('');
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  _pop(el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

  setHint(text, tutorial) {
    $('#hint-text').textContent = text || '';
    $('#hint-area').classList.toggle('tutorial', !!tutorial && !!text);
    $('#btn-skip').hidden = !tutorial;
  }

  /** Pixel space taken by the HUD at the top and the hint area at the bottom. */
  insets() {
    const top = $('#hud').getBoundingClientRect().bottom;
    const bottom = $('#hint-area').getBoundingClientRect().height;
    return { top: top + 4, bottom: Math.max(48, bottom) };
  }

  // ---------- pop-ups ----------
  openModal(html) {
    this.modalOpen = true;
    this.modalRoot.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    this.modalRoot.hidden = false;
    return this.modalRoot.firstElementChild;
  }
  closeModal() { this.modalOpen = false; this.modalRoot.hidden = true; this.modalRoot.innerHTML = ''; }

  showComplete({ score, stars, moves, best, reward, isLast }, on) {
    const m = this.openModal(`
      <h2>${t('complete')}</h2>
      <div class="big-stars">${[1, 2, 3].map((s) => `<span class="ico ${stars >= s ? 'on' : ''}" style="animation-delay:${0.15 + s * 0.22}s">${ICONS.star}</span>`).join('')}</div>
      <div class="score-big">${score}<small>%</small></div>
      <dl class="facts">${fact(t('statMoves'), moves)}${fact(t('statBest'), best)}${fact('Pips', '+' + reward)}</dl>
      <div class="actions">
        ${cbtn('replay', 'replay', t('replay'))}
        ${isLast ? cbtn('map', 'home', t('tabHome'), { primary: true }) : cbtn('next', 'next', t('next'), { primary: true })}
        ${isLast ? '' : cbtn('map', 'home', t('tabHome'))}
      </div>`);
    for (let s = 0; s < stars; s++) setTimeout(() => sfx.star(s), 150 + (s + 1) * 220);
    if (reward) setTimeout(() => sfx.coin(), 1100);
    this._actions(m, on);
  }

  showFail({ canBuy, canAd, solved, total }, on) {
    const afford = save.pips >= BUY_MOVES_PRICE;
    const note = !canBuy ? t('alreadyBought') : !afford ? t('notEnough') : '';
    const m = this.openModal(`
      <h2>${t('failed')}</h2>
      <dl class="facts">${fact(t('points'), `${solved}/${total}`)}${fact('Pips', save.pips)}</dl>
      ${note ? `<span class="note">${note}</span>` : ''}
      <div class="actions">
        ${cbtn('buy', 'plus', t('buyMoves'), { disabled: !(canBuy && afford), sub: `${icon('pip')}${BUY_MOVES_PRICE}` })}
        ${cbtn('ad', 'video', t('buyMoves'), { disabled: !canAd, sub: t('adShort') })}
        ${cbtn('replay', 'replay', t('replay'))}
        ${cbtn('map', 'home', t('tabHome'))}
      </div>`);
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

  showSettings(inGame) {
    const s = save.settings;
    const row = (key) => `<div class="setting-row"><span>${t(key)}</span><button class="switch ${s[key] ? 'on' : ''}" data-toggle="${key}" role="switch" aria-checked="${s[key]}" aria-label="${t(key)}"></button></div>`;
    const m = this.openModal(`
      <h2>${t('settings')}</h2>
      <div class="settings">
        ${row('sound')}${row('music')}${row('vibration')}
        <div class="setting-row"><span>${t('language')}</span><div class="seg">${LANGS.map(([c, name]) => `<button data-lang="${c}" class="${s.lang === c ? 'on' : ''}">${name}</button>`).join('')}</div></div>
        <p class="controls-hint"><b>${t('controls')}</b>${t('controlsHint')}</p>
      </div>
      <div class="actions">
        ${cbtn('close', 'close', t('close'))}
        ${inGame ? cbtn('map', 'exit', t('tabHome')) : cbtn('reset', 'replay', t('reset'))}
      </div>`);
    m.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.toggle;
      s[k] = !s[k]; persist();
      b.classList.toggle('on', s[k]); b.setAttribute('aria-checked', s[k]);
      if (k === 'music') syncMusic();
      sfx.tap();
    }));
    m.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
      s.lang = b.dataset.lang; persist();
      applyI18n(); this.h.onSettingsChanged();
      this.showSettings(inGame);
    }));
    this._actions(m, {
      close: () => {},
      map: () => this.h.onBackToMap(),
      reset: () => { if (confirm(t('resetConfirm'))) { resetProgress(); this.selected = null; this.renderMap(true); } },
    });
  }

  _actions(modal, on) {
    modal.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
      sfx.tap();
      this.closeModal();
      on[b.dataset.a]?.();
    }));
  }

  toast(text) {
    const el = this.toastEl;
    el.textContent = text; el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
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
