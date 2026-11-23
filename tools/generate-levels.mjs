// Offline level generator + validator (GDD 6.2, 7, 12).
// Usage: node tools/generate-levels.mjs   (BUDGET_MS=2500 per level by default)
// Writes src/data/levels.json (50 campaign levels in 5 worlds) and
// src/data/challenges.json (daily challenge pool). Every level is solved by the
// BFS solver, which provides the best-case move count and a sample solution.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLevel, slide, initialState, stateKey, CELL, ARROW_CHAR } from '../src/core/rules.js';
import { analyse, solve } from '../src/core/solver.js';
import { allOrientations, DIR_KEYS, DIRS } from '../src/core/dice.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/data/levels.json');
const OUT_CH = resolve(HERE, '../src/data/challenges.json');
const BUDGET_MS = +(process.env.BUDGET_MS || 2500);
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',').map(Number)) : null;
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

function moveLimit(best, mode) {
  // GDD 6.4: best case + buffer. "easy" for intros, "tight" late in a world.
  if (mode === 'challenge') return best + 2;
  if (mode === 'tight') return Math.max(Math.ceil(best * 1.3), best + 2);
  return Math.max(Math.ceil(best * 1.5), best + 3);
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
      return { ...def, best: res.best, limit: moveLimit(res.best), solution: res.solution, tutorial: true };
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

/** Top faces the dice can show when it stops on each point / enters each face lock. */
function arrivalTops(level) {
  const tops = level.points.map(() => new Set());
  const gateTops = new Map();
  const start = initialState(level);
  const seen = new Set([stateKey(level, start)]);
  const queue = [start];
  const opts = { ignoreNumbers: true, openGates: true };
  for (let i = 0; i < queue.length && i < 25000; i++) {
    for (const d of DIR_KEYS) {
      const r = slide(level, queue[i], d, opts);
      if (!r.moved) continue;
      if (r.stop === 'point') tops[r.pointIndex].add(r.state.o[0]);
      for (const st of r.steps) {
        const ci = st.y * level.w + st.x;
        if (level.cells[ci] === CELL.GATE && !st.teleport) {
          if (!gateTops.has(ci)) gateTops.set(ci, new Set());
          gateTops.get(ci).add(st.o[0]);
        }
      }
      const k = stateKey(level, r.state);
      if (!seen.has(k)) { seen.add(k); queue.push(r.state); }
    }
  }
  return { points: tops.map((t) => [...t]), gates: gateTops };
}

/** Which mechanics the given solution actually relies on. */
function mechanicsUsed(level, solution) {
  const used = new Set();
  let s = initialState(level);
  for (const d of solution) {
    const r = slide(level, s, d);
    if (r.stop === 'pad') used.add('stop');
    for (const st of r.steps) {
      if (st.redirect) used.add('arrow');
      if (st.teleport) used.add('portal');
      if (st.crumble !== undefined) used.add('crumble');
      if (!st.teleport && level.cells[st.y * level.w + st.x] === CELL.GATE) used.add('gate');
    }
    s = r.state;
  }
  return used;
}

/** Does the level get harder (or impossible) if every mechanic tile became plain road? */
function mechanicsMatter(def, best) {
  const plain = { ...def, grid: def.grid.map((r) => r.replace(/[x^v<>TUca-f]/g, 'o')) };
  const res = solve(parseLevel(plain));
  return !res || res.best !== best;
}

function neighbourRoadDirs(g, W, H, x, y) {
  return DIR_KEYS.filter((d) => {
    const nx = x + DIRS[d].dx, ny = y + DIRS[d].dy;
    return nx >= 0 && ny >= 0 && nx < W && ny < H && g[ny * W + nx] === 1;
  });
}

function candidate(rng, spec) {
  const { W, H } = spec;
  const m = spec.mech || {};
  const nMech = (m.stop || 0) + (m.arrow || 0) + (m.portal || 0) * 2 + (m.crumble || 0) + (m.gate || 0);
  const { g, cells } = carve(rng, W, H, spec.segments, Math.max(3, Math.min(W, H) - 1));
  if (cells.length < spec.points + 4 + nMech) return null;
  const pool = cells.slice();
  const take = () => pool.splice(Math.floor(rng() * pool.length), 1)[0];
  const S = take(), E = take();
  if (Math.abs(S[0] - E[0]) + Math.abs(S[1] - E[1]) < 2) return null;
  const pts = []; for (let i = 0; i < spec.points; i++) pts.push(take());

  const base = [];
  for (let y = 0; y < H; y++) { const row = []; for (let x = 0; x < W; x++) row.push(g[y * W + x] ? 'o' : '.'); base.push(row); }
  base[S[1]][S[0]] = 'S'; base[E[1]][E[0]] = 'E';
  const gates = [];
  for (let i = 0; i < (m.stop || 0); i++) { const [x, y] = take(); base[y][x] = 'x'; }
  for (let i = 0; i < (m.arrow || 0); i++) {
    const [x, y] = take();
    const dirs = neighbourRoadDirs(g, W, H, x, y);
    if (!dirs.length) return null;
    base[y][x] = ARROW_CHAR[pick(rng, dirs)];
  }
  for (let i = 0; i < (m.portal || 0); i++) {
    const a = take(), b = take();
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < 3) return null;
    const ch = i === 0 ? 'T' : 'U';
    base[a[1]][a[0]] = ch; base[b[1]][b[0]] = ch;
  }
  for (let i = 0; i < (m.crumble || 0); i++) { const [x, y] = take(); base[y][x] = 'c'; }
  for (let i = 0; i < (m.gate || 0); i++) { const [x, y] = take(); base[y][x] = 'a'; gates.push([x, y]); }
  const nObs = spec.obstacles ? randInt(rng, spec.obstacles, spec.obstacles + 2) : 0;
  for (let i = 0; i < nObs && pool.length; i++) { const [x, y] = take(); base[y][x] = '#'; }
  const dice = pick(rng, ORIENTS);

  const probeRows = base.map((r) => r.slice());
  for (const [x, y] of pts) probeRows[y][x] = '1';
  const probeLevel = parseLevel({ id: 0, grid: probeRows.map((r) => r.join('')), dice });
  const tops = arrivalTops(probeLevel);
  if (tops.points.some((t) => t.length === 0)) return null;
  const gateTops = gates.map(([x, y]) => [...(tops.gates.get(y * W + x) || [])]);
  if (gateTops.some((t) => t.length === 0)) return null;

  let bestCand = null;
  for (let t = 0; t < 12; t++) {
    const rows = base.map((r) => r.slice());
    pts.forEach(([x, y], i) => { rows[y][x] = String(pick(rng, tops.points[i])); });
    gates.forEach(([x, y], i) => { rows[y][x] = String.fromCharCode(96 + pick(rng, gateTops[i])); });
    const def = { id: spec.id, world: spec.world, grid: rows.map((r) => r.join('')), dice };
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

    const finalDef = { id: spec.id, world: spec.world, grid, dice };
    let finalLevel;
    try { finalLevel = parseLevel(finalDef); } catch { continue; } // a portal twin was trimmed
    const check = analyse(finalLevel);
    if (!check || check.best !== res.best || check.dead !== res.dead) continue;

    // Every mechanic placed must be part of the solution.
    const used = mechanicsUsed(finalLevel, check.solution);
    if (finalLevel.uses.some((u) => !used.has(u))) continue;
    if (Object.keys(m).some((k) => m[k] && !finalLevel.uses.includes(k))) continue;
    const matters = nMech ? mechanicsMatter(finalDef, check.best) : false;
    if (spec.intro && !matters) continue;

    const score = 4 * Math.min(extra, 3) - 3 * Math.abs(res.best - spec.target)
      + Math.min(check.states, 500) / 90 + Math.min(blockers, 3) * 0.7 - deadFrac * 10
      + (matters ? 4 : 0)
      - Math.max(0, roadCells - spec.maxCells) * 0.6 + rng() * 0.5;
    if (!bestCand || score > bestCand.score) {
      const out = { ...finalDef, best: check.best, limit: moveLimit(check.best, spec.mode), solution: check.solution };
      if (spec.intro) out.intro = spec.intro;
      if (spec.challenge) out.challenge = true;
      bestCand = { score, extra, states: check.states, blockers, dead: check.dead, matters, def: out };
    }
  }
  return bestCand;
}

