# cnation TD (아르카 방어전)

Mobile-first portrait tower defence (Korean) built on the characters, monsters and terrain of cnation TACTICS
(`civilizednation/cnation-ft`). Static site: no build step, no server code. Design document: `docs/GDD.md`.

## Communication
Always write every message to the user in Korean (한국어).

## Files
- `index.html` — shell, all CSS, script tags with `?v=` cache-busting. On every release bump `GAME_VERSION` (js/game.js), the `?v=` tags and `VERSION` in `sw.js` together.
- `manifest.webmanifest`, `sw.js`, `icons/` — home screen install (PWA). The service worker is network-first (music cache-first). `icons/*.png` are a
  placeholder drawn from the game models by `tools/icon.html` + `node tools/make-icons.js`; the owner will supply the final icon — then just replace the PNGs.
- `helpTips()` in js/game.js builds the detailed tips under 「게임 방법」 from the data tables; update its hand-written parts when rules change.
- `js/data.js` — data tables (`SKILLS`, `UNITS`, `MONSTERS`, `MAPS`, `CHAPTERS`, `BOSSES`, `BLESSINGS`). Numbers come from TACTICS where one exists.
- `js/sim.js` — the rules. No DOM; deterministic per seed. Commands: `deploy`, `rankUp`, `withdraw`, `ult`, `startBattle`,
  `chooseBlessing`; it reports through `drain()` events. Shared by the screen and the bot — keep rendering out of it.
- `js/game.js` — three.js battlefield (fixed tilted orthographic top view, so `proj`/`unproj` are plain formulas), 2D overlay canvas
  for bars/ranges/effects, dock, unit panel, modals, saves (`cnation-td-save-v1` = `sim.snapshot()` taken when a battle starts).
- `js/models.js` — model code copied from TACTICS `game.js` (`bake` … `figure`, `makeWaterSurface`) with hooks `u.pal`, `u.hpal`, `u.scale`. Do not hand-edit the copied part.
- `tools/bot.js` — headless balance bot: `node tools/bot.js <chapter|all> <runs> [-v]`. Run it after any balance-relevant change;
  an ordinary build should clear every chapter, usually with 12–20 life left. `node tools/bot.js calibrate [chapter]` searches
  `diff` = [monster HP, monster attack, boss HP] for each chapter in `CHAPTER_DEFS` (js/data.js); copy the result in by hand.
- Chapters are generated from `CHAPTER_DEFS` by `buildChapter` (waves from `POOLS`, roster from `JOIN_AT`). Maps in `MAPS` are grown
  around the road by `sim.buildMap` from each map's seed, so the same map always comes out the same.
- Melee characters do not stop monsters: a monster inside a melee unit's tile (up to `block` at once) moves at `ENGAGE_SLOW` (1/3) and hits it.
- `bgm/` and `fonts/` come from cnation TACTICS. After adding or changing in-game text run `python3 tools/subset-fonts.py`
  and bump the `?v=` on the font URLs in index.html, or new characters fall back to the system font.
- Saves: auto save `cnation-td-save-v2` (taken at each battle start), slots `cnation-td-slots-v1` (3), clears `cnation-td-clear-v1`.
- Developer mode (title screen, beta only; to be removed at release): start any chapter, instant win and +500 gold from the in-game menu.

## Checking a change
Serve the folder (`python3 -m http.server`) and drive it with Playwright at a phone viewport (390×780); `window.TD.sim` exposes the simulation.
The battlefield must fill the phone width with no scrolling in portrait.
