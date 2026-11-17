# cnation TD · 아르카 방어전

cnation TACTICS(아르카 연대기)의 영웅·몬스터·지형으로 만든 세로형 모바일 디펜스 게임입니다.
탑 대신 **동료를 전장에 세워** 길을 따라 밀려오는 몬스터를 막습니다.

- 현재 버전: **ver.0.1.0** (프롤로그 한 장을 끝까지 플레이할 수 있는 프로토타입)
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
- `tools/bot.js` — 밸런스 확인용 자동 플레이 (`node tools/bot.js 0 6`)
