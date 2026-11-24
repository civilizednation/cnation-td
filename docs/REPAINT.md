# 원거리 발판 줄이기 — 그림 부분 수정

발판(올라온 돌 받침)이 원거리 유닛 수보다 너무 많아 장마다 1~2칸을 없앱니다(3장은 그대로).
없앨 받침은 길을 가장 적게 내려다보는(쓸모가 가장 적은) 것으로 골랐습니다.

## 하는 법 (맵마다)
1. 이미지 도구에 **두 장**을 첨부합니다: ① 현재 전장 그림 `docs/repaint/<맵>_orig.png` ② 표시 그림 `docs/repaint/<맵>_mark.png`
   (표시 그림: **빨간 X = 없앨 받침**, 하늘색 = 그대로 둘 받침)
2. 아래 **공통 프롬프트**에 그 맵의 **채울 모습** 한 줄을 넣어 붙여 넣습니다.
3. 결과를 보내 주시면 위치를 맞춰 확인한 뒤 게임에서도 그 칸을 평지로 바꿉니다(그림과 게임을 동시에 바꿈).

## 공통 프롬프트
```
Edit the FIRST image only. The SECOND image is the same picture with marks: the raised square stone platforms covered by a
RED X must be removed. Replace each red-X platform with flat ground at the same height as the ground around it:
<FILL>.
Keep everything else exactly as it is: the same framing and size, every other platform (the ones outlined in cyan), the road,
water, trees, buildings, the monster gate and the crystal. Do not add new platforms, characters, text or marks.
The red and cyan marks themselves must NOT appear in the result.
```

## 맵별
| 맵 | 없앨 받침 (행, 열 · 위·왼쪽부터 1) | 남는 발판 | 채울 모습 (<FILL>에 넣기) |
|---|---|---|---|
| 프롤로그 · 봄 들판 마을 (`prologue`) | 4행 7열 · 7행 3열 | 4칸 | plain spring grass with a few small wildflowers, matching the surrounding meadow |
| 1장 · 해안가 요새 (`fort`) | 6행 7열 · 4행 3열 | 4칸 | plain green grass on the cliff top with a few small stones, matching the surroundings |
| 2장 · 눈 덮인 산길 (`river`) | 9행 7열 · 4행 3열 | 5칸 | snow-covered ground with a small snowy pine sapling or a few snowy rocks, matching the surroundings |
| 4장 · 가을 왕도 (`city`) | 3행 4열 · 11행 7열 | 6칸 | lawn covered with fallen red and orange maple leaves, matching the surroundings |
| 5장 · 사막 오아시스 (`plain`) | 3행 6열 · 12행 4열 | 6칸 | golden sand with a small desert shrub, matching the surrounding dunes |
| 6장 · 정글 유적 (`ruins`) | 2행 7열 · 10행 3열 | 6칸 | mossy jungle ground with ferns and low tropical plants, matching the surroundings |
| 7장 · 화산 첨탑 (`tower`) | 9행 7열 | 6칸 | dark basalt ground with ash and small black rocks, matching the surroundings |
| 8장 · 제국 수도 (`capital`) | 6행 8열 · 5행 3열 | 6칸 | wet dark stone paving with a small stone flower planter, matching the surrounding plaza |
| FINAL · 수정 동굴 (`core`) | 12행 7열 · 8행 3열 | 6칸 | dark cave stone floor with a few tiny glowing crystal shards, matching the surroundings |

3장(원시림)은 발판 7칸 = 원거리 최대 5~6명이라 그대로 둡니다.

## 게임 쪽 변경 (그림이 오면 함께 적용)
`MAPS[id].noHigh`에 위 칸을 넣어 평지로 바꿉니다(나머지 지형은 그대로 유지).
```js
prologue: noHigh [[6, 3], [2, 6]]
fort: noHigh [[6, 5], [2, 3]]
river: noHigh [[6, 8], [2, 3]]
city: noHigh [[3, 2], [6, 10]]
plain: noHigh [[5, 2], [3, 11]]
ruins: noHigh [[6, 1], [2, 9]]
tower: noHigh [[6, 8]]
capital: noHigh [[7, 5], [2, 4]]
core: noHigh [[6, 11], [2, 7]]
```
