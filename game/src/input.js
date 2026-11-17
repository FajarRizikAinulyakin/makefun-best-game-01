// Keyboard and pointer input. Held keys give a move direction; one-shot presses
// (start, restart, pause, dash, bomb, mute) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost or counted twice.
// The mouse aim is stored in playfield coordinates, converted from the canvas
// rectangle each time the pointer moves.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_BOMB = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const DASH = new Set(['ShiftLeft', 'ShiftRight']);
const BOMB = new Set(['KeyE', 'KeyQ']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas, field) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let firing = false;
  let actions = 0;
  const aim = { x: field.width / 2, y: field.height / 2 - 120 };

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / field.width, rect.height / field.height);
    const ox = (rect.width - field.width * scale) / 2;
    const oy = (rect.height - field.height * scale) / 2;
    aim.x = (clientX - rect.left - ox) / scale;
    aim.y = (clientY - rect.top - oy) / scale;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (DASH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (BOMB.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BOMB;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    firing = false;
  });
  canvas.addEventListener('pointermove', (event) => toField(event.clientX, event.clientY));
  canvas.addEventListener('pointerdown', (event) => {
    toField(event.clientX, event.clientY);
    if (event.button === 2) actions |= ACTION_BOMB;
    else {
      firing = true;
      actions |= ACTION_CONFIRM;
    }
  });
  canvas.addEventListener('pointerup', (event) => {
    if (event.button !== 2) firing = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    aim,
    /** Normalised move vector, or 0,0 when idle. */
    move() {
      const x = (right ? 1 : 0) - (left ? 1 : 0);
      const y = (down ? 1 : 0) - (up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    isFiring() {
      return firing;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
