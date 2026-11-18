# cnation TD 효과음 제작 가이드 (Suno용)

게임에 쓰이는 효과음 28종의 **파일명 · 쓰이는 곳 · 목표 길이 · Suno 스타일 프롬프트**입니다.
파일명 그대로 만들어 한꺼번에 주시면, 앞뒤 불필요한 부분을 잘라 필요한 구간만 남기고 음량을 맞춰 `sfx/` 폴더에 넣겠습니다.
파일이 없는 효과음은 지금처럼 게임이 직접 합성한 소리로 대신 나오므로, 일부만 먼저 주셔도 됩니다.

## Suno에서 만드는 방법

1. **Custom** 모드로 만들고 **Instrumental**을 켭니다(가사 없음).
2. **Title**에 아래 파일명(예: `ui_tap`)을 그대로 넣습니다. 받은 파일 이름도 이 이름으로 맞춰 주세요.
3. **Style of Music** 칸에 아래 프롬프트를 붙여 넣습니다. 앞쪽 공통 문구와 각 효과음 문구를 함께 넣으세요.
4. Suno는 원래 음악을 만드는 도구라 30초~2분짜리 결과가 나옵니다. **괜찮습니다.** 원하는 소리가 처음 몇 초 안에 한 번이라도 또렷하게 들어 있으면, 제가 그 구간만 잘라 씁니다.
5. 한 번에 마음에 드는 소리가 안 나오면 2~3번 만들어 모두 주셔도 됩니다. 파일명 뒤에 `_2`, `_3`을 붙여 주시면 제가 가장 좋은 것을 고릅니다.
6. 파일 형식은 mp3나 wav 어느 쪽이든 됩니다.

### 모든 효과음에 공통으로 넣을 문구

```
game sound effect, one-shot, isolated, no music, no melody, no drums, no vocals, no background, short and clean, dry, mobile fantasy RPG, warm and soft, toy-like low-poly world,
```

게임 분위기: 판타지 RPG, 둥글고 따뜻한 로우폴리 3D 그래픽, 폰 스피커로 듣는 게임입니다. 너무 날카롭거나 거친 소리, 저음만 있는 소리는 폰에서 잘 안 들리므로 피합니다.

---

## 1. 화면 조작 (UI)

| 파일명 | 쓰이는 곳 | 목표 길이 | 스타일 프롬프트 (공통 문구 뒤에 붙임) |
|---|---|---|---|
| `ui_tap` | 버튼·초상화를 누를 때. 가장 자주 나옴 | 0.1초 | `single soft wooden click, tiny button tap, crisp but gentle, high-mid tone, very short` |
| `ui_confirm` | 저장하기 등 확인 | 0.3초 | `short pleasant confirm chime, two quick rising soft bell notes, positive, light` |
| `ui_error` | 배치할 수 없는 곳·골드 부족 | 0.3초 | `short soft error buzz, low muted wooden knock twice, gentle negative, not harsh` |
| `place_unit` | 캐릭터를 전장에 배치 | 0.5초 | `hero lands on the ground, soft boots thump with a small armor clink and a tiny sparkle, satisfying placement` |
| `rank_up` | 랭크업(★ 상승) | 0.8초 | `power up sparkle, rising magical shimmer with a bright chime at the end, rewarding level up` |
| `coin` | 몬스터 처치 골드 획득. 아주 자주 나옴 | 0.3초 | `single small gold coin clink, bright and light, quiet, not jingly` |

## 2. 전투 공격

| 파일명 | 쓰이는 곳 | 목표 길이 | 스타일 프롬프트 |
|---|---|---|---|
| `hit_melee` | 근접 기본 공격(카일·브란·네로·민병·방패병). 매우 자주 | 0.3초 | `quick sword slash whoosh with a soft blade impact, light and punchy, not bloody` |
| `hit_arrow` | 활 기본 공격(세라·사냥꾼). 매우 자주 | 0.4초 | `bow string twang and fast arrow whoosh ending in a soft thunk, light` |
| `hit_magic` | 마법 기본 공격(리아·루나·수습 마도사·수습 사제). 매우 자주 | 0.4초 | `small magic bolt, soft sparkling zap with a gentle pop on impact, light arcane` |
| `monster_die` | 몬스터가 쓰러질 때 | 0.5초 | `cute monster defeat, soft poof puff of smoke with a tiny squeak, cartoony, not gory` |

## 3. 스킬 (속성별, 스킬이 나갈 때)

