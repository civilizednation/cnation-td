# cnation TD (아르카 방어전)

Mobile-first portrait tower defence (Korean) built on the characters, monsters and terrain of cnation TACTICS
(`civilizednation/cnation-ft`). Static site: no build step, no server code. Design document: `docs/GDD.md`.

## Communication
Always write every message to the user in Korean (한국어).

## Files
- `index.html` — shell, all CSS, script tags with `?v=` cache-busting (bump with `GAME_VERSION` in `js/game.js`).
- `js/data.js` — data tables (`SKILLS`, `UNITS`, `MONSTERS`, `MAPS`, `CHAPTERS`, `BOSSES`, `BLESSINGS`). Numbers come from TACTICS where one exists.
- `js/sim.js` — the rules. No DOM; deterministic per seed. Commands: `deploy`, `rankUp`, `withdraw`, `ult`, `startBattle`,
  `chooseBlessing`; it reports through `drain()` events. Shared by the screen and the bot — keep rendering out of it.
- `js/game.js` — three.js battlefield (fixed tilted orthographic top view, so `proj`/`unproj` are plain formulas), 2D overlay canvas
  for bars/ranges/effects, dock, unit panel, modals, saves (`cnation-td-save-v1` = `sim.snapshot()` taken when a battle starts).
- `js/models.js` — model code copied from TACTICS `game.js` (`bake` … `figure`, `makeWaterSurface`) with hooks `u.pal`, `u.hpal`, `u.scale`. Do not hand-edit the copied part.
- `tools/bot.js` — headless balance bot: `node tools/bot.js <chapter> <runs>`. Run it after any balance-relevant change;
  an ordinary build should clear every chapter, with the prologue ending around 13–19 life.

## Checking a change
Serve the folder (`python3 -m http.server`) and drive it with Playwright at a phone viewport (390×780); `window.TD.sim` exposes the simulation.
The battlefield must fill the phone width with no scrolling in portrait.
