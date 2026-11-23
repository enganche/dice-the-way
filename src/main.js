import levels from './data/levels.json';
import challenges from './data/challenges.json';
import { View } from './game/view.js';
import { Game } from './game/game.js';
import { UI } from './ui.js';
import { bindInput } from './input.js';
import { unlockAudio } from './audio.js';
import { save } from './save.js';
import { ensureEvent, ensureMissions, isUnlocked } from './meta.js';

const view = new View(document.getElementById('stage'));
let game = null;

const ui = new UI(levels, challenges, {
  onPlay: (id, mode) => game.start(id, mode),
  onReplay: () => game.restart(),
  onQuit: () => game.quit(),
  onSkipTutorial: () => game.skipTutorial(),
  onUndo: () => game.undo(),
  onHint: () => game.hint(),
  tileImage: (key) => view.tileImage(key),
  onSettingsChanged: () => {
    if (!ui.home.hidden) ui.showTab(ui.tab || 'home');
    else if (game.level) { ui.setLevelHud(game.level, game.mode); game.refreshHud(); game.refreshCoach(); }
  },
});

function toMap() {
  game.stop();
  ui.closeModal();
  ui.showHome();
}

game = new Game(view, ui, levels, challenges, { toMap });

bindInput(document.getElementById('screen-game'), (dir) => game.input(dir), () => game.active && !ui.modalOpen && !ui.game.hidden);

window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('keydown', unlockAudio);
window.addEventListener('resize', () => {
  if (!ui.game.hidden) view.setInsets(...Object.values(ui.insets()));
  view.resize();
  if (!ui.game.hidden && game.active) game.refreshCoach();
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

ensureEvent();
if (isUnlocked('missions')) ensureMissions();

// First launch goes straight into the guided tutorial; afterwards, the map.
if (save.unlocked === 1 && !save.stars[1] && !save.tutorialSkipped) game.start(1);
else ui.showHome();

// Debug handle for tests and tuning.
window.__dtw = { game, view, ui, levels, challenges, save };