// ---------- level plan: 5 worlds x 10 levels, one new mechanic per world ----------
// [size, points, target, obstacles, mech, extra]
const PLAN = {
  4: [5, 1, 3, 0], 5: [5, 1, 4, 0], 6: [5, 2, 5, 1], 7: [6, 2, 5, 0], 8: [6, 2, 6, 1], 9: [6, 3, 7, 1], 10: [6, 3, 8, 1],
  11: [5, 1, 4, 0, { stop: 1 }, { intro: 'stop' }], 12: [6, 2, 5, 0, { stop: 1 }], 13: [6, 2, 6, 1, { stop: 2 }], 14: [6, 2, 6, 0, { stop: 1 }],
  15: [7, 3, 7, 1, { stop: 2 }], 16: [7, 3, 7, 0, { stop: 1 }], 17: [7, 3, 8, 1, { stop: 2 }], 18: [7, 4, 8, 0, { stop: 2 }],
  19: [8, 4, 9, 1, { stop: 2 }], 20: [8, 4, 10, 2, { stop: 2 }],
  21: [5, 1, 4, 0, { arrow: 1 }, { intro: 'arrow' }], 22: [6, 2, 5, 0, { arrow: 1 }], 23: [6, 2, 6, 0, { arrow: 2 }], 24: [6, 2, 6, 1, { arrow: 2, stop: 1 }],
  25: [7, 3, 7, 0, { arrow: 2 }], 26: [7, 3, 8, 1, { arrow: 2 }], 27: [7, 3, 8, 0, { arrow: 3 }], 28: [7, 3, 9, 1, { arrow: 2, stop: 1 }],
  29: [8, 4, 9, 0, { arrow: 3 }], 30: [8, 4, 10, 1, { arrow: 3 }],
  31: [6, 1, 4, 0, { portal: 1 }, { intro: 'portal' }], 32: [6, 2, 5, 0, { portal: 1 }], 33: [6, 2, 6, 1, { portal: 1 }], 34: [7, 2, 6, 0, { portal: 1, arrow: 1 }],
  35: [7, 3, 7, 0, { portal: 1 }], 36: [7, 3, 8, 1, { portal: 1, stop: 1 }], 37: [7, 3, 8, 0, { portal: 2 }], 38: [8, 3, 9, 0, { portal: 1, arrow: 2 }],
  39: [8, 4, 9, 1, { portal: 2 }], 40: [8, 4, 10, 0, { portal: 1, arrow: 1, stop: 1 }],
  41: [5, 1, 4, 0, { crumble: 1 }, { intro: 'crumble' }], 42: [6, 2, 5, 0, { crumble: 1 }], 43: [6, 2, 6, 0, { crumble: 2 }], 44: [7, 3, 7, 1, { crumble: 2 }],
  45: [7, 3, 8, 0, { crumble: 2, arrow: 1 }],
  46: [5, 1, 4, 0, { gate: 1 }, { intro: 'gate' }], 47: [6, 2, 6, 0, { gate: 1 }], 48: [7, 3, 8, 0, { gate: 1, crumble: 1 }],
  49: [8, 3, 9, 0, { gate: 1, portal: 1 }], 50: [8, 4, 11, 0, { gate: 1, crumble: 2, arrow: 1 }],
};

