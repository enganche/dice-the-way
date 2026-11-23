# Dice The Way — Game Design Document

**Version:** 0.2 (content, meta and live-ops update — see section 17 and docs/RESEARCH.md)
**Platforms:** Web (desktop + mobile browser), Android, iOS
**Genre:** Grid-based puzzle, hybrid casual
**Working title:** Dice The Way

> Decisions marked **[Decision]** were made in this draft to fill gaps in the brief. They are listed again in section 15 for review.

---

## 1. Overview

Dice The Way is a single-player puzzle game. The player rolls a dice across a grid-based road map. Each roll is one move. The goal is to stop the dice on every numbered point in the level, with the number on the top face matching the point. The player solves each level in as few moves as possible, within a move limit.

**Pillars**

1. **Readable puzzles.** Every board state is visible. Rules are simple. Difficulty comes from planning, not from hidden information.
2. **Dice logic.** Every move rotates the dice in a physically consistent way. The player learns to read the dice.
3. **Tabletop charm.** Levels look like small handcrafted dioramas, with bright, glossy, toy-like visuals.
4. **One thumb or one hand.** Controls are four directions only, on every platform.

---

## 2. Core Loop

1. Look at the board: start, obstacles, roads, numbered points, end point.
2. Plan a route, and predict the top face at each stop.
3. Input one direction. The dice slides until it hits an obstacle, a stop point, or the edge of the road network.
4. Check the result. Solved points stay solved.
5. Repeat until all points are solved and the dice reaches the end point, or the move limit runs out.
6. Score the level by move efficiency. Unlock the next level.

---

## 3. Controls

| Platform | Input |
|---|---|
| PC / Web (desktop) | **W** = up, **A** = left, **S** = down, **D** = right. Arrow keys also accepted. |
| Mobile (Android, iOS, mobile web) | **Swipe** in one of four directions. The dominant axis of the swipe decides the direction. |

**Input rules**

- One input = one move (see section 6.3).
- Swipe detection: minimum swipe distance about 40 px (scaled to screen DPI), and the swipe must be mostly along one axis. Taps do nothing.
- **Input is locked while the dice is animating.** [Decision] Inputs during an animation are buffered: at most one queued input is kept, and it is applied when the current roll ends.
- Inputs that point to a blocked direction do nothing and do not count as a move. Feedback: a small "bump" animation on the dice.
- Input is ignored while a menu, popup, or ad is open.

---

## 4. Dice Rules

- The dice has six faces with pips 1–6. Opposite faces sum to 7.
- **Rolling** is a 90° rotation about the edge in the direction of travel. Per cell rolled:
  - Roll **right**: the left face becomes the top, the top becomes the right, the right becomes the bottom, the bottom becomes the left.
  - Roll left, up, and down follow the same pattern in their own directions.
- A single move may roll the dice across several cells. The orientation is updated for each cell crossed.
- The start orientation is set per level and shown to the player at the start of the level.
- The **top face** is the only value that matters for solving.

---

## 5. Board Elements

| Element | Description | Behaviour |
|---|---|---|
| **Road cell** | Walkable tile. Shown as a dot on the path. | The dice can enter and pass through. |
| **Intersection** | A road cell connected to three or four neighbours. | The dice passes straight through. Turns are only made by new inputs. |
| **Obstacle** | Blocked tile (rock, wall, hole, etc.). | Stops any roll that would enter it. |
| **Start** | Spawn cell for the dice, with the start orientation. | Walkable. Cannot be a stop point unless the level says so. |
| **Point** | Road cell with a numbered square (1–6). | **Unsolved:** the dice stops here. **Solved:** the dice passes through without stopping. |
| **End** | Exit tile. | See section 5.1. |

A point may sit on a straight road or on an intersection.

### 5.1 Stopping and Solving

