// EMBERFALL's rules and state, with no drawing and no browser in it: the player,
// the enemies and their behaviours, bullets, pickups, waves and the Hollow King
// boss, collisions, score, combo and win/lose. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react (sounds, banners)
// without the world knowing about screens. Pools are allocated once, at boot.
import {
  BOMB, DROP, ENEMY, FIELD, FINAL_WAVE, PICKUP, PLAYER, spawnBurst, spawnInterval, waveComposition,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_PICKUP = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_WAVE = 32;
export const EVENT_BOSS = 64;
export const EVENT_BOMB = 128;
export const EVENT_DASH = 256;

const ENEMY_POOL = 96;
const BULLET_POOL = 320;
const PICKUP_POOL = 64;
const PARTICLE_POOL = 320;
const FLOATER_POOL = 32;

function overlaps(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy < r * r;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2 + 140, radius: PLAYER.radius,
    hp: PLAYER.maxHp, shieldTime: 0, spreadTime: 0, rapidTime: 0,
    dashTime: 0, dashCooldown: 0, invulnerable: 0, aimAngle: -Math.PI / 2,
    fireTimer: 0, bombs: PLAYER.startBombs, alive: true,
  };
  const enemies = [];
  for (let i = 0; i < ENEMY_POOL; i += 1) {
    enemies.push({
      active: false, kind: 'wisp', x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1,
      radius: 15, speed: 100, score: 50, shootTimer: 0, state: 0, timer: 0,
      tx: 0, ty: 0, flash: 0,
    });
  }
  const bullets = [];
  for (let i = 0; i < BULLET_POOL; i += 1) {
    bullets.push({ active: false, friendly: true, x: 0, y: 0, vx: 0, vy: 0, radius: 5, damage: 1 });
  }
  const pickups = [];
  for (let i = 0; i < PICKUP_POOL; i += 1) {
    pickups.push({ active: false, kind: 'ember', x: 0, y: 0, vx: 0, vy: 0, timer: 0 });
  }
  const particles = [];
  for (let i = 0; i < PARTICLE_POOL; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, color: '#fff' });
  }
  const floaters = [];
  for (let i = 0; i < FLOATER_POOL; i += 1) {
    floaters.push({ active: false, x: 0, y: 0, life: 0, text: '', color: '#fff' });
  }
  const motes = [];
  for (let i = 0; i < 42; i += 1) {
    motes.push({
      x: random() * FIELD.width, y: random() * FIELD.height,
      speed: 6 + random() * 14, size: 1 + random() * 2.5, phase: random() * Math.PI * 2,
    });
  }

  const state = {
    player, enemies, bullets, pickups, particles, floaters, motes,
    score: 0, best: 0, combo: 1, chain: 0, comboTimer: 0, kills: 0,
    wave: 0, waveState: 'intermission', spawnQueue: [], spawnTimer: 0,
    intermissionTimer: 1.6, banner: { text: 'EMBERFALL', sub: '', time: 0 },
    shake: 0, time: 0, elapsed: 0, gems: 0, boss: null, bossHp: 0, bossMaxHp: 1,
  };

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }
  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (!p) return;
      const a = random() * Math.PI * 2;
      const s = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.maxLife = 0.35 + random() * 0.4;
      p.life = p.maxLife;
      p.size = 2 + random() * 4;
      p.color = color;
    }
  }
  function floater(x, y, text, color) {
    const f = free(floaters);
    if (!f) return;
    f.active = true; f.x = x; f.y = y; f.life = 1; f.text = text; f.color = color;
  }
  function addScore(base, x, y) {
    const gained = base * state.combo;
    state.score += gained;
    floater(x, y, `+${gained}`, '#ffe08a');
    return gained;
  }

  function spawnEnemy(kind, x, y) {
    const e = free(enemies);
    if (!e) return null;
    const def = ENEMY[kind];
    const scale = 1 + (state.wave - 1) * 0.07;
    e.active = true;
    e.kind = kind;
    e.x = x; e.y = y;
    e.vx = 0; e.vy = 0;
    e.maxHp = Math.round(def.hp * (kind === 'boss' ? 1 + state.wave * 0.05 : scale));
    e.hp = e.maxHp;
    e.radius = def.radius;
    e.speed = def.speed * (1 + (state.wave - 1) * 0.03);
    e.score = def.score;
    e.shootTimer = 1 + random() * 1.5;
    e.state = 0;
    e.timer = 0.5 + random();
    e.flash = 0;
    if (kind === 'boss') {
      state.boss = e;
      state.bossMaxHp = e.maxHp;
      state.bossHp = e.hp;
    }
    return e;
  }

  function spawnAtEdge(kind) {
    const side = Math.floor(random() * 4);
    const m = 40;
    let x; let y;
    if (side === 0) { x = m + random() * (FIELD.width - 2 * m); y = -30; }
    else if (side === 1) { x = m + random() * (FIELD.width - 2 * m); y = FIELD.height + 30; }
    else if (side === 2) { x = -30; y = m + random() * (FIELD.height - 2 * m); }
    else { x = FIELD.width + 30; y = m + random() * (FIELD.height - 2 * m); }
    // Never spawn on top of the player.
    if (overlaps(x, y, 30, player.x, player.y, 90)) { x = FIELD.width - x; y = FIELD.height - y; }
    return spawnEnemy(kind, x, y);
  }

  function buildQueue(wave) {
    const comp = waveComposition(wave);
    const queue = [];
    for (const [kind, count] of Object.entries(comp)) {
      for (let i = 0; i < count; i += 1) queue.push(kind);
    }
    // Boss first, so the wave's climax is on screen from the start.
    queue.sort((a, b) => (a === 'boss' ? -1 : 0) - (b === 'boss' ? -1 : 0));
    for (let i = queue.length - 1; i > 0; i -= 1) {
      if (queue[i] === 'boss' || queue[0] === 'boss') continue;
      const j = 1 + Math.floor(random() * i);
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue;
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = buildQueue(wave);
    state.spawnTimer = 0.4;
    state.waveState = 'spawning';
    const isBoss = wave === FINAL_WAVE;
    state.banner = {
      text: isBoss ? 'THE HOLLOW KING' : `WAVE ${wave}`,
      sub: isBoss ? 'Defeat him to save the lantern' : `Wave ${wave} of ${FINAL_WAVE}`,
      time: 2.4,
    };
    if (isBoss) return EVENT_BOSS;
    return EVENT_WAVE;
  }

  function dropPickup(x, y) {
    if (random() < 0.6) {
      const g = free(pickups);
      if (g) {
        g.active = true; g.kind = 'ember';
        g.x = x + (random() - 0.5) * 30; g.y = y + (random() - 0.5) * 30;
        g.vx = (random() - 0.5) * 60; g.vy = (random() - 0.5) * 60; g.timer = 9;
      }
    }
    const roll = random();
    let kind = null;
    if (roll < DROP.heart) kind = 'heart';
    else if (roll < DROP.heart + DROP.shield) kind = 'shield';
    else if (roll < DROP.heart + DROP.shield + DROP.spread) kind = 'spread';
    else if (roll < DROP.heart + DROP.shield + DROP.spread + DROP.rapid) kind = 'rapid';
    else if (roll < DROP.heart + DROP.shield + DROP.spread + DROP.rapid + DROP.bomb) kind = 'bomb';
    if (kind) {
      const p = free(pickups);
      if (p) {
        p.active = true; p.kind = kind;
        p.x = x; p.y = y;
        p.vx = (random() - 0.5) * 40; p.vy = (random() - 0.5) * 40; p.timer = 11;
      }
    }
  }

  function killEnemy(e) {
    e.active = false;
    state.kills += 1;
    state.chain += 1;
    state.comboTimer = 2.5;
    state.combo = Math.min(5, 1 + Math.floor(state.chain / 4));
    addScore(e.score, e.x, e.y);
    burst(e.x, e.y, ENEMY[e.kind].color, e.kind === 'boss' ? 60 : e.kind === 'brute' ? 26 : 14, 260);
    state.shake = Math.max(state.shake, e.kind === 'boss' ? 14 : 5);
    if (e.kind === 'splitter') {
      spawnEnemy('wisp', e.x - 18, e.y);
      spawnEnemy('wisp', e.x + 18, e.y);
    }
    if (e.kind === 'boss') {
      state.boss = null;
      dropPickup(e.x, e.y);
      dropPickup(e.x - 40, e.y + 20);
      dropPickup(e.x + 40, e.y + 20);
      return EVENT_WIN;
    }
    dropPickup(e.x, e.y);
    return EVENT_KILL;
  }

  function fireBullet(x, y, angle, speed, friendly, damage, radius) {
    const b = free(bullets);
    if (!b) return;
    b.active = true;
    b.friendly = friendly;
    b.x = x; b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.damage = damage;
    b.radius = radius;
  }

  function hurtPlayer(damage, x, y) {
    if (!player.alive || player.invulnerable > 0 || player.dashTime > 0) return 0;
    if (player.shieldTime > 0) {
      burst(x, y, '#7dffce', 8, 160);
      return EVENT_HIT;
    }
    player.hp -= damage;
    player.invulnerable = PLAYER.hitInvulnerable;
    state.shake = Math.max(state.shake, 9);
    state.chain = 0;
    state.combo = 1;
    burst(player.x, player.y, '#ff5a4e', 16, 240);
    if (player.hp <= 0) {
      player.hp = 0;
      player.alive = false;
      burst(player.x, player.y, '#ffd166', 50, 380);
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function useBomb() {
    if (player.bombs <= 0 || !player.alive) return 0;
    player.bombs -= 1;
    let events = EVENT_BOMB;
    burst(player.x, player.y, '#ffb347', 40, 420);
    state.shake = 14;
    for (const b of bullets) if (b.active && !b.friendly) b.active = false;
    for (const e of enemies) {
      if (!e.active || e.kind === 'boss') continue;
      if (overlaps(e.x, e.y, e.radius, player.x, player.y, BOMB.radius)) {
        e.hp -= BOMB.damage;
        e.flash = 0.15;
        if (e.hp <= 0) events |= killEnemy(e);
      }
    }
    if (state.boss && state.boss.active) {
      state.boss.hp -= 2;
      state.boss.flash = 0.15;
      state.bossHp = state.boss.hp;
      if (state.boss.hp <= 0) events |= killEnemy(state.boss);
    }
    return events;
  }

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2 + 140;
    player.hp = PLAYER.maxHp;
    player.shieldTime = 0;
    player.spreadTime = 0;
    player.rapidTime = 0;
    player.dashTime = 0;
    player.dashCooldown = 0;
    player.invulnerable = 0;
    player.aimAngle = -Math.PI / 2;
    player.fireTimer = 0;
    player.bombs = PLAYER.startBombs;
    player.alive = true;
    for (const e of enemies) e.active = false;
    for (const b of bullets) b.active = false;
    for (const p of pickups) p.active = false;
    for (const p of particles) p.active = false;
    for (const f of floaters) f.active = false;
    state.score = 0;
    state.combo = 1;
    state.chain = 0;
    state.comboTimer = 0;
    state.kills = 0;
    state.wave = 0;
    state.waveState = 'intermission';
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.intermissionTimer = 1.6;
    state.banner = { text: 'EMBERFALL', sub: '', time: 0 };
    state.shake = 0;
    state.time = 0;
    state.elapsed = 0;
    state.gems = 0;
    state.boss = null;
    state.bossHp = 0;
    state.bossMaxHp = 1;
  }

  /** Jump straight to the final wave with the boss on screen (screenshot staging). */
  function stageBoss() {
    reset();
    state.score = 5230;
    state.kills = 87;
    state.elapsed = 412;
    startWave(FINAL_WAVE);
    state.spawnQueue = [];
    state.waveState = 'fighting';
    spawnEnemy('boss', FIELD.width / 2, 150);
    spawnEnemy('wisp', 240, 180);
    spawnEnemy('spitter', 1020, 200);
    spawnEnemy('dasher', 900, 540);
    player.x = FIELD.width / 2;
    player.y = FIELD.height - 150;
    player.aimAngle = -Math.PI / 2;
  }

  function step(dt, input, harmless) {
    let events = 0;
    state.time += dt;
    if (state.banner.time > 0) state.banner.time -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
    for (const m of motes) {
      m.y -= m.speed * dt;
      m.phase += dt;
      if (m.y < -4) { m.y = FIELD.height + 4; m.x = random() * FIELD.width; }
    }
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    for (const f of floaters) {
      if (!f.active) continue;
      f.life -= dt * 0.8;
      f.y -= 34 * dt;
      if (f.life <= 0) f.active = false;
    }
    if (harmless) {
      // Title backdrop: a few wisps drift, nothing can hurt or score.
      if (state.waveState === 'intermission' && random() < 0.02) spawnAtEdge('wisp');
      for (const e of enemies) {
        if (!e.active) continue;
        e.y += 26 * dt;
        e.x += Math.sin(state.time + e.y * 0.01) * 12 * dt;
        if (e.y > FIELD.height + 40) e.active = false;
      }
      return 0;
    }
    if (!player.alive) return events;
    state.elapsed += dt;

    // Combo decay.
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) { state.chain = 0; state.combo = 1; }
    }
    // Power-up timers.
    if (player.shieldTime > 0) player.shieldTime -= dt;
    if (player.spreadTime > 0) player.spreadTime -= dt;
    if (player.rapidTime > 0) player.rapidTime -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.dashCooldown > 0) player.dashCooldown -= dt;

    // --- Waves ---
    if (state.waveState === 'intermission') {
      state.intermissionTimer -= dt;
      if (state.intermissionTimer <= 0) events |= startWave(state.wave + 1);
    } else if (state.waveState === 'spawning') {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && state.spawnQueue.length > 0) {
        const burst = spawnBurst(state.wave);
        for (let k = 0; k < burst && state.spawnQueue.length > 0; k += 1) {
          spawnAtEdge(state.spawnQueue.shift());
        }
        state.spawnTimer = spawnInterval(state.wave);
        if (state.spawnQueue.length === 0) state.waveState = 'fighting';
      }
    } else if (state.waveState === 'fighting') {
      let any = false;
      for (const e of enemies) if (e.active) { any = true; break; }
      if (!any) {
        const bonus = 100 * state.wave;
        state.score += bonus;
        floater(FIELD.width / 2, FIELD.height / 2 - 60, `WAVE CLEAR +${bonus}`, '#7dffce');
        player.hp = Math.min(PLAYER.maxHp, player.hp + 10);
        state.waveState = 'intermission';
        state.intermissionTimer = 2.6;
        state.banner = { text: `WAVE ${state.wave} CLEAR`, sub: `Bonus +${bonus}  •  +10 hull`, time: 2.2 };
        events |= EVENT_WAVE;
      }
    }

    // --- Player movement, dash, aim, fire ---
    const mx = input?.mx ?? 0;
    const my = input?.my ?? 0;
    if (input?.dash && player.dashCooldown <= 0 && (mx !== 0 || my !== 0)) {
      player.dashTime = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown;
      player.invulnerable = Math.max(player.invulnerable, PLAYER.dashTime + 0.08);
      burst(player.x, player.y, '#ffd166', 10, 180);
      events |= EVENT_DASH;
    }
    if (input?.bomb) events |= useBomb();
    const dashing = player.dashTime > 0;
    if (dashing) player.dashTime -= dt;
    const speed = PLAYER.speed * (dashing ? PLAYER.dashSpeed : 1);
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + mx * speed * dt));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + my * speed * dt));
    if (input) player.aimAngle = Math.atan2(input.aimY - player.y, input.aimX - player.x);
    player.fireTimer -= dt;
    if (input?.firing && player.fireTimer <= 0) {
      const interval = PLAYER.fireInterval * (player.rapidTime > 0 ? 0.55 : 1);
      player.fireTimer = interval;
      const spread = player.spreadTime > 0;
      const angles = spread ? [-0.22, 0, 0.22] : [0];
      for (const off of angles) {
        fireBullet(
          player.x + Math.cos(player.aimAngle) * 22,
          player.y + Math.sin(player.aimAngle) * 22,
          player.aimAngle + off, PLAYER.bulletSpeed, true, PLAYER.bulletDamage, 5,
        );
      }
    }

    // --- Enemies ---
    for (const e of enemies) {
      if (!e.active) continue;
      if (e.flash > 0) e.flash -= dt;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      e.timer -= dt;
      if (e.kind === 'wisp' || e.kind === 'splitter') {
        e.vx += nx * e.speed * 3 * dt;
        e.vy += ny * e.speed * 3 * dt;
        const sp = Math.hypot(e.vx, e.vy) || 1;
        const cap = e.speed;
        e.vx = (e.vx / sp) * Math.min(sp, cap);
        e.vy = (e.vy / sp) * Math.min(sp, cap);
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      } else if (e.kind === 'spitter') {
        const want = 260;
        const dir = dist > want + 40 ? 1 : dist < want - 40 ? -1 : 0;
        e.x += nx * dir * e.speed * dt;
        e.y += ny * dir * e.speed * dt;
        e.x += -ny * Math.sin(state.time * 0.8 + e.y) * 20 * dt;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && dist < 560) {
          e.shootTimer = 2.3;
          fireBullet(e.x, e.y, Math.atan2(dy, dx), 230, false, 1, 7);
        }
      } else if (e.kind === 'brute') {
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;
      } else if (e.kind === 'dasher') {
        // state 0 approach, 1 telegraph, 2 lunge, 3 recover.
        if (e.state === 0) {
          e.x += nx * e.speed * dt;
          e.y += ny * e.speed * dt;
          if (e.timer <= 0 && dist < 340) { e.state = 1; e.timer = 0.5; e.tx = nx; e.ty = ny; }
        } else if (e.state === 1) {
          if (e.timer <= 0) { e.state = 2; e.timer = 0.42; }
        } else if (e.state === 2) {
          e.x += e.tx * 520 * dt;
          e.y += e.ty * 520 * dt;
          if (e.timer <= 0) { e.state = 3; e.timer = 0.9; }
        } else if (e.timer <= 0) {
          e.state = 0;
          e.timer = 0.8 + random();
        }
      } else if (e.kind === 'boss') {
        const frac = e.hp / e.maxHp;
        const enraged = frac < 0.33;
        e.x += nx * e.speed * (enraged ? 1.5 : 1) * dt;
        e.y += ny * e.speed * (enraged ? 1.5 : 1) * dt;
        state.bossHp = e.hp;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = enraged ? 1.5 : 2.4;
          const base = Math.atan2(dy, dx);
          for (let i = 0; i < 8; i += 1) {
            fireBullet(e.x, e.y, base + (i / 8) * Math.PI * 2, 190, false, 1, 8);
          }
          fireBullet(e.x, e.y, base - 0.25, 260, false, 1, 8);
          fireBullet(e.x, e.y, base, 260, false, 1, 8);
          fireBullet(e.x, e.y, base + 0.25, 260, false, 1, 8);
        }
        if (e.timer <= 0) {
          e.timer = enraged ? 4.5 : 6.5;
          let summoned = 0;
          for (let i = 0; i < 3 && summoned < 3; i += 1) {
            if (spawnEnemy('wisp', e.x + (random() - 0.5) * 160, e.y + (random() - 0.5) * 160)) summoned += 1;
          }
        }
      }
      // Keep inside the arena (boss and brutes push in from the edge spawn).
      e.x = Math.min(FIELD.width + 60, Math.max(-60, e.x));
      e.y = Math.min(FIELD.height + 60, Math.max(-60, e.y));
      // Contact damage.
      const contact = e.kind === 'brute' ? 22 : e.kind === 'boss' ? 25 : e.kind === 'dasher' && e.state === 2 ? 16 : 12;
      if (overlaps(e.x, e.y, e.radius, player.x, player.y, player.radius)) {
        const ev = hurtPlayer(contact, e.x, e.y);
        events |= ev;
        if (ev & EVENT_OVER) return events;
        // A wisp that hits is spent; bigger foes bounce off.
        if (e.kind === 'wisp') {
          e.active = false;
          burst(e.x, e.y, ENEMY.wisp.color, 10, 200);
        } else {
          e.x -= nx * 30;
          e.y -= ny * 30;
        }
      }
    }

    // --- Bullets ---
    for (const b of bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      if (b.friendly) {
        for (const e of enemies) {
          if (!e.active) continue;
          if (overlaps(b.x, b.y, b.radius, e.x, e.y, e.radius)) {
            b.active = false;
            e.hp -= b.damage;
            e.flash = 0.08;
            burst(b.x, b.y, '#ffe08a', 3, 120);
            if (e.hp <= 0) {
              const ev = killEnemy(e);
              events |= ev;
              if (ev & EVENT_WIN) return events;
            }
            break;
          }
        }
      } else if (overlaps(b.x, b.y, b.radius, player.x, player.y, player.radius)) {
        b.active = false;
        const ev = hurtPlayer(12, b.x, b.y);
        events |= ev;
        if (ev & EVENT_OVER) return events;
      }
    }

    // --- Pickups ---
    for (const p of pickups) {
      if (!p.active) continue;
      p.timer -= dt;
      if (p.timer <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (p.kind === 'ember' && dist < PICKUP.ember.magnet) {
        p.x += (dx / dist) * 320 * dt;
        p.y += (dy / dist) * 320 * dt;
      }
      if (dist < player.radius + 14) {
        p.active = false;
        events |= EVENT_PICKUP;
        if (p.kind === 'ember') {
          state.gems += 1;
          addScore(PICKUP.ember.score, p.x, p.y);
        } else if (p.kind === 'heart') {
          player.hp = Math.min(PLAYER.maxHp, player.hp + PICKUP.heart.heal);
          floater(p.x, p.y, `+${PICKUP.heart.heal} HULL`, '#5ee6a0');
        } else if (p.kind === 'shield') {
          player.shieldTime = PICKUP.shield.seconds;
          floater(p.x, p.y, 'AEGIS SHIELD', '#7dffce');
        } else if (p.kind === 'spread') {
          player.spreadTime = PICKUP.spread.seconds;
          floater(p.x, p.y, 'TRIPLE EMBERS', '#ffd166');
        } else if (p.kind === 'rapid') {
          player.rapidTime = PICKUP.rapid.seconds;
          floater(p.x, p.y, 'RAPID FIRE', '#ffd166');
        } else if (p.kind === 'bomb') {
          player.bombs += PICKUP.bomb.count;
          floater(p.x, p.y, '+1 NOVA', '#ff9d2e');
        }
        burst(p.x, p.y, '#ffd166', 8, 160);
      }
    }
    return events;
  }

  reset();
  return { state, reset, step, startWave, stageBoss, useBomb };
}
