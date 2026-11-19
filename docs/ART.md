# 전장 배경 그림 가이드

전장 배경은 맵마다 한 장의 그림을 씁니다. 캐릭터와 몬스터, 그림자, 효과는 지금처럼 게임이 3D로 그 위에 그립니다.
그림이 없는 맵은 기존 three.js 지형이 그대로 나옵니다.

## 작업 순서

1. **밑그림 받기**: `art/guides/<맵>.png` (1080×1920, 9:16). 게임 카메라로 찍은 지형 사진입니다.
   맵이 바뀌면 `node tools/make-guides.js` 로 다시 만듭니다.
2. **그리기**: 이미지 생성 도구에 밑그림을 참고 이미지로 넣고, 아래 **공통 프롬프트 + 맵별 프롬프트**를 붙여 넣습니다.
   결과는 9:16 세로, 가로 1080px 이상 PNG로 저장합니다.
   밑그림의 색과 나무는 무시하고 **배치(길·발판·물·문·수정 위치)만** 따르면 됩니다. 테마는 아래 표대로 자유롭게 바꿉니다.
3. **맞추기·확인**: `python3 tools/fit-art.py <맵> <그림 파일>`
   - 그림 속 어디가 게임 화면인지 자동으로 찾고, `art/check/<맵>.png` 에 칸 표시를 겹친 확인용 그림을 만듭니다.
   - 주황 = 길, **하늘색 = 고지대(원거리 발판)**, 보라 = 늪·모래, 파랑 = 물, **빨간 X = 바위·절벽·건물(아무도 설 수 없는 칸)**, 빨간 원 = 적 출현 문, 초록 원 = 아르카 수정.
   - **하늘색 칸마다 올라온 발판이 그려져 있는지**, 빨간 X 칸에 발판처럼 보이는 게 없는지, 길이 주황 칸을 따라가는지 봅니다. 어긋나면 수정 프롬프트로 고칩니다.
4. **넣기**: 맞으면 `--apply` 를 붙여 실행 → `art/<맵>.webp` 저장 + `js/data.js` 의 `MAP_ART` 에 자동 등록.

| 맵 id | 장 | 스토리 장소 | 크기 | 밑그림 |
|---|---|---|---|---|
| prologue | 프롤로그 | 국경 마을 에린 | 9×9 | art/guides/prologue.png |
| fort | 1장 | 에린 남문 | 9×10 | art/guides/fort.png |
| river | 2장 | 회색 산맥 | 9×11 | art/guides/river.png |
| forest | 3장 | 엘렌 숲 | 9×12 | art/guides/forest.png |
| city | 4장 | 왕도 레온 | 9×14 | art/guides/city.png |
| plain | 5장 | 벨른 평원 | 9×14 | art/guides/plain.png |
| ruins | 6장 | 아르카 외곽 | 9×14 | art/guides/ruins.png |
| tower | 7장 | 검은 첨탑 | 9×14 | art/guides/tower.png |
| capital | 8장 | 북부 제국 아스켈 | 9×14 | art/guides/capital.png |
| core | FINAL | 코어의 심층 | 9×14 | art/guides/core.png |

## 공통 프롬프트 (모든 맵에 먼저 붙여 넣기)

```
Repaint the attached reference image as a polished game background for a mobile tower-defense game.
The reference is a 3D render of the battlefield seen from a fixed, tilted top-down camera. Treat it as an exact layout guide.
Use the reference ONLY for layout. Ignore its colours, grass, trees and decorations: paint a completely new place in the theme below.

LAYOUT — must match the reference exactly:
- Same framing, same camera angle, same 9:16 portrait size. Do not crop, zoom, rotate or extend the scene.
- The road (tan path with dark borders) follows exactly the same cells and turns. Same width, no new branches.
- Every raised square platform stays on exactly the same cell — same number of platforms, none added, none removed,
  none moved. Paint each one as a clearly raised stone platform: light flat top, visible darker front face on its lower side,
  a soft shadow to the lower right. These are the spots where archers and mages stand, so they must read instantly.
- Tall blocks with rocks on them in the reference are CLIFFS, not platforms: paint them as rough natural rock outcrops
  or boulders with no flat walkable top, clearly different from the platforms.
- Water cells stay in the same cells (paint them as the theme says: sea, oasis, frozen river, ether pool...).
  Trees, rocks and props may change freely, but never on the road or on a raised platform.
- The monster gate (dark stone arch with red banners) and the glowing crystal on a stepped round dais stay in the same place.
- Swamp or sand stretches ON the road stay part of the road: paint them as muddy or sandy road with puddles and reeds,
  never as a fence, wall, bridge rail or water channel that blocks the path.
- Keep a faint square tile grid visible on open ground so players can see the cells.

STYLE:
- Stylized low-poly diorama, soft hand-painted textures, gentle ambient occlusion, clean shapes, like a premium mobile strategy game.
- Light from the upper left, shadows fall to the lower right.
- The play area (the road and the cells next to it) stays calm and medium-contrast so small characters, health bars and spell effects
  stand out on top. Put the richest detail (dense trees, flowers, ruins, props) in the outer border outside the road area.
- No characters, no monsters, no people, no animals, no text, no letters, no UI, no arrows, no numbers, no watermark.
```

