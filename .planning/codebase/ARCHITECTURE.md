# Architecture

**Analysis Date:** 2026-05-03

## Pattern Overview

**Overall:** Multi-page (MPA) Vanilla-JS SPA + Vercel Edge serverless backend, talking to Vercel KV (Upstash Redis). Frontend is a strict layered ES-module graph, glued together by a singleton state + pub/sub event bus. No UI framework, no bundler-driven router — each HTML page is its own entry, sharing a common module graph from `src/`.

**Key Characteristics:**
- **Layered, top-down imports**: `core` ← `game/player/ranking/stats` ← `controllers/ui/share/export` ← `main.js`. Lower layers never import upward. Verified by grep — no `core/*` file imports a controller, ui, or share module.
- **Singleton state + pub/sub**: `src/core/state.js` (`GameState`) and `src/core/config.js` (`GameConfig`) are module-singletons. Mutations always go through their setters, which auto-persist to localStorage AND emit semantic events on `src/core/events.js` for any module that needs to react.
- **Pure-function game core**: `src/game/calculator.js` is side-effect-free; `src/game/rules.js` is the only place that mutates team levels and writes history entries. Everything else reads via `state.get*()`.
- **Edge-only backend**: Every file in `api/**/*.js` exports `config = { runtime: 'edge' }`. KV is the single backing store; no DB, no queues, no auxiliary services.
- **Polling-based realtime**: Host PUTs to KV every 10s + on-demand; viewers GET every 2s. There are no WebSockets, no SSE, no Vercel KV pubsub primitives.
- **No build-step semantics for backend**: API files run as-is on Edge; frontend goes through Vite (bundler/HMR in dev, ES-module bundle in `dist/` for prod).

---

## High-Level Diagram

```
                     ┌──────────────────────────────────────────────┐
                     │               Browser (PWA)                  │
                     │                                              │
                     │  index.html       ─┐                         │
                     │  players.html      │                         │
                     │  player-profile.html  ── src/main.js +       │
                     │  rooms.html       ─┘    inline <script type=module>
                     │                          │                   │
                     │            ┌─────────────┴─────────────┐     │
                     │            │      ES Module Graph       │    │
                     │            │  (state, events, config,   │    │
                     │            │   game, ranking, ui, etc.) │    │
                     │            └─┬────────────────────┬─────┘    │
                     │              │                    │          │
                     │   localStorage (gd_v9_*)   sw.js (Service    │
                     │                            Worker, PWA)      │
                     └────────┬──────────────────────┬──────────────┘
                              │ HTTP fetch           │
                              │                      │
                  ┌───────────┴───────────┐  ┌───────┴───────────┐
                  │  Vercel Edge Funcs    │  │  Static assets    │
                  │   /api/rooms/*        │  │  /icons, /manifest │
                  │   /api/players/*      │  │  /sw.js, dist/*    │
                  └───────────┬───────────┘  └───────────────────┘
                              │
                              │ @vercel/kv (Upstash Redis)
                              ▼
                  ┌───────────────────────────────┐
                  │  Vercel KV namespaces:        │
                  │   room:{code}                 │
                  │   rooms:index                 │
                  │   favorites:index             │
                  │   player:{handle}             │
                  │   player_id:{plrId}           │
                  └───────────────────────────────┘
```

---

## Layers (Module Graph)

### Layer 0 — Foundation: `src/core/`
Stateless or self-contained primitives. No upward dependencies.

- **`src/core/utils.js`** (69 LOC) — `$()`, `on()`, `now()`, `escapeHtml()`. Used everywhere.
- **`src/core/storage.js`** (92 LOC) — typed wrapper around `localStorage`. Defines four key constants under `gd_v9_` prefix.
- **`src/core/events.js`** (113 LOC) — pure pub/sub: `on`, `off`, `emit`, `once`, `clear`. Each event listener is wrapped in try/catch so a single failing handler does not break the chain.
- **`src/core/state.js`** (311 LOC) — `GameState` singleton. Holds team levels, A-fail counters, round meta, history, players, playerStats, currentRanking, sessionStartTime. Every setter persists + emits `state:*` events. Returns deep copies for `getHistory()`, `getPlayerStats()` to defend against external mutation.
- **`src/core/config.js`** (429 LOC) — `GameConfig` singleton. Holds 4/6/8-player rules, point tables, team names/colors, and four prefs (must1, autoNext, autoApply, strictA). Has helpers to round-trip DOM inputs (`updateDOMInputsFromConfig`, `collectAndSaveRulesFromDOM`).
- **`src/core/modal.js`** (87 LOC) — accessibility helpers (`setupModalAccessibility`): ARIA, focus trap, Escape-to-close, scroll lock. Used by both player modals.

