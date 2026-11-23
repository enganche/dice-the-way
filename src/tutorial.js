// Guided tutorial scripts for the first three levels (GDD 7.4).
// Each step is shown before the matching move; `{dir}` is replaced by the
// arrow of the best next move. `forced` levels only accept that direction.
// `spot` spotlights a HUD element while the step is shown.

export const DIR_GLYPH = { U: '↑', D: '↓', L: '←', R: '→' };

export const TUTORIAL = {
  1: { forced: true, steps: [
    { text: 'tut1a' },
    { text: 'tut1b', spot: '#stat-moves' },
  ] },
  2: { forced: true, steps: [
    { text: 'tut2a', spot: '#stat-points' },
    { text: 'tut2b' },
    { text: 'tut2c' },
  ] },
  3: { forced: false, steps: [
    { text: 'tut3a', spot: '#compass' },
    { text: 'tut3b', spot: '#compass' },
    { text: 'tut3c' },
    { text: 'tut3d' },
  ] },
};
