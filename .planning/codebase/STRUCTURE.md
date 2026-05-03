# Codebase Structure

**Analysis Date:** 2026-05-03

## Top-Level Layout

```
guandan-scorer/
├── index.html              # Main scorer (PWA entry, loads src/main.js)
├── players.html            # Player browser (search, list)
├── player-profile.html     # Single-player stats page (Chart.js powered)
├── rooms.html              # Room browser (favorites + filter)
├── package.json            # npm: vite, chart.js, @vercel/kv (3 deps total)
├── vite.config.js          # 4 input pages → dist/, publicDir: public/
├── vercel.json             # buildCommand: npm run build, outputDirectory: dist
├── .env.example            # Template for ADMIN_TOKEN + KV_* vars
├── .env.local              # Local dev secrets (gitignored)
├── .gitignore
├── LICENSE                 # MIT
├── README.md
├── CLAUDE.md               # Project AI agent context
├── TODO.md                 # Roadmap / next steps
├── MODULAR_REWRITE_COMPLETE.md  # Historical migration notes (~9.7KB)
├── MODULAR_STATUS.md             # Historical migration notes (~3.5KB)
│
├── src/                    # Frontend ES modules — 41 .js files + style.css
├── api/                    # Vercel Edge Functions (16 files)
├── public/                 # Static assets served at root (icons, manifest, sw.js)
├── docs/                   # Project documentation (24 files)
├── scripts/                # Operational scripts
├── dist/                   # Build output (gitignored — Vite produces it)
├── node_modules/           # gitignored
├── temp/                   # Scratchpad (gitignored content)
├── .planning/              # GSD planning workspace (this folder)
├── .vercel/                # Vercel CLI cache
├── .vscode/, .specstory/, .serena/, .claude/   # Editor / AI tool caches
└── .git/
```

---

## `src/` — Frontend ES Modules (41 .js files + 1 CSS)

```
src/
├── main.js                            # 658 — App orchestrator (init, event wiring) for index.html ONLY
├── style.css                          # 556 — Single hand-written stylesheet shared by all 4 pages
│
├── core/                              # Layer 0: foundation primitives
│   ├── utils.js                       #  69 — $(), on(), now(), escapeHtml()
│   ├── storage.js                     #  92 — localStorage wrapper, exports KEYS (gd_v9_*)
│   ├── events.js                      # 113 — Pub/sub bus: on, off, emit, once, clear
│   ├── state.js                       # 311 — GameState singleton (teams, history, players, stats)
│   ├── config.js                      # 429 — GameConfig singleton (rules, prefs, team names/colors)
│   └── modal.js                       #  87 — Modal a11y helpers (ARIA, focus trap, Escape)
│
├── controllers/                       # Layer 3: DOM ↔ module glue (no business logic)
│   ├── gameControls.js                # 253 — Apply/Advance/Undo/Reset + attachTouchHandlersToAllTiles
│   ├── playerControls.js              # 181 — Generate/Shuffle/Bulk-names/Quick-start/Search
│   ├── exportControls.js              #  46 — TXT/CSV/PNG/Share buttons
│   ├── roomControls.js                #  67 — Create/Join/Browse/Leave room
│   └── settingsControls.js            # 183 — Mode select, prefs, custom rules, voting sync trigger
│
├── game/                              # Layer 1: game-rule logic
│   ├── calculator.js                  # 224 — Pure: parseRanks, calculateUpgrade, nextLevel, tier
│   ├── rules.js                       # 307 — checkALevelRules, applyGameResult, advanceToNextRound
│   └── history.js                     # 188 — renderHistory, undoLast, resetAll, rollbackToIndex
│
├── ranking/                           # Layer 1: current-round ranking state
│   ├── rankingManager.js              # 115 — Typed setters/getters around state.currentRanking
│   ├── rankingRenderer.js             # 270 — Renders #playerPool/#rankingArea + checkGameEnded()
│   └── rankingCalculator.js           # 148 — Bridge ranking UI → game/calculator
│
├── player/                            # Layer 1: player data + interaction (8 modules)
│   ├── playerManager.js               # 330 — Roster, ANIMAL_EMOJIS (77+), generate/shuffle/assign
│   ├── playerRenderer.js              # 219 — Renders player tiles in 3 zones (unassigned/t1/t2)
│   ├── dragDrop.js                    # 137 — Desktop HTML5 drag/drop wiring
│   ├── touchHandler.js                # 294 — Mobile long-press (200ms) drag with clone tracking
│   ├── photoRenderer.js               #  70 — Avatar (photo+emoji) renderer for modals/profile
│   ├── playerSearch.js                # 191 — Debounced (300ms) profile search component
│   ├── playerCreateModal.js           # 452 — Create-profile modal w/ photo upload (400x400 JPEG)
│   └── playerEditModal.js             # 584 — Edit modal (owner token + admin token + 登出本设备)
│
├── stats/                             # Layer 1: stats, honors, achievements
│   ├── statistics.js                  # 171 — updatePlayerStats(mode), renderStatistics
│   ├── honors.js                      # 443 — 14 honor algorithms (吕布/阿斗/石佛/etc.)
│   ├── mvpBurden.js                   #  78 — Single-source MVP/burden selector
│   └── achievements.js                #  92 — 20 badge definitions (logic inline in api/players/[handle].js)
│
├── ui/                                # Layer 2: UI components
│   ├── teamDisplay.js                 # 187 — Team styling (CSS vars), team summary
│   ├── victoryModal.js                # 504 — A-level victory modal w/ in-memory voting
│   └── panelManager.js                # 268 — Collapse/lock team-assignment panel, compact roster
│
├── share/                             # Layer 2: room sync, voting, share-URL
│   ├── roomManager.js                 # 465 — Host create+sync (10s) / Viewer poll (2s)
│   ├── roomUI.js                      # 282 — Sticky host/viewer banners, disableViewerControls
│   ├── shareManager.js                # 147 — ?share=... static URL encode/decode (base64)
│   ├── votingManager.js               # 933 — Viewer voting UI + host leaderboard polling (largest module)
│   └── votingSync.js                  # 122 — syncVotingToProfiles + scheduleAutoVotingSync (5min)
│
├── export/                            # Layer 2: data export
│   ├── exportHandlers.js              # 250 — TXT, CSV, exportLongPNG (desktop)
│   └── exportMobile.js                # 536 — Mobile-optimized PNG via canvas + avatar loading
│
└── api/                               # Layer 2: backend API client
    └── playerApi.js                   # 528 — Full client: searchPlayers, syncProfileStats, ownership tokens
```

