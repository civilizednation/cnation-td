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
- Melee characters do not stop monsters: a monster inside a melee unit's tile (up to `block` at once) moves at `ENGAGE_SLOW` (2/3) and hits it.
  Melee units on the road must stand at least `MELEE_GAP` (3) tiles apart (`canDeploy`); the screen shows the forbidden zone while placing.
- Every hero has a 필살기 (`UNITS[id].ult`) from ★1, ~18–24 s cooldown, starting half charged; ★5 is `ultBoost` (+30% power, −15% cooldown).
  A ready hero's dock card glows and casts on tap. Call it 필살기 in all player-facing text.
- Maps have their own size (`MAPS[id].w/h`): early chapters are smaller (9×9 … 9×12), 9×14 from chapter 4.
- Basic attacks: ranged `RANGED_INTERVAL` 1.2 / `RANGED_POWER` 0.3, melee `MELEE_INTERVAL` 0.7 / `MELEE_POWER` 0.7 of the base numbers;
  skills, 필살기 and heals are not affected. No melee on the road within `GATE_GAP` (3) tiles of a monster gate (`map.gates`).
- Placement: melee on road/grass/forest/bridge; ranged (heroes and soldiers) only on high ground — raised tiles beside the road,
  `MAPS[id].high` of them (6–8), never two edge to edge (`buildMap`).
- Slots: every joined hero may be on the field at once (one of each); soldiers only up to `S.soldierCap` = `CHAPTER_DEFS[].soldiers`
  (3,3,2,2,1…1) + legacy 「지휘관의 위엄」 (`command`, +1 each, max 2). `S.slotFree(def)` / `S.soldierCount()`; HUD shows 👑 heroes and 🪖 soldiers.
- Painted backgrounds (`docs/ART.md`): a map with an entry in `MAP_ART` (js/data.js) shows `art/<map>.webp` in an <img> behind the
  transparent WebGL canvas, placed by `placeArt()` from the guide frame (`artFrame`: map width + 1 tile, 9:16, centred). The tiles then
  become invisible shadow catchers (flat tile tops only); gate arch, crystal dais, trees and water are not drawn (only the gate glow and crystal beam/halo).
  `node tools/make-guides.js` renders `art/guides/<map>.png/.json`; `python3 tools/fit-art.py <map> <file> [--apply]` finds the frame
  inside a painting, writes `art/check/<map>.png` (tile outlines) and installs it. Re-make the guides (and repaint) if a map layout changes.
- Waves use half as many monsters with twice the HP and twice the gold each (`buildChapter`, `spawn`).
- Sound: one Web Audio context (`audioCtx`). Music is fetched and decoded into mono 22 kHz AudioBuffers (`bgm.load`, at most 3 kept) and played
  through gain nodes — <audio>.volume does not work on iPhone. `bgm/*.webm` (Opus) first, `bgm/*.m4a` (AAC copy) when WebM cannot be decoded,
  an <audio> element only if neither decodes. Crossfade 1 s,
  duck to 40% while a battle is paused or a window is open, victory track at the clear, fade to silence on defeat. Music gain = setting × `BGM_SCALE` (0.6); effects × `settings.sfxVol` (0–1, default 1).
  Effects: 35 names, each with a recorded file `sfx/<name>.mp3` listed in `SFX_FILES` (final takes chosen by the owner); `SFX_SYNTH` blips are only a
  fallback. Deaths pick by monster body (`DIE_SOUND`); deaths in one frame are batched (`playDeaths`). `docs/SFX.md` has every name, prompt and length.
  To replace a sound: cut from just before its first clear sound to the target length, fade the tail, level RMS (−16…−20 dBFS, peak ≤ −1 dBFS),
  save mono 96k mp3 as `sfx/<name>.mp3`. The owner may send an iPhone screen recording of Suno: extract the audio, split on silence, read the Suno
  titles from video frames to name each part, start ~0.1 s (≤10% of the clip) before it nears full loudness, then cut the same way. Developer mode applies `D.typicalLegacy(chapter)` instead of the player's legacies.
- `bgm/` and `fonts/` come from cnation TACTICS. After adding or changing in-game text run `python3 tools/subset-fonts.py`
  and bump the `?v=` on the font URLs in index.html, or new characters fall back to the system font.
- Saves: auto save `cnation-td-save-v2` (taken at each battle start), slots `cnation-td-slots-v1` (3), clears `cnation-td-clear-v1`,
  Arca legacies `cnation-td-legacy-v1` = {picks:{chapterIndex: legacyId}}.
- Two bonus kinds, keep them visibly apart: **에테르 축복** (`BLESSINGS`, chosen mid-chapter, this chapter only) and
  **아르카의 유산** (`LEGACIES`, one slot per chapter picked after a clear, permanent and stacking; passed to `createSim` as `legacy` counts).
  The bot (`D.typicalLegacy`) plays each chapter with the legacies an ordinary player would hold, and `diff` is calibrated with them.
- Developer mode (title screen, beta only; to be removed at release): start any chapter, instant win and +500 gold from the in-game menu.

## Checking a change
Serve the folder (`python3 -m http.server`) and drive it with Playwright at a phone viewport (390×780); `window.TD.sim` exposes the simulation.
The battlefield must fill the phone width with no scrolling in portrait.
