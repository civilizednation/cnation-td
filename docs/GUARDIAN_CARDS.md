# 수호자 카드 2장 — 그림 요청서

전 장을 ★3으로 깨면 **「아르카의 수호자」**, 전 장을 빛나는 ★3(수정빛 별)으로 깨면 **「빛의 수호자」** 칭호와 카드를 줍니다.
깨는 순간 카드가 빛과 함께 화면 가득 떠오르고, 이후에는 타이틀 화면의 칭호를 누르면 언제든 다시 볼 수 있습니다.
받는 순간 "와!" 하고 기분이 날아갈 만큼 **화려하고 귀한 수집 카드**처럼 만드는 것이 목표입니다.

## 하는 법
1. 이미지 도구에 참고 그림을 첨부합니다.
   - `ref_heroes.png` — 영웅 6명(왼쪽부터 카일 · 리아 · 브란 · 세라 · 루나 · 네로). 카드 속 영웅의 옷 · 색 · 무기를 맞추는 용도
   - `ref_altar.jpg`, `ref_world.jpg` — 게임의 화풍(밝고 채도 높은 판타지 일러스트, 아르카 수정의 청록 빛)
   - 「빛의 수호자」 카드에는 `ref_crystal_star.jpg`(수정빛 별)도 첨부
2. 아래 카드별 프롬프트를 그대로 붙여 넣습니다.
3. **세로 2:3 비율, 1024 × 1536 px 이상**으로 받아 `card_guardian.png`, `card_light.png`로 저장해 보내 주세요.

## 꼭 지켜 주세요
- **글자를 그리지 마세요.** 카드 아래쪽 **빈 명패**(가로로 긴 장식 판)를 비워 두면, 게임이 그 위에 한글로
  칭호 · 달성 날짜 · 기록(별 개수, 플레이 시간, 가장 활약한 영웅)을 또렷하게 써 넣습니다. AI 그림 속 글자는 깨지기 쉽기 때문입니다.
- 카드 테두리 바깥은 단색 어두운 배경이면 됩니다(제가 카드 모양대로 잘라 냅니다).
- 영웅들은 게임처럼 **귀여운 블록(복셀) 인형** 느낌이 아니라, 같은 옷 · 색 · 무기를 한 **멋진 판타지 일러스트 버전**으로 그려도 됩니다
  (카드는 "영웅들의 진짜 모습"을 보여 주는 특별한 그림이라는 느낌).

## ① 아르카의 수호자 카드 (`card_guardian.png`) — 금빛
```
A luxurious collectible trading card, portrait 2:3, for the fantasy tower-defence game "Arca". The card is the
reward for perfecting every chapter, so it must feel precious, triumphant and joyful.

FRAME: an ornate polished GOLD frame with engraved runes, small inset cyan crystal gems at the four corners and a
large faceted cyan Arca crystal set at the top centre of the frame, radiating light. Thin glowing filigree lines run
along the frame. Subtle holographic foil shimmer on the gold.

ART (upper 70% of the card): the six heroes of the reference sheet standing together in a heroic victory pose on a
cliff top at sunrise, seen slightly from below, cinematic and joyful —
  centre: Kyle (young swordsman, brown hair, white tunic with blue cape) raising his glowing sword high;
  left of him: Ria (white-haired mage girl, lilac witch hat and robe) lifting her crystal staff with sparks of fire;
  far left: Bran (bearded warrior in grey armour) with his tower shield planted, grinning;
  right of Kyle: Sera (blonde archer, green hood) with bow raised;
  far right: Luna (pink-haired priestess, cream robe) with her golden staff glowing;
  slightly behind: Nero (black-masked rogue) crouching on a rock with twin daggers, a confident pose.
Behind them, the giant cyan Arca crystal shines in the sky, sending warm golden god-rays over a vast fantasy
landscape (spring village, coastal fort, snowy pass, forest, autumn capital, desert, jungle ruins, volcano, empire
city — the journey of the game) fading into the distance. Gold confetti, light petals and glittering particles in
the air. Warm golden morning light, rich saturated colours, painterly fantasy illustration matching the references.

BOTTOM (lower 30%): a wide ornamental golden NAMEPLATE banner, left COMPLETELY EMPTY (smooth dark navy enamel
inside the gold border) for text to be added later. Under it, three large golden stars in a row.

No text, no letters, no numbers, no logos, no watermark anywhere. Centered, symmetric composition, crisp details.
```

## ② 빛의 수호자 카드 (`card_light.png`) — 수정빛 (최고 등급)
```
An even MORE luxurious, legendary-rarity collectible trading card, portrait 2:3, for the fantasy game "Arca". It
is the highest honour, awarded for a flawless run, so it must look divine, radiant and breathtaking — clearly a
tier above a gold card.

FRAME: a frame made of translucent faceted CYAN CRYSTAL and white-silver metal (not gold), glowing from within,
with prismatic rainbow refractions at the edges, tiny floating crystal shards around it, and the same crystal-blue
star motif as the reference (faceted blue stars with a cross of light). A large radiant Arca crystal crowns the top
centre, emitting a halo and beams of white-cyan light. Holographic prism foil shimmer across the whole frame.

ART (upper 70%): the same six heroes from the reference sheet, now ASCENDED — floating in the air in a circle of
light around the giant Arca crystal at the heart of a crystal cave that opens onto a starry night sky; their
outfits keep their colours but are trimmed with glowing crystal light, soft wings of light behind them, their
weapons shining (Kyle's sword, Ria's staff, Bran's shield, Sera's bow, Luna's staff, Nero's daggers). Kyle at the
front centre, hand on his heart, serene and proud. Streams of cyan and white light spiral upward, crystal-blue stars
twinkle everywhere, aurora in the sky. Ethereal, holy, awe-inspiring; painterly fantasy illustration matching the
references, rich cyan / white / soft violet palette with small gold accents.

BOTTOM (lower 30%): a wide ornamental CRYSTAL NAMEPLATE banner, left COMPLETELY EMPTY (smooth deep-blue glowing
glass inside a silver-crystal border) for text to be added later. Under it, three large faceted crystal-blue stars
in a row, each with a cross of light.

No text, no letters, no numbers, no logos, no watermark anywhere. Centered, symmetric composition, crisp details.
```

## 게임 쪽 (그림이 오면)
- 카드 그림을 `art/card_guardian.webp`, `art/card_light.webp`로 넣고, 빈 명패 위에 한글로
  칭호 · 달성 날짜 · 전체 별 · 빛나는 별 · 총 전투 시간 · 가장 활약한 영웅을 씁니다.
- **달성하는 순간:** 화면이 어두워지고 빛기둥이 내려와 카드가 뒤집히며(앞면 등장) 화면 가득 떠오릅니다.
  빛 입자가 흩날리고 카드 위로 반짝이는 빛줄기가 지나가며 축하 효과음과 승리 음악이 납니다. 카드를 기울이면(드래그) 빛 반사가 따라 움직입니다.
- **타이틀 화면:** 로고 아래에 「⭐ 아르카의 수호자」 / 「💎 빛의 수호자」 칭호(둘 다 있으면 빛의 수호자)를 표시하고, 누르면 같은 연출로 카드가 다시 뜹니다.
- 카드 이미지 저장(공유용) 버튼도 둡니다.
