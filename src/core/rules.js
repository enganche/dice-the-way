// Board rules (GDD sections 2, 5, 6). Pure logic, shared by the game,
// the solver and the level generator.
//
// Level definition (JSON):
//   { id, world, grid: ["..o1.", ...], dice: [top, front, right], best, limit, solution }
// Grid characters:
//   '.' empty   'o' road   '#' obstacle   'S' start   'E' end   '1'-'6' point
//   'x' stop pad      — the dice always stops on it
//   '^' 'v' '<' '>'   — arrow: the dice turns to the arrow's direction and keeps rolling
//   'T' / 'U'         — portal pair (each letter appears 0 or 2 times): the dice is
//                       sent to the twin portal and keeps rolling in the same direction
//   'c' crumble       — can be crossed once; it falls away when the dice leaves it
//   'a'-'f' face lock — the dice can roll onto it only if the top face would be 1-6

import { DIRS, DIR_KEYS, roll, orientationId } from './dice.js';

export const CELL = {
  EMPTY: 0, ROAD: 1, OBSTACLE: 2, START: 3, END: 4, POINT: 5,
  STOP: 6, ARROW: 7, PORTAL: 8, CRUMBLE: 9, GATE: 10,
};

const ARROW_CHARS = { '^': 'U', v: 'D', '<': 'L', '>': 'R' };
export const ARROW_CHAR = { U: '^', D: 'v', L: '<', R: '>' };

/** Mechanics a level uses, in teaching order. */
export const MECHANICS = ['stop', 'arrow', 'portal', 'crumble', 'gate'];

export function parseLevel(def) {
  const h = def.grid.length;
  const w = def.grid[0].length;
  const n = w * h;
  const cells = new Uint8Array(n);
  const pointAt = new Int8Array(n).fill(-1);
  const arrowAt = new Int8Array(n).fill(-1);   // index into DIR_KEYS
  const portalTo = new Int16Array(n).fill(-1);
  const crumbleAt = new Int8Array(n).fill(-1); // bit index
  const gateAt = new Int8Array(n).fill(0);     // required top face
  const points = [], crumbles = [], portals = { T: [], U: [] };
  const uses = new Set();
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
      } else if (c === 'x') { cells[i] = CELL.STOP; uses.add('stop'); }
      else if (ARROW_CHARS[c]) { cells[i] = CELL.ARROW; arrowAt[i] = DIR_KEYS.indexOf(ARROW_CHARS[c]); uses.add('arrow'); }
      else if (c === 'T' || c === 'U') { cells[i] = CELL.PORTAL; portals[c].push(i); uses.add('portal'); }
      else if (c === 'c') { cells[i] = CELL.CRUMBLE; crumbleAt[i] = crumbles.length; crumbles.push({ x, y, index: crumbles.length }); uses.add('crumble'); }
      else if (c >= 'a' && c <= 'f') { cells[i] = CELL.GATE; gateAt[i] = c.charCodeAt(0) - 96; uses.add('gate'); }
      else cells[i] = CELL.EMPTY;
    }
  }
  if (!start || !end) throw new Error(`level ${def.id}: needs a start and an end`);
  for (const k of ['T', 'U']) {
    const p = portals[k];
    if (p.length === 0) continue;
    if (p.length !== 2) throw new Error(`level ${def.id}: portal ${k} needs exactly two cells`);
    portalTo[p[0]] = p[1]; portalTo[p[1]] = p[0];
  }
  if (crumbles.length > 8) throw new Error(`level ${def.id}: too many crumble tiles`);
  return {
    def, id: def.id, w, h, cells, pointAt, arrowAt, portalTo, crumbleAt, gateAt,
    points, crumbles, start, end, uses: MECHANICS.filter((m) => uses.has(m)),
    dice: def.dice.slice(),
    best: def.best, limit: def.limit,
    fullMask: (1 << points.length) - 1,
  };
}

export function cellAt(level, x, y) {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return CELL.EMPTY;
  return level.cells[y * level.w + x];
}

