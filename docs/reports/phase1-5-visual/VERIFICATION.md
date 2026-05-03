# Phase 1.5 — Visual Verification Report

> Captured 2026-05-03 against `npm run preview` build, BASE_URL=http://localhost:4173.
> Reference: `docs/design/demos/demo-broadcast-v3.html` (the locked target).

## Verdict matrix

| Route | Viewport | Verdict | Notes |
|---|---|---|---|
| index | desktop | **PASS** | Top nav + ticker + 4/6/8 mode buttons + HUGE Fraunces level glyphs (200px) on team scoreboard + empty player pool/ranking grid (default state) + 16 editorial honor cards + "A级通关" sample/championship hero + profile snippet + footer. All sections from demo-broadcast-v3.html render. |
| index | mobile | **PASS** | Single-column stacked layout. Card-level glyph scales to 140px. Pool/slots collapse to 2-col / vertical. Honors 2-col. All sections preserved. |
| players | desktop | **PASS** | Top nav with PLAYERS tab active (orange underline + accent color). "玩家浏览器 · PLAYER REGISTRY" section rule. Editorial search block. API failure ("加载失败") expected — preview build has no backend; chrome renders correctly. |
| players | mobile | **PASS** | Vertical stack. Search input + 创建玩家 + 管理模式 buttons stack. Section rules wrap. Footer reflows. |
| rooms | desktop | **PASS** | Top nav with ROOMS active. Editorial sub-ticker showing TOTAL / FILTER / LIVE indicator. Section rule with "GAME NIGHT BROADCAST" tagline. Filter chips (全部房间 / ★收藏) styled per theme. Empty/error state shows in editorial typography. |
| rooms | mobile | **PASS** | Single column. Sub-ticker stays visible. Filter chips wrap. |
| player-profile | desktop | **PASS** | Top nav with PROFILE active. "玩家档案 · PLAYER PROFILE" section rule. Error state ("无法加载玩家资料 · LOAD ERROR") rendered in Fraunces — editorial fallback works. |
| player-profile | mobile | **PASS** | Stacked. Editorial error card. Footer reflows. |

## FLAG items (non-blocking, follow-up)

- **F1: Mobile nav label wrapping** — On narrow viewports (~390px), Chinese tab labels (游戏/玩家/房间/我的资料) wrap to 2 lines because the topnav doesn't add `white-space: nowrap`. Readable, not broken. Tightening with `nowrap` + slightly smaller font on `<480px` would clean it up. *Filed for follow-up; not blocking the merge.*

- **F2: Ticker IDs (`#tickerMode`, `#tickerLevel`, `#tickerOwner`, `#tickerRound`) are static placeholders** — JS doesn't currently update them. Future state: wire to `state.js` so ticker reflects live round + level + owner + mode. *Already noted in subagent report.*

- **F3: `.sample` and `.profile` snippet sections at bottom of `index.html` are placeholders** — Show "—" / "@—". Future state: bind to last-victory data and currently-selected player. *Already noted; intentional per spec.*

## BLOCK items

None.

## Other observations

- All builds succeed (`npm run build` → 64 modules transformed, 437-499ms).
- Preview server boots cleanly on :4173.
- No console errors related to theme mounting; the only console errors are API 404s (no backend in preview), which is expected.
- All ~130 JS-bound IDs verified preserved across all 4 pages (per subagent reports).

## What's visible vs. what was Phase 0+1

| | Phase 0+1 (shipped) | Phase 1.5 (this PR) |
|---|---|---|
| Token contract + theme manager | ✓ | ✓ |
| Broadcast palette + typography | ✓ (subtle) | ✓ |
| Top nav (editorial brand + tabs + user identity) | — | ✓ |
| Ticker strip (game page) | — | ✓ |
| Sub-ticker (rooms page) | — | ✓ |
| HUGE 200px Fraunces level glyphs | — | ✓ |
| Card-rank scoreboard structure (`.team__head`, `.card-level`, `.versus`) | — | ✓ |
| Editorial player pool / ranking slots | — | ✓ (structural) |
| 16 honor card editorial layout | — | ✓ |
| "A级通关" sample/championship hero | — | ✓ |
| Profile snippet | — | ✓ |
| Footer with editorial brand | — | ✓ |
| Cross-page consistent shell | — | ✓ (4/4 pages) |
| Mobile responsive | partial | ✓ |
