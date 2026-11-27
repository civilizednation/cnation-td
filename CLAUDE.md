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
- Versioning (from 1.0.0, the first complete release): bump the third digit (1.6.8 → 1.6.9) for every release by default. Bump the
  second digit (1.7.0) only when the owner says the change is a big one. On every release update together: `GAME_VERSION` (js/game.js), the `?v=` tags in index.html, `VERSION` in `sw.js`,
  README, and `revisions.html` — add a new `<section class="rev" id="vX.Y.Z">` at the top (date, 수정/변경/밸런스 bullets in Korean,
  player-facing words only) and move the `현재` tag to it. The title screen shows `ver.X.Y.Z (rev. history)` at the bottom; the link
  opens revisions.html inside the game (`showRevisions`, iframe; its back link posts `td:close-revisions`).
- Landscape (`orientation:landscape` and ≥640px wide): grid with the battlefield left and `#side` (strip, panel, dock) right; portrait
  phones keep the single column (`#side{display:contents}`). Painted maps also fill empty space with a blurred copy (`#artBlur`).
- `manifest.webmanifest`, `sw.js`, `icons/` — home screen install (PWA). The service worker is network-first (music cache-first). `icons/*.png` are the owner's final
  icon (1.7.31: Kyle with sword, shield and crystal tower; 512/192/180/64, 256-colour PNG; maskable = same full-bleed art). `tools/icon.html`
  + `node tools/make-icons.js` made the old placeholder and are no longer used. Bump the `?v=` on the icon links in index.html when replacing.
- `helpTips()` in js/game.js builds the detailed tips under 「게임 방법」 from the data tables; update its hand-written parts when rules change.
  Heroes use `heroTips(id)` (1.7.7): 필살기 block (power/area/reach/charge/element choices from ult+basic+rank skills, imprint additions),
  per-rank skills (`skillOf`), and each ★3 imprint with the skill it gives and the 필살기 element it adds; `heroGuideIntro` explains units.
- `js/data.js` — data tables (`SKILLS`, `UNITS`, `MONSTERS`, `MAPS`, `CHAPTERS`, `BOSSES`, `BLESSINGS`). Numbers come from TACTICS where one exists.
- `js/sim.js` — the rules. No DOM; deterministic per seed. Commands: `deploy`, `rankUp`, `withdraw`, `ult`, `startBattle`,
  `chooseBlessing`; it reports through `drain()` events. Shared by the screen and the bot — keep rendering out of it.
- `js/game.js` — three.js battlefield (fixed tilted orthographic top view, so `proj`/`unproj` are plain formulas), 2D overlay canvas
  for bars/ranges/effects, dock, unit panel, modals, saves (`cnation-td-save-v1` = `sim.snapshot()` taken when a battle starts).
- `js/models.js` — model code copied from TACTICS `game.js` (`bake` … `figure`, `makeWaterSurface`) with hooks `u.pal`, `u.hpal`, `u.scale`. Do not hand-edit the copied part.
- Owner's standing request: whenever bot results are reported, give not only wins but life left (mean, min–max) and stars (mean and
  ★3/★2/★1/fail counts, same rule as the clear screen: no leak ★3, life ≥ 75% of base ★2, clear ★1) — `tools/bot.js` prints them per
  chapter (`└` line) and in total (합계); `tools/strategy.js` adds 별 평균.
