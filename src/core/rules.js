// Board rules (GDD sections 2, 5, 6). Pure logic, shared by the game,
// the solver and the level generator.
//
// Level definition (JSON):
//   { id, world, grid: ["..o1.", ...], dice: [top, front, right], best, limit, solution }
// Grid characters:
//   '.' empty   'o' road   '#' obstacle   'S' start   'E' end   '1'-'6' point

import { DIRS, roll } from './dice.js';

export const CELL = { EMPTY: 0, ROAD: 1, OBSTACLE: 2, START: 3, END: 4, POINT: 5 };

export function parseLevel(def) {
  const h = def.grid.length;
  const w = def.grid[0].length;
  const cells = new Uint8Array(w * h);
  const pointAt = new Int8Array(w * h).fill(-1);
  const points = [];
  let start = null, end = null;
  for (let y = 0; y < h; y++) {
    const row = def.grid[y];
    if (row.length !== w) throw new Error(`level ${def.id}: ragged grid`);
    for (let x = 0; x < w; x++) {
      const c = row[x];
      const i = y * w + x;
      if (c === 'o') cells[i] = CELL.ROAD;
      else if (c === '#') cells[i] = CELL.OBSTACLE;
      else if (c === 'S') { cells[i] = CELL.START; start = { x, y }; }
      else if (c === 'E') { cells[i] = CELL.END; end = { x, y }; }
      else if (c >= '1' && c <= '6') {
        cells[i] = CELL.POINT;
        pointAt[i] = points.length;
        points.push({ x, y, n: +c, index: points.length });
      } else cells[i] = CELL.EMPTY;
    }
  }
  if (!start || !end) throw new Error(`level ${def.id}: needs a start and an end`);
  return {
    def, id: def.id, w, h, cells, pointAt, points, start, end,
    dice: def.dice.slice(),
    best: def.best, limit: def.limit,
    fullMask: (1 << points.length) - 1,
  };
}

export function cellAt(level, x, y) {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return CELL.EMPTY;
  return level.cells[y * level.w + x];
}

export function isWalkable(level, x, y) {
  const c = cellAt(level, x, y);
  return c !== CELL.EMPTY && c !== CELL.OBSTACLE;
}

export function initialState(level) {
  return { x: level.start.x, y: level.start.y, o: level.dice.slice(), mask: 0 };
}

/**
 * Apply one direction input. The dice rolls until it enters an unsolved point,
 * the end tile, or the next cell is not walkable.
 * Returns { moved, steps[], state, stop, pointIndex, solved, complete }.
 * `opts.ignoreNumbers` makes any stop on a point solve it (used for level scoring).
 */
export function slide(level, state, dir, opts) {
  const { dx, dy } = DIRS[dir];
  let { x, y, o, mask } = state;
  const steps = [];
  let stop = 'edge', pointIndex = -1, solved = false;
  for (;;) {
    const nx = x + dx, ny = y + dy;
    if (!isWalkable(level, nx, ny)) break;
    x = nx; y = ny; o = roll(o, dir);
    steps.push({ x, y, o });
    const p = level.pointAt[y * level.w + x];
    if (p >= 0 && !(mask & (1 << p))) {
      stop = 'point'; pointIndex = p;
      if (o[0] === level.points[p].n || (opts && opts.ignoreNumbers)) {
        mask |= 1 << p; solved = true;
      }
      break;
    }
    if (level.cells[y * level.w + x] === CELL.END) { stop = 'end'; break; }
  }
  const moved = steps.length > 0;
  const complete = moved && stop === 'end' && mask === level.fullMask;
  return { moved, steps, state: { x, y, o, mask }, stop, pointIndex, solved, complete };
}

/** GDD 6.2 */
export function scorePercent(best, moves) {
  return Math.min(100, Math.round((best / Math.max(1, moves)) * 100));
}
export function starsFor(score) {
  return score >= 100 ? 3 : score >= 75 ? 2 : 1;
}
