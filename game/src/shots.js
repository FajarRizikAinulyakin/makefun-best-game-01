// The screenshot scenes behind ?shot=start|play|boss|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by the
// autopilot, so the frame is what a real game looks like and the same seed
// always gives the same frame.
import { STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { autopilotInput } from './autopilot.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const BOSS_SECONDS = 9;
const END_LIMIT_SECONDS = 240;

/**
 * Set `world` to the named scene (start, play, boss or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'boss' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, null, true);
    return { screen: SCREEN_TITLE, best: 1840 };
  }
  if (name === 'boss') {
    world.stageBoss();
    for (let i = 0; i < BOSS_SECONDS / STEP; i += 1) {
      const events = world.step(STEP, autopilotInput(world.state, 1), false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    return { screen: SCREEN_PLAY, best: 5230 };
  }
  if (name === 'end') {
    // A bad pilot: it stands its ground and is overrun, a genuine loss. After
    // 45 s it stops firing altogether, so the scene always ends in defeat.
    for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
      const input = i > 45 / STEP
        ? { mx: 0, my: 0, aimX: world.state.player.x, aimY: world.state.player.y - 120, firing: false, dash: false, bomb: false }
        : autopilotInput(world.state, 0);
      const events = world.step(STEP, input, false);
      if (events & EVENT_OVER) break;
      if (events & EVENT_WIN) break;
    }
    const over = !world.state.player.alive;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: Math.max(1840, world.state.score) };
  }
  // Play: a good pilot. The autopilot clears waves faster than they spawn, so
  // no single moment is guaranteed busy — instead simulate once, snapshot the
  // busiest step (most shadows on screen, the player near the centre), and
  // restore that snapshot for the frame. (A second replay would diverge: the
  // world's seeded random is already spent by the first pass.)
  const inCentre = (x, y) => x > 220 && x < 1060 && y > 160 && y < 560;
  const countActive = () => world.state.enemies.reduce((n, e) => n + (e.active ? 1 : 0), 0);
  const countCentre = () => world.state.enemies.reduce(
    (n, e) => n + (e.active && inCentre(e.x, e.y) ? 1 : 0), 0,
  );
  let bestSnap = null;
  let bestValue = -1;
  for (let i = 0; i < 45 / STEP; i += 1) {
    const events = world.step(STEP, autopilotInput(world.state, 1), false);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
    const value = countActive() * 2 + countCentre()
      + (inCentre(world.state.player.x, world.state.player.y) ? 2 : 0);
    if (world.state.wave >= 2 && value > bestValue) {
      bestValue = value;
      bestSnap = structuredClone(world.state);
    }
  }
  if (bestSnap) {
    for (const key of Object.keys(bestSnap)) {
      const value = bestSnap[key];
      if (Array.isArray(value)) {
        world.state[key].length = 0;
        world.state[key].push(...value);
      } else if (value && typeof value === 'object') {
        Object.assign(world.state[key], value);
      } else {
        world.state[key] = value;
      }
    }
    // Re-link the boss to the restored enemy in the pool.
    world.state.boss = world.state.enemies.find((e) => e.active && e.kind === 'boss') ?? null;
  }
  return { screen: SCREEN_PLAY, best: 1840 };
}
