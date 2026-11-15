// Sanity tests for dice rules + validation of every shipped level.
// Usage: node tools/test-rules.mjs

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { roll, allOrientations, isValidOrientation } from '../src/core/dice.js';
import { parseLevel, slide, initialState, scorePercent, starsFor } from '../src/core/rules.js';
import { analyse } from '../src/core/solver.js';

// GDD 4: roll right -> left face becomes top, top becomes right.
let o = [1, 2, 3];
assert.deepEqual(roll(o, 'R'), [4, 2, 1]);
assert.deepEqual(roll(o, 'L'), [3, 2, 6]);
assert.deepEqual(roll(o, 'U'), [2, 6, 3]);
assert.deepEqual(roll(o, 'D'), [5, 1, 3]);
for (const d of ['U', 'D', 'L', 'R']) {
  let q = o; for (let i = 0; i < 4; i++) q = roll(q, d);
  assert.deepEqual(q, o, 'four rolls return to the same orientation');
}
assert.deepEqual(roll(roll(o, 'R'), 'L'), o);
assert.deepEqual(roll(roll(o, 'U'), 'D'), o);
assert.equal(allOrientations().length, 24);
assert.ok(!isValidOrientation([1, 3, 2]), 'mirror dice is invalid');

assert.equal(scorePercent(4, 4), 100);
assert.equal(scorePercent(3, 4), 75);
assert.equal(starsFor(100), 3); assert.equal(starsFor(75), 2); assert.equal(starsFor(74), 1);

const levels = JSON.parse(readFileSync(new URL('../src/data/levels.json', import.meta.url)));
assert.equal(levels.length, 30);
for (const def of levels) {
  assert.ok(isValidOrientation(def.dice), `L${def.id} dice orientation`);
  const level = parseLevel(def);
  const res = analyse(level);
  assert.ok(res, `L${def.id} solvable`);
  assert.equal(res.best, def.best, `L${def.id} best case`);
  if (def.id <= 12) assert.equal(res.dead, 0, `L${def.id} has no unwinnable states`);
  assert.ok(def.limit > def.best, `L${def.id} limit`);
  // Replay the stored solution.
  let s = initialState(level), done = false;
  for (const d of def.solution) { const r = slide(level, s, d); assert.ok(r.moved); s = r.state; done = r.complete; }
  assert.ok(done, `L${def.id} stored solution completes the level`);
}
console.log('all rule tests passed;', levels.length, 'levels validated');
