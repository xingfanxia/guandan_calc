# Guandan Scorer — Game Logic Truth (for redesign work)

> Generated 2026-05-03 from `src/game/{calculator,rules,history}.js`, `src/core/state.js`, `index.html`.
> This is the ground truth for any visual proposal. **Read FIRST** — do NOT design from generic concepts.

---

## 1. Levels are CARD VALUES, not abstract numbers

```js
const LEVELS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
// src/game/calculator.js:125
```

A team at "level 7" is **playing card-rank 7**. The progression goes **2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → J → Q → K → A**. Reaching A means *clearing the championship round* (通关).

**Visual opportunity:** levels SHOULD be displayed as cards or card-faces, not numerals. The 12-step progression IS the central narrative arc.

---

## 2. Round mechanics

Each round (本局) has:
- **Round level** (本局级牌) — the card rank being played this round
- **Round owner** (本局所有者) — the team whose level this round is at
- **Next round preview** (下局级牌) — shown when manual-advance mode is on

After a round, the WINNING team's NEW level becomes the next round's level. Winner becomes new round owner.

The round-owner concept matters enormously for A-level wins: in **strict mode** (default), you can only win the championship at YOUR OWN A-level round.

---

## 3. Mode-specific upgrade math

### 4-player (2v2) — fixed table
- (1st, 2nd) = +3 levels (双下 / sweep)
- (1st, 3rd) = +2 levels
- (1st, 4th) = +1 level
- No 1st place = 0 (must1 rule)

### 6-player (3v3) — point-based
- Position points (default): 1=5pt · 2=4pt · 3=3pt · 4=3pt · 5=1pt · 6=0pt
- Calculate winning team's score sum vs opp score sum
- Threshold (default): diff ≥ 7 → +3 · ≥ 4 → +2 · ≥ 1 → +1 · else 0
- "must1" rule: no 1st = no upgrade (toggleable in settings)

### 8-player (4v4) — point-based + sweep bonus
- **Sweep (1,2,3,4) → +4 levels** (special case — most dramatic moment)
- Otherwise: 1=7pt down to 8=0pt; thresholds ≥11 → +3, ≥5 → +2, ≥0 → +1
- "must1" rule applies

---

## 4. A-level rules (the climax)

When a team is at level A:

| Condition | Strict A mode | Lenient A mode |
|---|---|---|
| Win at own A round, no 末游 | **通关** ✓ | **通关** ✓ |
| Win at own A round, has 末游 | A-fail counter +1 | Stay at A, keep playing |
| Win at opponent's round | Not 通关; return to own A | Not 通关; return to own A |
| Lose at own A round | A-fail counter +1 | Stay at A, keep playing |
| 3 own-A failures | **Demote that team to level 2** | No demotion |

- **通关 condition in both modes**: must win at YOUR OWN A-level round AND have no 末游
- **Strict mode** (default): failed own-A attempts increment A1/A2/A3 and the third failure demotes that team to 2
- **Lenient mode**: own-A failures do not increment counters or demote; teams keep playing until a valid own-A clear
- `roundOwner` is authoritative when both teams are at A; do not infer owner from matching levels.

---

## 5. Terminology glossary (USE THIS, not English equivalents)

| Term | Meaning |
|---|---|
| 级牌 | "level card" — current card rank for the round |
| 本局 | this round / this hand |
| 本局级牌 | current round's level card |
| 下局级牌 | next round's level card (preview) |
| 通关 | "clear" — winning at A (championship victory) |
| 升级 / 升X级 | upgrade / upgrade by X levels |
| 不升级 | no level up |
| 头游 | 1st place ("head tour") |
| 二游 | 2nd place |
| 末游 | last place ("tail tour") |
| 双下 / 大D | "double down" — 1st AND 2nd from same team (sweep) |
| A失败 (A1/A2/A3) | Strict-mode own-A failure count; 3 resets that team to 2 |
| 回滚至此前 | rollback to before this round |
| 撤销上一局 | undo last round |
| 待排名玩家 | players awaiting ranking |
| 玩家池 | player pool (drag source for ranking) |
| 应用结果到战绩 | apply result to record |
| 进入下一局 | enter next round |
| 历史战绩 | historical records |
| 多人房间 | multi-player room |
| 房主 | host/room owner |
| 观众 | viewer |
| 人民的声音 | "voice of the people" — voting system |
| 很C / 最C | top performer / vote winner (positive) |
| 很闹 / 最闹 | worst performer / vote winner (negative) |
| 荣誉提名 | honor nomination |
| 特殊荣誉 | special honors (the 16-honor system) |
| 玩家排名统计 | player ranking statistics |

