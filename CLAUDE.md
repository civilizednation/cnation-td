# cnation TD (아르카 방어전)

Mobile-first portrait tower defence (Korean) built on the characters, monsters and terrain of cnation TACTICS
(`civilizednation/cnation-ft`). Static site: no build step, no server code. Design document: `docs/GDD.md`.

## Communication
Always write every message to the user in Korean (한국어).

## Releasing
Unless the owner says otherwise, every finished change is committed, pushed to the working branch and fast-forward merged to
`main` (Vercel deploys main).

## Files
- `index.html` — shell, all CSS, script tags with `?v=` cache-busting.
  `#app` is `position:fixed` to all four edges (not `100dvh`) and the page is pinned at 0,0 (`pinPage`/`settle` in game.js): iOS
  home-screen apps could leave the page offset by the status bar, pushing the dock off screen.
- Versioning (from 1.0.0, the first complete release): a big change bumps the second digit (1.1.0), a small change or fix bumps the
  third (1.0.1). On every release update together: `GAME_VERSION` (js/game.js), the `?v=` tags in index.html, `VERSION` in `sw.js`,
  README, and `revisions.html` — add a new `<section class="rev" id="vX.Y.Z">` at the top (date, 수정/변경/밸런스 bullets in Korean,
  player-facing words only) and move the `현재` tag to it. The title screen shows `ver.X.Y.Z (rev. history)` at the bottom; the link
  opens revisions.html inside the game (`showRevisions`, iframe; its back link posts `td:close-revisions`).
- Landscape (`orientation:landscape` and ≥640px wide): grid with the battlefield left and `#side` (strip, panel, dock) right; portrait
  phones keep the single column (`#side{display:contents}`). Painted maps also fill empty space with a blurred copy (`#artBlur`).
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
- 필살기 power (1.2.0): arcaslash 5, meteor 4.5, eclipse 6, hawk 12 — area 필살기 take over half a normal monster's HP, hawk one-shots it;
  bosses take full damage and boss HP is calibrated for that. Ult damage events carry `ult`/`pct`; the screen shows a landing reticle
  (`target`), impact flash/cracks/debris (`impact`, `flash2`), a short hit stop (`hitStop`) and bursts with big popping numbers on struck monsters.
- Soldier attack and magic are multiplied by `SOLDIER_POWER` (3.2, in `legacyScale`, so sim and the clear summary agree); soldiers have
  no extra abilities by the owner's choice. Target: a soldier deals ~20–30% of a damage hero's damage.
- Soldiers use their own models (`model:{soldierId}` → `soldierParts` in models.js, a TD-only hook), not recoloured heroes.
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
  `MAPS[id].noHigh` turns listed high cells back into grass after the map is grown (rest of the map unchanged) — used where a painting hides a cell (tower: behind the crystal).
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
- Chapter clear (`clearFlow` in game.js): pages 결산 → 유산 (`legacyModal`) → 다음 장 준비 → 마무리 (3 pages on FINAL). Uses `S.stats`
  (dealt/healedBy per unit, ults, goldEarned/goldSpent, battle time; kept in the snapshot) and `D.unitStats`/`D.legacyScale` (the same
  legacy formula sim.refresh uses). Best record per chapter: `cnation-td-records-v1` = {chapterId:{stars,life,time,kills}}.
- Title (1.6.0): attract mode (`demo` in game.js) — a real battle on a painted map of an opened chapter plays behind the transparent
  title modal (`#app.title #viewport` fills the screen), auto-deployed with ranks 3, 필살기 now and then, restarted when it ends.
  While `demo.on`: no sfx except ui_*, no toast/banner, events in `DEMO_SKIP` ignored (no saves/results), gate and crystal labels hidden.
  Title type scale: logo 40, tagline 18, buttons 16, small 12; menu = 게임 시작 (gold) / 이어하기, three round SVG icon buttons, footer.
  `art/title.webp` (ruins + crystal) is no longer used on the title; kept for a future loading/ending screen.
