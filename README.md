# cnation TD · 아르카 방어전

cnation TACTICS(아르카 연대기)의 영웅·몬스터·지형으로 만든 세로형 모바일 디펜스 게임입니다.
탑 대신 **동료를 전장에 세워** 길을 따라 밀려오는 몬스터를 막습니다.

- 현재 버전: **ver.0.4.8 beta** — 프롤로그부터 FINAL까지 전체 10장, 영웅 6명·병사 5종·몬스터 30종·보스 10종
- 기획안: [`docs/GDD.md`](docs/GDD.md)

## 실행
빌드 과정이 없는 정적 사이트입니다. 저장소 루트를 그대로 Vercel·GitHub Pages에 올리면 됩니다.
로컬에서는 `python3 -m http.server 8080` 후 http://localhost:8080 을 엽니다.

## 파일
- `index.html` — 화면 틀과 CSS
- `js/data.js` — 캐릭터·스킬·몬스터·맵·장·축복 데이터
- `js/sim.js` — 전투 규칙(화면과 분리된 시뮬레이션)
- `js/game.js` — 3D 전장, 조작, UI, 저장
- `js/models.js` — cnation TACTICS에서 가져온 3D 모델 코드
- `vendor/three-r170.js` — three.js r170
- `tools/bot.js` — 밸런스 확인용 자동 플레이 (`node tools/bot.js all 4`, 보정은 `node tools/bot.js calibrate`)
- `tools/subset-fonts.py` — 게임에 쓰인 글자만 남기도록 폰트를 다시 만듭니다 (`pip install fonttools brotli`)
- `manifest.webmanifest`, `sw.js`, `icons/` — 홈 화면 추가(PWA). 아이콘은 임시이며, 최종 아이콘이 오면 `icons/` 안의 PNG만 바꾸면 됩니다
- `bgm/`, `fonts/` — cnation TACTICS와 같은 음악과 폰트 (폰트는 SIL OFL)
