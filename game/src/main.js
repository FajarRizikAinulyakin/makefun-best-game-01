// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play,
// paused, game over and victory.
//
// ?seed=N fixes the falling pattern. ?shot=start|play|boss|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOMB, EVENT_BOSS, EVENT_DASH, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_PICKUP, EVENT_WAVE, EVENT_WIN } from './world.js';
import { createAudio } from './audio.js';
import {
  ACTION_BOMB, ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  // Resizing the canvas clears it, so repaint the staged scene after any
  // resize (for example a screenshot tool changing the viewport).
  window.addEventListener('resize', () => {
    renderer.draw(world.state, scene.screen, scene.best);
  });
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, { width: 1280, height: 720 });
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.init();
    audio.click();
    audio.startMusic();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Survive 10 waves and banish the Hollow King.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    audio.stopMusic();
    if (won) audio.win();
    else audio.gameOver();
    announce(won
      ? `Victory. Score ${world.state.score}. Best ${best}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stopMusic();
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      audio.startMusic();
      announce('Playing.');
    }
  }

  function stepWorld(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, null, true);
      return;
    }
    const move = input.move();
    const events = world.step(STEP, {
      mx: move.x, my: move.y,
      aimX: input.aim.x, aimY: input.aim.y,
      firing: input.isFiring(),
      dash: Boolean(actions & ACTION_DASH),
      bomb: Boolean(actions & ACTION_BOMB),
    }, false);
    if (events & EVENT_BOSS) audio.boss();
    else if (events & EVENT_WAVE) audio.wave();
    if (events & EVENT_HIT) {
      audio.hurt();
      announce(world.state.player.hp <= 0 ? 'The lantern falls.' : `Hit. Hull ${Math.ceil(world.state.player.hp)}.`);
    }
    if (events & EVENT_KILL) audio.explode();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_BOMB) audio.bomb();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // One-shot presses (dash, bomb) belong to the first step of this frame only.
      let stepActions = actions;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        stepWorld(stepActions);
        stepActions = 0;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting shadows swarm unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stopMusic();
      announce('Paused.');
    }
  });

  // First gesture unlocks audio.
  canvas.addEventListener('pointerdown', () => audio.init(), { once: true });
  announce('Emberfall. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
