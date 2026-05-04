# Theme System Handoff — 2026-05-03

> Sessions: theme system Phase 1.5 closure + Phase 2 (Linear) ship + UX polish pass + Phase 3 (Trading) ship.
> All commits on `main`. See `git log` from `1de8a7e` through `c90a6d9`.

## Where we are

| Phase | Description | Status |
|---|---|---|
| 0 + 1 | Token contract + Broadcast palette + theme manager + ThemePicker | **MERGED** (94b648b, PR #1) |
| 1.5 | Editorial closure of all Broadcast sections — ~92% match vs demo (per-section ≥95% individually except profile snippet which was deleted) | **SHIPPED** (99fcf5b) |
| 2 | Linear / Vercel Console theme — second registered theme, density-first restyle | **SHIPPED** (cf211a6) |
| 2.5 (polish) | UX polish, dev infrastructure, room banner theming | **SHIPPED** (commits ed4b94e → 10bb01b) |
| 3 | Trading Terminal theme — third registered theme, JetBrains Mono + amber HUD on near-black, 1px borders, ASCII bracket flair, fixed grid background overlay. CSS-only re-paint of the same DOM. Desktop + 390px mobile pass both captured. | **SHIPPED** (9883e1d, c90a6d9) |
| 4 | Atelier Console theme | TODO |
| 5 | Tea-Table theme (needs commissioned ink illustrations) | TODO |
| — | Sidebar layout for Linear via `layout.mount()` + state preservation across switches (was Phase 2.5; deferred — still the canonical infra TODO) | TODO |
| — | Sparkline renderer + flip Trading's `featureManifest.sparklines` to `true` | **SHIPPED 2026-05-04** (commit 72f18e0) — `src/themes/_shared/sparkline.js`, wired into `src/stats/statistics.js`; Trading shows 近况 column. Visual baseline: `docs/reports/phase3-5-sparklines/`. |
| — | Visual regression CI (Percy / Chromatic / pixelmatch) | TODO |
| — | PNG export theme-awareness | TODO (Phase 5) |

## What shipped this session

### A. Editorial Phase 1.5 closure (commit 99fcf5b)

Pushed Broadcast theme from ~40% to ~92% match vs `docs/design/demos/demo-broadcast-v3.png`. New live-data sync modules:

- `src/ui/calcPreviewSync.js` — 红/蓝/差距 segments per ranking state, mode-aware slot count
- `src/ui/rulesDrawerSync.js` — compact `c4 / t6 / p6 / t8 / flags` chips in collapsed `<summary>`
- `src/ui/profileSnippetSync.js` *(later deleted — see UX polish below)*

Existing modules rewritten:
- `src/ui/tickerSync.js` — extended to 6 fields (Room/Mode/Round/Level/Owner/Elapsed) + LIVE indicator
- `src/ui/teamDisplay.js` — RANK NN/13 subtitle + active-game header line accents
- `src/player/playerRenderer.js` — `.roster-row` markup in scoreboard team zones (avatar + display + handle/emoji + tag)
- `src/game/history.js` — flexbox `.history__row` markup with mini-Fraunces level cards + winner badges (replaces `<table>`)
- `src/stats/honors.js` — recipient block with team-colored avatar + handle + formatted stat

### B. Phase 2 — Linear theme (commit cf211a6)

`src/themes/linear/` — second registered theme. Same DOM + renderers as Broadcast; CSS-only transformation. Geist + Geist Mono, deep neutral oklch base, Linear purple accent, density-first scale, no decorative card suits, 4-column honors grid.

### C. UX polish (commits ed4b94e → 10bb01b)

| Fix | What/Where |
|---|---|
| Demo placeholders deleted | "示例 · 通关时刻" + "玩家档案 · Preview" sections removed from `index.html` (they were design inspirations, not production). Deleted `src/ui/profileSnippetSync.js` and its main.js wiring. |
| Setup-section auto-hide | `src/ui/setupVisibility.js` — when game has begun (history > 0 OR ranking placed), hides multiplayer + game-mode + player-setup sections (each section-rule + content pair toggles together via `previousElementSibling`). Reset/undo restores them. |
| Honors LEADER badge | `src/stats/honors.js` — only shown when honor is 进行中 (calculating). When populated, the recipient row carries leadership; badge gets hidden. Fixes "every honor shows LEADER" noise. |
| Honor avatars use emoji | For 玩家N session players (no `@handle`), use the player's assigned emoji as avatar (🐌 / 🐢 / 🦋 / etc.) instead of the digit. Profile players still use first char of display name. |
| Card suits hidden | `:root[data-theme="broadcast"] .card-level__suit { display: none }` — ♥ / ♦ decorations were noise without info. |
| Rules drawer mode-filtered | `src/ui/rulesDrawerSync.js` — only show current mode's chips (4-player → c4 + flags; 6-player → t6 + p6 + flags; 8-player → t8 + p8 + flags), plus a leading `mode: 6人` chip. Re-renders on `ui:modeChanged`. |
| Cross-page theme persistence | `src/themes/_shared/themeBootstrap.js` — sets `data-theme` from `gd_v9_theme` localStorage before paint. Loaded as a `<script type="module">` on all 4 HTML pages. Both `broadcast/theme.css` and `linear/theme.css` are linked everywhere. |
| Mobile ticker simplification | `@media (max-width: 768px)` in broadcast theme: hide Room/Owner/Elapsed chips + their separators. Keep Mode/Round/Level. Round chip larger and bolder. |
| Random ranking visibility | `src/controllers/playerControls.js` — write to `#applyTip` ("✓ 已随机分配名次，结果已自动应用" or "请点击「应用结果到战绩」") so the click doesn't feel like a no-op. |
| Vite dev → prod KV proxy | `vite.config.js` — `server.proxy['/api']` → `https://gd.ax0x.ai`. Players + rooms pages now show 24 real profiles + 20 active rooms instead of "加载失败". `GD_NO_API_PROXY=1` opts out. |
| Localhost room guard removed | `src/share/roomManager.js` — dropped the `import.meta.env.DEV` alert that hard-blocked room creation. Replaced with one-line `console.info` so it's clear dev hits prod KV. |
| Host/viewer room banners themed | `src/share/roomUI.js` no longer inline-styles the banners with `#3b82f6` / `#10b981` gradients. Adds `room-banner` + `room-banner--host` / `room-banner--viewer` classes. CSS rules added in **both** broadcast and linear theme.css using their respective `--accent` / `--win` tokens. |

## Key takeaways — what every new theme MUST do

These are the **non-negotiable rules** for Phase 3+ themes (Trading, Atelier, Tea-Table). Violating any of them recreates problems we just spent a session fixing.

### 1. NEVER hardcode colors

Every color value must reference a CSS custom property from the token spec (`src/themes/_shared/tokenSpec.js`). No `#3b82f6`, no `rgb(...)`. If a component picks a color that isn't in the spec yet, **add it to the spec** and define it in every active theme.

The host/viewer banner bug (this session) was caused by inline `background: linear-gradient(135deg, #3b82f6 ...)` — broke under both themes. Always set classes; let theme.css define the look.

### 2. Test populated state, never empty placeholder

Every theme audit must capture **populated** state via the capture scripts:
- `scripts/visual/capture-phase1-5-final.mjs` (seeds 8-round history + ranking + honors)
- `scripts/visual/capture-linear-theme.mjs` (same, but data-theme=linear)
- `scripts/visual/capture-all-pages.mjs` (all 4 pages)
- `scripts/visual/capture-game-active.mjs` (verifies setupVisibility hiding)

Empty-state captures hide gaps. The first Phase 1.5 declaration was "92% complete" with empty UI — actual fidelity was ~40%. AX corrected: "this is like 10% complete." See `feedback_compare_to_demo_before_done.md` in agent memory for the discipline.

### 3. Score worst-section, not average

Aggregate fidelity = WORST individual section. If 9 sections are at 95% and one is at 30%, the theme is at 30%, not 90%. Average is misleading; one broken section breaks the impression.

### 4. Cross-page theme persistence is mandatory

Every entry HTML (`index.html`, `players.html`, `rooms.html`, `player-profile.html`) must:
1. `<link rel="stylesheet" href="/src/themes/<theme>/theme.css">` for **every** registered theme (not just one)
2. `<script type="module" src="/src/themes/_shared/themeBootstrap.js"></script>` to set `data-theme` from localStorage before paint

Otherwise navigation between pages causes theme flip-back.

### 5. Hide demo-only content

The demo HTML files (`docs/design/demos/demo-*.html`) include design-inspiration sections (sample/championship preview, profile snippet preview) that are NOT production content. Don't port them into the live HTML. They show what a populated state could look like; real apps render real data into existing renderers.

### 6. Setup-only sections must auto-hide when game has begun

Multiplayer card, mode selector, player setup — these are SETUP-only. When `state.getHistory().length > 0` or `state.getCurrentRanking()` has entries, the user is mid-game and these are clutter. `src/ui/setupVisibility.js` is the canonical implementation; new themes shouldn't need to do anything beyond inheriting this behavior.

### 7. Mobile responsive is per-theme work

Each theme defines its own `@media (max-width: 768px)` block. Sizes that work on Broadcast (200px Fraunces glyph) absolutely do not work on Linear (36px Geist). Each theme decides:
- Which ticker fields to drop on mobile
- How the scoreboard re-stacks
- Pool/slot grid columns
- Whether honors collapse to 1 col, 2 col, or stay 3-4

### 8. Honors / sample / championship semantics

The 16 honors render via `src/stats/honors.js`. Each honor card has:
- `.honor__top` — index, category, status badge (`.honor__status` — only shown when 进行中)
- `.honor__name` — large display title
- `.honor__desc` — description line
- `.honor__recipient` — avatar + display + handle + stat

Theme-specific changes are limited to font sizing, color tokens, and grid columns. **Don't add a per-theme `renderHonor` function** — the data binding lives in `honors.js` and themes only style.

### 9. Dev environment requires the API proxy

`vite.config.js` proxies `/api/*` to `https://gd.ax0x.ai`. Without this, fetch requests get back JS source code (Vite serves `.js` files). Future themes don't change this; just be aware that **dev writes go to prod KV**. Solo project so it's fine; `GD_NO_API_PROXY=1` opts out.

### 10. Banner / sticky-strip theming

Two banners exist (host = orange/accent, viewer = green/win). Both must be themed in every theme.css. Use `--accent`, `--accent-soft`, `--accent-line`, `--win` tokens — don't hardcode green or blue.

## Files / paths a future Phase 3 contributor needs to read first

1. `docs/design/THEME-ARCHITECTURE.md` — the 5-phase plan + token spec rationale
2. `docs/design/HANDOFF.md` — broader handoff (this file is more focused on lessons learned this session)
3. `src/themes/_shared/tokenSpec.js` — the token name contract (every theme must satisfy)
4. `src/themes/broadcast/theme.css` + `src/themes/linear/theme.css` — the two reference implementations
5. `docs/reports/phase1-5-final/` (Broadcast audit baseline) + `docs/reports/phase2-linear/` (Linear audit baseline)
6. The `scripts/visual/capture-*.mjs` family — replicate for new themes

## Visual baselines

| Path | Purpose |
|---|---|
| `docs/reports/phase1-5-final/index-final.png` | Broadcast populated full-page (~92% match) |
| `docs/reports/phase1-5-final/{ticker,scoreboard,activegame,calcpreview,history,honors,profile-snippet,rules-drawer}.png` | Per-section Broadcast captures |
| `docs/reports/phase2-linear/index-linear.png` | Linear populated full-page |
| `docs/reports/phase2-linear/{ticker,scoreboard,activegame,...}.png` | Per-section Linear captures |
| `docs/reports/audit-pages/{index-empty,players,rooms}-{desktop,mobile}.png` | Cross-page audit (all 4 routes, both viewports) |
| `docs/reports/audit-pages/index-active-{desktop,mobile}.png` | Verifies setupVisibility hiding |

## Reference: dev workflow

```bash
# Pull live KV credentials (one-time, refreshes monthly)
vercel env pull --yes

# Run dev with /api proxy to prod (default)
npm run dev
# Visit http://localhost:3000/ → real player + room data

# Run dev offline (no API proxy)
GD_NO_API_PROXY=1 npm run dev

# Build (typechecks + bundles)
npm run build

# Capture full audit (all themes, all pages, populated + empty)
npm run dev &
node scripts/visual/capture-all-pages.mjs
node scripts/visual/capture-phase1-5-final.mjs
node scripts/visual/capture-linear-theme.mjs
node scripts/visual/capture-game-active.mjs
```

## Open issues / known gaps

- **Profile snippet** was deleted from index.html. The user career-stats display still lives at `/player-profile.html` (full page). Decision: don't put a placeholder on game view; let `players.html` and `player-profile.html` be the canonical career data display.
- **Linear sidebar layout** is documented in `THEME-ARCHITECTURE.md` Section 3 (`layout.mount()`) but not yet implemented. Phase 2 ships token+component restyle only; the sidebar restructure is deferred.
- ~~**Theme picker location**~~ — RESOLVED in commit `ee70c88` (2026-05-04). Picker now sits in the topnav between tabs and user, rendered as inline radio chips per theme (`.topnav__picker` wrapper). No gear icon — the radios speak for themselves.
- **PNG export** is not theme-aware. The `src/export/exportHandlers.js` and `src/export/exportMobile.js` use hardcoded colors for canvas rendering. Phase 5 should address.
- **Vercel CLI** is at 52.0.0 in this session; 53.x is current. Upgrade with `npm i -g vercel@latest` when convenient.