### Total: 41 modules, ~12.1k LOC frontend

**Note on directory naming**: `src/api/` (singular `playerApi.js`) is the *frontend client* for the backend. The actual backend lives at `/api/` (top-level). Import paths use `../api/playerApi.js` from sibling modules — easy to confuse with backend if not paying attention.

---

## `api/` — Backend (Vercel Edge Functions, 16 files, ~3k LOC)

All files export `config = { runtime: 'edge' }`. Web-standard `Request`/`Response`. KV via `@vercel/kv`.

```
api/
├── rooms/
│   ├── create.js                      # 116 — POST: create room + crypto-random 32-byte authToken
│   ├── [code].js                      # 181 — GET (sanitized) / PUT (Bearer-token gate, TOFU fallback)
│   ├── list.js                        # 139 — GET: paginated room list, ?favorites=true filter
│   ├── vote/
│   │   └── [code].js                  # 140 — POST vote (fingerprint dedup) / GET results
│   ├── reset-vote/
│   │   └── [code].js                  #  95 — POST: clear votes for a round (host auth)
│   └── favorite/
│       └── [code].js                  # 143 — POST favorite (remove TTL) / DELETE unfavorite (1y TTL)
│
└── players/
    ├── _utils.js                      # 290 — Shared: validation, ID gen, ownership/admin token utils,
    │                                          sanitizePlayer, initializePlayerStats schema
    ├── create.js                      # 132 — POST: create profile, returns ownershipToken ONCE
    ├── [handle].js                    # 947 — GET (sanitized) / PUT modes:
    │                                          - implicit (stats sync) — Bearer (room or owner)
    │                                          - mode='PROFILE_UPDATE' — Bearer (owner) or body adminToken
    │                                          - mode='ROTATE_TOKEN'   — Bearer (owner) or body adminToken
    │                                         (Largest backend file — embeds achievements logic + mode-stats migration)
    ├── list.js                        # 111 — GET: search/list profiles (lastActiveAt sort)
    ├── touch.js                       #  74 — POST: bump lastActiveAt
    ├── delete.js                      #  87 — POST: admin-only delete (constant-time admin token)
    ├── reset-stats.js                 #  87 — POST: admin-only stats reset (keeps profile)
    ├── migrate-modes.js               # 189 — POST admin: migrate ALL players to mode-specific stats
    ├── migrate-single.js              # 127 — POST: migrate one player by handle (no admin token check)
    └── backfill-duration.js           # 121 — GET: backfill sessionDuration from room timestamps
```