### Layer 1 — Domain: `src/game/`, `src/ranking/`, `src/player/` (data only), `src/stats/`
Game-rule logic and per-domain state. Reads/writes via `state` and `config` singletons.

**`src/game/`** — pure game logic (3 modules)
- **`src/game/calculator.js`** (224 LOC) — `parseRanks`, `calculateUpgrade`, `nextLevel`, `tier`, `scoreSum`. Strictly pure — no `state` import.
- **`src/game/rules.js`** (307 LOC) — `applyGameResult`, `checkALevelRules`, `advanceToNextRound`. The ONLY module that calls `state.setTeamLevel`, `state.setTeamAFail`, `state.addHistoryEntry` for game progression. Embeds the entire A-level decision tree (8 branches across own-A vs opponent's-round × winner-has-last × strictA). 4-player mode tracks A-fail counter (3 fails → demote to 2); 6/8-player do NOT (per 2026-05 rule change — see file header comment).
- **`src/game/history.js`** (188 LOC) — `renderHistory`, `undoLast`, `resetAll`, `rollbackToIndex`. Renders the history table; rollback uses snapshot fields stored in each history entry.

**`src/ranking/`** — current-round ranking state (3 modules)
- **`src/ranking/rankingManager.js`** (115 LOC) — typed setters/getters around `state.currentRanking` (ranking is in-memory only, not persisted across reloads).
- **`src/ranking/rankingRenderer.js`** (270 LOC) — owns ranking-area DOM (`#playerPool`, `#rankingArea`). Exports `checkGameEnded()` — defines the canonical "game ended" check by inspecting the latest history entry's `aNote` for "通关" (excluding the strict-mode warning phrases "才能通关" / "需"). Used by 7 callers in 5 modules.
- **`src/ranking/rankingCalculator.js`** (148 LOC) — bridge between ranking UI state and `game/calculator.js`. Exports `checkAutoCalculate`, `calculateFromRanking`, `getPlayerRankingData`.

**`src/player/`** — player data + interaction (8 modules)
- **`src/player/playerManager.js`** (330 LOC) — owns the player roster, exports the canonical `ANIMAL_EMOJIS` array (77+), generates / shuffles / assigns players. `addPlayerFromProfile` integrates persisted player profiles.
- **`src/player/playerRenderer.js`** (219 LOC) — renders player tiles in unassigned/team1/team2 zones. Owns the shared `draggedPlayer` reference used by both desktop drag and mobile touch.
- **`src/player/dragDrop.js`** (137 LOC) — desktop HTML5 drag-and-drop wiring; sets up drop zones for both team assignment and rank slots.
- **`src/player/touchHandler.js`** (294 LOC) — mobile long-press (200ms) drag with hand-rolled clone tracking; `handleTouchStart/Move/End/Cancel` exported and re-attached after every render via `attachTouchHandlersToAllTiles`.
- **`src/player/photoRenderer.js`** (70 LOC) — renders player avatars (photo or emoji), used by victory modal, voting cards, and profile page (NOT by tile rendering).
- **`src/player/playerSearch.js`** (191 LOC) — search component (debounced 300ms) backed by `api/playerApi.js → searchPlayers`.
- **`src/player/playerCreateModal.js`** (452 LOC) — full profile-create modal with photo upload (auto-resized to 400×400 JPEG, base64 stored). Wires `setupModalAccessibility`.
- **`src/player/playerEditModal.js`** (584 LOC) — edit modal; supports owner-token auth and admin-token override; "登出本设备" wipes the per-handle ownership token from localStorage.

**`src/stats/`** — stats, honors, achievements (4 modules)
- **`src/stats/statistics.js`** (171 LOC) — `updatePlayerStats(mode)` (called on apply), `renderStatistics`. Bridges to honors and MVP/burden.
- **`src/stats/honors.js`** (443 LOC) — 14 honor algorithms (吕布, 阿斗, 石佛, 波动王, 奋斗王, etc.). All scale across 4/6/8 modes. Variance-based honors gate on `rankings.length < 5` to defend against the n=1 trivial-zero case (documented in calculateVariance).
- **`src/stats/mvpBurden.js`** (78 LOC) — extracted single-source-of-truth selector for team MVP / burden (lowest / highest avg ranking, with explicit tie-breakers). Used by both live UI (`statistics.js`) and PNG export (`exportMobile.js`) — earlier these were duplicated.
- **`src/stats/achievements.js`** (92 LOC) — 20 achievement-badge definitions (newbie/started/veteran/legend, streaks, honor-collection, social, marathon, etc.). Definitions only; achievement-earned logic lives inline in `api/players/[handle].js` `checkAchievements()` to avoid module imports in Edge runtime.

### Layer 2 — UI shells & integration: `src/ui/`, `src/share/`, `src/export/`, `src/api/`

- **`src/ui/teamDisplay.js`** (187 LOC) — applies team colors to root CSS vars, renders team summary (level / A-fail badges).
- **`src/ui/victoryModal.js`** (504 LOC) — A-level victory celebration modal. Computes winner-team MVP as **player with lowest avg ranking across the session** (NOT the last-round position-1 finisher — invariant). Hosts in-memory voting tallies (`votes.mvp`, `votes.burden`); `getVotingResults()` returns top-voted IDs.
- **`src/ui/panelManager.js`** (268 LOC) — collapses/locks the team-assignment panel after the first round; renders compact team roster for viewers.
- **`src/share/roomManager.js`** (465 LOC) — host create/sync, viewer join/poll, URL `?room=...&auth=...` parsing. Hosts: 10s `setInterval` syncToRoom + `syncNow()` on critical actions. Viewers: 2s `setInterval` polling with `lastUpdated` change detection.
- **`src/share/roomUI.js`** (282 LOC) — sticky host/viewer banners with live timer (1s tick from `createdAt`), `disableViewerControls()` for read-only mode.
- **`src/share/votingManager.js`** (933 LOC, the single largest module) — viewer voting UI (locked → unlocked at game end), per-browser fingerprint dedup, host-side leaderboard polling, post-vote results display.
- **`src/share/votingSync.js`** (122 LOC) — `syncVotingToProfiles` aggregates per-player MVP+burden vote counts and PUTs each voted player's profile via host's room auth token. `scheduleAutoVotingSync` queues a 5-min auto-sync after game ends.
- **`src/share/shareManager.js`** (147 LOC) — `?share=...` URL encoder/decoder (base64 of full game snapshot). Static, non-realtime.
- **`src/export/exportHandlers.js`** (250 LOC) — TXT and CSV export, plus `exportLongPNG` (desktop canvas snapshot).
- **`src/export/exportMobile.js`** (536 LOC) — mobile-optimized PNG export via canvas; loads avatar photos as Image, renders MVP / burden using `findMVPAndBurden`.
- **`src/api/playerApi.js`** (528 LOC) — entire client-side API surface. Hosts the per-handle ownership-token cache (`gd_owner_token_<handle>`), the `syncProfileStats` orchestrator, and `getPlayerDisplayData` (snapshot + live profile merge). Authorization order: room-host token > per-handle owner token.

### Layer 3 — Controllers: `src/controllers/`
Wire DOM elements to layer 1 + 2 modules. No business logic here beyond glue.

- **`src/controllers/gameControls.js`** (253 LOC) — Apply / Advance / Undo / Reset buttons. Exports `attachTouchHandlersToAllTiles` (used by every render that creates new tiles, since touch handlers must be re-attached after innerHTML replaces).
- **`src/controllers/playerControls.js`** (181 LOC) — Generate / Shuffle / Bulk-names / Quick-start / Search / Create-profile.
- **`src/controllers/exportControls.js`** (46 LOC) — TXT / CSV / PNG / Share-URL buttons → `export/*` and `share/shareManager`.
- **`src/controllers/roomControls.js`** (67 LOC) — Create-room / Join-room / Browse-rooms (→ `/rooms.html`) / Leave-room.
- **`src/controllers/settingsControls.js`** (183 LOC) — Mode select, preference checkboxes, custom-rules save/reset, voting-sync trigger, team name/color editors.

### Layer 4 — Entry: `src/main.js` (658 LOC)
Initializes and orchestrates everything for `index.html` (the main scorer page). Other HTML pages have their own inline `<script type="module">` blocks that import directly from layer 1/2 modules — they do NOT load `main.js`.

---

## Pages

| Page | Entry | Purpose |
|------|-------|---------|
| `index.html` (545 LOC) | `<script type="module" src="/src/main.js">` | Main scorer. Mode select, team assignment, ranking area, history, statistics, honors, room controls, victory modal, voting section. |
| `players.html` (434 LOC) | inline `<script type="module">` importing from `/src/api/playerApi.js`, `/src/player/playerCreateModal.js`, `/src/player/photoRenderer.js`, `/src/core/utils.js` | Player browser — search + paginated list of all profiles, click → profile page. Admin-mode UI. |
| `player-profile.html` (1021 LOC) | inline `<script type="module">` importing from `/src/api/playerApi.js`, `/src/stats/achievements.js`, `chart.js`, `/src/player/photoRenderer.js`, `/src/player/playerEditModal.js`, `/src/core/utils.js` | Single-player profile. Stats sections, achievement badges, partner/rival Chart.js bar charts, edit/admin actions. |
| `rooms.html` (436 LOC) | inline `<script type="module">` (no listed imports — uses fetch directly) | Room browser. All rooms / favorites filter, player handle filter, pagination, click → join URL. |

All four pages share `src/style.css` (556 LOC) plus per-page inline `<style>` blocks for nav-tabs, page-specific cards, etc.

---

## State Management Strategy

**Singletons:** `state` (`src/core/state.js`) and `config` (`src/core/config.js`) are the two canonical app-state holders. Both implement the singleton pattern in their constructors (`if (instance) return instance;`).

**Persistence:**
- `state` ⇄ `localStorage[gd_v9_state]` (teams, round meta, history, winner) + `gd_v9_players` + `gd_v9_stats`. Written on every setter call via `persist()`.
- `config` ⇄ `localStorage[gd_v9_config]`. Written on every setter; merged with defaults on `hydrate()` so new defaults appear when added.
- Hydration is idempotent — `state.hydrate()` short-circuits via `_hydrated` flag to prevent late module init from clobbering in-flight mutations.
- `currentRanking` and `sessionStartTime` are deliberately NOT persisted (ephemeral session state).

**Mutation rules:**
- All getters that return collections (`getHistory`, `getPlayers`, `getCurrentRanking`) return shallow or deep copies. `getPlayerStats()` uses `JSON.parse(JSON.stringify(...))` because callers were mutating nested per-player records.
- Setters always go through the public API (`state.setTeamLevel('t1', 'A')`); raw `state.teams.t1.lvl = 'A'` is never used in the codebase. Verified via grep.
- `addHistoryEntry` deep-clones the incoming entry to break reference sharing — protects the rollback snapshot from external mutation.

**Snapshotting for async safety:** When `applyResult.finalWin === true` triggers profile sync, `main.js:259-262` deep-clones `historyEntry`, `players`, and `playerStats` before the 2-second `setTimeout`. This prevents user actions during the wait (Undo, Reset, Apply) from corrupting the synced session data.

---

## Event Bus Pattern

`src/core/events.js` is a flat dictionary of `eventName → callback[]`. No namespaces, no wildcards — events are loosely typed by convention (`{namespace}:{verb}`).

**Active event taxonomy** (verified by grep):
- `state:*` — `hydrated`, `persisted`, `teamLevelChanged`, `teamAFailChanged`, `winnerChanged`, `roundLevelChanged`, `roundOwnerChanged`, `nextRoundBaseChanged`, `historyAdded`, `historyRolledBack`, `historyCleared`, `historySet`, `playersChanged`, `playerStatsChanged`, `currentRankingChanged`, `gameReset`, `allReset`
- `config:*` — `hydrated`, `persisted`, `4/6/8PlayerRulesChanged`, `teamChanged`, `preferenceChanged`, `preferencesChanged`, `reset`, `rulesReset`, `rulesUpdated`
- `ranking:*` — `positionSet`, `cleared`, `complete`, `updated`
- `player:*` — `generated`, `teamAssigned`, `teamsShuffled`, `updated`, `addedFromProfile`, `removeRequested`, `removed`
- `room:*` — `created`, `joined`, `dataLoaded`, `updated`, `synced`, `left`
- `game:*` — `resultApplied`, `victoryAchieved`, `victoryForVoting`, `roundAdvanced`, `rollback`
- `voting:*` — `submitted`, `reset`

`main.js:166-453` (`setupModuleEventHandlers`) is the central reaction switchboard. Other modules also subscribe to events relevant to them (e.g., `votingManager.js:690` listens for `game:victoryForVoting`).

---

## Real-Time Room Sync Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                            HOST                                    │
│                                                                    │
│  User action ──▶ controllers/gameControls.js                       │
│       │              │                                             │
│       │              ▼                                             │
│       │         game/rules.applyGameResult()                       │
│       │              │ (mutates state, emits state:*)              │
│       │              ▼                                             │
│       │         state.persist() ──▶ localStorage                   │
│       │                                                            │
│       │         ── Plus auto every 10s ──                          │
│       │                                                            │
│       └──────▶  share/roomManager.syncToRoom()                     │
│                      │                                             │
│                      ▼                                             │
│                 fetch PUT /api/rooms/{code}                        │
│                 Authorization: Bearer {hostAuthToken}              │
│                 Body: full room snapshot + preserved votes         │
│                      │                                             │
└──────────────────────┼─────────────────────────────────────────────┘
                       │
                       ▼  api/rooms/[code].js (Edge)
                       │  - constant-time auth token compare
                       │  - TOFU pin if no stored token (legacy rooms)
                       │  - kv.set('room:{code}', JSON, TTL=1y)
                       │
                       ▼
┌────────────────────────────────────────────────────────────────────┐
│                     Vercel KV (Upstash Redis)                      │
│                          room:{code}                               │
└──────────────────────┬─────────────────────────────────────────────┘
                       │
                       ▼  HTTP GET every 2s
┌────────────────────────────────────────────────────────────────────┐
│                          VIEWERS                                   │
│                                                                    │
│  share/roomManager.startPolling()                                  │
│       │                                                            │
│       ▼                                                            │
│  fetch GET /api/rooms/{code}                                       │
│       │  (server strips authToken via sanitization)                │
│       ▼                                                            │
│  Compare lastUpdated; if changed:                                  │
│       │                                                            │
│       ▼                                                            │
│  loadRoomData() → state.setTeamLevel/setHistory/setPlayers/...     │
│       │                                                            │
│       ▼                                                            │
│  emit('room:updated') ──▶ main.js:419 re-renders entire UI         │
└────────────────────────────────────────────────────────────────────┘
```

**Auth tokens:**
- `roomManager.createRoom()` calls `POST /api/rooms/create`, which generates a 32-byte hex auth token via `crypto.getRandomValues` and returns it ONCE (`api/rooms/create.js:62`).
- The token is stored in KV alongside room data; `GET` strips it via destructure (`api/rooms/[code].js:53`).
- `PUT` requires the token in `Authorization: Bearer ...`; constant-time string compare in `api/rooms/[code].js:7`.
- TOFU fallback: if no stored token (legacy room), accept first PUT's token and pin it.

**Dev-mode block:** `roomManager.js:27` uses `import.meta.env.DEV` to detect pure-Vite sessions and pop an alert ("requires Vercel deploy") — prevents stale localStorage room codes from hitting prod KV during local dev.

---

## Voting Flow

```
                    ┌── HOST                       ┌── VIEWERS ──┐
                    │                              │             │
  Game ends         │                              │             │
  (A级通关 in        │                              │             │
   history.aNote)   │                              │             │
        │           │                              │             │
        ▼           ▼                              ▼             │
  victoryModal   showHostVoting + startVotePolling    showEnd-   │
  shows MVP +    (1s GET /api/rooms/vote/{code})      GameVoting │
  in-memory                                           ForViewers │
  voting buttons                                      (unlock UI)│
        │                                                │       │
        │                                                ▼       │
        │                                    User selects MVP +  │
        │                                    burden buttons      │
        │                                                │       │
        │                                                ▼       │
        │                              POST /api/rooms/vote/{code}│
        │                              { mvpId, burdenId, fp }   │
        │                                                │       │
        │                                                ▼       │
        │                                    api/rooms/vote/[code]
        │                                    - checks fingerprint
        │                                      against room.endGameVotes
        │                                      .fingerprints[]
        │                                    - increments mvp/burden
        │                                      counters in KV     │
        │                                                          │
        ▼                                                          │
   Periodically (3s) updateVoteLeaderboard() refreshes            │
   #mvpStatsTable / #burdenStatsTable from /vote/{code}            │
        │                                                          │
        │                                                          │
        ▼     5 min after game end (or manual settings click)     │
   votingSync.syncVotingToProfiles()                              │
        - Aggregates per-player vote counts                        │
        - For each voted player.handle:                            │
            PUT /api/players/{handle}                              │
              Authorization: Bearer {hostAuthToken}                │
              Body: { mode: 'VOTE_ONLY', mvpVoteCount, ... }       │
        - Server merges into player.stats.mvpVotes / burdenVotes  │
```

**Dedup:** Each viewer browser writes a fingerprint (UA + screen + tz + random) to `localStorage.gd_voter_fingerprint` once, then sends it with every vote. Server tracks `room.endGameVotes.fingerprints[]` and rejects duplicates.

**Idempotency:** `votingSync.syncVotingToProfiles` is safe to call multiple times — server stores `votingHistory` keyed by room+round so re-syncs apply latest counts (overwrite-safe, not additive).

---

## Data Flows

### Starting a Game (local)
1. `index.html` loads → `main.js:init()`.
2. `checkURLForRoom` and `loadFromShareURL` both return false → `state.hydrate()` and `config.hydrate()` from localStorage.
3. `state.setSessionStartTime(Date.now())` if not already set.
4. `initializeUI` reads checkboxes from config, renders rule hint.
5. `setupEventListeners` wires controllers; `setupModuleEventHandlers` wires inter-module pub/sub.
6. `renderInitialState` renders teams, players (or empty if none), ranking area, history, statistics.
7. User assigns players via drag/drop or "Quick Start"; player count must match mode (4/6/8).

### Submitting a Round
1. User drags players into ranking slots → `dragDrop` / `touchHandler` calls `setRankPosition` → `state.setCurrentRanking` → emits `state:currentRankingChanged`.
2. `main.js:168 onEvent('ranking:updated')` re-renders pool/slots, then calls `checkAutoCalculate(mode)`.
3. If complete, `calculateFromRanking(mode)` returns winner + upgrade.
4. If `autoApply` preference is true, calls `applyGameResult(calcResult, winner, playerRankingData)` (`game/rules.js`).
5. `applyGameResult`:
   - Captures snapshot of all teams + round meta for rollback.
   - `checkALevelRules` evaluates 8 branches (A-team won/lost × own/other round × winner-has-last × strict).
   - For 4-player only: `recordAFail` increments and demotes at 3 strikes. 6/8-player skip this entirely.
   - Calls `state.setTeamLevel`, `state.setRoundLevel`, `state.setRoundOwner`, `state.addHistoryEntry`.
   - Returns `{ applied, finalWin, historyEntry, message }`.
6. `main.js:231` calls `updatePlayerStats`, clears ranking, re-renders teams/history/stats.
7. If `applyResult.finalWin`: `await showVictoryModal(winnerName)`, schedule `scheduleAutoVotingSync()`, snapshot all state for the post-2s `syncProfileStats`.

### Ending a Session (A-level victory)
1. `applyGameResult` returns `finalWin: true`.
2. `victoryModal` renders MVP + tagline. MVP = winning-team player with **lowest average ranking across the entire session** (`victoryModal.js:85-98`). NOT the last-round winner. Identical logic in `share/votingManager.js:339-351` and `export/exportMobile.js:62-76` (deduplicated via `stats/mvpBurden.js`).
3. After 2-second wait (lets local voting register), `syncProfileStats` (`api/playerApi.js:271`):
   - Computes per-player relative session ranking (1-N) by sorting `sessionStats[playerId].totalRank / games`.
   - Maps each session honor to its winning player.
   - For each player with a `handle`, builds `gameResult` with: avg ranking, relative rank, team, teamWon, gamesInSession, sessionDuration, honorsEarned, votedMVP/Burden, teammates[], opponents[], mode, finalLevel.
   - PUTs each player's profile via `updatePlayerStats(handle, gameResult, hostAuthToken)`.
4. Server merges into player stats (`api/players/[handle].js`); achievements re-evaluated; `recentRankings`, partners/opponents tables updated.

### Syncing Profile Stats — Auth flow
- **Room games (host):** `roomAuthToken` from `getRoomInfo()` is sent as `Authorization: Bearer ...`. Server accepts because the token matches the room's stored `authToken`, and host has authority over every player in the room.
- **LOCAL games:** `roomAuthToken` is null. Falls back to per-handle `getOwnershipToken(handle)` from `localStorage[gd_owner_token_<handle>]` — the token issued on profile creation. Works only for the original creator's device.
- **Viewers:** `roomAuthToken` is null in viewer mode (banner is sticky-readonly). Server rejects writes (per the C-1 audit fix referenced in `votingSync.js:54-57`). This is correct — viewers should not write profile stats.

---

## Key Abstractions

**`state` singleton** (`src/core/state.js`)
- Purpose: single source of truth for all game state.
- Pattern: Singleton + persistence + event emission on every setter.
- Examples: `state.setTeamLevel('t1', 'A')`, `state.addHistoryEntry({...})`, `state.getPlayerStats()` (deep clone).

**`config` singleton** (`src/core/config.js`)
- Purpose: rules and preferences (4/6/8-player mode tables, must1/autoNext/autoApply/strictA, team names/colors).
- Pattern: Same singleton + persist + emit pattern as `state`.

**Event bus** (`src/core/events.js`)
- Purpose: loose coupling between modules — `state` mutations announce themselves, controllers and renderers subscribe.
- Pattern: Classic pub/sub. No payload schema enforcement — payloads are duck-typed.

**`history` entry** (built in `game/rules.js:227-243`)
- Purpose: immutable record of a single round result. Acts as both history-row source and rollback snapshot.
- Fields: `ts, mode, combo, ranks, up, win, winKey, t1, t2, round, aNote, sessionDuration, gameEndedAt, prevT1Lvl, prevT1A, prevT2Lvl, prevT2A, prevRound, prevRoundOwner, prevNextRoundBase, playerRankings`.
- Deep-cloned on add and on rollback to prevent reference-sharing bugs.

**Ownership token** (`src/api/playerApi.js:6-38` + `api/players/_utils.js:236-269`)
- Purpose: per-handle credential for self-edit of player profiles from the original device.
- Pattern: Server generates 32-byte hex on `POST /api/players/create`, returns ONCE in response; client persists to `localStorage[gd_owner_token_<handle>]`. Server stores SHA-256 hash (`ownershipTokenHash`) — preimage resistance protects against KV leak.
- Auth precedence: `roomAuthToken` (Bearer) > owner token (Bearer) > admin token (request body).

---

## Entry Points

**`src/main.js:init()`** (line 66)
- Triggered by `DOMContentLoaded` (or immediately if already loaded) on `index.html`.
- Order: room-mode check → share-URL check → state hydration → UI init → event wiring → initial render → room banner.

**Inline `<script type="module">` in each secondary HTML page**
- `players.html` → `initializeCreateModal`, fetches `searchPlayers` directly.
- `player-profile.html` → `getPlayer`, `Chart` setup, `initializeEditModal`.
- `rooms.html` → no `src/` imports; uses `fetch` directly against `/api/rooms/list` and `/api/rooms/favorite`.

**Edge Function entry points**
- `api/rooms/create.js` → `POST` only; generates room code + auth token.
- `api/rooms/[code].js` → `GET` (public, sanitized) and `PUT` (Bearer-token-gated).
- `api/rooms/list.js` → `GET`; reads `rooms:index` or `favorites:index`.
- `api/rooms/vote/[code].js` → `POST` (vote) / `GET` (results).
- `api/rooms/favorite/[code].js` → `POST` (favorite, removes TTL) / `DELETE` (unfavorite, restores 1y TTL).
- `api/rooms/reset-vote/[code].js` → `POST`; clears votes for a round.
- `api/players/create.js` → `POST`.
- `api/players/[handle].js` → `GET` (public sanitized) / `PUT` (auth-gated, supports `mode: 'PROFILE_UPDATE'` | `'ROTATE_TOKEN'` | implicit-stats).
- `api/players/list.js` → `GET`.
- `api/players/touch.js` → `POST`; bumps `lastActiveAt`.
- `api/players/delete.js`, `reset-stats.js`, `migrate-modes.js`, `migrate-single.js`, `backfill-duration.js` → admin endpoints (validate `ADMIN_TOKEN` env via constant-time compare; fail-closed if env unset).

---

## Error Handling

**Strategy:** Loud-and-recoverable. Every fetch wraps in try/catch with `console.error`, returns `{ success: false }` for non-critical paths (touch, stats sync) and shows `alert()` for user-facing failures (create/join room).

**Patterns:**
- **Edge functions:** every handler has a top-level try/catch that returns `{ error: ... }` with appropriate HTTP status. JSON parse errors → 400. KV miss → 404. Auth fail → 403. Internal → 500.
- **State setters:** validate team key (`['t1', 't2'].includes`) and `throw new Error` on invalid input. Caller protected by event-listener try/catch in `events.js:60`.
- **Storage:** `load()` and `save()` swallow `localStorage` exceptions (warn + return default), so quota errors don't crash the app.
- **Async user actions:** `apply` button has a double-submit guard (`gameControls.js:81-83`) — disables itself for the entire async flow including the awaited `showVictoryModal`.
- **Stats sync:** non-blocking promises (`updatePlayerStats(...).then().catch()` in `playerApi.js:380`); a single profile-update failure does not block other players.

---

## Cross-Cutting Concerns

**Logging:** `console.log` / `console.warn` / `console.error` directly. No logger abstraction. Heavy logging in `roomManager`, `playerApi.syncProfileStats`, `votingSync` (game-end is the most failure-prone path).

**Validation:**
- Client-side: `validateHandle` in `api/playerApi.js:133` (regex + length).
- Server-side: `_utils.validateHandle`, `_utils.validatePlayerData`, `_utils.validateAdminToken`, `_utils.validateOwnershipToken`. All in `api/players/_utils.js`.
- Game data: `applyGameResult` validates `calcResult.upgrade !== undefined` and `Array.isArray(ranks)` before mutating state.
- Rank parsing: `parseRanks` validates length, range (1..maxRank), and uniqueness.

**Authentication:**
- Room PUT: Bearer host auth token, constant-time compared in `api/rooms/[code].js:7`.
- Player PUT (PROFILE_UPDATE / stats): admin token (body) OR per-handle owner token (Bearer, hashed compare).
- Admin endpoints: admin token only (constant-time, fail-closed if `ADMIN_TOKEN` env unset).
- Voting: anonymous + browser fingerprint dedup (no auth).

**Internationalization:** None — copy is hardcoded zh-CN throughout. UTF-8 enforced at every API boundary (every Edge handler sets `Content-Type: application/json` charset implied; comment "UTF-8 encoding for Chinese characters" in headers of all API files).

**PWA:** `public/manifest.json` + `public/sw.js` + main.js install-prompt handler. iOS Safari gets a custom install-instructions modal (no `beforeinstallprompt` support).

---

## Key Invariants

1. **MVP = lowest average session ranking.** NOT last-round 1st place. Three places enforce it: `victoryModal.js:85-98`, `votingManager.js:339-351`, `mvpBurden.js:27` (used by `statistics.js` and `exportMobile.js`).
2. **A-level fail counter is 4-player ONLY.** 6/8-player modes do NOT track fails or demote — they keep playing until someone wins on their own A. Enforced in `rules.js:20 tracksAFail()` and `rules.js:71 recordAFail()`.
3. **Strict A-level victory requires `roundLevel === 'A' && roundOwner === aTeam`.** Otherwise the round just continues. Enforced in `rules.js:112-126`.
4. **Game-ended check requires "通关" without "才能通关" or "需" or "但".** Encoded in `rankingRenderer.checkGameEnded()` — the canonical check used by 7 callers.
5. **State setters always emit events AND persist.** Never bypass setters with raw mutation; verified by grep — no direct `state.teams.t1.lvl =` exists.
6. **Player stats deep-clones on read.** `state.getPlayerStats()` returns a JSON-roundtripped copy; mutating the result does not affect source state. Same for `getHistory` and `getCurrentRanking`.
7. **History entries are deep-cloned on add and on `setHistory`.** Protects rollback snapshots from external mutation.
8. **Auth tokens are returned ONCE.** Server-issued room auth tokens (`api/rooms/create.js:62`) and ownership tokens (`api/players/create.js`) are NEVER readable via GET — clients must persist on receipt.
9. **Server-side ownership tokens are stored hashed (SHA-256 hex, 64 chars).** A KV leak cannot be replayed. Length-equality short-circuit explicitly guards against schema-change leaking a 1-bit oracle (`_utils.js:259`).
10. **Pre-2-second snapshot before profile sync.** `main.js:259-262` deep-clones historyEntry/players/stats/roomInfo SYNCHRONOUSLY before the 2-second timeout — protects against user mutations during the wait.
11. **Touch handlers must be re-attached after every render.** `attachTouchHandlersToAllTiles` is called after every `renderPlayers` / `renderRankingArea` / room update. Uses `dataset.touchHandlersAttached === 'true'` as idempotency guard.
12. **Viewers cannot write to profiles or rooms.** Sanitized GET strips `authToken`; viewer mode passes `null` as `roomAuthToken` and per-handle owner tokens are not issued for viewers.

---

*Architecture analysis: 2026-05-03*
