# Guandan Scorer — UX Flows (companion to GAME-TRUTH.md)

> Generated 2026-05-03 after demo-v2 review caught critical UX surface omissions.
> v1/v2 demos showed only the post-victory state. **95% of session time is mid-ranking** — that's what v3 must lead with.
> Read alongside GAME-TRUTH.md before any visual proposal.

---

## 1. The Hot Path: Active Gameplay (Rank Placement)

This is the loop:

1. Round starts at known level (e.g., Round 5, level 4, Red owns)
2. Players play the hand at the table
3. Host enters finishing positions:
   - **Desktop:** drag player tiles from the **玩家池** (player pool) into ranking slots **一/二/三/四/五/六** (drag-and-drop via `src/player/dragDrop.js`)
   - **Mobile:** tap a slot to "activate" it, then tap a player from the pool — they land. Long-press also works (`src/player/touchHandler.js`, 200ms threshold). Tap-to-select is more discoverable than drag on touch.
4. When all slots filled:
   - If `autoApply` ON (default): result auto-calculates → levels update → next round starts
   - If `autoApply` OFF: host clicks **应用结果到战绩** then **进入下一局**
   - If `autoNext` OFF: levels update but stay on current round screen until manual advance
5. Loop until 通关

### Visual requirements per theme

Every demo MUST show:
- Two team panels with current levels (card glyphs)
- Round-owner banner ("本局：4 · 红队的级")
- **玩家池** clearly labeled — contains unranked players, drag/tap source
- **Ranking slots** labeled 一/二/三/四/五/六 (or 1-4 / 1-8 depending on mode)
- ONE slot in **drop-target highlight state** to show the interaction model
- ONE player tile in **dragging/pressed state** (mid-flight visualization)
- **Auto-apply** + **auto-advance** toggles visible (with default-on state)
- **应用结果** + **进入下一局** buttons (manual mode fallback)
- **Mode selector** (4 / 6 / 8 segmented control)

---

## 2. Auto-Advance Flow

Default mode: place all players → auto-calculate → auto-advance → ready for next round. Host barely touches anything.

```
[Place player 1] → [Place player 2] → ... → [Place last player]
                                              ↓ 200ms
                                            [Calc upgrade]
                                              ↓
                                            [Update levels]
                                              ↓
                                            [Advance round, refill pool]
                                              ↓
                                            [Ready for next ranking]
```

When toggled off, the manual buttons appear. Demo should show both states clearly.

---

## 3. Navigation IA — 4 Surfaces

The app spans 4 HTML pages today:

| URL | Purpose | Tab label |
|---|---|---|
| `index.html` | Active game scoring | 游戏 (Game) |
| `players.html` | Search/browse all players | 玩家 (Players) |
| `rooms.html` | Active rooms + favorites | 房间 (Rooms) |
| `player-profile.html` | Individual profile (linked) | 我的资料 (Profile) |

### Visual requirements per theme

Persistent nav visible from any view. Current view marked active.

| Theme | Nav placement |
|---|---|
| **A · Broadcast** | Top tabs in editorial-style with Fraunces label |
| **C · Tea-Table** | Top horizontal serif Chinese characters (游戏 · 玩家 · 房间 · 资料) |
| **D · Trading** | Top status-bar-style with monospace tags `[NAV] GAME · PLAYERS · ROOMS · ME` |
| **E · Linear** | Sidebar (desktop) / bottom tab bar (mobile) — already does this |
| **F · Atelier** | Minimal top nav with generous space, serif labels |

**Mobile pattern:** bottom tab bar (iOS native) is most discoverable except where a theme has a strong reason otherwise (Atelier prefers immersion).

---

## 4. Settings / Custom Rules

Reference: `index.html:241-296` — the collapsed `<details>` for custom rules.

Configurable per mode:
- **4-player upgrade table:** (1,2)=+3, (1,3)=+2, (1,4)=+1
- **6-player thresholds + position points:** thresholds [+3≥7, +2≥4, +1≥1]; points [1=5, 2=4, 3=3, 4=3, 5=1, 6=0]
- **8-player thresholds + position points:** thresholds [+3≥11, +2≥5, +1≥0]; points [1=7…8=0]

Plus toggles:
- `autoApply` — 排名完成后自动应用结果
- `autoNext` — 应用后自动进入下一局
- `strictA` — 严格A级规则
- `must1` — 仅有1方可升级

### Visual requirements per theme

A collapsed drawer/panel showing **current settings preview** + expand affordance:
- Default: compact 1-2 line preview (e.g., `自动 · 严式 · must1` chips)
- Tappable/clickable to expand into full editor
- Theme-styled:
  - **Trading:** monospace config rows like `T6_3 = 7` (env-style)
  - **Atelier:** italic editorial small text in a quiet sidebar
  - **Linear:** standard settings panel with proper form controls
  - **Broadcast:** broadcast-style stat-card grid
  - **Tea-Table:** scholar's notation with serif column labels

---

## 5. Mode Selector (4 / 6 / 8)

Top of player-setup section. Switching mode:
- Resets the ranking
- Adjusts slot count (4/6/8)
- Adjusts upgrade math (different per mode)

**Visual requirements:** segmented control or radio chip group prominently visible. Current mode highlighted.

---

## 6. Secondary Surfaces (already covered in v2 — keep these)