---

## `docs/` — Project Documentation (24 files)

```
docs/
├── README.md                                       # Docs index
├── PROJECT_OVERVIEW.md                             # High-level pitch
├── FEATURE_STATUS.md                               # What's complete
├── GAME_RULES.md                                   # Detailed Guandan rules + scoring
├── HANDOFF.md                                      # Current session-handoff context
├── HANDOFF-2026-05-02-audit.md                     # Audit-specific handoff (historical)
├── SECURITY.md                                     # Source of truth for auth model
├── PWA_SETUP.md                                    # PWA install + service worker notes
├── MODE_SPECIFIC_STATS_PLAN.md                     # 4P/6P/8P stat split plan
├── PROFILE_EDIT_PLAN.md                            # Profile edit feature plan
│
├── architecture/
│   ├── CODEBASE_STRUCTURE.md                       # File-by-file module reference
│   ├── DESIGN_DECISIONS.md                         # Architectural rationale log
│   ├── KV_SCHEMA.md                                # Vercel KV namespace + key map
│   ├── PLAYER_PROFILE_ARCHITECTURE.md              # Profile system deep dive
│   ├── TECHNICAL_ARCHITECTURE.md                   # System design (rooms, voting, sync)
│   └── TECHNICAL_IMPLEMENTATION.md                 # Implementation details
│
├── features/
│   ├── PLAYER_PROFILE_SPEC.md                      # Profile system spec
│   ├── PROFILE_PHOTO_PLAN.md                       # Photo upload feature
│   └── VOTING_SYSTEM.md                            # Community voting spec
│
└── guides/
    ├── DEPLOYMENT_GUIDE.md                         # Vercel deployment procedure
    ├── DEVELOPMENT_METHODOLOGY.md                  # Workflow / process
    ├── REALTIME_SETUP.md                           # KV setup + room sync wiring
    └── USER_GUIDE.md                               # End-user docs
```

---

## `public/` — Static Assets (Vite `publicDir`)

```
public/
├── manifest.json                      # PWA manifest (掼蛋, standalone, portrait-primary)
├── sw.js                              # Service worker (91 LOC, registered by main.js)
├── favicon.ico
├── favicon-16x16.png
├── favicon-32x32.png
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── README.md
```

All files in `public/` are served at the URL root (`/manifest.json`, `/sw.js`, etc.).

---

## `scripts/` — Operational Scripts

```
scripts/
└── ops/
    └── verify-ownership-tokens.mjs    # 111 — Verify ownership-token integrity in KV
```

No `migrations/` or other subdirs yet. Per CLAUDE.md convention: data migrations go to `scripts/migrations/`, ops to `scripts/ops/`.

---

## Top-Level Files

| File | LOC | Purpose |
|------|-----|---------|
| `index.html` | 545 | Main scorer page. Loads `/src/main.js` as ES module. Hosts `<script>` for PWA install handler integration. |
| `players.html` | 434 | Player browser. Inline `<script type="module">` imports `playerApi`, `playerCreateModal`, `photoRenderer`, `utils`. Admin-mode UI. |
| `player-profile.html` | 1021 | Single-player profile. Largest HTML file. Imports `playerApi`, `achievements`, `chart.js`, `photoRenderer`, `playerEditModal`. Renders 8 sections + Chart.js bar charts for partners/rivals. |
| `rooms.html` | 436 | Room browser. Inline `<script type="module">`, no `/src/` imports — uses `fetch` directly against `/api/rooms/list` and `/api/rooms/favorite`. |
| `package.json` | 21 | npm: `dev: vite`, `build: vite build`, `preview: vite preview`. Three deps: `vite` (devDep), `chart.js`, `@vercel/kv`. Type: module. |
| `vite.config.js` | 18 | Multi-entry build (4 HTML pages → `dist/`). `publicDir: 'public'`, `server.port: 3000`. Note: README/CLAUDE.md say port 5173 but config says 3000 — see drift below. |
| `vercel.json` | 4 | Three keys: `buildCommand: npm run build`, `outputDirectory: dist`, `framework: null`. |
| `.env.example` | — | Template (not read; do not quote). |
| `.env.local` | — | Local dev secrets (not read; gitignored, do not quote). |

---

## Where Styles Live