| 파일명 | 쓰이는 곳 | 목표 길이 | 스타일 프롬프트 |
|---|---|---|---|
| `skill_fire` | 불 스킬(화염검·파이어·파이어 스톰·화염 화살 등) | 0.8초 | `fire spell, quick flame burst whoosh with crackling embers, warm` |
| `skill_ice` | 물·얼음 스킬(프로스트·얼음 베기·얼음 화살 등) | 0.8초 | `ice spell, crystalline freezing crackle with a glassy chime, cold sparkle` |
| `skill_wind` | 바람 스킬(폭풍 베기·회오리 폭풍·질풍 화살 등) | 0.8초 | `wind spell, swirling gust whoosh, airy and fast` |
| `skill_thunder` | 번개 스킬(썬더) | 0.8초 | `lightning spell, sharp electric zap and short thunder crack, bright` |
| `skill_light` | 빛 스킬(홀리·아르카 참격 등) | 0.8초 | `holy light spell, radiant shimmering chime with a soft choir-like pad, brief, angelic` |
| `skill_dark` | 암흑 스킬(침묵의 표식·월식 등) | 0.8초 | `dark shadow spell, low eerie whoosh with a muffled magical thud, mysterious` |
| `heal` | 힐·정화·응급 치료 | 0.8초 | `healing spell, gentle rising sparkling chimes, soft and soothing, restorative` |

## 4. 필살기

| 파일명 | 쓰이는 곳 | 목표 길이 | 스타일 프롬프트 |
|---|---|---|---|
| `ult_ready` | 영웅의 필살기가 준비됐을 때 알림 | 0.6초 | `ready notification, bright magical ding with a short shimmer, alert but friendly, distinct` |
| `ult_cast` | 필살기 발동(폭발 연출과 함께) | 1.8초 | `epic special attack, powerful rising whoosh into a big magical explosion boom with sparkling debris, cinematic impact, heroic` |

## 5. 위기·피해

| 파일명 | 쓰이는 곳 | 목표 길이 | 스타일 프롬프트 |
|---|---|---|---|
| `crystal_hit` | 몬스터가 아르카 수정에 닿아 생명이 줄 때 | 1.0초 | `magic crystal cracking alarm, glassy crack with a low warning tone, urgent but short` |
| `ally_down` | 아군 캐릭터가 쓰러질 때 | 1.0초 | `hero falls, soft body thud on the ground with a sad descending chime` |

## 6. 전투 진행·보스

| 파일명 | 쓰이는 곳 | 목표 길이 | 스타일 프롬프트 |
|---|---|---|---|
| `battle_start` | 전투 시작 | 1.5초 | `short war horn call, single heroic horn blast, fantasy battle begins` |
| `wave_clear` | 장 중간의 전투 하나를 이겼을 때 | 1.5초 | `short victory jingle, three bright brass notes rising, cheerful small fanfare` |
| `boss_appear` | 보스 등장·보스가 다음 단계로 강해질 때 | 2.5초 | `boss appears, deep ominous gong hit with a monstrous roar, rumbling, dramatic` |
| `boss_attack` | 보스의 광역 공격·조준 광선 경고 | 1.2초 | `heavy boss area attack, deep shockwave whoosh and rumbling impact, menacing` |

## 7. 보상·결과

| 파일명 | 쓰이는 곳 | 목표 길이 | 스타일 프롬프트 |
|---|---|---|---|
| `blessing` | 에테르 축복 선택(이번 장에서만) | 1.2초 | `ethereal blessing, airy sparkling shimmer with soft wind chimes, light blue magic` |
| `legacy` | 아르카의 유산 선택(영구) | 1.8초 | `grand golden reward, warm glowing chime swell with a deep resonant bell, majestic and permanent` |
| `defeat` | 패배(수정이 깨짐) | 2.5초 | `sad defeat sting, slow descending soft notes with a shattering crystal, melancholic, short` |

---

## 받은 뒤 제가 하는 작업

1. 각 파일에서 소리가 시작되는 지점을 찾아 앞의 무음과 잡음을 자르고, 목표 길이에 맞춰 뒤를 짧게 페이드아웃합니다.
2. 효과음끼리 크기가 비슷하게 들리도록 음량을 맞춥니다. 자주 나오는 `hit_*`, `coin`, `ui_tap`은 조금 작게, 필살기·보스는 조금 크게 맞춥니다.
3. 모노 mp3(작은 용량)로 바꿔 `sfx/<파일명>.mp3`에 넣고, 게임 코드의 `SFX_READY` 목록에 등록합니다.
4. 실제 화면에서 겹쳐 들리는 정도를 확인하고, 필요하면 자주 나오는 소리의 최소 간격을 조정합니다.

배경 음악(TACTICS 원작 곡)은 그대로 씁니다. 바꾸고 싶은 곡이 있으면 따로 알려 주세요.
