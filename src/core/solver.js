// Breadth-first solver over (cell, orientation, solved mask) — GDD section 12.

import { DIR_KEYS } from './dice.js';
import { slide, initialState, stateKey as keyOf } from './rules.js';

/**
 * Shortest solution from `from` (default: level start).
 * Returns { best, solution } or null when unsolvable.
 */
export function solve(level, from, opts) {
  const start = from || initialState(level);
  const seen = new Map(); // key -> { prev, dir }
  const startKey = keyOf(level, start);
  seen.set(startKey, null);
  let frontier = [{ s: start, k: startKey }];
  let depth = 0;
  while (frontier.length) {
    depth++;
    const next = [];
    for (const { s, k } of frontier) {
      for (const d of DIR_KEYS) {
        const r = slide(level, s, d, opts);
        if (!r.moved) continue;
        const nk = keyOf(level, r.state);
        if (seen.has(nk)) continue;
        seen.set(nk, { prev: k, dir: d });
        if (r.complete) {
          let sol = '', cur = nk;
          while (seen.get(cur)) { const e = seen.get(cur); sol = e.dir + sol; cur = e.prev; }
          return { best: depth, solution: sol };
        }
        next.push({ s: r.state, k: nk });
      }
    }
    frontier = next;
  }
  return null;
}

/** First move of a shortest solution from the given state, or null. */
export function hintMove(level, state) {
  const r = solve(level, state);
  return r ? r.solution[0] : null;
}

/**
 * Full analysis used by the level generator: explores every reachable state.
 * Returns { best, solution, states, dead, visited:Set<cellIndex> } or null.
 * `dead` = reachable states from which the level can no longer be completed.
 */
export function analyse(level) {
  const start = initialState(level);
  const nodes = new Map(); // key -> { s, depth, prev, dir, complete, out:[] }
  const startKey = keyOf(level, start);
  nodes.set(startKey, { s: start, depth: 0, prev: -1, dir: '', complete: false, out: [] });
  const queue = [startKey];
  const visited = new Set([start.y * level.w + start.x]);
  let bestKey = -1;
  for (let qi = 0; qi < queue.length; qi++) {
    const k = queue[qi];
    const node = nodes.get(k);
    if (node.complete) continue; // terminal
    for (const d of DIR_KEYS) {
      const r = slide(level, node.s, d);
      if (!r.moved) continue;
      for (const st of r.steps) visited.add(st.y * level.w + st.x);
      const nk = keyOf(level, r.state);
      node.out.push(nk);
      if (!nodes.has(nk)) {
        nodes.set(nk, { s: r.state, depth: node.depth + 1, prev: k, dir: d, complete: r.complete, out: [] });
        queue.push(nk);
        if (r.complete && bestKey < 0) bestKey = nk;
      }
    }
  }
  if (bestKey < 0) return null;
  let solution = '';
  for (let cur = bestKey; nodes.get(cur).prev !== -1; cur = nodes.get(cur).prev) solution = nodes.get(cur).dir + solution;

  // Reverse reachability from winning states to count dead states.
  const rev = new Map();
  for (const [k, n] of nodes) for (const t of n.out) {
    if (!rev.has(t)) rev.set(t, []);
    rev.get(t).push(k);
  }
  const canWin = new Set();
  const stack = [];
  for (const [k, n] of nodes) if (n.complete) { canWin.add(k); stack.push(k); }
  while (stack.length) {
    const k = stack.pop();
    for (const p of rev.get(k) || []) if (!canWin.has(p)) { canWin.add(p); stack.push(p); }
  }
  return {
    best: nodes.get(bestKey).depth,
    solution,
    states: nodes.size,
    dead: nodes.size - canWin.size,
    visited,
  };
}