## 맵별 프롬프트 (공통 프롬프트 뒤에 이어 붙이기)

배경을 새로 그리므로 장마다 전혀 다른 장소로 꾸밉니다. 길·발판·물 칸의 **위치**는 게임 규칙이라 그대로 두고,
물 칸은 테마에 맞게 바다·오아시스·얼음 호수·용암 등으로 바꿔 그려도 됩니다(어느 쪽이든 배치할 수 없는 칸).
늪·모래 칸(적이 느려지는 길)도 테마에 맞는 진흙·눈길·모래·재 등으로 그립니다.

| 장 | 맵 id | 새 테마 |
|---|---|---|
| 프롤로그 | prologue | 봄 들판의 시골 마을 |
| 1장 | fort | 해안가 절벽 요새 · 모래사장 |
| 2장 | river | 눈 덮인 산길 · 얼어붙은 강 |
| 3장 | forest | 깊은 원시림 |
| 4장 | city | 단풍 든 가을 왕도 |
| 5장 | plain | 사막 오아시스 |
| 6장 | ruins | 폭포가 있는 정글 유적 |
| 7장 | tower | 화산 지대의 검은 첨탑 |
| 8장 | capital | 비 내리는 황혼의 제국 수도 |
| FINAL | core | 지하 수정 동굴 · 아르카 코어 |

**prologue — 봄 들판의 시골 마을**
```
Theme: a peaceful farming village in spring. Fresh green meadow, small thatched cottages, wooden fences, a windmill, flower beds
and vegetable patches at the border. Raised platforms are low stone garden terraces. The pond on the right is a clear village pond
with lily pads. The slow stretch on the road is soft spring mud with puddles. Palette: bright spring green, warm thatch, pale stone.
```

**fort — 해안가 절벽 요새 (1장)**
```
Theme: a seaside fortress on the coast. The water cells in the lower right are the sea: turquoise shallow water with gentle waves
and foam on a sandy beach. Grass on top of sea cliffs, a stone lighthouse and wooden docks, crates and ropes at the border,
seagull-free. Monsters enter from the RIGHT edge. The slow stretch on the road is loose beach sand. Raised platforms are
weathered stone bastions. Palette: sand, turquoise, sea-green grass, white stone.
```

**river — 눈 덮인 산길 (2장)**
```
Theme: a snowy mountain pass in winter. Snow-covered ground with patches of frozen grass, snowy pine trees, icy rocks and
tall snow-capped peaks at the border. The water cells are a half-frozen mountain river with ice floes, crossed by a sturdy
wooden bridge exactly where the road crosses. The road is a trampled snowy dirt path, clearly darker than the snow.
Raised platforms are snow-topped stone blocks with a visible dark front face. Palette: white, ice blue, pine green, warm brown path.
```

**forest — 깊은 원시림 (3장)**
```
Theme: an ancient primeval forest. Rich moss-green ground, huge old trees with thick roots around the edges, ferns, mushrooms,
mossy boulders, soft light beams through the canopy. Two stretches of the road are boggy forest mud with puddles and reeds
(still clearly road). The water cells are a small forest pond. Raised platforms are mossy old stone blocks.
Palette: deep green, moss, warm earth, golden light.
```

**city — 단풍 든 가을 왕도 (4장)**
```
Theme: a royal capital in autumn. The road is a cobblestone street, open ground is lawn covered with fallen red and orange leaves,
maple trees in full autumn colour, townhouses with cream walls and dark blue roofs, lanterns at the border. The water cells are a
narrow stone canal. TWO monster gates at the top. Raised platforms are low stone terraces. Palette: maple red, orange, cream, slate blue.
```
4장은 AI가 길을 단순하게 바꿔 그리기 쉬우니 아래도 함께 붙입니다(실제로 이걸 붙여서 한 번에 맞았습니다).
```
CRITICAL LAYOUT for this map — copy the road from the reference cell by cell:
- There are TWO monster gates, both on the TOP edge, facing DOWN (left gate in the 2nd column, right gate in the 8th column).
  From each gate the road goes STRAIGHT DOWN 3 cells; there is NO road along the top edge between the gates.
- The two roads meet in one horizontal road on the 4th row, then the single road continues exactly as in the reference.
- The only water is a narrow canal of 3 cells on the RIGHT edge. No pond on the left side.
- Keep all 8 raised platforms exactly on the reference cells.
```

