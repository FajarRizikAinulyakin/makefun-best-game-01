// The autopilot that plays the game for the screenshot scenes. It is a real
// player of the same rules: it moves, aims at the nearest enemy, fires, dashes
// away from danger and uses a Nova when surrounded. `skill` 1 plays well;
// skill 0 plays badly (it barely moves and never dashes), so the end scene is
// a genuine loss. No wall clock, no randomness of its own — the world's seeded
// random decides everything, so a scene is the same every time.
import { FIELD } from './config.js';

/** The autopilot's move/aim/fire decision for this step. */
export function autopilotInput(state, skill) {
  const p = state.player;
  let nearest = null;
  let nearestDist = Infinity;
  let threat = null;
  let threatDist = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < nearestDist) { nearestDist = d; nearest = e; }
    if (e.kind !== 'spitter' && d < threatDist) { threatDist = d; threat = e; }
  }
  let mx = 0;
  let my = 0;
  let aimX = p.x;
  let aimY = p.y - 120;
  let firing = false;
  let dash = false;
  let bomb = false;
  if (skill === 0) {
    // A hurried player: stands still, shoots at whatever is nearest, never dashes.
    if (nearest) {
      aimX = nearest.x;
      aimY = nearest.y;
      firing = true;
    }
    return { mx: 0, my: 0, aimX, aimY, firing, dash: false, bomb: false };
  }
  // Kite: drift away from the nearest threat, toward the centre when crowded.
  if (threat && threatDist < 150) {
    const dx = p.x - threat.x;
    const dy = p.y - threat.y;
    const len = Math.hypot(dx, dy) || 1;
    mx = dx / len;
    my = dy / len;
    if (threatDist < 70 && p.dashCooldown <= 0) dash = true;
  } else if (nearest) {
    // Close to a comfortable firing range, strafing sideways.
    const dx = nearest.x - p.x;
    const dy = nearest.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const want = 240;
    const radial = len > want + 40 ? 1 : len < want - 40 ? -1 : 0;
    mx = (dx / len) * radial + (-dy / len) * 0.5;
    my = (dy / len) * radial + (dx / len) * 0.5;
    const mLen = Math.hypot(mx, my) || 1;
    mx /= mLen;
    my /= mLen;
  }
  // Stay inside the arena with a margin.
  if (p.x < 90) mx = Math.max(mx, 0.4);
  if (p.x > FIELD.width - 90) mx = Math.min(mx, -0.4);
  if (p.y < 90) my = Math.max(my, 0.4);
  if (p.y > FIELD.height - 90) my = Math.min(my, -0.4);
  if (nearest) {
    aimX = nearest.x;
    aimY = nearest.y;
    firing = true;
  }
  // Nova when surrounded and it is worth it.
  let close = 0;
  for (const e of state.enemies) {
    if (e.active && Math.hypot(e.x - p.x, e.y - p.y) < 200) close += 1;
  }
  if (close >= 5 && p.bombs > 0) bomb = true;
  return { mx, my, aimX, aimY, firing, dash, bomb };
}