function specFor(id) {
  const [size, points, target, obstacles, mech = {}, extra = {}] = PLAN[id];
  const world = Math.ceil(id / 10);
  const inWorld = (id - 1) % 10;
  const hasCrumble = !!mech.crumble;
  return {
    id, world, W: size, H: size, points, target, lo: target - 1, hi: target + 1,
    obstacles, mech, intro: extra.intro,
    segments: 3 + size + points, minSize: Math.min(size, 4 + Math.floor(inWorld / 4)),
    maxCells: 10 + points * 4 + size, minExtra: id <= 5 || extra.intro ? 0 : 1,
    mode: extra.intro || id <= 10 ? 'easy' : inWorld >= 7 ? 'tight' : 'easy',
    maxDead: id <= 8 || extra.intro ? (hasCrumble ? 0.5 : 0) : hasCrumble ? 0.6 : id <= 12 ? 0.12 : 0.25,
  };
}

// Daily challenge pool: mid-game difficulty, mixed mechanics, tight move limit.
const CH_MECH = [{ stop: 1 }, { arrow: 2 }, { portal: 1 }, { crumble: 1 }, { arrow: 1, stop: 1 }, { portal: 1, arrow: 1 }, { gate: 1 },
  { crumble: 1, arrow: 1 }, { stop: 2 }, { portal: 1, stop: 1 }, { arrow: 2 }, { gate: 1, arrow: 1 }, { crumble: 2 }, { portal: 1, crumble: 1 }];