/** Can the dice roll onto (x, y) arriving with orientation `o`? */
export function canEnter(level, x, y, o, gone, opts) {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return false;
  const i = y * level.w + x;
  const c = level.cells[i];
  if (c === CELL.EMPTY || c === CELL.OBSTACLE) return false;
  if (c === CELL.CRUMBLE && (gone & (1 << level.crumbleAt[i]))) return false;
  if (c === CELL.GATE && o[0] !== level.gateAt[i] && !(opts && opts.openGates)) return false;
  return true;
}

export function initialState(level) {
  return { x: level.start.x, y: level.start.y, o: level.dice.slice(), mask: 0, gone: 0 };
}

/** Unique numeric key for a state (cell, orientation, solved points, fallen tiles). */
export function stateKey(level, s) {
  return (((s.y * level.w + s.x) * 36 + orientationId(s.o)) * (level.fullMask + 1) + s.mask) * (1 << level.crumbles.length) + (s.gone || 0);
}

/**
 * Apply one direction input. The dice rolls until it enters an unsolved point,
 * the end tile, a stop pad, or the next cell cannot be entered.
 * Arrows turn it, portals move it to their twin, crumble tiles fall behind it.
 * Returns { moved, steps[], state, stop, pointIndex, solved, complete }.
 * Each step is { x, y, o, dir, teleport?, crumble? (index of the tile that fell
 * as the dice left it), redirect? }.
 * `opts.ignoreNumbers` makes any stop on a point solve it (used for level scoring);
 * `opts.openGates` lets the dice through every face lock (used by the generator).
 */
export function slide(level, state, dir, opts) {
  const w = level.w;
  let { x, y, o, mask } = state;
  let gone = state.gone || 0;
  let d = dir;
  const steps = [];
  const seen = new Set();
  let stop = 'edge', pointIndex = -1, solved = false;
  for (;;) {
    const { dx, dy } = DIRS[d];
    const nx = x + dx, ny = y + dy;
    const no = roll(o, d);
    if (!canEnter(level, nx, ny, no, gone, opts)) break;
    const step = { x: nx, y: ny, o: no, dir: d };
    const leaving = level.crumbleAt[y * w + x];
    if (leaving >= 0 && !(gone & (1 << leaving))) { gone |= 1 << leaving; step.crumble = leaving; }
    x = nx; y = ny; o = no;
    steps.push(step);
    const i = y * w + x;
    const c = level.cells[i];
    const p = level.pointAt[i];
    if (p >= 0 && !(mask & (1 << p))) {
      stop = 'point'; pointIndex = p;
      if (o[0] === level.points[p].n || (opts && opts.ignoreNumbers)) {
        mask |= 1 << p; solved = true;
      }
      break;
    }
    if (c === CELL.END) { stop = 'end'; break; }
    if (c === CELL.STOP) { stop = 'pad'; break; }
    if (c === CELL.ARROW) {
      const nd = DIR_KEYS[level.arrowAt[i]];
      if (nd !== d) step.redirect = nd;
      d = nd;
    } else if (c === CELL.PORTAL) {
      const j = level.portalTo[i];
      x = j % w; y = (j - x) / w;
      steps.push({ x, y, o, dir: d, teleport: true });
    }
    // Arrows and portals can form a closed circuit: stop where it would repeat.
    const loopKey = (y * w + x) * 4 + DIR_KEYS.indexOf(d);
    if (c === CELL.ARROW || c === CELL.PORTAL) {
      if (seen.has(loopKey)) { stop = 'loop'; break; }
      seen.add(loopKey);
    }
    if (steps.length > 400) { stop = 'loop'; break; }
  }
  const moved = steps.length > 0;
  const complete = moved && stop === 'end' && mask === level.fullMask;
  return { moved, steps, state: { x, y, o, mask, gone }, stop, pointIndex, solved, complete };
}

/** GDD 6.2 */
export function scorePercent(best, moves) {
  return Math.min(100, Math.round((best / Math.max(1, moves)) * 100));
}
export function starsFor(score) {
  return score >= 100 ? 3 : score >= 75 ? 2 : 1;
}
