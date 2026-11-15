// Level controller: applies the rules, drives the view, HUD, audio and pop-ups.

import { parseLevel, slide, initialState, scorePercent, starsFor } from '../core/rules.js';
import { hintMove } from '../core/solver.js';
import { save, persist, rewardFor, BUY_MOVES_PRICE, EXTRA_MOVES } from '../save.js';
import { sfx, vibrate } from '../audio.js';
import { track } from '../analytics.js';
import { t } from '../i18n.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Game {
  constructor(view, ui, levels, nav) {
    this.view = view; this.ui = ui; this.levels = levels; this.nav = nav; // nav: { toMap() }
    this.active = false; this.busy = false; this.queued = null; this.runId = 0;
    this.level = null;
  }

  get movesLeft() { return this.level.limit + this.extraMoves - this.movesUsed; }
  get tutorial() { return !!this.level.def.tutorial && !save.tutorialSkipped; }

  start(id) {
    const def = this.levels.find((l) => l.id === id);
    this.level = parseLevel(def);
    this.runId++;
    this.state = initialState(this.level);
    this.movesUsed = 0; this.extraMoves = 0; this.boughtMoves = false;
    this.busy = false; this.queued = null; this.active = true;
    this.ui.closeModal();
    this.ui.showGame();
    this.ui.setLevelHud(this.level);
    this.refreshHud();
    this.refreshHint();
    this.view.setInsets(...Object.values(this.ui.insets()));
    this.view.loadLevel(this.level);
    this.view.setEndReady(this.level.points.length === 0);
    this.view.start();
    this.updateHintArrow();
    track('level_start', { level: id });
  }

  restart() { if (this.level) this.start(this.level.id); }

  refreshHud(mask = this.state.mask, top = this.state.o[0]) {
    this.ui.updateHud({
      movesLeft: this.movesLeft, movesTotal: this.level.limit + this.extraMoves,
      mask, total: this.level.points.length, top,
    });
    if (!this.tutorial) this.ui.setHint(t('used', { u: this.movesUsed, b: this.level.best }), false);
  }

  refreshHint(key) {
    if (this.tutorial) this.ui.setHint(t(key || 'tut' + this.level.id), true);
    else this.ui.setHint(t('used', { u: this.movesUsed, b: this.level.best }), false);
    this.view.setInsets(...Object.values(this.ui.insets()));
  }

  updateHintArrow() {
    this.view.showHint(this.tutorial && this.active ? hintMove(this.level, this.state) : null);
  }

  skipTutorial() {
    save.tutorialSkipped = true; persist();
    this.refreshHint(); this.updateHintArrow();
  }

  /** One direction input (GDD 3). Buffers at most one input while animating. */
  async input(dir) {
    if (!this.active) return;
    if (this.busy) { this.queued = dir; return; }
    this.busy = true;
    const run = this.runId;
    const res = slide(this.level, this.state, dir);

    if (!res.moved) {
      sfx.buzz(); vibrate(15);
      await this.view.bump(dir);
    } else {
      this.movesUsed++;
      this.state = res.state;
      this.view.showHint(null);
      this.refreshHud(this.state.mask & ~(res.solved ? 1 << res.pointIndex : 0), res.steps[0].o[0]);
      track('move_made', { level: this.level.id, dir, cells: res.steps.length });
      await this.view.rollSteps(res.steps, dir, (st, i) => {
        if (run !== this.runId) return;
        sfx.clack(i); this.ui.setTopFace(st.o[0]);
      });
      if (run !== this.runId) return;
      sfx.land(); vibrate(10);
      this.view.land();

      if (res.stop === 'point') {
        if (res.solved) {
          sfx.chime(); vibrate([10, 40, 20]);
          this.view.pointSolved(res.pointIndex);
          if (this.tutorial && this.level.id >= 2) this.refreshHint('tutMatch');
        } else {
          sfx.wrong(); vibrate(40);
          this.view.pointMismatch(res.pointIndex);
          if (this.tutorial) this.refreshHint('tutMiss');
        }
      } else if (res.stop === 'end' && !res.complete) {
        this.view.endNotReady();
        this.ui.toast(t('needAll'));
      }
      this.refreshHud();
      this.view.setEndReady(this.state.mask === this.level.fullMask);

      if (res.complete) { this.finish(); return; }
      if (this.movesLeft <= 0) { await wait(350); if (run === this.runId) this.fail(); return; }
      await wait(60);
      if (run !== this.runId) return;
      this.updateHintArrow();
    }

    if (run !== this.runId) return;
    this.busy = false;
    const next = this.queued; this.queued = null;
    if (next && this.active && !this.ui.modalOpen) this.input(next);
  }

  async finish() {
    const run = this.runId, lv = this.level;
    this.active = false; this.queued = null;
    const score = scorePercent(lv.best, this.movesUsed);
    const stars = starsFor(score);
    const reward = rewardFor(lv.id, stars);
    save.stars[lv.id] = Math.max(save.stars[lv.id] || 0, stars);
    save.bestMoves[lv.id] = Math.min(save.bestMoves[lv.id] || Infinity, this.movesUsed);
    save.pips += reward;
    save.unlocked = Math.max(save.unlocked, Math.min(lv.id + 1, this.levels.length));
    persist();
    track('level_complete', { level: lv.id, score, stars, moves: this.movesUsed });

    sfx.win(); vibrate([20, 60, 20, 60, 40]);
    this.ui.confetti();
    await this.view.celebrate();
    await wait(250);
    if (run !== this.runId) return;
    const isLast = lv.id === this.levels.length;
    this.ui.showComplete({ score, stars, moves: this.movesUsed, best: lv.best, reward, isLast }, {
      next: () => this.start(lv.id + 1),
      replay: () => this.start(lv.id),
      map: () => { if (isLast) this.ui.toast(t('allDone')); this.nav.toMap(); },
    });
  }

  fail() {
    this.queued = null;
    sfx.fail();
    track('level_fail', { level: this.level.id, solved: this.state.mask });
    const resume = () => { this.extraMoves += EXTRA_MOVES; this.busy = false; this.refreshHud(); this.updateHintArrow(); };
    const solved = this.level.points.filter((p) => this.state.mask & (1 << p.index)).length;
    this.ui.showFail({ canBuy: !this.boughtMoves, canAd: true, solved, total: this.level.points.length }, {
      buy: () => {
        save.pips -= BUY_MOVES_PRICE; persist();
        this.boughtMoves = true;
        sfx.coin(); track('moves_bought', { level: this.level.id });
        resume();
      },
      ad: () => this.ui.showAd(() => { track('ad_rewarded_watched', { level: this.level.id }); sfx.coin(); resume(); }),
      replay: () => this.restart(),
      map: () => this.nav.toMap(),
    });
  }

  stop() { this.active = false; this.runId++; this.view.stop(); }
}