**plain — 사막 오아시스 (5장)**
```
Theme: a desert crossing with an oasis. Warm golden sand dunes and cracked dry earth, palm trees, sandstone rocks and desert tents
with colourful cloth at the border. The water cells are oasis pools with reeds and palms around them. Monsters enter from the LEFT edge.
The road is a packed caravan track, darker than the sand; its slow stretch is deep loose sand. Raised platforms are sandstone blocks.
Palette: gold, terracotta, palm green, turquoise water.
```

**ruins — 폭포가 있는 정글 유적 (6장)**
```
Theme: overgrown jungle ruins of an ancient civilisation. Lush jungle plants, vines, giant leaves, carved stone heads and
crumbling temple walls at the border, a waterfall at one edge. The water cells are two shallow jungle streams with small stone bridges
where the road crosses. Raised platforms are carved temple stone blocks. Palette: emerald green, wet grey stone, teal water.
```

**tower — 화산 지대의 검은 첨탑 (7장)**
```
Theme: a volcanic wasteland around a dark sorcerer's black spire. Dark basalt ground with glowing cracks only at the border,
ash, black rocks, jagged obsidian spires, distant lava flows at the edges. Monsters enter from the LEFT edge; the road spirals inward
and the crystal sits near the CENTER of the map. The slow stretch on the road is a patch of hot ash and cooling lava crust (still clearly road).
Keep the road and platforms lighter than the ground so they read clearly. Palette: charcoal, ember orange, ash grey.
```

**capital — 비 내리는 황혼의 제국 수도 (8장)**
```
Theme: a grand imperial capital at dusk after rain. Wet dark stone plazas with reflections, tall pale stone walls, deep red banners,
gas lamps glowing warmly, statues at the border. The water cells are a stone moat. TWO monster gates at the top.
Raised platforms are cut stone bastions. Keep the road clearly lit and readable. Palette: blue-grey dusk, wet stone, warm lamp light, deep red.
```
8장도 문이 2개라 아래를 함께 붙입니다.
```
CRITICAL LAYOUT for this map — copy the road from the reference cell by cell:
- There are TWO monster gates, both on the TOP edge, facing DOWN (left gate in the 1st column, right gate in the 9th column).
  From each gate the road goes STRAIGHT DOWN; there is NO road along the top edge between the gates.
- Follow every turn of both roads exactly as in the reference until they join, then the single road down to the crystal.
- Keep all 8 raised platforms and the water cells exactly on the reference cells.
```

**core — 지하 수정 동굴 · 아르카 코어 (FINAL)**
```
Theme: a vast underground crystal cavern at the heart of the ancient Arca core. Dark stone floor with faint glowing ancient runes,
giant crystal clusters in purple and teal at the border, ancient machinery half buried in rock. The water cells are pools of glowing
liquid ether. The slow stretch on the road is a shallow ether puddle (still clearly road). Glow stays soft in the play area
so spell effects remain visible. Palette: deep indigo, dark slate, soft teal and violet light.
```

## 어긋났을 때 수정 프롬프트

확인 그림(`art/check/<맵>.png`)에서 하늘색 칸에 발판이 없거나, 발판이 없어야 할 곳에 있거나, 길이 벗어났을 때
**그린 그림과 밑그림을 함께 첨부**하고:

```
Keep this painting exactly as it is, but fix the layout to match the second image (the layout guide):
- Raised stone platforms must be on exactly these cells: <예: row 3 column 2, row 4 column 4 ...>. Remove any other raised platforms
  and paint plain grass there.
- The road must follow exactly the same cells as the guide.
Change nothing else.
```

(칸 번호는 위에서부터 행, 왼쪽부터 열. 확인 그림을 보고 제가 칸 번호를 적어 드릴 수도 있습니다.)


---

# 월드맵 (장 선택) 그림

장 선택 화면의 배경입니다. 게임이 그 위에 장 버튼(번호 · 별 · 잠김 · 유산 배지 · 현재 위치의 카일 표시)과 클리어한 길의 빛을 올립니다.
받으면 `art/world.webp` 로 저장하고 `WORLD_MAP.file` 과 실제 받침 위치(`WORLD_MAP.stops`, 가로·세로 %)를 등록합니다.

정거장 위치(가로 %, 위에서부터 %): 1 프롤로그 (50,89) · 2 1장 (74,80) · 3 2장 (30,71) · 4 3장 (70,62) · 5 4장 (30,53) ·
6 5장 (70,44) · 7 6장 (30,35) · 8 7장 (70,26) · 9 8장 (32,18) · 10 FINAL (55,10)