- **Single shared stylesheet**: `src/style.css` (556 LOC). CSS custom properties (`--bg`, `--card`, `--ink`, `--muted`, `--stroke`, `--chip`, `--accent`) defined under `:root`. Loaded by every HTML page via `<link rel="stylesheet" href="/src/style.css">`.
- **Inline page-specific `<style>` blocks**: each HTML page has its own `<style>` block in `<head>` for nav-tabs, page-specific cards (player-card, room-card, profile-header), etc. No CSS preprocessor, no Tailwind, no CSS-in-JS.
- **Inline element styles**: heavy use of `style="..."` and `style.cssText = ...` in JS for dynamic / one-off styling (e.g., banners, modals). This is a known maintainability trade-off — see CONCERNS.

---

## Where Images / Assets Live

- **Icons / favicons**: `public/icons/` (PWA 192/512), `public/favicon-{16,32}x32.png`, `public/favicon.ico`.
- **Avatars**: NOT files — emoji codepoints from `ANIMAL_EMOJIS` (`src/player/playerManager.js:12-21`, 77+ entries) OR base64-encoded JPEG strings stored in player profiles (`photoBase64` field, max ~100KB per `_utils.js:94`).
- **No bundled images** beyond icons/favicons.

---

## Where to Add New Code

| Type of change | Goes here |
|----------------|-----------|
| Game rule change (4P/6P/8P) | `src/game/rules.js` (logic) + `src/core/config.js` (defaults if needed) |
| Pure scoring tweak | `src/game/calculator.js` (must remain side-effect-free) |
| New honor algorithm | `src/stats/honors.js` (add to honor definitions array) |
| New achievement badge | `src/stats/achievements.js` (definition) AND `api/players/[handle].js` `checkAchievements` (earn logic) |
| New stat tracked | Schema in `api/players/_utils.js initializePlayerStats()`, sync in `src/api/playerApi.js syncProfileStats`, surface in `player-profile.html` |
| New event | Emit in the source module (state setter, controller handler), subscribe in `src/main.js setupModuleEventHandlers` or the consuming module |
| New API endpoint | New file under `api/rooms/` or `api/players/`. Edge runtime — use `crypto.getRandomValues`, NOT Node `crypto`. Auth via `_utils.validateOwnershipToken` / `validateAdminToken` / room Bearer compare. |
| New page | Add HTML at top level + register in `vite.config.js` `rollupOptions.input`. Inline `<script type="module">` and import directly from `/src/...`. |
| New UI component (modal, panel) | `src/ui/` for global UI; `src/player/` for player-related; wire `setupModalAccessibility` from `src/core/modal.js` for modals |
| New controller (button wiring) | `src/controllers/<name>Controls.js` — keep glue-only, push business logic into layer 1/2 |
| New utility helper | `src/core/utils.js` if cross-cutting; otherwise feature-local |
| New ops script | `scripts/ops/<name>.mjs` (ESM, executable). For DB migrations: `scripts/migrations/`. |
| Documentation | `docs/<category>/` — categories: `architecture/`, `features/`, `guides/`. Top-level for cross-cutting (FEATURE_STATUS, GAME_RULES). |

---

## Storage Keys Map

### `localStorage` (frontend, prefix `gd_v9_*` from `src/core/storage.js:8`)

| Key | Source | Contents |
|-----|--------|----------|
| `gd_v9_config` | `KEYS.CONFIG` | Game rules (c4/t6/p6/t8/p8 tables), prefs (must1, autoNext, autoApply, strictA), team names/colors |
| `gd_v9_state` | `KEYS.STATE` | teams (lvl, aFail), roundLevel, roundOwner, nextRoundBase, history[], winner |
| `gd_v9_players` | `KEYS.PLAYERS` | Players array (id, name, emoji, team, handle, photoBase64, etc.) |
| `gd_v9_stats` | `KEYS.STATS` | Per-player session stats keyed by player.id (games, totalRank, firstPlaceCount, lastPlaceCount, rankings[]) |

### `localStorage` — non-prefixed (NOT under `gd_v9_*`)

| Key | Source | Contents |
|-----|--------|----------|
| `gd_owner_token_<handle>` | `src/api/playerApi.js:10` | Per-handle ownership token issued at profile creation. One key per handle the device has created. |
| `gd_voter_fingerprint` | `src/share/votingManager.js:23` | Per-browser fingerprint string (UA + screen + tz + random). Used for vote dedup. |
| `gd_voted_rooms` | `src/share/votingManager.js:61` | JSON map of `{roomCode: true}` for rooms this browser has voted in. |

