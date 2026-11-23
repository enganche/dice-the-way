# Genre research — Dice The Way v0.2

Short notes from looking at rolling-dice puzzles, sliding (ice) puzzles and hybrid-casual live-ops, and what each finding changed in the game.

## 1. Rolling-dice puzzles (game-jam entries, player feedback)

| Finding | Change in v0.2 |
|---|---|
| Players struggle to keep the hidden faces in their head; one asked for an unfolded-dice preview of the next face. | **Dice compass** in the HUD: top face in the middle, and the face that comes up after one roll in each direction around it. The tutorial points at it. |
| No undo makes one slip cost the whole level; players praised games that had undo. | **Undo booster** (stock + buy with Pips). Undo restores points, fallen tiles and the move count. |
| Tiles that force a face were praised as a way to guide reasoning. | **Face lock** tile: the dice can only roll onto it if the arriving top face matches. |
| Slow roll animations get complaints. | Multi-cell rolls already speed up per cell; teleports and redirects are short tweens. |
| Brute-forcing happens when levels give too much room. | Generator trims unused road, keeps only obstacles that block a used road, and requires every mechanic placed to be part of the solution. |

## 2. Sliding / ice puzzles

| Finding | Change in v0.2 |
|---|---|
| Each world adds a new twist: portals, one-way gates, tiles that crumble after one use (e.g. *Sliiide*). | One new tile per world: **stop pad** (W2), **arrow** (W3), **portal** (W4), **crumble** (W5), **face lock** (W5 late). |
| Arrow/stop blocks redirect or break a slide (e.g. *Puzzle Retreat*). | Arrow and stop pad tiles. |
| Teleporters are "a little confusing at first". | Every new tile has an **intro card** with its real tile art, an easy intro level, and a free first-move hint on that level. |

## 3. Hybrid-casual live-ops (2025 market coverage)

| Pattern | Change in v0.2 |
|---|---|
| Daily login rewards / streak chests (day-7 big prize). | **Daily gift** 7-day calendar; missing a day restarts it. |
| Win-streak mechanics are the most common pairing in casual puzzle live-ops. | **Hot streak**: consecutive wins give up to +3 start moves; lost on giving up or quitting mid-level. |
| Battle passes drive retention; progress tied to levels. | **Dice Pass** weekly event: tickets from stars, challenge, replays; 10 reward tiers, final tier is an exclusive dice skin. |
| Daily/weekly missions. | **Daily missions**: 3 per day from a pool + a bonus chest for finishing all three. |
| Collections / albums as long-term meta. | **Dice skins** collection + **Star road** chests at star milestones. |
| Fail-screen offers are the largest revenue source. | Fail screen keeps +5 moves (Pips / ad) and now shows the streak at risk. |
| Progressive disclosure of features. | Features unlock by level (daily L2, undo L4, missions L5, hint L6, pass L8, streak L9, challenge L12), each with a one-time card. |

Not implemented (needs a backend): leaderboards, team events, cloud save.

## Sources

- itch.io GMTK Game Jam 2022 entries and comments (dice-themed jam): https://itch.io/jam/gmtk-jam-2022/rate/1621183, https://itch.io/jam/gmtk-jam-2022/rate/1618197, https://itch.io/jam/gmtk-jam-2022/rate/1619150
- Sliiide: Ice Tile Block Puzzle (App Store): https://apps.apple.com/app/id6761265327
- Ice Bot: Sliding Block Puzzle (Pocket Gamer): https://www.pocketgamer.com/ice-bot-sliding-block-puzzle/
- Puzzle Retreat (App Store): https://apps.apple.com/au/app/puzzle-retreat/id561834333
- Naavik — Live ops trends powering mobile puzzle: https://naavik.co/digest/live-ops-trends-powering-mobile-puzzle/
- AppMagic — Inside Mobile Gaming LiveOps 2026: https://appmagic.rocks/blog/mechanicsfor2026
- AppMagic — Top hybridcasual games Q1 2025: https://appmagic.rocks/blog/hybridcasual-q1-2025
- InvestGame — LiveOps report 2025: https://investgame.net/news/pdf/2026-01-15-liveops_report_2025_en/
