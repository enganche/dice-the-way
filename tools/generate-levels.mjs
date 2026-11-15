// Offline level generator + validator (GDD 6.2, 7, 12).
// Usage: node tools/generate-levels.mjs   (BUDGET_MS=4000 per level by default)
// Writes src/data/levels.json. Every level is solved by the BFS solver, which
// provides the best-case move count and a sample solution.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLevel, slide, initialState } from '../src/core/rules.js';
import { analyse, solve } from '../src/core/solver.js';
import { allOrientations, orientationId, DIR_KEYS } from '../src/core/dice.js';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/levels.json');
const BUDGET_MS = +(process.env.BUDGET_MS || 4000);
const ORIENTS = allOrientations();

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

function moveLimit(best, tight) {
  // GDD 6.4: best case + buffer (about half of best, minimum 3). Tighter late game.
  return tight ? Math.max(Math.ceil(best * 1.3), best + 2) : Math.max(Math.ceil(best * 1.5), best + 3);
}

// ---------- hand-made tutorial layouts ('?' = point, number chosen by solver) ----------
const TUTORIALS = [
  { grid: ['.....', '.ooE.', '.o...', '.o...', '.S...'], target: 2 },
  { grid: ['.....', 'So?oo', '....o', '....o', '....E'], target: 3 },
  { grid: ['.oooo', '.o..o', '.Soo?', '....o', '....E'], target: 4 },
];

function fillNumbers(grid, nums) {
  let i = 0;
  return grid.map((row) => row.replace(/\?/g, () => String(nums[i++])));
}

function buildTutorial(t, id) {
  const k = t.grid.join('').split('?').length - 1;
  const total = 6 ** k;
  for (let a = 0; a < total; a++) {
    const nums = []; let v = a;
    for (let i = 0; i < k; i++) { nums.push(1 + (v % 6)); v = Math.floor(v / 6); }
    const def = { id, world: 1, grid: fillNumbers(t.grid, nums), dice: [1, 2, 3] };
    const res = analyse(parseLevel(def));
    if (res && res.best === t.target && res.dead === 0) {
      return { ...def, best: res.best, limit: moveLimit(res.best, false), solution: res.solution, tutorial: true };
    }
  }
  throw new Error('tutorial ' + id + ' has no valid numbering');
}

// ---------- procedural layouts ----------
function carve(rng, W, H, segments, maxLen) {
  const g = new Uint8Array(W * H);
  const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y * W + x] === 1;
  const makesBlock = (x, y) => {
    for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
      let full = true;
      for (const [px, py] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const cx = x + ox + px, cy = y + oy + py;
        if (!(cx === x && cy === y) && !at(cx, cy)) { full = false; break; }
      }
      if (full) return true;
    }
    return false;
  };
  let x = randInt(rng, 0, W - 1), y = randInt(rng, 0, H - 1);
  g[y * W + x] = 1;
  const cells = [[x, y]];
  let lastDir = -1;
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let s = 0; s < segments; s++) {
    if (rng() < 0.3) { [x, y] = pick(rng, cells); lastDir = -1; }
    let d = randInt(rng, 0, 3);
    if (d === lastDir || d === (lastDir ^ 1)) d = (d + 2) % 4; // prefer turning
    const len = randInt(rng, 2, maxLen);
    for (let i = 0; i < len; i++) {
      const nx = x + D[d][0], ny = y + D[d][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) break;
      if (!at(nx, ny)) {
        if (makesBlock(nx, ny)) break;
        g[ny * W + nx] = 1; cells.push([nx, ny]);
      }
      x = nx; y = ny;
    }
    lastDir = d;
  }
  return { g, cells };
}

// Top faces the dice can show when it stops on each point (numbers ignored).
function arrivalTops(level) {
  const tops = level.points.map(() => new Set());
  const key = (s) => ((s.y * level.w + s.x) * 36 + orientationId(s.o)) * (level.fullMask + 1) + s.mask;
  const start = initialState(level);
  const seen = new Set([key(start)]);
  const queue = [start];
  for (let i = 0; i < queue.length && i < 20000; i++) {
    for (const d of DIR_KEYS) {
      const r = slide(level, queue[i], d, { ignoreNumbers: true });
      if (!r.moved) continue;
      if (r.stop === 'point') tops[r.pointIndex].add(r.state.o[0]);
      const k = key(r.state);
      if (!seen.has(k)) { seen.add(k); queue.push(r.state); }
    }
  }
  return tops.map((t) => [...t]);
}