- **Victory moment** (通关 modal) — shown as a SMALLER "示例 · 通关时刻" sample within the page, not the hero
- **History** (last 3-5 rounds, with rollback affordance hint)
- **Honors gallery** (16-honor system context, 6 currently earned)
- **Player profile snippet** (career stats, partner/rival)

---

## 7. What v1/v2 Demos Got Wrong (Don't Repeat)

| # | Miss | Why it matters |
|---|---|---|
| 1 | Showed only post-victory state | Active gameplay is 95% of time |
| 2 | No visible interaction model for rank placement | THE primary interaction of the app |
| 3 | No 玩家池 visible | Half the drag-drop story |
| 4 | No top/bottom navigation between 游戏/玩家/房间/资料 | App is 4 pages, not 1 |
| 5 | No auto-apply + auto-advance toggles | Core UX flow |
| 6 | No mode selector (4/6/8) | First decision in any session |
| 7 | No custom rules panel | Power-user surface |
| 8 | Mobile prioritized victory hero | Should prioritize active ranking |

---

## 8. v3 LOCKED SCENARIO (PRIMARY = active gameplay)

### State at the moment of the screenshot

- **Mode:** 6-player (3v3)
- **Round 5 in progress** (4 rounds played prior)
- **Round level: 4** (Red's round — "本局：4 · 红队的级")
- **Team Red 红队 (Level 4):** 老张 @laozhang, 阿伟 @awei, 大刘 @daliu
- **Team Blue 蓝队 (Level 3):** 小王 @xiaowang, 阿明 @aming, 小美 @xiaomei

### Mid-ranking interaction state (the hero of the demo)

| Slot | Status | Player |
|---|---|---|
| 一 (头游) | ✓ filled | 阿伟 (Red) |
| 二 | ✓ filled | 小王 (Blue) |
| **三** | **● drop-target highlighted** | (drag in flight — see below) |
| 四 | empty | — |
| 五 | empty | — |
| 六 (末游) | empty | — |

**玩家池 (player pool, contains 4 unranked players):**
- **大刘 (Red) — currently mid-drag toward slot 三** (show this with hover-shadow / lifted state on desktop, or "selected" state on mobile)
- 阿明 (Blue)
- 小美 (Blue)
- 老张 (Red)

### Settings state (default ON for all)
- ✓ 排名完成后自动应用结果 (autoApply)
- ✓ 应用后自动进入下一局 (autoNext)
- ✓ 严格A级规则 (strictA)
- ✓ 仅有1方可升级 (must1)

### Recent history (4 rounds, plausible — agents may use these or interpolate)

| # | 级牌 | 胜方 | 组合 | 升级 | 红 | 蓝 |
|---|---|---|---|---|---|---|
| 1 | 2 | 红 | (1,2,5) | 升2级 | 4 | 2 |
| 2 | 4 | 蓝 | (1,3,4) | 升1级 | 4 | 3 |
| 3 | 3 | 红 | (1,2,4) | 升0级 (must1 not met) | 4 | 3 |
| 4 | 3 | 红 | (1,3,5) | 升0级 (diff < threshold) | 4 | 3 |
| 5 | 4 | (in progress) | — | — | — | — |

### Sample victory state (shown as smaller secondary section, NOT hero)

A compact preview labeled "示例 · 通关时刻" (Sample · Championship Moment) showing what 红队A级通关 looks like when achieved — using the previous v2 scenario but at smaller size. This shows users WHERE the game can end without dominating the active-game screen.

### Honors progress (4 rounds in, 16-system)

Most honors aren't earned yet — show a "进行中" (in-progress) indicator on the gallery with current candidates:
- 吕布 (most 1st): 阿伟 leading (2/4 1sts)
- 阿斗 (most last): TBD
- 节奏核心 (team-leading tempo pressure): 老张 leading (team context)
- (others: 进行中 placeholder)

### Player profile snippet (for 阿伟 @awei — career stats)

Same as v2: Sessions 47, won 29 (61.7%), rounds 412, avg 2.84, time 38h22m, votes 23/2, top partner @laozhang (75%), top rival @xiaowang (lost 58%).

---

## 9. Section Order for v3 Demos

This is the ORDER of sections, top to bottom:

1. **Top navigation** (theme-styled, 4 surfaces)
2. **Header strip** (room code · mode · round + level + owner · elapsed · sync)
3. **Mode selector** (4 / 6 / 8 segmented control, 6 active)
4. **Two team panels** (current levels 4 / 3, rosters with team color)
5. **🟢 ACTIVE GAME** (the hero):
   - Round-owner banner
   - 玩家池 (4 players, 1 mid-drag/selected)
   - Ranking slots (2 filled, 1 drop-target, 3 empty)
   - Auto toggles row
   - Manual buttons (greyed since auto is on, but visible)
6. **Calculation preview** (live calc as ranks fill — currently showing "等待最后4位")
7. **Custom rules drawer** (collapsed, with preview chips)
8. **Recent history** (4 rounds + R5 marker)
9. **Honors gallery** (16-system, in-progress markers)
10. **示例 · 通关时刻** (smaller sample of victory state)
11. **Player profile snippet**

For mobile, the ORDER stays similar but bottom nav replaces top nav, and section 5 (active game) is the FIRST scrollable content after header.