- An unsolved point **stops** the dice when it is entered.
- When the dice stops on a point:
  - If the top face equals the point number, the point becomes **Solved**. It is marked (for example a glow and check), and it no longer stops the dice.
  - If it does not match, the point stays unsolved. The dice remains on it. The player must move from there.
- Solved points can be crossed freely in any direction. **No trigger.**
- The dice stops at obstacles, the board edge, or where the road ends. A stop with no point just ends the move.
- **End point [Decision]:** the dice stops on the end point. The level completes only if all points are solved at that moment. If not, the dice stays there and the player must keep playing.

### 5.2 Level Completion

- Level complete = **all points solved AND dice on the end point**.
- Completion ends the level immediately. The player's move count is locked in.

---

## 6. Move and Scoring

### 6.1 Move Limit

- Each level has a **move limit**.
- When moves reach zero and the level is not complete, the level is **failed**.
- On fail, the player can:
  - **Buy moves** with game currency (+5 moves, price in section 9), or
  - **Watch a rewarded ad** (+5 moves, once per fail screen), or
  - **Replay** the level from the start.
- Moves can be bought one time per failed attempt. [Decision]

### 6.2 Best Case and Score

- Each level has a **best case**: the minimum number of moves that completes it. It is calculated by an offline solver and stored with the level.
- Score is based on the player's moves:

  `Score % = min(100, round(BestMoves / PlayerMoves × 100))`

  - Best case = 100%.
  - Each extra move reduces the score.
- Stars (meta feedback) [Decision]:
  - ★ = level completed
  - ★★ = score 75% or more
  - ★★★ = score 100% (best case)

### 6.3 What counts as a move

- **[Decision]** One **direction input** = one move, regardless of how many cells the dice rolls through.
- Blocked inputs do not count.
- Buying or ad-gained moves do not reduce the score; the score is based only on moves used.

### 6.4 Move Limit Design

- Move limit = best case + a buffer. [Decision] Default buffer: best case × 1.5, rounded up, with a minimum buffer of 3.
- Harder levels may have a tighter buffer to force efficient play.

---

## 7. Level Design

### 7.1 Grid and Layout

- Levels are **grid-based**. Default grid sizes: 5×5 (tutorial) up to 9×9 (late game).
- Roads connect cells in four directions. Roads can cross at intersections.
- Each level has: one start, one end, 1–6 points (ramping up), and obstacles. Some levels have no obstacles, others have many.

### 7.2 Design Principles

- **Introduce one mechanic at a time.** Mechanics in order: straight rolls → stop on point → matching a number → intersections → solved points as pass-through → multi-point ordering → tight move limits.
- **Every level has a clear solution.** Each level is validated by the solver before release.
- **Avoid dead ends the player cannot see.** Use the grid and obstacles to make the board readable at a glance.
- **Points that matter.** A point should either force a stop or create a decision (which way to approach it), not be a free check.

### 7.3 Level Data (per level)

- Level ID, world, grid size
- Cell list: road, intersection, obstacle, start, end
- Points: cell position, number
- Start orientation of the dice (top, front, right, etc.)
- Best-case move count (solver output)
- Move limit
- Star thresholds (default: 75% and 100%)

### 7.4 Tutorial

- First 3 levels teach: swipe/WASD, stopping on a point, matching the top face. The UI highlights the top face and the next valid direction.
- Tutorial can be skipped.

---

## 8. Progression

- Levels are grouped into **Worlds** (each world has its own visual theme and about 10–15 levels). [Decision] Launch content: 1 world with 30 levels; 2 more worlds planned.
- Levels unlock in order. A level unlocks when the previous level is completed (any star count).
- The **Level Map** (section 10) shows the path through the worlds.

---

## 9. Economy

| Item | Source | Use |
|---|---|---|
| **Pips** (soft currency) [Decision] | Earned by completing levels (more for more stars). Small amounts from daily reward (live ops). | Buy moves on the fail screen. |
| **Rewarded ad** | Watched on the fail screen. | +5 moves. |