> **Drift note**: `clearAll()` in `storage.js:67` only clears the four `gd_v9_*` keys — owner tokens, voter fingerprint, and voted-rooms map persist across "reset all" actions. Likely intentional (don't lose ownership) but undocumented.

### Vercel KV namespaces (backend, via `@vercel/kv`)

| Key pattern | Source | Contents | TTL |
|-------------|--------|----------|-----|
| `room:{code}` | `api/rooms/create.js`, `[code].js`, `vote/[code].js`, `favorite/[code].js`, `reset-vote/[code].js` | Full room snapshot: settings, state, players, playerStats, currentRanking, authToken, endGameVotes (mvp/burden/fingerprints[]), createdAt, finishedAt, lastUpdated, isFavorite | 1 year default; PERMANENT (no TTL) when favorited; restored to 1y on unfavorite |
| `rooms:index` | `api/rooms/create.js`, `list.js` | Array of `{roomCode, createdAt}` (capped at 100 most recent) | None |
| `favorites:index` | `api/rooms/list.js`, `favorite/[code].js` | Array of `{roomCode, createdAt, favoritedAt, playerCount, gameCount, teamNames}` | None |
| `player:{handle}` | All `api/players/*.js` | Profile + stats: handle, displayName, emoji, photoBase64, playStyle, tagline, ownershipTokenHash, lastActiveAt, stats4P, stats6P, stats8P, modeBreakdown, partners, opponents, votingHistory, recentGames | None |
| `player_id:{plrId}` | `api/players/create.js`, `delete.js` | Reverse lookup: PLR_XXXXXX → handle | None |

> **No locks, no transactions** — every PUT does read-modify-write. Race conditions possible if two clients PUT simultaneously, but the host-only auth gate makes concurrent writes very rare in practice.

---

## Drift Between CLAUDE.md and Reality

These deltas were observed during this audit (recorded for the concerns sweep):

1. **Module count: CLAUDE.md says 38; reality is 41 `.js` files in `src/`.** Specifically, CLAUDE.md misses `src/core/modal.js`, `src/player/playerEditModal.js`, and `src/stats/mvpBurden.js`. CLAUDE.md also has a duplicate "Statistics (1 module)" + "Statistics (3 modules)" section (the 3-module count is correct).
2. **Dev port: CLAUDE.md says 5173; `vite.config.js:13` says 3000.** Both can be valid if `npm run dev` overrides, but as configured the dev server opens on 3000.
3. **`src/share/` module count: CLAUDE.md doesn't break this out, but it has 5 modules** (roomManager, roomUI, shareManager, votingManager, votingSync). One — `shareManager.js` — is the static URL share (NOT realtime room).
4. **`src/api/` is treated as part of the Player Profile System** in CLAUDE.md, but it's a single file (`playerApi.js`, 528 LOC) used by the entire codebase, not just profile features. It also handles ownership tokens, vote-only sync, and host-token auth flows.
5. **`src/player/` module count: CLAUDE.md says 4 (or 5 with photoRenderer), then mentions 6 modules including playerSearch and playerCreateModal.** Reality is 8: also includes `playerEditModal.js`. Edit modal is a major UI surface (584 LOC) that CLAUDE.md doesn't mention by name.
6. **`api/players/_utils.js` exports more than CLAUDE.md acknowledges** — adds `validateAdminToken`, `constantTimeEqual`, `generateOwnershipToken`, `hashToken`, `validateOwnershipToken`, `extractBearerToken`, `sanitizePlayer`. These are critical security primitives.
7. **`src/share/votingManager.js` is 933 LOC — the largest single module in the codebase.** Bigger than `src/main.js` (658). Heavy inline UI generation via template literals + `style.cssText = ...`. CLAUDE.md doesn't flag this as an outlier.
8. **`api/players/[handle].js` is 947 LOC** — also embeds `checkAchievements()` and a mode-stats migration step inline. Both could live elsewhere; instead they're inlined "to avoid module imports in Edge Functions" (per file comment).
9. **`scripts/migrations/` directory does NOT exist** — only `scripts/ops/`. Migration endpoints currently live as Edge Functions (`api/players/migrate-modes.js`, `migrate-single.js`, `backfill-duration.js`). Per CLAUDE.md convention, a real migration runner should live under `scripts/migrations/`.
10. **No CSS preprocessor or Tailwind** — confirmed; CLAUDE.md doesn't claim one but the inline `<style>` per page + heavy `style.cssText` usage is worth surfacing as a maintainability concern.

---

*Structure analysis: 2026-05-03*