- iOS home-screen apps: status bar style is `black` (opaque), so iOS lays the page out below the status bar with the right height
  and #app simply fills the viewport. With `black-translucent` every sizing trick (bottom:0, 100lvh, +safe-area-inset-top, screen.height)
  was off by the status bar on a real iPhone (1.5–1.6.3). `fitApp()` is now a no-op kept for the resize hook.
- Painting first (1.6.1, 1.6.5): `waitArt`/`onArt` in game.js — while a map painting loads, `#app.artwait` hides the 3D canvas, effects,
  HUD, dock and title menu, with no timeout (a slow network waits). `loading` = the 「데이터 불러오는 중…」 overlay (`#loading` in index.html,
  visible from first paint under key 'boot' until the first painting): `begin/end/wait(key,promise,cap)`, shown after 120 ms, plus a
  slow-network line after 6 s. Used by waitArt, `paintFirst` (world map/altar), the title demo (loads the next map's painting with
  `loadImg` before switching) and chapter start (battle music, 8 s cap). `preloadArt` fetches the rest; sw.js serves `art/` cache-first.
- Title menu (1.7.0): with a save 「▶ 전투 계속하기」 (gold, chapter + battle n/N) + 「🗺 모험 지도」; without a save 「🗺 모험 지도」 only;
  a brand-new player 「⚔ 모험 시작」 (straight into the prologue). Icons: 저장 슬롯 (load), 소리, 게임 방법. `chapterInfo` offers
  「전투 계속하기」/「처음부터 다시」 when the auto save is in that chapter.
- Monster HP bars: a pale trail shows the part just lost (held 0.45 s, then drains) and the bar flashes; a 필살기 holds the bar until
  its impact (`hold`). Damage areas work on every monster in range (checked: 파이어 hits all of a cluster for ~16–30% of max HP each). Clear wrap-up, defeat and the
  in-game menu have 지도로 (`toWorld`). The altar view pauses a running battle (sets `modalOpen`).
- World map chapter select (`showWorld`/`chapterInfo` in game.js, `#world` z15 under the modal): `WORLD_MAP` in data.js = painting file
  (null → placeholder gradient + dotted path) and the ten stops as [x%,y%]. Stops show number, stars, lock, the chapter's legacy badge
  and Kyle on the current chapter; cleared segments glow. Developer mode keeps the plain list (`chapterList(true)`).
  Painted: `art/world.webp` (stops measured from its pedestals; cleared segments are not drawn over a painting). On the painting
  (`.wstop.painted`) nothing is drawn but text: number and name in the region's `WORLD_MAP.ink` colour with a dark stroke, black-outlined
  stars (missing ones dark), locked = a lock only, legacy icon beside the pedestal. Sizes are in `cqw` (.wmap is a size container): the
  pedestal top is ~10.5cqw × 4.8cqw and the number (5.6cqw) / lock (3.6cqw) fit inside it.
  Legacy view: with `ALTAR.file` (`art/altar.webp`) a full-screen `altarView` (`#altar` z16) puts each chapter's legacy in its socket
  (`ALTAR.sockets` [x%,y%]) and the totals (`D.legacyTotal(id,n)`) on the floor panel; without it the old modal list. Prompts in docs/ART.md.
- No dialogue in play (owner's choice, 1.6.3): chapter start shows a banner, the boss battle a one-line hint toast; `dialogue()` and
  the intro/bossIntro/outro texts in data.js are unused.
- Two bonus kinds, keep them visibly apart: **에테르 축복** (`BLESSINGS`, chosen mid-chapter, this chapter only) and
  **아르카의 유산** (`LEGACIES`, one slot per chapter picked after a clear, permanent and stacking; passed to `createSim` as `legacy` counts).
  The bot (`D.typicalLegacy`) plays each chapter with the legacies an ordinary player would hold, and `diff` is calibrated with them.
- Developer mode (title screen): kept for testing after 1.0.0 by the owner's choice — start any chapter, instant win and +500 gold from the in-game menu.

## Checking a change
Serve the folder (`python3 -m http.server`) and drive it with Playwright at a phone viewport (390×780); `window.TD.sim` exposes the simulation.
The battlefield must fill the phone width with no scrolling in portrait.
