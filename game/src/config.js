// EMBERFALL — tuning, palette and enemy definitions in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Survive all of these waves and defeat the Hollow King on the last one to win. */
export const FINAL_WAVE = 10;

export const PLAYER = {
  radius: 16,
  speed: 330,
  maxHp: 100,
  fireInterval: 0.16,
  bulletSpeed: 760,
  bulletDamage: 1,
  dashCooldown: 2.0,
  dashTime: 0.18,
  dashSpeed: 2.7,
  hitInvulnerable: 0.9,
  startBombs: 3,
};

export const BOMB = { damage: 6, radius: 340 };

/** Enemy kinds. hp/speed grow a little with the wave; score is before the combo multiplier. */
export const ENEMY = {
  wisp: { radius: 15, speed: 105, hp: 2, score: 50, color: '#b78cff' },
  spitter: { radius: 17, speed: 78, hp: 3, score: 100, color: '#ff7ad9' },
  brute: { radius: 26, speed: 52, hp: 9, score: 200, color: '#ff5a4e' },
  splitter: { radius: 20, speed: 88, hp: 4, score: 120, color: '#7dffce' },
  dasher: { radius: 15, speed: 95, hp: 3, score: 150, color: '#ffd166' },
  boss: { radius: 56, speed: 46, hp: 240, score: 5000, color: '#e5484d' },
};

/** How many of each kind a wave spawns, before the wave's scaling. */
export function waveComposition(wave) {
  const n = wave;
  return {
    wisp: 4 + n * 2,
    spitter: n >= 2 ? 1 + n : 0,
    brute: n >= 3 ? Math.floor(n / 2) : 0,
    splitter: n >= 4 ? Math.floor(n / 2) : 0,
    dasher: n >= 5 ? Math.floor(n / 2) : 0,
    boss: n === FINAL_WAVE ? 1 : 0,
  };
}

/** Seconds between spawn bursts in a wave; waves get denser as they go on. */
export function spawnInterval(wave) {
  return Math.max(0.22, 0.6 - wave * 0.04);
}

/** Enemies spawned per burst: waves arrive in clusters, not a trickle. */
export function spawnBurst(wave) {
  return wave >= 6 ? 3 : wave >= 3 ? 2 : 1;
}

export const PICKUP = {
  ember: { score: 10, magnet: 150 },
  heart: { heal: 30 },
  shield: { seconds: 8 },
  spread: { seconds: 12 },
  rapid: { seconds: 12 },
  bomb: { count: 1 },
};

/** Drop chances on a kill (roll once per kill, ember gems are separate). */
export const DROP = { heart: 0.05, shield: 0.07, spread: 0.08, rapid: 0.08, bomb: 0.05 };

export const PALETTE = {
  backdrop: '#0a0812',
  skyTop: '#171029',
  skyBottom: '#0a0812',
  floor: '#14101f',
  floorLine: '#1e1830',
  lantern: '#ffb347',
  lanternGlow: '#ff9d2e',
  player: '#ffd166',
  playerCore: '#fff3c4',
  bullet: '#ffe08a',
  enemyBullet: '#ff6b9d',
  ember: '#ff9d2e',
  panel: '#171226',
  panelEdge: '#3d2f63',
  text: '#f5efe0',
  muted: '#a99ec7',
  hp: '#5ee6a0',
  hpLow: '#ff5a4e',
  danger: '#ff5a4e',
  combo: '#7dffce',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberfall.best';
