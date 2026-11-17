// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. All art is drawn in code — no image files.
import { ENEMY, FIELD, FINAL_WAVE, FONT, PALETTE, PLAYER } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, line: 32 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const waveLabel = cachedLabel('WAVE ');
  const finalLabel = cachedLabel('SCORE ');
  const killsLabel = cachedLabel('SHADOWS BANISHED ');
  const timeLabel = cachedLabel('TIME ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }

  function circle(x, y, r, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }

  function drawBackground(state) {
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Floor grid, faint.
    context.strokeStyle = PALETTE.floorLine;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 80; x < FIELD.width; x += 80) { context.moveTo(x, 0); context.lineTo(x, FIELD.height); }
    for (let y = 80; y < FIELD.height; y += 80) { context.moveTo(0, y); context.lineTo(FIELD.width, y); }
    context.stroke();
    // Drifting ember motes.
    for (const m of state.motes) {
      const tw = 0.35 + 0.35 * Math.sin(m.phase);
      context.globalAlpha = tw;
      circle(m.x, m.y, m.size, PALETTE.ember);
    }
    context.globalAlpha = 1;
    // The Last Lantern, at the centre of the arena: the thing being defended.
    const cx = FIELD.width / 2;
    const cy = FIELD.height / 2;
    const glow = context.createRadialGradient(cx, cy, 10, cx, cy, 190);
    glow.addColorStop(0, 'rgba(255, 179, 71, 0.28)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    context.fillStyle = glow;
    context.fillRect(cx - 190, cy - 190, 380, 380);
    context.strokeStyle = '#6b5322';
    context.lineWidth = 4;
    context.beginPath();
    context.arc(cx, cy, 26, 0, Math.PI * 2);
    context.stroke();
    circle(cx, cy, 18, PALETTE.lantern);
    circle(cx, cy, 9, '#fff3c4');
  }

  function drawPickups(state) {
    for (const p of state.pickups) {
      if (!p.active) continue;
      const bob = Math.sin(state.time * 4 + p.x) * 3;
      const y = p.y + bob;
      if (p.kind === 'ember') {
        circle(p.x, y, 7, PALETTE.ember);
        circle(p.x, y, 3.5, '#fff3c4');
      } else if (p.kind === 'heart') {
        context.fillStyle = '#ff5a7a';
        context.beginPath();
        context.arc(p.x - 5, y - 2, 6, 0, Math.PI * 2);
        context.arc(p.x + 5, y - 2, 6, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.moveTo(p.x - 10, y);
        context.lineTo(p.x + 10, y);
        context.lineTo(p.x, y + 11);
        context.closePath();
        context.fill();
      } else {
        const label = p.kind === 'shield' ? 'A' : p.kind === 'spread' ? '3' : p.kind === 'rapid' ? 'R' : 'N';
        const color = p.kind === 'shield' ? '#7dffce' : p.kind === 'bomb' ? '#ff9d2e' : '#ffd166';
        circle(p.x, y, 13, color);
        text(label, p.x, y + 6, 16, '#14101f', 'center', true);
      }
    }
  }

  function drawEnemies(state) {
    for (const e of state.enemies) {
      if (!e.active) continue;
      const def = ENEMY[e.kind];
      const flash = e.flash > 0;
      const color = flash ? '#ffffff' : def.color;
      if (e.kind === 'wisp') {
        circle(e.x, e.y, e.radius, color);
        circle(e.x - 5, e.y - 4, 3, '#14101f');
        circle(e.x + 5, e.y - 4, 3, '#14101f');
        // Wavy tail.
        context.strokeStyle = color;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(e.x - 8, e.y + 10);
        context.quadraticCurveTo(e.x, e.y + 22 + Math.sin(state.time * 6 + e.x) * 4, e.x + 8, e.y + 10);
        context.stroke();
      } else if (e.kind === 'spitter') {
        circle(e.x, e.y, e.radius, color);
        circle(e.x, e.y, e.radius - 7, '#14101f');
        circle(e.x, e.y, 6, color);
      } else if (e.kind === 'brute') {
        context.fillStyle = color;
        context.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * Math.PI * 2 + state.time * 0.4;
          const px = e.x + Math.cos(a) * e.radius;
          const py = e.y + Math.sin(a) * e.radius;
          if (i === 0) context.moveTo(px, py); else context.lineTo(px, py);
        }
        context.closePath();
        context.fill();
        circle(e.x - 8, e.y - 4, 3.5, '#14101f');
        circle(e.x + 8, e.y - 4, 3.5, '#14101f');
      } else if (e.kind === 'splitter') {
        circle(e.x, e.y, e.radius, color);
        context.strokeStyle = '#14101f';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(e.x - e.radius, e.y);
        context.lineTo(e.x + e.radius, e.y);
        context.moveTo(e.x, e.y - e.radius);
        context.lineTo(e.x, e.y + e.radius);
        context.stroke();
      } else if (e.kind === 'dasher') {
        const telegraph = e.state === 1;
        context.fillStyle = telegraph ? '#ffffff' : color;
        context.beginPath();
        context.moveTo(e.x, e.y - e.radius);
        context.lineTo(e.x + e.radius, e.y);
        context.lineTo(e.x, e.y + e.radius);
        context.lineTo(e.x - e.radius, e.y);
        context.closePath();
        context.fill();
        if (telegraph) {
          context.strokeStyle = 'rgba(255, 209, 102, 0.7)';
          context.lineWidth = 2;
          context.beginPath();
          context.moveTo(e.x, e.y);
          context.lineTo(e.x + e.tx * 90, e.y + e.ty * 90);
          context.stroke();
        }
      } else if (e.kind === 'boss') {
        // Crown of horns + burning core.
        context.fillStyle = color;
        context.beginPath();
        context.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#2a0a0e';
        for (let i = -1; i <= 1; i += 1) {
          context.beginPath();
          context.moveTo(e.x + i * 26 - 10, e.y - e.radius + 14);
          context.lineTo(e.x + i * 26, e.y - e.radius - 26);
          context.lineTo(e.x + i * 26 + 10, e.y - e.radius + 14);
          context.closePath();
          context.fill();
        }
        circle(e.x - 18, e.y - 8, 7, '#ffd166');
        circle(e.x + 18, e.y - 8, 7, '#ffd166');
        circle(e.x, e.y + 12, 12, '#ff9d2e');
        circle(e.x, e.y + 12, 6, '#fff3c4');
      }
      // Health bar for tough foes.
      if (e.maxHp >= 4 && e.hp < e.maxHp) {
        const w = e.radius * 2;
        context.fillStyle = '#14101f';
        context.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
        context.fillStyle = PALETTE.hpLow;
        context.fillRect(e.x - w / 2, e.y - e.radius - 12, w * (e.hp / e.maxHp), 5);
      }
    }
  }

  function drawBullets(state) {
    for (const b of state.bullets) {
      if (!b.active) continue;
      if (b.friendly) {
        circle(b.x, b.y, b.radius + 3, 'rgba(255, 224, 138, 0.3)');
        circle(b.x, b.y, b.radius, PALETTE.bullet);
      } else {
        circle(b.x, b.y, b.radius + 3, 'rgba(255, 107, 157, 0.3)');
        circle(b.x, b.y, b.radius, PALETTE.enemyBullet);
      }
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (!p.alive) return;
    const blink = p.invulnerable > 0 && Math.floor(state.time * 12) % 2 === 0 && p.dashTime <= 0;
    if (blink) return;
    // Aim line, faint.
    context.strokeStyle = 'rgba(255, 209, 102, 0.25)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(p.x, p.y);
    context.lineTo(p.x + Math.cos(p.aimAngle) * 44, p.y + Math.sin(p.aimAngle) * 44);
    context.stroke();
    // Shield ring.
    if (p.shieldTime > 0) {
      context.strokeStyle = 'rgba(125, 255, 206, 0.8)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(p.x, p.y, p.radius + 9, 0, Math.PI * 2);
      context.stroke();
    }
    // Warden: a little lantern-bearer, drawn as a hooded triangle + glowing core.
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.moveTo(p.x, p.y - p.radius - 4);
    context.lineTo(p.x + p.radius, p.y + p.radius);
    context.lineTo(p.x - p.radius, p.y + p.radius);
    context.closePath();
    context.fill();
    circle(p.x, p.y + 2, 8, PALETTE.playerCore);
    // Dash trail.
    if (p.dashTime > 0) {
      context.globalAlpha = 0.4;
      circle(p.x - Math.cos(p.aimAngle) * 26, p.y - Math.sin(p.aimAngle) * 26, 12, PALETTE.player);
      context.globalAlpha = 1;
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      circle(p.x, p.y, p.size, p.color);
    }
    context.globalAlpha = 1;
    context.textBaseline = 'alphabetic';
    for (const f of state.floaters) {
      if (!f.active) continue;
      context.globalAlpha = Math.max(0, f.life);
      text(f.text, f.x, f.y, 18, f.color, 'center', true);
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, best) {
    const p = state.player;
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 26, PALETTE.text, 'left', true);
    text(waveLabel(`${state.wave} / ${FINAL_WAVE}`), FIELD.width / 2, 18, 26, PALETTE.text, 'center', true);
    text(bestLabel(Math.max(best, state.score)), FIELD.width - 24, 18, 26, PALETTE.muted, 'right');
    // Hull bar.
    const barX = 24;
    const barY = 56;
    const barW = 220;
    context.fillStyle = '#14101f';
    context.fillRect(barX, barY, barW, 14);
    context.fillStyle = p.hp < 30 ? PALETTE.hpLow : PALETTE.hp;
    context.fillRect(barX, barY, barW * (p.hp / PLAYER.maxHp), 14);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(barX, barY, barW, 14);
    text(`HULL ${Math.ceil(p.hp)}`, barX, barY + 20, 15, PALETTE.muted, 'left');
    // Bombs.
    for (let i = 0; i < p.bombs; i += 1) {
      circle(FIELD.width - 30 - i * 28, 66, 9, '#ff9d2e');
      text('N', FIELD.width - 30 - i * 28, 60, 12, '#14101f', 'center', true);
    }
    text('NOVA  [E]', FIELD.width - 24 - Math.max(0, p.bombs) * 28 - 8, 58, 15, PALETTE.muted, 'right');
    // Dash cooldown.
    const dashReady = p.dashCooldown <= 0;
    text(dashReady ? 'DASH READY  [SPACE]' : 'DASH …', 24, 92, 15, dashReady ? PALETTE.combo : PALETTE.muted, 'left');
    // Combo.
    if (state.combo > 1) {
      text(`COMBO x${state.combo}`, FIELD.width / 2, 52, 22, PALETTE.combo, 'center', true);
    }
    // Active power-ups.
    const active = [];
    if (p.spreadTime > 0) active.push(`TRIPLE ${Math.ceil(p.spreadTime)}s`);
    if (p.rapidTime > 0) active.push(`RAPID ${Math.ceil(p.rapidTime)}s`);
    if (p.shieldTime > 0) active.push(`AEGIS ${Math.ceil(p.shieldTime)}s`);
    if (active.length > 0) text(active.join('   •   '), FIELD.width / 2, 84, 16, PALETTE.combo, 'center');
    // Boss health bar.
    if (state.boss && state.boss.active) {
      const bw = 420;
      const bx = (FIELD.width - bw) / 2;
      const by = FIELD.height - 36;
      text('THE HOLLOW KING', FIELD.width / 2, by - 24, 16, PALETTE.danger, 'center', true);
      context.fillStyle = '#14101f';
      context.fillRect(bx, by, bw, 12);
      context.fillStyle = PALETTE.danger;
      context.fillRect(bx, by, bw * Math.max(0, state.boss.hp / state.bossMaxHp), 12);
      context.strokeStyle = PALETTE.panelEdge;
      context.strokeRect(bx, by, bw, 12);
    }
    // Low hull warning.
    if (p.hp > 0 && p.hp < 30) {
      const pulse = 0.25 + 0.2 * Math.sin(state.time * 6);
      context.fillStyle = `rgba(255, 90, 78, ${pulse})`;
      context.fillRect(0, 0, FIELD.width, 10);
      context.fillRect(0, FIELD.height - 10, FIELD.width, 10);
    }
    // Wave banner.
    if (state.banner.time > 0) {
      context.globalAlpha = Math.min(1, state.banner.time);
      text(state.banner.text, FIELD.width / 2, 190, 52, PALETTE.text, 'center', true);
      if (state.banner.sub) text(state.banner.sub, FIELD.width / 2, 240, 22, PALETTE.muted, 'center');
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = 150 + lines.length * PANEL.line + 64;
    const width = PANEL.width;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10, 8, 18, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 46, PALETTE.text, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 118 + i * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 22, PALETTE.lantern, 'center', true);
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const sx = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const sy = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawBackground(state);
    drawPickups(state);
    drawEnemies(state);
    drawBullets(state);
    drawPlayer(state);
    drawParticles(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('EMBERFALL', [
        'Defend the Last Lantern. The shadows are coming.',
        'Survive 10 waves and banish the Hollow King.',
        'Move WASD / arrows  •  Aim mouse  •  Hold click to fire',
        'SPACE dash  •  E or right-click: Nova bomb  •  P pause  •  M mute',
        `Best score ${Math.max(best, state.score)}`,
      ], 'Click or press ENTER to start', PALETTE.lantern);
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The shadows wait for no one — except now.', ''], 'Press P or click to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('THE LANTERN FALLS', [
        finalLabel(state.score),
        bestLabel(Math.max(best, state.score)),
        `Reached wave ${state.wave} of ${FINAL_WAVE}  •  ${killsLabel(state.kills)}`,
        timeLabel(`${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`),
      ], 'Press SPACE or click to play again', PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      drawPanel('THE LANTERN ENDURES', [
        'The Hollow King is banished. Dawn returns.',
        finalLabel(state.score),
        bestLabel(Math.max(best, state.score)),
        `All ${FINAL_WAVE} waves cleared  •  ${killsLabel(state.kills)}`,
        timeLabel(`${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`),
      ], 'Press SPACE or click to play again', PALETTE.combo);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
