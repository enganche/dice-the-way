// Unified input layer (GDD 3, 12): keyboard and swipe both emit move(direction).

import { track } from './analytics.js';

const KEYS = {
  KeyW: 'U', ArrowUp: 'U', KeyS: 'D', ArrowDown: 'D',
  KeyA: 'L', ArrowLeft: 'L', KeyD: 'R', ArrowRight: 'R',
};
const SWIPE_MIN = 36;     // CSS px (already DPI-independent)
const AXIS_RATIO = 1.25;  // the swipe must be mostly along one axis

export function bindInput(surface, onMove, isEnabled) {
  window.addEventListener('keydown', (e) => {
    const dir = KEYS[e.code];
    if (!dir || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!isEnabled()) return;
    e.preventDefault();
    onMove(dir);
  });

  let start = null;
  surface.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a, input, select')) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  surface.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < SWIPE_MIN) return;
    start = null; // one swipe = one move; taps never get here
    if (!isEnabled()) return;
    if (ax > ay * AXIS_RATIO) onMove(dx > 0 ? 'R' : 'L');
    else if (ay > ax * AXIS_RATIO) onMove(dy > 0 ? 'D' : 'U');
    else track('swipe_ambiguous');
  });
  const cancel = () => { start = null; };
  surface.addEventListener('pointerup', cancel);
  surface.addEventListener('pointercancel', cancel);
}