- Starter balance and prices are placeholders to be tuned: buy moves = 30 Pips for +5 moves.
- Shop tab is **Coming soon** in this version. Pips can be bought later as an IAP. Not in v1 scope.

---

## 10. UI and UX

### 10.1 General Principles

- Simple, hybrid casual look. Most of the screen shows the level or the map.
- Large touch targets (minimum 48 dp). Safe-area aware on iOS and Android notches.
- Portrait orientation on mobile. Landscape or portrait on desktop web, with the board centred.

### 10.2 Main Menu

Three tabs at the bottom:

| Tab | Content |
|---|---|
| **Level** | Level map (default tab). |
| **Shop** | Coming soon (placeholder screen). |
| **Meta** | Coming soon (placeholder screen). |

### 10.3 Level Map Screen (Level tab)

- Path-based roadmap of levels, like a typical puzzle game. Nodes show number and stars.
- Current level is highlighted with a **Play** button.
- Top area: current world name and progress (stars collected / total).
- **Live ops buttons** (placeholder): for example Daily Reward and Event. Coming soon, shown as locked icons.
- **Meta button** (placeholder): links to the Meta tab.
- Settings button (sound, music, vibration, language, controls hint).

### 10.4 Level Screen (in-game)

Most of the screen is the board. HUD:

| Area | Content |
|---|---|
| **Top bar** | Level number, **Replay** button, **Settings** button. |
| **Objective progress** | "Points solved: 2 / 5" with a small progress bar or pip icons. |
| **Move counter** | "Moves left: 7" (large, clearly visible). |
| **Board** | The grid, road dots, points, obstacles, dice. Centred. |
| **Bottom (mobile)** | Empty or hints area. Swipe is performed anywhere on the screen. |

Reference: simple HUD like hybrid casual puzzle games: information on top, play area in the centre, controls out of the way.

### 10.5 Pop-ups

- **Level complete:** score %, stars, pips earned, buttons: Next Level, Replay.
- **Level failed:** buttons: Buy Moves (+5), Watch Ad (+5), Replay.
- **Settings:** sound, music, vibration, controls, language, back to map.

### 10.6 Feedback

- Dice roll: rolling animation per cell, dust/bounce on stop.
- Point stop (not matching): shake and red flash.
- Point solved: glow, check mark, short chime, pip count increases.
- Blocked input: small bump.
- Level complete: confetti burst and star animation.

---

## 11. Visual Direction

### 11.1 References

- **Flaming Core (Habby):** vibrant, saturated colour palette, glossy stylized shapes, bright lighting and readable effects. Use for colour energy and the casual, polished feel.
- **Hitman GO / Lara Croft GO:** levels as tabletop diorama boards, clean tile-based movement, fixed camera, minimal clutter, and clear piece silhouettes. Use for board layout and camera.

Both are references for mood and presentation only. No assets, names, or layouts are copied.

### 11.2 Theme

- The world is a **giant tabletop** or game board built from dice-inspired pieces.
- The dice is ivory or bone with dark pips, and has a glossy finish.
- Roads are carved paths or painted lines on wood or felt. Obstacles are stone blocks, pegs, or small cubes.
- Points are numbered inlay tiles. Solved points glow with the colour of the world.
- Each world has its own palette (e.g. World 1: warm wood and mint; World 2: cool stone and violet).

### 11.3 Camera and Presentation

- Fixed, elevated camera with slight perspective, like a board game diorama. The whole board fits on screen.
- Dice rolls are animated with a tumble.
- Soft shadows, rim light, and a subtle bloom on solved points.

### 11.4 Audio

- Short, tactile dice roll sounds (wood/plastic clacks) that vary per cell.
- Soft ambient music per world.
- Positive chime for solve, soft buzz for a blocked input.

---

## 12. Technical Notes

