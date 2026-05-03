# Phase 0 + Phase 1 — Visual Verification Report

> Captured 2026-05-03 against the running Vite dev server (`npm run dev`).
> Reference: `docs/design/demos/demo-broadcast-v3.png` (locked Broadcast desktop)
> and `docs/design/demos/demo-broadcast-mobile-v2.png` (locked Broadcast mobile).

## Verdict matrix

| Route | Desktop (1280×800) | Mobile (390×844) | Theme console errors |
|---|---|---|---|
| `/` (index) | **PASS** | **PASS** | 0 |
| `/players.html` | PASS-with-FLAG | PASS-with-FLAG | 0 |
| `/rooms.html` | PASS-with-FLAG | PASS-with-FLAG | 0 |
| `/player-profile.html?handle=test_hao` | PASS-with-FLAG | PASS-with-FLAG | 0 |

**Zero BLOCK items.** Phase 0 + Phase 1 ship.

## What's in scope for this verification

- ✅ Token contract resolves (`verifyTokensPresent()` reports clean)
- ✅ `data-theme="broadcast"` cascades on all 4 pages
- ✅ Broadcast oklch palette applied — warm slate base, ember accent
- ✅ Fraunces / Inter Tight / DM Mono fonts loaded from Google Fonts
- ✅ Theme manager registers + mounts before first render
- ✅ Theme picker mounted into the settings drawer (single-theme placeholder UI)
- ✅ All existing components render without breakage
- ✅ Mobile layouts respect responsive breakpoints
- ✅ No console errors from theme code

## What was deferred (out of scope — explicitly noted in plan)

- ❌ DOM restructure to match the demo's `.activegame__head` / `.scorer` /
  `.pool-tile` scaffold pixel-perfect → **Phase 1.5 PR**
- ❌ Eliminating the 235 inline `style=""` attributes that still hardcode
  legacy palette values → **Phase 0b PR** (cosmetic since they happen to
  resolve to the same hex values today, but they'll prevent future themes
  from re-skinning those elements)
- ❌ Phases 2-5 (Linear, Trading, Atelier, Tea-Table) → separate PRs
- ❌ PNG export theme-awareness → Phase 5 work
- ❌ Visual regression CI (Percy/Chromatic) → Phase 5+ work

## FLAG batch (post-merge follow-ups)

Pre-existing issues surfaced during capture, NOT caused by Phase 0+1:

1. **Vite dev server doesn't proxy `/api/*` to Vercel functions.** Captures show
   "加载失败" / "加载中..." on players + rooms + profile. Errors look like
   `SyntaxError: Unexpected token '/', "// List an"...` — Vite returns the raw
   JS source of `api/players/list.js` and the API client tries to parse it as
   JSON. Resolution: use `vercel dev` for full-stack local dev, or stub `/api`
   in `vite.config.js`. Tracked separately — does not block this PR.

2. **Buttons with hardcoded inline styles still use legacy hex values.** Examples:
   `搜索` button (blue), `创建新玩家` (green), `管理模式` (red). These will
   re-skin properly once the Phase 0b inline-style migration lands.

## Reproduction

```bash
# Terminal 1 — boot dev server
npm run dev

# Terminal 2 — run capture
node scripts/visual/capture-broadcast.mjs
```

Output: `docs/reports/phase0-1-visual/{index,players,rooms,player-profile}-{desktop,mobile}.png`
