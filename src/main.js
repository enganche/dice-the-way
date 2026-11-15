import levels from './data/levels.json';
import { View } from './game/view.js';
import { Game } from './game/game.js';
import { UI } from './ui.js';
import { bindInput } from './input.js';
import { unlockAudio } from './audio.js';

const view = new View(document.getElementById('stage'));
let game = null;

const ui = new UI(levels, {
  onPlay: (id) => game.start(id),
  onReplay: () => game.restart(),
  onBackToMap: () => toMap(),
  onSkipTutorial: () => game.skipTutorial(),
  onSettingsChanged: () => {
    if (!ui.home.hidden) ui.renderMap(false);
    else if (game.level) { ui.setLevelHud(game.level); game.refreshHud(); game.refreshHint(); }
  },
});

function toMap() {
  game.stop();
  ui.closeModal();
  ui.showHome();
}

game = new Game(view, ui, levels, { toMap });

bindInput(document.getElementById('screen-game'), (dir) => game.input(dir), () => game.active && !ui.modalOpen && !ui.game.hidden);

window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('keydown', unlockAudio);
window.addEventListener('resize', () => {
  if (!ui.game.hidden) view.setInsets(...Object.values(ui.insets()));
  view.resize();
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

ui.showHome();

// Debug handle for tests and tuning.
window.__dtw = { game, view, ui, levels };