- **Engine (recommended):** Unity (2D with 3D-style rendering or 3D orthographic), targeting WebGL, Android, and iOS from one project. [Decision: the brief does not name an engine. This is a recommendation to confirm.]
- **Level format:** JSON or ScriptableObject per level, validated by an editor tool and the solver.
- **Solver:** offline breadth-first search over (cell, top/front orientation, solved-point mask). Produces best-case move count and a sample solution.
- **Input:** unified input layer. WASD / arrows on PC, swipe on touch, both emitting the same `Move(direction)` event.
- **Saves:** local save for level progress, stars, pips, and settings. Cloud save is out of v1 scope.
- **Ads:** rewarded ads via the platform's standard SDK (AdMob on Android/iOS; web ads excluded from v1 or handled as a placeholder).
- **Analytics (minimum):** `level_start`, `move_made`, `level_complete` (score, stars, moves), `level_fail`, `moves_bought`, `ad_rewarded_watched`.
- **Performance target:** 60 fps on mid-range Android and iOS devices; WebGL initial load under 10 MB.

---

## 13. Scope

### In scope (v1)

- Core dice rolling, points, obstacles, intersections, start and end.
- Move limit, fail screen with buy moves (Pips) and rewarded ad.
- Scoring with best case, stars.
- One world with 30 levels, plus 3 tutorial levels within it.
- Main menu (Level tab active; Shop and Meta as Coming soon).
- Level map with play button, placeholder live ops and meta buttons.
- In-game HUD, replay, settings.
- WASD and swipe input. Web, Android, iOS.

### Out of scope (v1)

- Shop with real purchases.
- Meta progression (Coming soon).
- Live ops events (placeholders only).
- Undo.
- Cloud save and accounts.
- Level editor for players.

---

## 14. Milestones (proposed)

| Milestone | Goal |
|---|---|
| M1 Prototype | Dice roll, stop, points, solve. Grey box. WASD + swipe. 5 test levels. |
| M2 Core Puzzle | Obstacles, intersections, move limit, scoring, solver. 15 levels. |
| M3 Content and UI | 30 levels, menus, level map, HUD, pop-ups. |
| M4 Art and Audio | Diorama art, dice, effects, sound. |
| M5 Platform Builds | Web, Android, iOS builds, ads, analytics, store-ready QA. |

---

## 15. Open Questions and Decisions to Confirm

1. **Move definition:** is one direction input = one move (current draft), or should each cell crossed count as a move?
2. **Stopping at intersections:** does the dice pass straight through every intersection (current draft), or should intersections also stop the dice?
3. **End point:** must all points be solved before the end point completes the level (current draft), or can the dice finish at the end point at any time?
4. **Stars and score thresholds:** confirm 75% for 2 stars and 100% for 3 stars.
5. **Currency name and price:** "Pips" and 30 Pips for +5 moves are placeholders.
6. **Undo:** should there be an undo button? It is not in the brief and is not in v1 scope.
7. **Buy moves limit:** once per fail (current draft), or can the player buy several times?
8. **Engine:** Unity recommended. Confirm, or name another.
9. **Level count and worlds** for launch: 30 levels in one world (current draft).
10. **Web ads:** is a rewarded ad needed on web, or only on mobile?

---

## 16. Glossary

- **Point:** a numbered square on the road. Stops the dice until solved.
- **Top face:** the dice face pointing up. Must match the point number.
- **Best case:** the minimum move count that solves the level.
- **Move limit:** maximum moves allowed in a level.
- **Pips:** soft currency (placeholder name).

---

## 17. v0.2 Update (supersedes earlier sections where they differ)

Research notes behind these changes: `docs/RESEARCH.md`.

### 17.1 New tiles (grid characters in `src/core/rules.js`)

