// Level controller: applies the rules, drives the view, HUD, audio, boosters,
// tutorial coach and pop-ups, and reports results to the meta layer.

import { parseLevel, slide, initialState, scorePercent, starsFor } from '../core/rules.js';
import { hintMove } from '../core/solver.js';
import { save, persist, rewardFor, BUY_MOVES_PRICE, EXTRA_MOVES } from '../save.js';
import { sfx, vibrate } from '../audio.js';
import { track } from '../analytics.js';
import { t } from '../i18n.js';
import * as meta from '../meta.js';
import { TUTORIAL, DIR_GLYPH } from '../tutorial.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Game {
  constructor(view, ui, levels, challenges, nav) {
    this.view = view; this.ui = ui; this.levels = levels; this.challenges = challenges;
    this.nav = nav; // { toMap() }
    this.active = false; this.busy = false; this.queued = null; this.runId = 0;
    this.level = null; this.mode = 'level';
  }

  get movesLeft() { return this.level.limit + this.extraMoves - this.movesUsed; }
  get tutorial() { return !!this.level.def.tutorial && !save.tutorialSkipped && this.mode === 'level'; }
  get script() { return this.tutorial ? TUTORIAL[this.level.id] : null; }

  /** Start a campaign level (id) or today's daily challenge (mode 'challenge'). */
  async start(id, mode = 'level') {
    const def = mode === 'challenge' ? this.challenges.find((l) => l.id === id) : this.levels.find((l) => l.id === id);
    this.mode = mode;
    this.level = parseLevel(def);
    this.runId++;
    const run = this.runId;
    this.state = initialState(this.level);
    this.history = [];
    this.movesUsed = 0; this.boughtMoves = false; this.usedBoosters = false;
    this.bonusMoves = mode === 'level' ? meta.streakBonus() : 0;
    this.extraMoves = this.bonusMoves;
    this.freeHint = !!def.intro && !save.seen['hint_' + def.intro];
    this.busy = false; this.queued = null; this.active = false;
    this.ui.closeModal();
    this.ui.showGame(mode, this.level);
    this.view.setSkin(meta.equippedSkin());
    this.ui.setLevelHud(this.level, mode);
    this.refreshHud();
    this.view.setInsets(...Object.values(this.ui.insets()));
    this.view.loadLevel(this.level);
    this.view.setEndReady(this.level.points.length === 0);
    this.view.start();
    track('level_start', { level: id, mode });

    // Intro cards: a new tile type, or a booster unlocking.
    const cards = [];
    if (def.intro && !save.seen[def.intro]) cards.push(def.intro);
    if (mode === 'level' && id === meta.UNLOCK.undo + 1 && !save.seen.undo) cards.push('undo');
    if (mode === 'level' && id === meta.UNLOCK.hint + 1 && !save.seen.hint) cards.push('hint');
    for (const c of cards) {
      await this.ui.showIntro(c, this.view.tileImage(introTile(c, this.level)));
      if (run !== this.runId) return;
      save.seen[c] = true; persist();
    }
    if (this.bonusMoves) this.ui.toast(t('streakBonus', { n: this.bonusMoves }), 'flame');
    this.active = true;
    this.refreshCoach();
  }

  restart() {
    if (!this.level) return;
    if (this.movesUsed > 0 && this.mode === 'level') meta.breakStreak();
    this.start(this.level.id, this.mode);
  }

  refreshHud(mask = this.state.mask, o = this.state.o) {
    this.ui.updateHud({
      movesLeft: this.movesLeft, mask, o, used: this.movesUsed, best: this.level.best,
      undo: save.inventory.undo, hint: save.inventory.hint, canUndo: this.history.length > 0,
    });
  }

  /** Tutorial coach text, swipe hand and the on-board arrow. */
  refreshCoach(missKey) {
    const sc = this.script;
    let dir = null;
    if (sc) {
      dir = hintMove(this.level, this.state);
      const stepIdx = Math.min(this.movesUsed, sc.steps.length - 1);
      const step = sc.steps[stepIdx];
      const key = missKey || step.text;
      this.ui.coach({
        text: t(key, { dir: DIR_GLYPH[dir] || '' }),
        dir, spot: missKey ? null : step.spot,
        at: this.view.screenPos(this.state.x, this.state.y),
        skip: true,
      });
    } else if (this.freeHint && this.movesUsed === 0) {
      dir = hintMove(this.level, this.state);
      this.ui.coach({ text: t('introTry', { dir: DIR_GLYPH[dir] || '' }), dir, at: this.view.screenPos(this.state.x, this.state.y) });
    } else {
      this.ui.coach(null);
    }
    this.view.showHint(dir);
  }

  skipTutorial() {
    save.tutorialSkipped = true; persist();
    this.refreshCoach();
  }

  /** One direction input (GDD 3). Buffers at most one input while animating. */
  async input(dir) {
    if (!this.active) return;
    if (this.busy) { this.queued = dir; return; }
    // Guided tutorial levels only accept the shown direction.
    const sc = this.script;
    if (sc && sc.forced) {
      const want = hintMove(this.level, this.state);
      if (want && dir !== want) { sfx.buzz(); this.ui.nudgeCoach(); this.view.bump(dir); return; }
    }
    this.busy = true;
    const run = this.runId;
    const res = slide(this.level, this.state, dir);

    if (!res.moved) {
      sfx.buzz(); vibrate(15);
      await this.view.bump(dir);
    } else {
      this.history.push({ state: this.state, movesUsed: this.movesUsed });
      this.movesUsed++;
      this.state = res.state;
      this.view.showHint(null);
      this.ui.coach(null);
      if (this.freeHint) { this.freeHint = false; save.seen['hint_' + this.level.def.intro] = true; persist(); }
      this.refreshHud(this.state.mask & ~(res.solved ? 1 << res.pointIndex : 0), res.steps[0].o);
      track('move_made', { level: this.level.id, dir, cells: res.steps.length });
      await this.view.rollSteps(res.steps, dir, (st, i) => {
        if (run !== this.runId) return;
        if (st.teleport) sfx.portal(); else sfx.clack(i);
        if (st.crumble !== undefined) sfx.crumble();
        if (st.redirect) sfx.whoosh();
        this.ui.setTopFace(st.o);
      });
      if (run !== this.runId) return;
      sfx.land(); vibrate(10);
      this.view.land();

      let missKey = null;
      if (res.stop === 'point') {
        if (res.solved) {
          sfx.chime(); vibrate([10, 40, 20]);
          this.view.pointSolved(res.pointIndex);
        } else {
          sfx.wrong(); vibrate(40);
          this.view.pointMismatch(res.pointIndex);
          missKey = 'tutMiss';
          if (!this.tutorial) this.ui.toast(t('mismatch', { n: this.level.points[res.pointIndex].n, top: res.state.o[0] }));
        }
      } else if (res.stop === 'end' && !res.complete) {
        this.view.endNotReady();
        this.ui.toast(t('needAll'));
      } else if (res.stop === 'pad') {
        sfx.pad();
      }
      this.refreshHud();
      this.view.setEndReady(this.state.mask === this.level.fullMask);

      if (res.complete) { this.finish(); return; }
      if (this.movesLeft <= 0) { await wait(350); if (run === this.runId) this.fail(); return; }
      await wait(60);
      if (run !== this.runId) return;
      this.refreshCoach(this.tutorial ? missKey : null);
    }

    if (run !== this.runId) return;
    this.busy = false;
    const next = this.queued; this.queued = null;
    if (next && this.active && !this.ui.modalOpen) this.input(next);
  }

  // ---------- boosters ----------
  undo() {
    if (!this.active || this.busy) return;
    if (!this.history.length) { this.ui.toast(t('nothingToUndo')); return; }
    if (!this.useBooster('undo')) return;
    const prev = this.history.pop();
    this.state = prev.state; this.movesUsed = prev.movesUsed;
    this.view.syncState(this.state);
    this.view.setEndReady(this.state.mask === this.level.fullMask);
    sfx.undo();
    this.refreshHud();
    this.refreshCoach();
    track('booster_used', { level: this.level.id, booster: 'undo' });
  }

  hint() {
    if (!this.active || this.busy) return;
    const dir = hintMove(this.level, this.state);
    if (!dir) { this.ui.toast(t('noWay')); return; }
    if (!this.useBooster('hint')) return;
    this.view.showHint(dir);
    this.ui.coach({ text: t('hintShow', { dir: DIR_GLYPH[dir] }), dir, at: this.view.screenPos(this.state.x, this.state.y) });
    sfx.chime();
    this.refreshHud();
    track('booster_used', { level: this.level.id, booster: 'hint' });
  }

  /** Spend one booster; offer to buy one with Pips when out of stock. */
  useBooster(kind) {
    if (this.tutorial) return true; // free while learning
    if (save.inventory[kind] > 0) {
      save.inventory[kind]--; this.usedBoosters = true; persist();
      return true;
    }
    const price = meta.BOOSTER_PRICE[kind];
    this.active = false;
    this.ui.showBuyBooster(kind, price, {
      buy: () => {
        if (save.pips < price) { this.ui.toast(t('notEnough')); this.active = true; return; }
        save.pips -= price; save.inventory[kind]++; persist(); sfx.coin();
        this.active = true;
        kind === 'undo' ? this.undo() : this.hint();
      },
      close: () => { this.active = true; },
    });
    return false;
  }

  // ---------- results ----------
  async finish() {
    const run = this.runId, lv = this.level;
    this.active = false; this.queued = null;
    this.ui.coach(null);
    const score = scorePercent(lv.best, this.movesUsed);
    const stars = starsFor(score);
    sfx.win(); vibrate([20, 60, 20, 60, 40]);
    this.ui.confetti();

    if (this.mode === 'challenge') {
      const reward = meta.completeChallenge();
      track('challenge_complete', { level: lv.id, moves: this.movesUsed });
      await this.view.celebrate();
      await wait(250);
      if (run !== this.runId) return;
      this.ui.showChallengeComplete({ moves: this.movesUsed, best: lv.best, stars, reward, streak: save.challenge.streak }, {
        map: () => this.nav.toMap(),
      });
      return;
    }

    const prevStars = save.stars[lv.id] || 0;
    const pips = rewardFor(lv.id, stars);
    save.stars[lv.id] = Math.max(prevStars, stars);
    save.bestMoves[lv.id] = Math.min(save.bestMoves[lv.id] || Infinity, this.movesUsed);
    save.pips += pips;
    save.unlocked = Math.max(save.unlocked, Math.min(lv.id + 1, this.levels.length));
    const firstClear = prevStars === 0;
    const extra = meta.onLevelWin({ stars, firstClear, points: lv.points.length, moves: this.movesUsed, usedBoosters: this.usedBoosters });
    persist();
    track('level_complete', { level: lv.id, score, stars, moves: this.movesUsed });

    await this.view.celebrate();
    await wait(250);
    if (run !== this.runId) return;
    const isLast = lv.id === this.levels.length;
    const nextWorld = !isLast && meta.worldOf(lv.id + 1).id !== meta.worldOf(lv.id).id;
    this.ui.showComplete({
      score, stars, moves: this.movesUsed, best: lv.best, pips, tokens: extra.tokens,
      streak: meta.isUnlocked('streak') ? extra.streak : 0, isLast, nextWorld, nextId: lv.id + 1,
    }, {
      next: () => this.start(lv.id + 1),
      replay: () => this.start(lv.id),
      map: () => { if (isLast) this.ui.toast(t('allDone')); this.nav.toMap(); },
    });
  }

  fail() {
    this.queued = null;
    this.active = false;
    this.ui.coach(null);
    sfx.fail();
    track('level_fail', { level: this.level.id, solved: this.state.mask, mode: this.mode });
    const resume = (n) => { this.extraMoves += n; this.busy = false; this.active = true; this.refreshHud(); this.refreshCoach(); };
    const giveUp = () => { if (this.mode === 'level') meta.breakStreak(); meta.onLevelFail(this.movesUsed); };
    const solved = this.level.points.filter((p) => this.state.mask & (1 << p.index)).length;
    this.ui.showFail({
      canBuy: !this.boughtMoves, canAd: true, solved, total: this.level.points.length,
      streak: this.mode === 'level' && meta.isUnlocked('streak') ? save.winStreak : 0,
    }, {
      buy: () => {
        save.pips -= BUY_MOVES_PRICE; persist();
        this.boughtMoves = true;
        sfx.coin(); track('moves_bought', { level: this.level.id });
        resume(EXTRA_MOVES);
      },
      ad: () => this.ui.showAd(() => { track('ad_rewarded_watched', { level: this.level.id }); sfx.coin(); resume(EXTRA_MOVES); }),
      replay: () => { giveUp(); this.start(this.level.id, this.mode); },
      map: () => { giveUp(); this.nav.toMap(); },
    });
  }

  /** Leaving mid-level (pause menu). */
  quit() {
    if (this.level && this.active && this.movesUsed > 0 && this.mode === 'level') meta.breakStreak();
    this.nav.toMap();
  }

  stop() { this.active = false; this.runId++; this.ui.coach(null); this.view.stop(); }
}

/** Tile art key for an intro card. */
function introTile(kind, level) {
  if (kind === 'portal') return 'portalT';
  if (kind === 'gate') { const i = level.cells.findIndex((_, k) => level.gateAt[k] > 0); return 'g' + (i >= 0 ? level.gateAt[i] : 3); }
  if (kind === 'undo' || kind === 'hint') return '';
  return kind;
}
