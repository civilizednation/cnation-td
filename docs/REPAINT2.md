# 발판 분산 배치 — 그림 부분 수정 (ver.1.7.2 예정)

전투가 화면 가운데에만 몰리지 않도록 원거리 발판(올라온 돌 받침)을 **개수는 그대로 두고** 전장 전체에 흩어 놓습니다.
발판끼리 가장 가까운 거리가 최대가 되도록 골랐고, 장마다 구부러진 길 바깥쪽의 **외곽 발판**(길이 5칸 이하로 보이는 자리)을 1~3개 일부러 넣었습니다.

## 하는 법 (맵마다)
1. 이미지 도구에 **두 장**을 첨부합니다: ① 현재 전장 그림 `<맵>_orig.jpg` ② 표시 그림 `<맵>_mark.jpg`
   - **빨간 X** = 없앨 받침 → 주변 땅으로 채움
   - **금색 칸** = 새 받침을 세울 자리
   - **하늘색 테두리** = 그대로 둘 받침
2. 아래 **공통 프롬프트**의 <FILL>에 그 맵의 채울 모습을 넣어 붙여 넣습니다.
3. 결과를 보내 주시면 위치를 맞춰 확인한 뒤 게임에서도 발판을 옮깁니다(그림과 게임을 동시에 바꿈).
   한 번에 잘 안 되면 없애기 먼저, 세우기를 다음에 — 두 번에 나눠 해도 됩니다.

## 공통 프롬프트
```
Edit the FIRST image only. The SECOND image is the same picture with marks.
1) Every raised square stone platform covered by a RED X must be removed: replace it with flat ground at the same height as
   the ground around it: <FILL>.
2) On every GOLD square, build a NEW raised square stone platform that looks exactly like the existing platforms in this
   picture: the same size (one tile), the same material, colour, height, edges and shadow. Its top must fill the gold square.
Keep everything else exactly as it is: the same framing and size, the road, water, trees, buildings, the monster gate, the
crystal, and the platforms outlined in cyan. Do not add any other platforms, characters, text or marks.
The red, gold and cyan marks themselves must NOT appear in the result.
```

## 맵별 (행·열은 위·왼쪽부터 1)
| 맵 | 없앨 받침 (빨간 X) | 새 받침 (금색) | 그대로 | 채울 모습 (<FILL>) |
|---|---|---|---|---|
| 프롤로그 · 봄 들판 마을 (`prologue`) | 3행 6열 · 4행 3열 · 4행 5열 · 6행 4열 | 2행 9열 · 3행 2열 · 7행 6열 · 8행 1열 | 0 | plain spring grass with a few small wildflowers, matching the surrounding meadow |
| 1장 · 해안가 요새 (`fort`) | 3행 4열 · 4행 6열 · 6행 5열 · 7행 6열 | 2행 1열 · 3행 7열 · 7행 3열 · 8행 9열 | 0 | plain green grass on the cliff top with a few small stones, matching the surroundings |
| 2장 · 눈 덮인 산길 (`river`) | 3행 4열 · 4행 5열 · 7행 6열 · 9행 5열 | 3행 5열 · 4행 1열 · 5행 9열 · 9행 8열 | 1 | snow-covered ground with a few snowy rocks, matching the surroundings |
| 3장 · 원시림 (`forest`) | 5행 3열 · 7행 5열 · 8행 4열 · 10행 6열 | 3행 1열 · 5행 7열 · 9행 7열 · 11행 1열 | 3 | mossy forest floor with ferns and small mushrooms, matching the surroundings |
| 4장 · 가을 왕도 (`city`) | 5행 3열 · 6행 4열 · 8행 4열 · 9행 5열 | 3행 3열 · 3행 9열 · 6행 6열 · 9행 9열 | 2 | lawn covered with fallen red and orange maple leaves, matching the surroundings |
| 5장 · 사막 오아시스 (`plain`) | 4행 5열 · 6행 4열 · 9행 5열 · 10행 6열 | 3행 3열 · 3행 8열 · 9행 9열 · 10행 2열 | 2 | golden sand with a small desert shrub, matching the surrounding dunes |
| 6장 · 정글 유적 (`ruins`) | 4행 7열 · 10행 6열 · 11행 4열 | 2행 3열 · 2행 9열 · 10행 9열 | 3 | mossy jungle ground with ferns and low tropical plants, matching the surroundings |
| 7장 · 화산 첨탑 (`tower`) | 4행 6열 · 8행 3열 · 8행 5열 · 11행 4열 · 11행 6열 | 2행 9열 · 3행 4열 · 7행 1열 · 12행 1열 · 12행 6열 | 1 | dark basalt ground with ash and small black rocks, matching the surroundings |
| 8장 · 제국 수도 (`capital`) | 5행 5열 · 6행 6열 · 8행 6열 · 9행 5열 · 11행 4열 · 12행 5열 | 2행 7열 · 3행 2열 · 7행 8열 · 8행 3열 · 12행 7열 · 13행 2열 | 0 | wet dark stone paving with a small stone flower planter, matching the surrounding plaza |
| FINAL · 수정 동굴 (`core`) | 3행 4열 · 5행 3열 · 6행 6열 · 11행 6열 | 3행 1열 · 5행 9열 · 9행 8열 · 13행 9열 | 2 | dark cave stone floor with a few tiny glowing crystal shards, matching the surroundings |

## 게임 쪽 변경 (그림이 오면 함께 적용)
`MAPS[id].highAt`에 아래 칸 [열, 행](0부터)을 넣으면 그 맵의 발판이 정확히 이 자리로 바뀝니다(나머지 지형은 그대로).
```js
prologue: highAt [[8, 1], [1, 2], [5, 6], [0, 7]]
fort: highAt [[0, 1], [6, 2], [2, 6], [8, 7]]
river: highAt [[4, 2], [0, 3], [8, 4], [3, 6], [7, 8]]
forest: highAt [[0, 2], [3, 3], [6, 4], [2, 6], [6, 8], [3, 9], [0, 10]]
city: highAt [[2, 2], [8, 2], [5, 5], [2, 8], [8, 8], [5, 11]]
plain: highAt [[2, 2], [7, 2], [4, 6], [8, 8], [1, 9], [5, 11]]
ruins: highAt [[2, 1], [8, 1], [5, 4], [2, 7], [8, 9], [4, 11]]
tower: highAt [[8, 1], [3, 2], [0, 6], [6, 6], [0, 11], [5, 11]]
capital: highAt [[6, 1], [1, 2], [7, 6], [2, 7], [6, 11], [1, 12]]
core: highAt [[0, 2], [4, 4], [8, 4], [3, 8], [7, 8], [8, 12]]
```