---

## 6. The Honors System — 16 honors (NOT 14)

Source: `index.html:341-407`. Each is a CHARACTER ARCHETYPE with cultural depth.
The live system waits for at least 5 rounds before awarding these full-session
honors; earlier states remain "数据采集中" to avoid noisy small-sample labels.

| Honor | 解释 | Reference |
|---|---|---|
| 吕布 | 最多第一名 | Three Kingdoms warrior — King of First |
| 阿斗 | 最多垫底 | Liu Bei's "useless heir" — Bottom Dweller |
| 石佛 | 优秀且稳定 | "Stone Buddha" calm — Excellence + Stability |
| 波动王 | 排名波动最大 | Volatility King |
| 奋斗王 | 排名稳步提升 | Comeback King — steady improvement |
| 翻车王 | 前3掉垫底 | Crash King — top-3 to last |
| 赌徒 | 高风险高回报 | The Gambler |
| 大满贯 | 体验所有排名 | Grand Slam — all positions |
| 连段王 | 连续好排名 | Top-Half Streak King |
| 团队中轴 | 队内支点 | Team Anchor — consistently above teammate average |
| 逆转核心 | 惊天逆转 | Comeback Core — low-to-high comeback arc |
| 保底核心 | 队伍保底 | Safety Net — no-last team floor |
| 节奏核心 | 队伍节奏 | Tempo Core — team-leading pressure |
| 燃尽王 | 后程坠落 | Burnout King |
| 棋差一着 | 差点登顶 | One Move Short |
| 抗压王 | 低谷反弹 | Pressure Rebound — rebounds after bottom-tier pressure rounds |

**Visual opportunity:** these aren't generic badges — they're literary references. They deserve typography/illustration that respects their gravity. v1 demos used 6 abstract badges; the real system has 16 with story.

---

## 7. MVP — TWO CONCEPTS, NOT ONE

The app distinguishes:

1. **Algorithmic Session MVP** — player with **lowest average ranking** across the session (e.g., avg rank 2.41 wins). Lower is better. NOT the last-round winner.
2. **Voted Most-C (最C)** — player with most viewer votes via 人民的声音 system

These can be DIFFERENT people. Voted MVP reflects vibe/momentum/personality; algorithmic MVP reflects raw consistent performance.

**Visual opportunity:** dual-MVP treatment — show both, distinguish them visually. Could be the most distinctive moment in the app.

---

## 8. Real-time room sync architecture

- Host syncs every 10s + immediate sync on `apply` / `advance`
- Viewers poll every 2s with timestamp-diffing (`roomManager.js:331`)
- Room codes: 6-digit alphanumeric (e.g., A1B2C3)
- Auth: viewer can vote but not control; host has bearer token
- The "live" feel matters — there's a real audience watching

---

## 9. LOCKED SCENARIO for the rebuilds

Both demos must use this scenario so they're directly comparable.

### Setup
- **Mode:** 6-player (3v3)
- **Round 22 just finished — 红队 A级通关!** 🎉