function candidate(rng, spec) {
  const { W, H } = spec;
  const { g, cells } = carve(rng, W, H, spec.segments, Math.max(3, Math.min(W, H) - 1));
  if (cells.length < spec.points + 4) return null;
  // Choose distinct special cells.
  const pool = cells.slice();
  const take = () => pool.splice(Math.floor(rng() * pool.length), 1)[0];
  const S = take(), E = take();
  if (Math.abs(S[0] - E[0]) + Math.abs(S[1] - E[1]) < 2) return null;
  const pts = []; for (let i = 0; i < spec.points; i++) pts.push(take());
  const obs = []; const nObs = spec.obstacles ? randInt(rng, spec.obstacles, spec.obstacles + 2) : 0;
  for (let i = 0; i < nObs && pool.length; i++) obs.push(take());

  const base = [];
  for (let y = 0; y < H; y++) { const row = []; for (let x = 0; x < W; x++) row.push(g[y * W + x] ? 'o' : '.'); base.push(row); }
  base[S[1]][S[0]] = 'S'; base[E[1]][E[0]] = 'E';
  for (const [x, y] of obs) base[y][x] = '#';
  const dice = pick(rng, ORIENTS);

  let bestCand = null;
  const probeRows = base.map((r) => r.slice());
  for (const [x, y] of pts) probeRows[y][x] = '1';
  const tops = arrivalTops(parseLevel({ id: 0, grid: probeRows.map((r) => r.join('')), dice }));
  if (tops.some((t) => t.length === 0)) return null;
  const combos = tops.reduce((a, t) => a * t.length, 1);
  const tries = Math.min(combos, 12);
  for (let t = 0; t < tries; t++) {
    const rows = base.map((r) => r.slice());
    pts.forEach(([x, y], i) => { rows[y][x] = String(pick(rng, tops[i])); });
    const def = { id: spec.id, world: 1, grid: rows.map((r) => r.join('')), dice };
    const level = parseLevel(def);
    const res = analyse(level);
    if (!res || res.best < spec.lo || res.best > spec.hi) continue;
    const deadFrac = res.dead / res.states;
    if (deadFrac > spec.maxDead) continue;
    const relaxed = solve(level, null, { ignoreNumbers: true });
    const extra = relaxed ? res.best - relaxed.best : 2;
    if (extra < spec.minExtra) continue;

    // Trim road cells no reachable state ever enters; keep only obstacles that block a used road.
    const vis = (x, y) => x >= 0 && y >= 0 && x < W && y < H && res.visited.has(y * W + x);
    let blockers = 0;
    const out = rows.map((r) => r.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = out[y][x];
      if (c === '#') {
        const through = (vis(x - 1, y) && vis(x + 1, y)) || (vis(x, y - 1) && vis(x, y + 1));
        if (through) blockers++; else out[y][x] = '.';
      } else if (c !== '.' && !vis(x, y)) out[y][x] = '.';
    }
    if (blockers < Math.min(1, spec.obstacles)) continue;

    // Crop to bounding box.
    let x0 = W, x1 = -1, y0 = H, y1 = -1, roadCells = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (out[y][x] !== '.') {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); roadCells++;
    }
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    if (cw < spec.minSize || ch < spec.minSize) continue;
    const grid = out.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join(''));

    const finalDef = { id: spec.id, world: 1, grid, dice };
    const check = analyse(parseLevel(finalDef));
    if (!check || check.best !== res.best || check.dead !== res.dead) continue;

    const score = 4 * Math.min(extra, 3) - 3 * Math.abs(res.best - spec.target)
      + Math.min(check.states, 400) / 80 + Math.min(blockers, 3) * 0.7 - deadFrac * 12
      - Math.max(0, roadCells - spec.maxCells) * 0.6 + rng() * 0.5;
    if (!bestCand || score > bestCand.score) {
      bestCand = {
        score, extra, states: check.states, blockers, dead: check.dead,
        def: { ...finalDef, best: check.best, limit: moveLimit(check.best, spec.tight), solution: check.solution },
      };
    }
  }
  return bestCand;
}

function specFor(i) {
  const t = (i - 4) / 26;
  const size = i <= 7 ? 5 : i <= 12 ? 6 : i <= 19 ? 7 : i <= 25 ? 8 : 9;
  const points = i <= 6 ? 1 : i <= 10 ? 2 : i <= 15 ? 3 : i <= 21 ? 4 : i <= 26 ? 5 : 6;
  const target = Math.round(3 + t * 11);
  const obstacles = i < 8 || i % 3 === 0 ? 0 : i < 16 ? 1 : 2;
  return {
    id: i, W: size, H: size, points, target, lo: target - 1, hi: target + 1,
    obstacles, segments: 3 + size + points, minSize: Math.min(size, 4 + Math.floor(t * 3)),
    maxCells: 10 + points * 4 + size, minExtra: i <= 4 ? 0 : 1, tight: i > 20, maxDead: i <= 12 ? 0 : 0.2,
  };
}

const levels = TUTORIALS.map((t, i) => buildTutorial(t, i + 1));
for (let i = 4; i <= 30; i++) {
  const spec = specFor(i);
  const rng = mulberry32(1000 + i * 7919);
  const t0 = Date.now();
  let best = null, n = 0;
  while (Date.now() - t0 < BUDGET_MS || (!best && Date.now() - t0 < BUDGET_MS * 6)) {
    n++;
    const c = candidate(rng, spec);
    if (c && (!best || c.score > best.score)) best = c;
  }
  if (!best) throw new Error(`level ${i}: no candidate found (${n} layouts)`);
  levels.push(best.def);
  console.log(`L${i} ${best.def.grid[0].length}x${best.def.grid.length} pts=${spec.points} best=${best.def.best} limit=${best.def.limit} extra=${best.extra} states=${best.states} obs=${best.blockers} dead=${best.dead} tried=${n}`);
  console.log(best.def.grid.map((r) => '   ' + r).join('\n'), '  ', best.def.solution);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(levels, null, 1).replace(/\[\s+(\d),\s+(\d),\s+(\d)\s+\]/g, '[$1, $2, $3]') + '\n');
console.log(`wrote ${levels.length} levels -> ${OUT}`);
