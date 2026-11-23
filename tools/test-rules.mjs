// Sanity tests for dice rules, new tile mechanics and validation of every shipped level.
// Usage: node tools/test-rules.mjs

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { roll, allOrientations, isValidOrientation } from '../src/core/dice.js';
import { parseLevel, slide, initialState, scorePercent, starsFor } from '../src/core/rules.js';
import { analyse, solve } from '../src/core/solver.js';

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

const lv = (grid) => parseLevel({ id: 0, grid, dice: [1, 2, 3] });
const go = (level, dirs, s = initialState(level)) => { let r; for (const d of dirs) { r = slide(level, s, d); s = r.state; } return r; };

// Stop pad: the dice stops on it.
{ const L = lv(['SoxoE']); const r = go(L, 'R'); assert.equal(r.stop, 'pad'); assert.equal(r.state.x, 2); }
// Arrow: turns the dice and keeps rolling.
{
  const L = lv(['Sov', '..o', '..E']);
  const r = go(L, 'R');
  assert.equal(r.stop, 'end'); assert.deepEqual([r.state.x, r.state.y], [2, 2]);
  assert.ok(r.steps.some((s) => s.redirect === 'D'));
  assert.deepEqual(r.state.o, roll(roll(roll(roll([1, 2, 3], 'R'), 'R'), 'D'), 'D'));
}
// Portal: teleports to the twin and keeps rolling in the same direction; orientation unchanged by the jump.
{
  const L = lv(['SoT.', '....', '.Too', '...E']);
  const r = go(L, 'R');
  assert.ok(r.steps.some((s) => s.teleport));
  assert.deepEqual([r.state.x, r.state.y], [3, 2]);
  assert.deepEqual(r.state.o, roll(roll(roll(roll([1, 2, 3], 'R'), 'R'), 'R'), 'R'));
}
// Crumble: falls when the dice leaves it, and then blocks.
{
  const L = lv(['Soco', '...E']);
  const r1 = go(L, 'R');
  assert.equal(r1.state.x, 3); assert.equal(r1.state.gone, 1);
  const r2 = slide(L, r1.state, 'L');
  assert.equal(r2.moved, false, 'fallen tile blocks the way back');
}
// Face lock: enter only when the arriving top face matches.
{
  const top = roll([1, 2, 3], 'R')[0]; // 4
  const open = lv([`S${String.fromCharCode(96 + top)}E`]);
  assert.equal(go(open, 'R').stop, 'end');
  const shut = lv([`S${String.fromCharCode(96 + (top === 1 ? 2 : 1))}E`]);
  assert.equal(go(shut, 'R').moved, false);
}
// Arrow circuit does not loop forever.
{ const L = lv(['S>v', '.^<', '..E']); const r = go(L, 'R'); assert.ok(r.steps.length < 50); }
// Hint solver works from a mid-level state with fallen tiles.
{ const L = lv(['Soco', '...E']); const r = go(L, 'R'); assert.ok(solve(L, r.state)); }

function validate(def, i) {
  assert.ok(isValidOrientation(def.dice), `L${def.id} dice orientation`);
  const level = parseLevel(def);
  const res = analyse(level);
  assert.ok(res, `L${def.id} solvable`);
  assert.equal(res.best, def.best, `L${def.id} best case`);
  if (i < 8) assert.equal(res.dead, 0, `L${def.id} has no unwinnable states`);
  assert.ok(def.limit > def.best, `L${def.id} limit`);
  let s = initialState(level), done = false;
  for (const d of def.solution) { const r = slide(level, s, d); assert.ok(r.moved); s = r.state; done = r.complete; }
  assert.ok(done, `L${def.id} stored solution completes the level`);
  return level;
}

const levels = JSON.parse(readFileSync(new URL('../src/data/levels.json', import.meta.url)));
assert.equal(levels.length, 50);
levels.forEach((def, i) => {
  assert.equal(def.id, i + 1);
  assert.equal(def.world, Math.ceil(def.id / 10), `L${def.id} world`);
  const level = validate(def, i);
  if (def.intro) assert.ok(level.uses.includes(def.intro), `L${def.id} intro level uses ${def.intro}`);
});
// Each world's mechanic first appears on its intro level.
const firstUse = {};
levels.forEach((def) => { for (const m of parseLevel(def).uses) if (!(m in firstUse)) firstUse[m] = def.id; });
assert.deepEqual(firstUse, { stop: 11, arrow: 21, portal: 31, crumble: 41, gate: 46 });

const challenges = JSON.parse(readFileSync(new URL('../src/data/challenges.json', import.meta.url)));
assert.ok(challenges.length >= 7);
challenges.forEach((def) => { assert.ok(def.challenge); validate(def, 99); });
console.log('all rule tests passed;', levels.length, 'levels and', challenges.length, 'challenges validated');