### Pre-round state
- Red at **A**, Blue at **8**, round level **A**, owner **Red** (Red's A round)

### Teams
- **红队** (Red, Level A → 通关):
  - 老张 @laozhang
  - 阿伟 @awei (session MVP)
  - 大刘 @daliu
- **蓝队** (Blue, Level 8):
  - 小王 @xiaowang
  - 阿明 @aming (session burden)
  - 小美 @xiaomei

### Round 22 final positions
| 名次 | 玩家 | 队伍 | 标签 |
|---|---|---|---|
| 1 (头游) | 阿伟 | 红 | — |
| 2 | 大刘 | 红 | — |
| 3 | 小王 | 蓝 | — |
| 4 | 老张 | 红 | — |
| 5 | 小美 | 蓝 | — |
| 6 (末游) | 阿明 | 蓝 | — |

### Calculation
- 红 ranks: [1, 2, 4] → score 5 + 4 + 3 = **12**
- 蓝 ranks: [3, 5, 6] → score 3 + 1 + 0 = **4**
- Diff: 12 − 4 = **8** (≥ 7 → +3 tier)
- Has 头游, no 末游, at own A → **通关** 🎉

### Last 5 rounds (history table)
| # | 级牌 | 胜方 | 组合 | 升级 | t1红 | t2蓝 |
|---|---|---|---|---|---|---|
| 18 | J | 红 | (1,2,5) | 升2级 | K | 5 |
| 19 | K | 红 | (1,3,4) | 升1级 | A | 5 |
| 20 | A | 蓝 | (1,3,5) | 蓝升1级 | A | 6 |
| 21 | 6 | 蓝 | (1,2,4) | 升2级 | A | 8 |
| 22 | A | 红 | (1,2,4) | **A级通关** | A 🏆 | 8 |

### Session totals
- 22 rounds played, 47:23 elapsed
- **Algorithmic MVP**: 阿伟 @awei (avg rank **2.41** across 22 rounds, **8 first places**)
- **Algorithmic Burden**: 阿明 @aming (avg rank **4.86**)
- **Voted 最C**: 阿伟 @awei (**12 votes** from 人民的声音)
- **Voted 最闹**: 阿明 @aming (**10 votes**)

### Honors earned this session (use these 6 in honor gallery)
| Honor | Player | Stat |
|---|---|---|
| 吕布 | 阿伟 | 8/22 first places |
| 石佛 | 阿伟 | top 25%, low variance |
| 阿斗 | 阿明 | 8/22 last places |
| 节奏核心 | 老张 | 75% team-leading rounds with active pressure |
| 保底核心 | 大刘 | no-last team safety net |
| 大满贯 | 小美 | finished in every position 1-6 |

### Player profile snippet (for 阿伟 @awei — career stats, NOT just this session)
- Sessions: **47** played • **29** won (61.7% wr)
- Rounds: **412** played
- Avg ranking (career): **2.84**
- Total play time: **38h 22m**
- Career votes: **23** 最C • **2** 最闹
- Top partner: **@laozhang** (24 sessions, 75% wr together)
- Top rival: **@xiaowang** (31 sessions facing, lost 58%)

---

## 10. What v1 demos got wrong (don't repeat)

1. ❌ Levels shown as plain numerals "7", "5" → **should be CARD VALUES** (J, Q, K, A glyphs)
2. ❌ "Ranking positions 1-6" with cryptic placeholder labels → **use 头游/二游/末游 terminology** + clear player tile placement showing team color
3. ❌ Missing "round owner" concept → must show whose level this round is at (e.g., "本局：A · 红队的级")
4. ❌ Missing "下局级牌" preview chip
5. ❌ Used 14 honors → actually **16, including 抗压王** (pressure-rebound honor)
6. ❌ Didn't distinguish algorithmic MVP from voted MVP → show both separately
7. ❌ Missing the **玩家池** (player pool drag-source) above ranking slots
8. ❌ Missing "应用结果" + "进入下一局" two-button workflow (manual mode)
9. ❌ History table didn't show 升X级 / 通关 / aNote columns
10. ❌ Missing A级 chip with strict-mode toggle indicator

---

## 11. Visual opportunities specific to Guandan

1. **Cards as primitive** — levels ARE cards. Display them as cards (with suit? without?). The 2→A progression is a card-by-card climb.
2. **Character archetypes** — honors have 2,000-year-old cultural depth. Treat them as portraits/sigils, not Bootstrap badges.
3. **Round owner narrative** — "this is Red's A round" is dramatic storytelling.
4. **Dual MVP** — algorithmic vs voted is a real tension worth surfacing.
5. **The climb to A** — 12 levels to reach A, then must defend. Worth visualizing as a journey, not a counter.
6. **Live broadcast mode** — viewers polling every 2s, host syncing every 10s. Real "live" feel.
7. **Voting moment** — 人民的声音 is theatrical. Worth a hero treatment.
