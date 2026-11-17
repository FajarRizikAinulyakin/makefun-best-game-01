# EMBERFALL — Defend the Last Lantern

An entry for make.fun's **best-game-01** ("Make the best game").

![bounty](https://make.fun/api/bounties/best-game-01/badge.svg?owner=FajarRizikAinulyakin&repo=makefun-best-game-01)
![submissions](https://make.fun/api/bounties/best-game-01/submissions/badge.svg?owner=FajarRizikAinulyakin&repo=makefun-best-game-01)
![status](https://make.fun/api/bounties/best-game-01/status/badge.svg?owner=FajarRizikAinulyakin&repo=makefun-best-game-01)

> The shadows are coming for the Last Lantern. You are its Warden. Survive
> **10 waves** of shadow creatures and banish the **Hollow King** — or the
> light goes out.

## Play it

Serve `game/` with any static file server (no build step, no network requests)
and open `game/index.html` in a desktop browser:

```sh
node serve.ts
# then open http://localhost:8080
```

## How to play

| Control | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse | Aim |
| Hold left click | Fire ember bolts |
| Space / Shift | Dash (brief invulnerability, 2 s cooldown) |
| E or right-click | Nova bomb — clears nearby shadows (limited) |
| P / Esc | Pause |
| M | Mute |

## The game

- **Arena shooter, twin-stick style.** Kite, aim, and fire; positioning matters
  as much as shooting.
- **Five enemy kinds, each with its own behaviour:** Wisps chase you,
  Spitters keep their distance and shoot, Brutes soak damage, Splitters break
  into two Wisps, and Dashers telegraph a lunge before striking.
- **A boss:** the Hollow King arrives on wave 10 with radial bullet bursts,
  aimed spreads, summoned minions, and an enraged phase below a third of his
  health. Beating him wins the game.
- **Meaningful choices:** ember gems dropped by kills feed a combo multiplier
  (up to ×5); pickups grant Triple Embers, Rapid Fire, an Aegis shield, hull
  repairs, or extra Nova bombs — grab them or keep your distance, and spend
  your limited Novas on the moment that matters.
- **Escalating waves:** each wave spawns more, faster, tougher enemies, with a
  wave-clear bonus and a small hull repair between waves.
- **Feel and polish:** particles, screen shake, hit flashes, floating score
  text, a low-hull warning, wave banners, synthesized WebAudio sound effects
  and a looping bass line (no audio files), pause, best-score persistence, and
  a live HUD (score, best, wave, hull, bombs, dash, combo, power-up timers,
  boss health bar).
- **Complete loop:** title screen → play → pause → victory or game-over screen,
  each with a restart. Screenshots in `screenshots/` show the whole loop.

## Screenshots

The four screenshots are deterministic renders of the game's own code, staged
with `?shot=<scene>&seed=1` (see `shots.json` and `game/src/shots.js`):

1. `1-start.jpg` — title screen
2. `2-play.jpg` — mid-wave combat with the full HUD
3. `3-boss.jpg` — the Hollow King boss fight
4. `4-end.jpg` — game-over screen with score and restart

## Structure

```
game/
  index.html          page shell (canvas + status line, no external refs)
  src/
    config.js         tuning, palette, enemy definitions, wave table
    random.js         seeded RNG (mulberry32) — repeatable scenes
    audio.js          WebAudio synth: effects + music, no audio files
    input.js          keyboard + mouse, one-shot action flags
    world.js          rules: player, enemies, boss, waves, pickups, scoring
    autopilot.js      the bot that plays the screenshot scenes
    shots.js          deterministic ?shot= staging (start/play/boss/end)
    render.js         all drawing: arena, lantern, HUD, panels
    main.js           boot, fixed-step loop, screens
main.ts               Node 22 program: copies game/ + screenshots/ to /output
                      and writes dossier.json via vendor/makefun-game.ts
vendor/makefun-game.ts  make.fun's dossier library, unchanged from the kit
```

The game is original work written for this bounty: its own name, art (drawn in
code), sounds (synthesized), and rules. It uses only the standard library on
the Node side and no libraries at all in the browser.

## License

MIT — see [LICENSE](LICENSE).