function challengeSpec(i) {
  const mech = CH_MECH[i];
  const size = 6 + (i % 2), points = 2 + (i % 3 === 0 ? 1 : 0), target = 6 + (i % 3);
  return {
    id: 1001 + i, world: 0, W: size, H: size, points, target, lo: target - 1, hi: target + 1,
    obstacles: i % 4 === 0 ? 1 : 0, mech, segments: 3 + size + points, minSize: 4,
    maxCells: 10 + points * 4 + size, minExtra: 1, mode: 'challenge', challenge: true,
    maxDead: mech.crumble ? 0.6 : 0.3,
  };
}

/** Each step loosens the spec a little when no layout is found in time. */
function relax(spec, r) {
  if (r === 0) return spec;
  return {
    ...spec,
    lo: spec.lo - r, hi: spec.hi + r,
    obstacles: r >= 2 ? 0 : spec.obstacles,
    minExtra: r >= 2 ? 0 : spec.minExtra,
    maxDead: Math.min(0.7, spec.maxDead + 0.15 * r),
    segments: spec.segments + r,
  };
}

function generate(spec, seed) {
  const rng = mulberry32(seed);
  let best = null, n = 0, r = 0;
  for (; r < 5 && !best; r++) {
    const s = relax(spec, r);
    const t0 = Date.now();
    while (Date.now() - t0 < BUDGET_MS * (r ? 2 : 1)) {
      n++;
      const c = candidate(rng, s);
      if (c && (!best || c.score > best.score)) best = c;
    }
  }
  if (!best) throw new Error(`level ${spec.id}: no candidate found (${n} layouts)`);
  if (r > 1) console.log(`   (relaxed x${r - 1})`);
  console.log(`L${spec.id} w${spec.world} ${best.def.grid[0].length}x${best.def.grid.length} pts=${spec.points} mech=${JSON.stringify(spec.mech)} best=${best.def.best} limit=${best.def.limit} extra=${best.extra} matters=${best.matters} states=${best.states} dead=${best.dead} tried=${n}`);
  console.log(best.def.grid.map((r) => '   ' + r).join('\n'), '  ', best.def.solution);
  return best.def;
}

const levels = TUTORIALS.map((t, i) => buildTutorial(t, i + 1));
let previous = [];
if (ONLY) { try { previous = (await import(OUT, { with: { type: 'json' } })).default; } catch { previous = []; } }
for (let i = 4; i <= 50; i++) {
  if (ONLY && !ONLY.has(i) && previous[i - 1]) { levels.push(previous[i - 1]); continue; }
  levels.push(generate(specFor(i), 1000 + i * 7919));
}
const challenges = [];
if (!ONLY) for (let i = 0; i < CH_MECH.length; i++) challenges.push(generate(challengeSpec(i), 50000 + i * 104729));

const fmt = (list) => JSON.stringify(list, null, 1).replace(/\[\s+(\d),\s+(\d),\s+(\d)\s+\]/g, '[$1, $2, $3]') + '\n';
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, fmt(levels));
if (challenges.length) writeFileSync(OUT_CH, fmt(challenges));
console.log(`wrote ${levels.length} levels -> ${OUT}` + (challenges.length ? `, ${challenges.length} challenges -> ${OUT_CH}` : ''));
