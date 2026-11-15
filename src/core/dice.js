// Dice orientation logic (GDD section 4).
// An orientation is [top, front, right]; "front" is the face toward the player
// (grid +y / screen-down). Opposite faces sum to 7.

export const DIRS = {
  U: { dx: 0, dy: -1 },
  D: { dx: 0, dy: 1 },
  L: { dx: -1, dy: 0 },
  R: { dx: 1, dy: 0 },
};
export const DIR_KEYS = ['U', 'D', 'L', 'R'];
export const OPPOSITE = { U: 'D', D: 'U', L: 'R', R: 'L' };

export const DEFAULT_ORIENTATION = [1, 2, 3];

/** Roll one cell in a direction. Returns a new orientation. */
export function roll(o, dir) {
  const t = o[0], f = o[1], r = o[2];
  switch (dir) {
    case 'R': return [7 - r, f, t]; // left face comes up, top goes right
    case 'L': return [r, f, 7 - t];
    case 'U': return [f, 7 - t, r]; // front face comes up, top goes back
    case 'D': return [7 - f, t, r];
    default: throw new Error('bad direction ' + dir);
  }
}

/** Compact id (0..35) for an orientation; top+front fully determine it. */
export function orientationId(o) {
  return (o[0] - 1) * 6 + (o[1] - 1);
}

/** All 24 physically valid orientations (same chirality as the default). */
export function allOrientations() {
  const seen = new Map();
  const queue = [DEFAULT_ORIENTATION];
  seen.set(orientationId(DEFAULT_ORIENTATION), DEFAULT_ORIENTATION);
  while (queue.length) {
    const o = queue.shift();
    for (const d of DIR_KEYS) {
      const n = roll(o, d);
      const id = orientationId(n);
      if (!seen.has(id)) { seen.set(id, n); queue.push(n); }
    }
  }
  return [...seen.values()];
}

export function isValidOrientation(o) {
  if (!Array.isArray(o) || o.length !== 3) return false;
  return allOrientations().some((v) => v[0] === o[0] && v[1] === o[1] && v[2] === o[2]);
}