| Tile | Char | Rule |
|---|---|---|
| Stop pad | `x` | The dice always stops on it. |
| Arrow | `^ v < >` | The dice turns to the arrow's direction and keeps rolling. Stops on the arrow if that way is blocked. |
| Portal pair | `T`, `U` (two of each) | Rolling in sends the dice to the twin; it keeps rolling the same way. Orientation does not change in the jump. |
| Crumble | `c` | Can be crossed once; it falls when the dice leaves it, then blocks. |
| Face lock | `a`–`f` (1–6) | The dice can roll onto it only if the arriving top face is that number. |

Arrow/portal circuits stop the dice where the path would repeat. The solver state now includes fallen crumble tiles.

### 17.2 Content: 50 levels, 5 worlds, daily challenges

| World | Levels | New tile | Intro level |
|---|---|---|---|
| 1 Maple Table | 1–10 | — (tutorial 1–3) | — |
| 2 Harbor Deck | 11–20 | Stop pad | 11 |
| 3 Violet Arcade | 21–30 | Arrow | 21 |
| 4 Star Observatory | 31–40 | Portal | 31 |
| 5 Ember Ruins | 41–50 | Crumble (41), Face lock (46) | 41, 46 |

- Difficulty is a saw-tooth: each world starts with a small intro board and ramps to 8×8 with 4 points; later worlds mix earlier tiles in.
- Move limit: generous on intros and early levels; tighter on the last 3 levels of a world.
- 14 daily challenge boards (`src/data/challenges.json`), mixed tiles, limit = best + 2. One per day, rotating.
- Every level is generated and validated offline (`npm run levels`, `npm test`): solvable, stored solution replays, every placed tile is used by the solution, intro levels need their tile to be solvable in the best case.

### 17.3 Tutorial and onboarding

- First launch goes straight into level 1. Levels 1–2 are guided and only accept the shown direction (swipe-hand animation + coach bubble + board arrow). Level 3 is guided but free, so the player can see a mismatch.
- HUD spotlights: moves (L1), points (L2), dice compass (L3).
- New tiles: intro card with the tile art, plus a free first-move hint on the intro level.
- Boosters and live-ops features unlock by level, each with a one-time card. Tutorial can be skipped and replayed from Settings.

### 17.4 HUD and layout

- Top: pause · level + world · replay. Status capsule: moves left, point chips, **dice compass** (top face + next top face for each direction).
- Bottom (thumb reach): Undo and Hint boosters with stock badges; "Best · Used" in between. Coach bubble floats above.
- Pause menu: sound/music/vibration toggles, resume, replay, home (warns about losing the hot streak).

### 17.5 Meta

- **Boosters:** Undo (start 3) and Hint (start 2). Out of stock → buy one for 20 / 30 Pips.
- **Hot streak:** consecutive wins give +1/+2/+3 start moves. Lost when giving up after failing or quitting mid-level. Unlocks after level 9.
- **Star road:** 9 chests at 8 → 150 stars (Pips, boosters, 4 dice skins).
- **Dice skins:** 10 skins (Pips, star road, Dice Pass). The equipped skin is used for the 3D dice.
- **Shop:** free Pips by ad (3/day), booster packs for Pips, IAP Pip packs (placeholders).

### 17.6 Live-ops

| Feature | Unlocks after | Reset | Rewards |
|---|---|---|---|
| Daily gift | L2 | local midnight | 7-day calendar, day 7 = 80 Pips + 2 hints; missing a day restarts |
| Daily missions | L5 | local midnight | 3 from a pool (win, stars, 3★, points, moves, no boosters, streak, challenge) + bonus chest |
| Dice Pass | L8 | Monday 00:00 local | Tickets: stars on first clear, 1 on replay, 5 for the challenge; 10 tiers, last = Sunset skin |
| Daily challenge | L12 | local midnight | 60 Pips (+10/day of challenge streak, max +50) + 5 tickets |

Home shows red dots on every entry point with something to claim, and timers under each rail button. All state is local (`save.js`, key `dice-the-way.save.v2`, migrates v1).

### 17.7 Still out of scope

Leaderboards, team events, cloud save and real purchases need a backend and remain placeholders.