- `tools/survey.js [runs=30] [chapters]` (1.7.32; `BOTS=고수,중수` picks bots): 고수 (STRAT `ult:'expert'` — densest-cluster meteor, holds 필살기 for
  crowds / elites / leak threats and chains them), 중수 (sound placement but 필살기 at once, first element, ignores 명당/수정 조각) and 초보 (bad
  habits) × every chapter, 4 processes; prints wins, life and stars. Owner's targets (1.7.33, life 10): expert ★3 rate 프롤로그 80% · 1장 60% →
  falling evenly to FINAL 20%; middle bot wins ~80% with about half its life left; novice is reported only.
  `tools/tune.js` fits `diff` (HP for the expert target, attack for the middle-bot target, HP again; `DIFF` env multiplies diffs in bot.js).
  Results are noisy (±10–15%p per chapter at 30 runs; the tuner's 20-run fits did not hold up, so finish by hand from full surveys) and
  ★3 flips on single leaks — inspect leaks with `-v` (a structural leak = fix the cause, not HP). Results: docs/survey-1.7.31.txt,
  docs/survey-1.7.32.txt (life 20), docs/survey-1.7.33.txt (life 10). Elites appear from the 4th battle (1.7.32).
- `tools/bot.js` — headless balance bot: `node tools/bot.js <chapter|all> <runs> [-v]`. Run it after any balance-relevant change;
  an ordinary build should clear every chapter (life is 10 since 1.7.33; 수정 강화 legacy +2, 수정의 가호 blessing +3). `node tools/bot.js calibrate [chapter]` searches
  `diff` = [monster HP, monster attack, boss HP] for each chapter in `CHAPTER_DEFS` (js/data.js); copy the result in by hand.
- Chapters are generated from `CHAPTER_DEFS` by `buildChapter` (waves from `POOLS`, roster from `JOIN_AT`). Maps in `MAPS` are grown
  around the road by `sim.buildMap` from each map's seed, so the same map always comes out the same.
- Melee characters do not stop monsters: a monster inside a melee unit's tile (up to `block` at once) moves at `ENGAGE_SLOW` (2/3) and hits it.
  Melee units on the road must stand at least `MELEE_GAP` (5) tiles apart counted ALONG the road (`roadGap` in sim.js: difference of
  distance along a shared path, else BFS over road tiles; 1.7.5 — a straight-line radius blocked the parallel bends); the screen marks the
  forbidden road tiles with X while placing (no circle).
- Hit timing (1.7.12): damage lands when the visual arrives — `later(delay,fn)` queues it in `S.pending` (cleared at prep): `FLIGHT`
  meteor .5 s, bolt .12, blast/shot .14 (area victims are picked at impact), ranged basic attacks `SHOT_FLIGHT` .17, monster shots .2.
  The screen therefore needs no bar hold; the meteor's visual delay is divided by the game speed so it stays in step.
- 필살기 (1.7.0, the core of play): power arcaslash 8, meteor 7.2, eclipse 9.6, hawk 19 (×1.6 of 1.2.0); bosses take full damage. Ult damage events
  carry `ult`/`pct`/`aff` (the affinity share, shown as a second number) / `element` / `chain`; the screen shows a landing reticle, impact,
  an element flourish (`elemfx`), hit stop and big popping numbers.
- Melee basic attacks (1.7.1) are drawn as effects, not animation: `meleeSwing` per unit (kyle alternating crescents + every 3rd an X `mcross`,
  bran hop + `msmash` shockwave, nero double `mstab` + red `xmark` on 암습, militia spear `mstab`, shield short arc), coloured by the ★3 imprint;
  the model dashes, leans (`rotation.order='YXZ'`) and squashes (`o.strike`, `o.heavy`).
- Soldier attack and magic are multiplied by `SOLDIER_POWER` (3.2, in `legacyScale`, so sim and the clear summary agree); soldiers have
  no extra abilities by the owner's choice. Target: a soldier deals ~20–30% of a damage hero's damage.
- Soldiers use their own models (`model:{soldierId}` → `soldierParts` in models.js, a TD-only hook), not recoloured heroes.
- Every hero has a 필살기 (`UNITS[id].ult`) from ★1. Charge time = `SKILLS[ult].cd` (`S.ultTime(u)`: sera 32, kyle 38, nero 40, ria 45, bran/luna 48;
  ★5 `ultBoost` −15%, legacy ultCdr). Charges only while deployed and only in `battle` phase; starts at 0, carries over between battles
  (snapshot keeps `ultCd`), withdraw resets, going down keeps half. Rate ×1.5 on a vantage tile, ×2 while `u.shardT` > 0.
  `S.ult(id,x,y,element)`: element must be in `S.ultElements(u)` (ult/basic/skill elements; [] for heal/fortress) and adds `ULT_STATUS`
  (fire burn, ice/water freeze, wind slow, thunder stun, dark poison) or light +20%. 연계: within `CHAIN_WINDOW` 3 s of the last 필살기 → +15%/+30%.
  The screen (1.7.1): a charged hero has no ring — its body glows in `HERO_COLOR` (`readyGlow`, per-unit emissive copy of `M.sharedMat`), a halo +
  rising motes and a diamond crest (`drawReady`), and a one-time `readyburst` beam when it fills. A ready card glows and casts on tap; more than one element opens `#elPick` (weak/resist counts); `#chainBar` + 「N 연계!」.
  A ranged hero's 필살기 ignores range (1.7.6: `range=99` in tryCast for ults of non-melee units).
  Call it 필살기 in all player-facing text.
- 명당 (`S.vantage`, `pickVantage` once at chapter start and kept for the whole chapter since 1.7.20 — moving a placed unit means selling
  it, so a spot that moved every battle could not be followed; 1.7.4 rules: one high tile from the top third by road cover, one road tile (path fraction .3–.62,
  scored by crossings + pedestals within 2.9 + slow ground) from the top third; within those, the half farthest from characters already
  placed (`room`; melee spot: from melee only). The snapshot keeps `vantage`, so a resumed battle shows the same spots (1.7.9). +25% damage (`VANTAGE_DMG`), charge ×1.5, range +.5 / block +1. The bot (STRAT `vantage`,
  `vw`) gains little from chasing it because it never moves a placed unit; a player who re-plans each battle does.
- Battle declutter (1.7.2): no name labels for auto skills (필살기 only), combos are a gold ring (암습 a red X), no numbers for basic attacks or
  damage to allies, skill hits on one monster within 0.3 s merge into one number (`numOf`, dmg events carry `skill`); ally HP bars show while
  preparing/selected, 1.5 s after a hit and always at ≤30% HP (ally bars never red, so they are not mistaken for monsters: green → yellow → orange `#ff8a1e`
  at ≤30% with a pulsing light-orange frame; 1.7.18); ★ always shown (1.7.6, owner: to see who needs ranks).
- Ground marks under characters are 3D meshes (`decalGroup`/`syncDecals`, 1.7.6) so bodies hide the part behind them: 명당 tile (gold fill +
  square frame), 수정 조각 holder (three turning cyan arcs); the TACTICS team foot ring of every model is hidden in `modelFor` (1.7.13, owner's choice); only the shadow disc remains. 2D overlay keeps only motes/labels.
  Owner's rule: shapes around units always go behind bodies. Every ring is a 3D `groundRing(key,x,y,r,color,fill,dashed)` asked for each frame
  (pruned by `pruneRings`): selected range + aura, placing hover range, melee gate zones, 필살기 aim area, 철벽의 성채 and beam-warning rings.
  Shielded monsters (보호막 −30%) get a small shield badge right of the HP bar (`shieldBadge`), not a circle.
- Pedestal spread (1.7.3, docs/REPAINT2.md): every map has `MAPS[id].highAt` = hand-placed pedestals (same count, spread as far apart as
  possible, 1–3 outer-bend spots; replaces the grown high cells), and the paintings were repainted to match. To move a pedestal: edit
  `highAt`, re-make the guide, repaint, `fit-art.py --apply`.
- 수정 조각: `S.shardIn` (first 18 s, then 40 s of battle) → `S.shard` + event `shard`; `S.giveShard(id|null)` → `shardGiven`, `u.shardT`=20.
  The screen drops it in a light pillar, floats it above the dock (`#shard` in #app), drag onto a card/field hero or tap → tap; 0.25× speed while
  choosing, random after `SHARD_SECONDS` 5 real s. The sim gives it at random after 20 s by itself (bot/demo).
- Cancel bar (1.7.19): while anything is being chosen (placing a card, a selected ally, 필살기 aim or element, potion or shard target) the
  strip shows `#cancelBar` 「✕ 취소 · <what> · ⏱ 느리게」 in place of chips/boss bar/buttons (`selectionLabel`, `cancelTick`). One
  `cancelSelection()` clears every state; tapping the bar, an empty spot of the field, or the same card again cancels. `#aimHint` is retired.
- 체력 물약 (1.7.17): `POTIONS` 5 per chapter (`S.potions`, kept in the snapshot, not carried to the next chapter); `S.usePotion(id)` in
  battle only: +50% max HP, clears bad states, one ally every `POTION_CD` 10 s. Screen: `#potionBtn` (heart-shaped red bottle `POTION_SVG` + count, red button since 1.7.21) in the strip → tap an ally
  (field or card; quarter speed while choosing) or the ally panel's 물약 button; event `potion` → green bubbles + number. The bot uses one
  on a hero under 30% HP.
- Battle chips show 「다음 전투」 (`nextChip`, `S.preview(S.battle+1)`). Waves mix elements; each group one kind, consecutive groups prefer another element.
- Economy (1.7.0): soldiers −35% cost, soldier rank-up ×0.92 more (−40% total), start gold 150+15×chapter, battles 1/2 at 60%/75% HP.
- `tools/strategy.js` compares habits (placement, 필살기 timing, element/vantage/shard use); target: ordinary play ≥90% clears, bad habits ≤50%.
- Maps have their own size (`MAPS[id].w/h`): early chapters are smaller (9×9 … 9×12), 9×14 from chapter 4.
- Basic attacks: ranged `RANGED_INTERVAL` 1.2 / `RANGED_POWER` 0.3, melee `MELEE_INTERVAL` 0.7 / `MELEE_POWER` 0.7 of the base numbers;
  skills, 필살기 and heals are not affected. No melee on the road within `GATE_GAP` (2 since 1.7.2) tiles of a monster gate (`map.gates`).
- Placement: melee on road/grass/forest/bridge; ranged (heroes and soldiers) only on high ground — the pedestals in `MAPS[id].highAt`
  (4–7 per map; `high` only seeds the grown map).
- Slots: every joined hero may be on the field at once (one of each); soldiers only up to `S.soldierCap` = `CHAPTER_DEFS[].soldiers`
  (3,3,2,2,1…1) + legacy 「지휘관의 위엄」 (`command`, +1 each, max 2). `S.slotFree(def)` / `S.soldierCount()`; HUD shows 👑 heroes and 🪖 soldiers. When the soldier slots are full the
  unused soldier cards turn grey (`.card.full`, 「자리 없음」, 1.7.14). Ranged cards (heroes and soldiers) also turn grey with 「발판 없음」
  when every pedestal is taken (`freePedestals`, 1.7.15); tapping a grey card toasts why instead of starting a placement.
- Painted backgrounds (`docs/ART.md`): a map with an entry in `MAP_ART` (js/data.js) shows `art/<map>.webp` in an <img> behind the
  transparent WebGL canvas, placed by `placeArt()` from the guide frame (`artFrame`: map width + 1 tile, 9:16, centred). The tiles then
  become invisible shadow catchers (flat tile tops only); gate arch, crystal dais, trees and water are not drawn (only the gate glow and crystal beam/halo).
  `node tools/make-guides.js` renders `art/guides/<map>.png/.json`; `python3 tools/fit-art.py <map> <file> [--apply]` finds the frame
  inside a painting, writes `art/check/<map>.png` (tile outlines) and installs it. Re-make the guides (and repaint) if a map layout changes.
  `MAPS[id].noHigh` turns listed high cells back into grass after the map is grown (rest of the map unchanged) — used where a painting
  hides a cell (tower: behind the crystal) and (1.6.13) to retire surplus pedestals: high = prologue/fort 4, river 5, forest 7, the
  rest 6 (≈ max ranged units + 1–2). Those paintings were repainted with the pedestals turned into ground (docs/REPAINT.md).
- Waves use half as many monsters with twice the HP and twice the gold each (`buildChapter`, `spawn`). Groups of one kind (1.7.21): each
  starts ≥ `GROUP_GAP` 5 s after the previous group's last monster, plus the time a faster group would need to catch up over ~15 tiles
  (max 10 s), so groups of different elements stay apart.
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
- Battle end (1.7.36): the sim ends a battle only when no hit is still in flight (`S.pending` empty); the screen waits real time
  (`afterBattle`: won 2.2 s after a 「CLEAR」 banner, lost 1.6 s, blessing 1.2 s) and the window drops in and grows (`enterModal`, `#modal.enter`).
- Chapter clear (`clearFlow` in game.js): pages 결산 → 유산 (`legacyModal`) → 다음 장 준비 → 마무리 (3 pages on FINAL). Uses `S.stats`
  (dealt/healedBy per unit, ults, goldEarned/goldSpent, battle time; kept in the snapshot) and `D.unitStats`/`D.legacyScale` (the same
  legacy formula sim.refresh uses). Best record per chapter: `cnation-td-records-v1` = {chapterId:{stars,life,time,kills}}.
- Title (1.6.0): attract mode (`demo` in game.js) — a real battle on a painted map of an opened chapter plays behind the transparent
  title modal (`#app.title #viewport` fills the screen), auto-deployed with ranks 3, 필살기 now and then, restarted when it ends.
  While `demo.on`: no sfx except ui_*, no toast/banner, events in `DEMO_SKIP` ignored (no saves/results), gate and crystal labels hidden.
  Title type scale: logo 40, tagline 18, buttons 16, small 12; menu = 게임 시작 (gold) / 이어하기, three round SVG icon buttons, footer.
  `art/title.webp` (ruins + crystal) is no longer used on the title; kept for a future loading/ending screen.
- HUD (1.7.21): no life chip (the crystal label on the field shows ♥); `#hudBattle` is two lines 「전투 n/N」 + battle name (tap → full
  chapter/battle name toast); HUD buttons min-width 33px so the longest battle name (10 chars) fits at 390 px.
- iOS home-screen apps: status bar style is `black` (opaque), so iOS lays the page out below the status bar with the right height
  and #app simply fills the viewport. With `black-translucent` every sizing trick (bottom:0, 100lvh, +safe-area-inset-top, screen.height)
  was off by the status bar on a real iPhone (1.5–1.6.3). `fitApp()` is now a no-op kept for the resize hook.
- Painting first (1.6.1, 1.6.5): `waitArt`/`onArt` in game.js — while a map painting loads, `#app.artwait` hides the 3D canvas, effects,
  HUD, dock and title menu, with no timeout (a slow network waits). `loading` = the 「데이터 불러오는 중…」 overlay (`#loading` in index.html,
  visible from first paint under key 'boot' until the first painting): `begin/end/wait(key,promise,cap)`, shown after 120 ms, plus a
  slow-network line after 6 s. Used by waitArt, `paintFirst` (world map/altar), the title demo (loads the next map's painting with
  `loadImg` before switching) and chapter start (battle music, 8 s cap). `preloadArt` fetches the rest; sw.js serves `art/` cache-first.
- Title menu (1.6.8): with a save 「▶ 전투 계속하기」 (gold, chapter + battle n/N) + 「🗺 모험 지도」; without a save 「🗺 모험 지도」 only;
  a brand-new player 「⚔ 모험 시작」 (straight into the prologue). Icons: 저장 슬롯 (load), 소리, 게임 방법. `chapterInfo` offers
  「전투 계속하기」/「처음부터 다시」 when the auto save is in that chapter.
- Elements (1.6.9): monsters with an element show its icon in a coloured ring left of the HP bar; with a character selected,
  `unitElements(u)` × `matchup()` (same table as sim.affinity) makes strong matchups glow with ▲ and weak ones dim. The ★3 imprint
  choice gets its own button row (`#panel.choosing`) with `STRONG_VS` hints. An imprint adds/upgrades one skill of that element only.
- Boss HP: an overhead bar like other monsters, always shown, red with a gold frame (1.7.35, owner: a boss without one looked odd in its escort); `bossHud()` also fills `#bossBar`, which sits in `#strip` under the battlefield (1.7.8: at the top it hid the
  monster gates) and replaces the chips while a boss is out (`#strip.has-boss`): element, name, red bar + trail with HP numbers inside.
  Hidden on the title demo.
- Monster HP bar length = `hpBarScale(e)`: √(maxHp ÷ (69 × battle tune hp)), clamped 0.75–1.8 (bosses up to 2.4).
- Monster HP bars (red `#ee4f3f`, bosses too; elites a darker red `#a8141c` since 1.7.14) and, since 1.7.11, ally bars: a pale trail shows the part just lost
  (`barTrail`) — held `BAR_HOLD` 0.1 s, then shrinks over `BAR_DRAIN` 0.15 s (owner: 0.5 s felt too long), the same for every hit — and the bar flashes; a 필살기 holds the bar until
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
  (`ALTAR.sockets` [x%,y%], `size` 13.2 — measured from the painted gold rings in 1.7.30; medals fill 86% of a ring, names are small
  dark text engraved under each ring, no plate) and the totals (`D.legacyTotal(id,n)`) on the floor panel; without it the old modal list. Prompts in docs/ART.md.
- 빛나는 ★3 (1.7.23): a ★3 clear while holding no legacy from a LATER chapter (`eraFor(i)`, decided at `startChapter`, never in developer
  mode) is stored in `SHINE_KEY` and shown with `.shine` (1.7.25: SVG crystal-blue faceted stars `SHINE_STAR` with gradient `#sgrad` and a thick black outline (1.7.34: stroke 2.6 under the fill + tight black drop-shadows in `shineGlow`), a turning light cross behind each,
  cyan glow + twinkles — no plate, owner found it messy; plain ★ stays gold) on the clear pages, chapter info, map stops and the map
  header count. Legacies always apply in full when replaying (owner: players want to come back stronger for ★3).
- Legacy icons (1.7.26): painted round medallions `art/legacy/<id>.webp` (256 px, circular alpha, cropped from the owner's 768 px art;
  prompts in docs/LEGACY_ICONS.md). `legacyInfo(id).icon` is an `<img class="licon">` (the emoji stays in `.emoji`/alt), so every
  place that shows a legacy (altar sockets, map badges, offer, clear pages, totals) uses the picture.
- 수호자 카드 (1.7.27): all chapters ★3 → 「아르카의 수호자」, all 빛나는 ★3 → 「빛의 수호자」 (`guardianCheck` after each clear, stored in
  `GUARD_KEY` with date, stars, shine, total kills/time from records and the MVP hero from `HERO_DEALT_KEY` = hero damage summed over
  clears). `art/card_guardian.webp` / `card_light.webp` (owner's art, 2:3); `CARDS[kind].plate` = the empty nameplate as fractions, where only two
  centred lines are written (1.7.28, owner: less text): the title, and the engraved name (`GUARD_KEY.name`, ≤10 chars, `askName`, asked
  once when first earned) or the date when there is no name. Stats stay stored in `GUARD_KEY` but are not printed.
  `#gcard` overlay: beam, falling motes, flip-in, shine sweep, tilt on drag; buttons other card / 이름 / 이미지로 저장 (`saveCard` draws
  the card + text on a canvas → share sheet or download) / 받기·닫기. Shown over the last clear page when earned; the title shows the
  honour (`.gtitle`, light wins) and tapping it reopens the card.
- Resets (1.7.22): the legacy view's 「유산 초기화」 clears only `LEGACY_KEY` (confirm says stars/clears stay and re-clearing a chapter
  offers its legacy again). The world map footer 「⟲ 처음부터 새로 시작」 (two-step confirm) removes clears, shine, records, legacies, guardian cards/name, hero damage, auto save
  and slots (settings stay) and returns to the title, which then offers 「⚔ 모험 시작」.
- No dialogue in play (owner's choice, 1.6.3): chapter start shows a banner, the boss battle a one-line hint toast; `dialogue()` and
  the intro/bossIntro/outro texts in data.js are unused.
- Two bonus kinds, keep them visibly apart: **에테르 축복** (`BLESSINGS`, chosen mid-chapter, this chapter only) and
  **아르카의 유산** (`LEGACIES`, one slot per chapter picked after a clear, permanent and stacking; passed to `createSim` as `legacy` counts).
  The bot (`D.typicalLegacy`) plays each chapter with the legacies an ordinary player would hold, and `diff` is calibrated with them.
- Developer mode (title screen): kept for testing after 1.0.0 by the owner's choice — start any chapter, instant win and +500 gold from the in-game menu.

## Checking a change
Serve the folder (`python3 -m http.server`) and drive it with Playwright at a phone viewport (390×780); `window.TD.sim` exposes the simulation.
The battlefield must fill the phone width with no scrolling in portrait.