```
A vertical 9:16 world map illustration for a mobile tower-defense game's chapter select screen, 1080x1920 or larger.
Stylized low-poly diorama with soft hand-painted textures, bright and readable, premium casual mobile game style,
seen from a high three-quarter top-down angle. Light from the upper left.

ROUTE:
- One continuous winding cobblestone path starts at the bottom center and zigzags upward to the top, like a board game trail.
- Along the path there are exactly TEN stops. Each stop is an EMPTY round flat stone pedestal (a plain circular stone platform
  with a light top and a darker rim, about 9% of the image width), with nothing on it. Exactly ten, no more.
- Stop positions (x from the left, y from the top, as a percentage of the image):
  1 (50%, 89%), 2 (74%, 80%), 3 (30%, 71%), 4 (70%, 62%), 5 (30%, 53%),
  6 (70%, 44%), 7 (30%, 35%), 8 (70%, 26%), 9 (32%, 18%), 10 (55%, 10%).
- The path between stops is clearly visible and never hidden behind objects.

REGIONS — the land changes along the route, each stop sits in its own small region, blending smoothly into the next:
1. a peaceful spring farming village: thatched cottages, windmill, flower fields
2. a seaside cliff fortress on the right edge: turquoise sea, sandy beach, lighthouse, stone walls
3. a snowy mountain pass: snow, pine trees, a half-frozen river with a wooden bridge
4. an ancient primeval forest: huge mossy trees, ferns, mushrooms
5. a royal capital in autumn: red and orange maple trees, cream townhouses with blue roofs, cobbled square
6. a desert oasis: golden dunes, palm trees, colorful caravan tents, a small blue pool
7. jungle temple ruins with a waterfall: vines, carved stone heads, emerald jungle
8. a volcanic wasteland with a dark sorcerer's black spire: basalt rocks, glowing lava streams at a distance
9. a grand imperial capital at dusk after rain: wet stone, warm lamp lights, deep red banners, tall pale walls
10. at the top, the entrance of a vast crystal cavern glowing in teal and violet light, the heart of the ancient Arca core,
    the most magical and dramatic spot of the map

COMPOSITION:
- Keep the top 6% of the image calm and simple (sky, clouds or mountain silhouettes).
- Fill the space beside the path with rich scenery, rivers, bridges and small props, but keep every pedestal and the path clear.
- Overall the map should feel like a journey from a cozy village up to a mysterious glowing crystal at the summit.

DO NOT include: any text, letters, numbers, icons, UI, buttons, stars, locks, arrows, flags with writing,
characters, people, monsters, animals, or watermarks.
```

어긋났을 때:
```
Keep this map exactly as it is, but make sure there are exactly ten empty round stone pedestals on the path,
one in each region, with nothing on top of them. Remove any extra pedestals, numbers, text or icons. Change nothing else.
```

---

# 아르카의 제단 (유산 창 배경)

「아르카의 유산」 창의 배경입니다. 게임이 열 개의 홈 위에 얻은 유산 아이콘을 빛나게 끼워 넣고, 아래쪽에 효과 합계를 글로 씁니다.
받으면 `art/altar.webp` 로 저장하고 홈 위치를 재서 등록합니다.

```
A vertical 9:16 illustration, 1080x1920 or larger, for the "legacy" screen of a fantasy mobile tower-defense game.
Stylized low-poly diorama with soft hand-painted textures, matching a premium casual mobile game. Seen from the front,
slightly from above. Light from the upper left.

SCENE:
- An ancient sacred altar of pale carved stone inside a quiet ruined sanctuary, at night, lit by a huge glowing teal crystal
  (the Arca core) floating above the altar in the upper middle of the image, with soft rays of light.
- On the face of the altar there are exactly TEN round EMPTY sockets arranged in two rows of five, evenly spaced,
  each a shallow circular hollow with a thin gold rim, all the same size (about 12% of the image width), all completely empty.
  The two rows of sockets sit between 30% and 52% of the image height from the top.
- Faint glowing ancient rune lines connect the sockets to the crystal above.
- The lower 40% of the image is calm, dark and simple (stone floor, soft mist, gentle shadows) because text will be placed there.
- Around the edges: broken pillars, ivy, a few small floating crystal shards, distant starry sky through a broken roof.

PALETTE: deep blue-green night, pale stone, warm gold rims, teal and soft violet crystal glow.

DO NOT include: any text, letters, numbers, icons or symbols inside the sockets, UI, characters, people, animals, or watermarks.
```

어긋났을 때:
```
Keep this image exactly as it is, but make sure the altar has exactly ten empty round sockets with gold rims,
in two rows of five, evenly spaced and all the same size, with nothing inside them. Change nothing else.
```
