# Guandan Calculator - Complete Codebase Structure

> Comprehensive guide to every file in the codebase

**Last Updated**: 2025-12-11
**Version**: 10.0 (Modular + Refactored + Profile Photos)
**Total Files**: 65+ modules (38 source modules + APIs + pages)

---

## Root Directory

```
/
├── index.html              # Main game entry point (v10.0 navigation)
├── players.html            # Player browser page (with admin mode)
├── player-profile.html     # Individual profile page (with photos)
├── rooms.html              # Room browser page (NEW v10.0)
├── package.json            # Dependencies and scripts
├── vite.config.js          # Multi-page build configuration
├── vercel.json             # Deployment settings
├── TODO.md                 # Implementation tracker (v10.0 updated)
├── CLAUDE.md               # AI coding instructions (v10.0 updated)
└── README.md               # Project overview (v10.0)
```

### `index.html` (Main Game)
- Entry point for the game application
- Loads `src/main.js` as ES6 module (509 lines, refactored)
- Contains all UI structure:
  - Modern pill navigation (👥 浏览玩家 | 🏠 浏览房间 | 🎮 游戏)

**Key Sections**:
- Lines 34-64: Player profile search UI
- Lines 77-94: Team drop zones
- Lines 98-112: Team status display
- Lines 342-397: Voting system UI

### `players.html` (Player Browser)
- Standalone page for browsing all players
- Grid layout with player cards
- Search and pagination
- Import playerSearch modules
- Click card → navigate to profile

### `player-profile.html` (Profile Page)
- Displays individual player's complete stats
- URL: `?handle=xiaoming`
- 8 sections: Header, Session Stats, Round Stats, Time, Rankings, Honors, Voting, Partners, Achievements, Games
- Fetches data from `GET /api/players/[handle]`

---

## Source Code (`src/`)

### Entry Point

#### `main.js` (509 lines) - Application Orchestrator
**Purpose**: Wire up all modules and handle events

**Key Responsibilities**:
1. **Initialization** (lines 81-121)
   - Check for room/share URLs
   - Hydrate state from localStorage
   - Start session timer
   - Setup UI and event handlers

2. **Player Profile Integration** (lines 312-340)
   - Initialize search and create modal
   - Wire up selection callbacks
   - Show initial players

3. **Game Controls** (lines 182-255)
   - Apply button: Manual ranking application
   - Advance button: Next round
   - Undo button: Rollback
   - Reset button: New game

4. **Victory Handling** (lines 230-251, 736-759)
   - Calculate session honors
   - Get voting results
   - Sync profile stats
   - Show victory modal
   - Schedule auto voting sync

5. **Event Handlers** (lines 649-900)
   - Ranking events (updated, cleared)
   - Player events (generated, assigned, profile added/removed)
   - State events (reset, rollback)
   - Room events (created, joined, updated)

6. **Room Banners** (lines 1087-1214)
   - showHostBanner(): Live timer, room code, copy link
   - showViewerBanner(): Live timer, read-only indicator
   - Timers stop on game end

**Imports**: 25+ modules from all domains

---

### Core Modules (`src/core/`)

#### `utils.js` - DOM Helpers
**Exports**:
- `$(id)` - getElementById shorthand
- `on(el, event, handler)` - addEventListener wrapper
- `now()` - Current timestamp string

**Usage**: Used throughout app for DOM operations

#### `storage.js` - LocalStorage Wrapper
**Exports**:
- `load(key, defaultValue)` - Get from localStorage with fallback
- `save(key, value)` - Set to localStorage (JSON)
- `KEYS` - All storage keys (`gd_v9_*`)

**Keys**:
- `gd_v9_settings` - Game configuration
- `gd_v9_state` - Team levels, history
- `gd_players` - Player data
- `gd_player_stats` - Session statistics

#### `events.js` - Pub/Sub System
**Exports**:
- `on(event, handler)` - Subscribe to event
- `emit(event, data)` - Publish event
- `off(event, handler)` - Unsubscribe
- `once(event, handler)` - Subscribe once

**Events**: 30+ events for cross-module communication

#### `state.js` - Game State Singleton
**Purpose**: Single source of truth for all game state

**State Fields**:
- `teams` - Team levels and A-fail counters
- `roundLevel`, `roundOwner`, `nextRoundBase`
- `history` - Complete game history
- `players` - Current session players
- `playerStats` - Session statistics
- `currentRanking` - Temporary ranking state
- `sessionStartTime` - Timer start (NEW)

**Methods**: 30+ getters/setters with event emission

#### `config.js` - Settings Manager
**Purpose**: Manage game rules and preferences

**Settings**:
- Team names and colors
- 4/6/8 player upgrade rules
- Preferences (must1, autoApply, strictA, autoNext)

**Methods**: Get/set with localStorage persistence

---

### Game Logic (`src/game/`)

#### `calculator.js` - Pure Calculation Functions
**Exports**:
- `parseRanks(rankStr)` - Parse ranking string
- `calculateUpgrade(ranks, mode)` - Determine upgrade amount
- `nextLevel(current, upgrade)` - Calculate next level

**Pure Functions**: No side effects, testable

#### `rules.js` - Game Rules Engine
**Exports**:
- `checkALevelRules(winner, ranks, mode)` - thin wrapper since 2026-06-11: gathers state/config and delegates to the pure algorithm in `shared/aLevelLogic.js` (zero host deps, vendored by the guandan-scorer-wxapp sibling repo — edit the shared file, never re-inline the logic here)
- `applyGameResult(calcResult, winner, playerData)` - Apply round
  - Complete game flow orchestration (still state-coupled, NOT vendored)
  - Updates team levels
  - Checks A-level rules
  - Creates history entry with **sessionDuration**
  - Emits events

**A-Level Logic**: Strict vs lenient mode handling — algorithm in `shared/aLevelLogic.js`

#### `history.js` - History Management
**Exports**:
- `renderHistory()` - Display game history table
- `undoLast()` - Rollback last round
- `resetAll(keepPlayers)` - Clear game

**UI Rendering**: History table with rollback buttons

---

### Player System (`src/player/`)

#### `playerManager.js` - Player Data Management
**Purpose**: Manage player data and team assignment

**Key Functions**:
- `generatePlayers(count)` - Create session players
- **`addPlayerFromProfile(profile)`** - Add from profile (NEW)
  - Creates session player with profile data
  - Calls `touchPlayer()` API
  - Emits `player:addedFromProfile`
- **`removePlayer(playerId)`** - Remove from game (NEW)
- `shuffleTeams(mode)` - Random team assignment
- `applyBulkNames(str)` - Parse space-separated names

**Exports**: `ANIMAL_EMOJIS` (77+ emojis)

#### `playerRenderer.js` - Player Tile Rendering
**Functions**:
- `renderPlayers()` - Render all player tiles
- `createPlayerTile(player)` - Create draggable tile
  - **Disables name editing for profile players** (line 98)
  - **Add remove button (×) for profiles** (lines 115-145)
- `updateTeamLabels()` - Update team displays

**DOM Creation**: Player tiles with drag/drop support

#### `playerSearch.js` - Search UI Component (NEW)
**Purpose**: Real-time player profile search

**Functions**:
- `initializePlayerSearch(onSelect, onCreate)` - Setup
- `performSearch(query)` - Execute with 300ms debounce
- `renderSearchResults(players)` - Display results
- `showInitialPlayers()` - Load recent 10
- `clearSearchResults()` - Reset

**UI**: Search input → Results list → Click to add

#### `playerCreateModal.js` - Creation Modal (NEW)
**Purpose**: Full-screen modal for creating profiles

**Functions**:
- `initializeCreateModal(onCreated)` - Setup callback
- `showCreateModal()` - Display modal
- `closeModal()` - Hide
- `setupModalHandlers()` - Wire form

**Form**: Handle, DisplayName, Emoji grid (77+), PlayStyle dropdown, Tagline

#### `dragDrop.js` - Desktop Drag & Drop
**Purpose**: HTML5 drag/drop for team assignment

**Variables**: `draggedPlayer` - Track current drag

**Events**: dragstart, dragover, drop

#### `touchHandler.js` - Mobile Touch Events
**Purpose**: Long-press drag for mobile

**Functions**:
- `handleTouchStart(e)` - 200ms long-press detection
- `handleTouchMove(e)` - Track touch position
- `handleTouchEnd(e)` - Drop handling

**Mobile Support**: iOS and Android compatible

---

### Ranking System (`src/ranking/`)

#### `rankingManager.js` - Ranking State
**Functions**:
- `setRanking(position, playerId)` - Assign to slot
- `getRanking()` - Get current rankings
- `clearRanking()` - Reset
- `randomizeRanking(playerIds, mode)` - Random shuffle
- `isRankingComplete(mode)` - Check all filled

#### `rankingRenderer.js` - Ranking UI
**Functions**:
- `renderRankingArea(mode)` - Setup slots and pool
- `renderPlayerPool()` - Unranked players
- `renderRankingSlots()` - 1st-8th place slots
- **`checkGameEnded()`** - Detect A-level victory
  - Lines 25-35: Fixed to exclude conditional "通关"

**Bug Fix**: Exclude "才能通关", "需", "但" from victory detection

#### `rankingCalculator.js` - Calculation Bridge
**Functions**:
- `checkAutoCalculate(mode)` - Should auto-calc?
- `calculateFromRanking(mode)` - Get upgrade from positions
- `getPlayerRankingData()` - Extract player→rank mapping

---

### Statistics (`src/stats/`)

#### `statistics.js` - Session Stats Tracking
**Purpose**: Track local session performance

**Functions**:
- `updatePlayerStats(mode)` - Update after each round
- `renderStatistics()` - Display stats table

**Data**: Stored in `state.playerStats`
```javascript
{
  playerId: {
    games: 30,
    totalRank: 109,  // Sum of all ranks
    firstPlaceCount: 7,
    lastPlaceCount: 2,
    rankings: [3, 4, 2, ...]  // All round rankings
  }
}
```

#### `honors.js` - Honor Calculation
**Purpose**: Calculate 16 full-session honors from session data

**Function**: `calculateHonors(totalPlayers)`
**Returns**: Object with honor winners
**Eligibility**: Full-session honors require at least 5 rounds of valid
rankings before any award is emitted; otherwise cards remain in-progress.

**Algorithms** (lines 38-328):
- **吕布** (MVP): Most first places + tie-breaker
- **阿斗** (Burden): Most last places
- **石佛** (Stable): Low avg + low variance
- **波动王** (Volatile): High variance
- **奋斗王** (Improvement): Early-to-late climb
- **逆转核心** (Comeback Core): Low-to-high comeback arc
- **翻车王** (Crash): Top 3 to last drops
- **赌徒** (Gambler): High first + high last rates
- **大满贯** (Complete): Experience all positions
- **连段王** (Top-Half Streak): Longest top-half streak
- **团队中轴** (Team Anchor): Teammate-relative anchor impact
- **保底核心** (Safety Net): No-last team safety net
- **节奏核心** (Tempo Core): Team-leading pressure with opponent context
- **燃尽王** (Burnout): Early-to-late collapse after a solid start
- **棋差一着** (Almost): Repeated second place without wins
- **抗压王** (Resilient): Rebounds after bottom-tier pressure rounds

#### `shared/achievementLogic.js` / `src/stats/achievements.js` - Achievement System (NEW)
**Purpose**: Define and check 17 active achievement badges from one shared implementation. `src/stats/achievements.js` re-exports the shared catalog for existing frontend imports.

**Constant**: `ACHIEVEMENTS` - All definitions
```javascript
{
  newbie: { name: '初来乍到', badge: '🐣', desc: '完成第一场游戏' },
  // ... 16 more
}
```

**Function**: `checkAchievements(stats, lastSession)`
- Milestone (4): Games played thresholds
- Performance (4): Streaks and win rate
- Honor Collection (4): Honor diversity
- Social (3): Relationship milestones and session-specific
- Special (2): Unique feats

---

### UI Components (`src/ui/`)

#### `teamDisplay.js` - Team Styling
**Functions**:
- `applyTeamStyles()` - Apply colors to UI
- `renderTeams()` - Update team status display
- `updateTeamLabels()` - Update team names
- `updateRuleHint(mode)` - Show rule explanation

#### `victoryModal.js` - Victory Celebration (Enhanced)
**Purpose**: A-level victory modal with MVP tagline

**Functions**:
- **`showVictoryModal(teamName)`** - Display (lines 50-146)
  - Calculate MVP (lowest avg ranking)
  - Show tagline if profile player
  - Emit room voting events
  - Display modal

- **`getVotingResults()`** - Legacy local-vote hook
  - Returns `{mvp: null, burden: null}`
  - Room voting results are synced through `votingManager.js`/`votingSync.js`

- `closeVictoryModal()` - Hide modal

**MVP Calculation** (lines 48-68): Lowest average = best

#### `toast.js` - Generic Toast Notifications (NEW 2026-05-06)
**Purpose**: Stack-based toast manager — used by `playerApi.syncProfileStats` to surface server-returned `newAchievements` after victory

**Functions**:
- `showToast(opts)` - Render or queue a toast. Opts: `{variant, badge, title, name, desc, duration}`
- `clearToasts()` - Drop all visible + queued toasts (used by tests; production rarely calls)

**Behavior**:
- Stack lives top-right on desktop (max 3 visible), top-center full-width strip on mobile
- Auto-dismiss after 5s; click anywhere on the toast (or close button) dismisses immediately
- Queue overflow when more than 3 trigger at once
- Theme-agnostic: CSS uses TOKEN_SPEC vars (`--surface`, `--accent`, `--rule`, `--ink*`)

**XSS-safe by construction**: createElement + textContent only — no innerHTML, no template strings interpolating user data into HTML

---

### Export System (`src/export/`)

#### `exportHandlers.js` - TXT/CSV Export
**Functions**:
- `exportTXT()` - Text format with full history
- `exportCSV()` - Spreadsheet format
- `exportLongPNG()` - Desktop PNG (2200px wide)

#### `exportMobile.js` - Mobile PNG Export (Enhanced)
**Purpose**: 600px mobile-optimized PNG

**Enhancements**:
- Lines 62-87: **MVP tagline display**
  - Calculate from session stats (not last round)
  - Gold color, 2-line format
- Lines 89-98: **Session duration display**
  - Format: "45分钟" or "2小时15分"
- Lines 78-400: Complete game summary

**Canvas Rendering**: UTF-8 Chinese character support

---

### Theme System (`src/themes/` + `src/ui/*Sync.js` modules) - All 5 phases shipped (last: Phase 5 Tea-Table 2026-05-06)

5-theme architecture per `docs/design/THEME-ARCHITECTURE.md`. **All five themes registered and shipped**: Broadcast (A · default), Linear (E), Trading (D), Atelier (F), Tea-Table (G). Tea-Table is the only theme with real image assets — 17 ink-brush portrait JPGs at `public/themes/teatable/honors/<honor-id>.jpg` generated via gpt-image-2 (Azure). Other themes are CSS-only restyles of the shared DOM.

**Phase 1.5 (Broadcast editorial closure)** — drove from ~40% to ~92% match vs `docs/design/demos/demo-broadcast-v3.png`:
- DOM rewrite of all 4 HTML pages (`index.html`, `players.html`, `rooms.html`, `player-profile.html`) — top nav + ticker + scoreboard + active-game + history + honors + sample + profile + footer.
- ~840 inline `<style>` lines migrated into `theme.css`, scoped under `:root[data-theme="broadcast"]`. theme.css ≈3500 lines.
- All 130+ JavaScript-bound element IDs preserved.
- New live-data sync modules: `ui/calcPreviewSync.js`, `ui/rulesDrawerSync.js`, `ui/profileSnippetSync.js`. Existing `ui/tickerSync.js` extended to 6 fields. `game/history.js` rewritten as flexbox rows. `stats/honors.js` rewritten with team-colored recipient blocks. `player/playerRenderer.js` extended with `.roster-row` mode for scoreboard team zones. `ui/teamDisplay.js` extended with RANK NN/13 + active-game header line accents.
- ARIA preserved across rewrite. Removed the duplicate "我的资料 / PROFILE" topnav tab — returns when session identity ships in Phase 2.5.

**Phase 2 (Linear / Vercel Console)** — shipped 2026-05-03:
- Second registered theme. Same DOM + renderers as Broadcast; CSS-only transformation.
- Geist + Geist Mono, deep-neutral oklch base, single Linear-purple accent, density-first scale.
- `src/themes/linear/theme.css` (~990 lines, every rule scoped under `:root[data-theme="linear"]`).
- Capture baselines: `docs/reports/phase2-linear/`.
- Phase 2.5 follow-up: Linear sidebar layout via `layout.mount()` + state preservation across theme switches.

#### `themes/_shared/tokenSpec.js` - Token Contract
**Exports**: `TOKEN_SPEC` (frozen Object: color/font/scale/radius lists),
`cssVar(category, key)` (builds `--<name>` CSS custom-property names),
`verifyTokensPresent(rootEl)` (runtime contract check across all categories).

#### `themes/_shared/themeManager.js` - Theme Orchestration
**Functions**:
- `register(theme)` - Register a theme (tolerates `export default` shape)
- `mount(themeName)` - Set `data-theme` attr, run `layout.mount`, persist to localStorage, emit `theme:changed`
- `switchTo(themeName)` - No-op when current === target; otherwise `mount`
- `listThemes()` / `getCurrent()` / `getManifest()` / `resolveBootTheme(default)`

**Storage**: `gd_v9_theme` localStorage key (matches `gd_v9_*` convention).

#### `themes/_shared/featureManifest.js` - Cross-Theme Behavior Contract
Declares per-theme rendering choices: `navigation`, `rankingInteraction`,
`victorySurface`, `sparklines`, `commandPalette`, `honorPortraits`,
`customRulesUI`, `liveCalcStrip`. `resolveManifest(themeManifest)` merges
with `DEFAULT_MANIFEST` for missing keys.

#### `themes/_shared/ThemePicker.js` - Settings-Drawer Picker
XSS-safe (createElement + textContent, no innerHTML). Renders a status row
when only one theme is registered; flips to a radio group when 2+ exist.
Captures and releases its `theme:changed` subscription across re-mounts.

#### `themes/_shared/sparkline.js` - Pure SVG Sparkline Renderer (Phase 3.5)
Shipped 2026-05-04. Returns a `<svg>` element from a numeric data series
(`renderSparkline({ data, width, height, range, invertY, color, ... })`)
plus a ranking-specific helper (`renderRankingSparkline(rankings, mode)`)
that auto-inverts Y so rank 1 plots at the top. Class-based grid lines
(`.sparkline__grid`) and a `--last` dot let themes restyle via CSS without
re-rendering. Wired into `src/stats/statistics.js` — appears as a 近况
column in the stats-table when `getManifest().sparklines === true` (Trading
flipped this on; Broadcast / Linear stay false and render unchanged).

#### `themes/broadcast/theme.css` - Broadcast Palette + Typography + Component Styles
Activates under `:root[data-theme="broadcast"]`. Each oklch() value is
paired with a sRGB hex/rgb fallback so Safari iOS 15.0–15.3 (parsers that
reject oklch) still gets a valid color. **~3650 lines** post-Phase-1.5. Defines:
- 22 color tokens (bg/surface/ink/accent/team/win/loss/rule families)
- 3 font tokens (Fraunces / Inter Tight / DM Mono)
- 8 spacing tokens (`--s1` through `--s8`)
- 5 radius tokens
- Backward-compat aliases (`--card`/`--muted`/`--stroke`/`--chip`) for unmigrated rules
- All Phase 1.5 component styles: `.topnav`, `.ticker`, `.modeselect`, `.scorer`, `.team`, `.card-level`, `.versus`, `.activegame`, `.pool`, `.slots`, `.calcpreview`, `.toggles`, `.manualbtns`, `.btn` family, `.rules-drawer`, `.history`, `.honors`, `.honor`, `.sample`, `.profile`, `.footer`
- Page-specific sections (clearly marked with `/* === PAGE: PLAYERS BROWSER === */` etc.) for `.player-card`, `.players-grid`, `.rooms-grid`, `.room-card`, `.profile-page-hero`, `.career-stat-tile`, `.mode-tab`, `.filter-tab`, `.players-pagination`, etc.
- `@media (max-width: 768px)` responsive block stacks scoreboard columns, collapses pool/slots, scales card-level glyph from 200px → 140px

Phase 2 follow-up: split into `theme.tokens.css` + `theme.layout.css` + `theme.components.css` (deferred — see HANDOFF.md "Phase 1.5 follow-ups" section).

#### `themes/broadcast/featureManifest.js` / `index.js`
Broadcast's explicit manifest values + the theme barrel (name, displayName,
description, stylesheet path, layout placeholder).

#### `themes/linear/theme.css` - Linear / Vercel Console Theme (Phase 2)
Activates under `:root[data-theme="linear"]`. ~990 lines.
- Geist + Geist Mono, oklch deep-neutral 270° base, single Linear-purple accent
- Density-first scale (`--s1` through `--s8` are 4/6/10/14/20/28/40/56 px)
- Equal-lightness surfaces (14/18/22/26%) with 1px borders for depth
- Compact level glyph (36px) replaces Broadcast's 200px editorial; no decorative card-suit symbols
- 4-column honors grid, monospace history table, custom checkbox styling

#### `themes/linear/featureManifest.js` / `index.js`
Linear's manifest (`commandPalette: true`, `liveCalcStrip: 'monospace'`,
`honorPortraits: 'tagged'`) + theme barrel.

#### `ui/tickerSync.js` - Live Ticker Binding
Six-field ticker (`#tickerRoom`, `#tickerMode`, `#tickerRound`, `#tickerLevel`,
`#tickerOwner`, `#tickerElapsed`) plus a LIVE/SYNC indicator. Reads room code
from URL hash or `state.getRoomCode()`. Drives an interval timer for the
elapsed counter. Listens to `ui:modeChanged`, round-level/owner/history events,
`state:hydrated`, `state:gameReset`, `state:allReset`, `room:updated`,
`room:joined`, `room:left`, `config:teamChanged`.

#### `ui/calcPreviewSync.js` - LIVE CALC Editorial Strip (NEW Phase 1.5)
Renders three editorial segments — 红 / 蓝 / 差距 — based on current ranking
state. For 4-player: combination lookup with c4 table. For 6/8: per-team partial
sums + score difference + threshold hint. Mode-aware slot count. Subscribes to
ranking events + `ui:modeChanged`.

#### `ui/rulesDrawerSync.js` - Rules Chip Strip (NEW Phase 1.5)
Renders the compact `<summary>` chip strip on the Custom Rules drawer:
`c4: 3-2-1 · t6: 7/4/1 · p6: 5-4-3-3-1-0 · t8: 11/5/0 · flags: ...`. Listens to
`config:settingChanged`, `config:rulesUpdated`, `config:preferenceChanged`,
`config:preferencesChanged`.

#### `ui/profileSnippetSync.js` - Bottom-of-Page Profile Card (NEW Phase 1.5)
Binds the editorial profile snippet to the active player profile. Active
player resolved via `gd_active_profile_handle` localStorage key (set when user
selects a player) or first profile-player in current session. Renders avatar,
name, handle, badge, 6-stat grid (Sessions/Won/Rounds/AvgRank/PlayTime/最C·最闹),
top-partner + top-rival progress bars. Empty-state fallback for guest.

### Share & Room Features (`src/share/`)

#### `roomManager.js` - Real-Time Rooms
**Functions**:
- `createRoom()` - Generate code, store in KV
- `joinRoom(code)` - Load room data
- `checkURLForRoom()` - Parse URL params
- `getRoomInfo()` - Get current room state
- `syncNow()` - Manual sync to KV
- `startAutoSync()` - 10-second interval

**Room Data**: Stored in Vercel KV with auth tokens

#### `shareManager.js` - Static Sharing
**Functions**:
- `generateShareURL()` - URL-encoded game state
- `loadFromShareURL()` - Parse and load state
- `showShareModal()` - Display share options

#### `votingManager.js` - Community Voting
**Purpose**: Viewer voting for MVP/burden

**Functions**:
- `submitEndGameVotes(mvp, burden)` - Submit viewer vote
- `getEndGameVotingResults()` - Host fetches from API
- `showHostVoting()` - Display results to host
- `updateVoteLeaderboard()` - Live polling (3s)
- `initializeViewerVotingSection()` - Locked viewer UI
- `showEndGameVotingForViewers()` - Unlock on victory

**Storage**: `/api/rooms/vote/[code]` in KV

#### `votingSync.js` - Profile Integration (NEW)
**Purpose**: Sync voting results to player profiles

**Functions**:
- **`syncVotingToProfiles()`** - Manual/auto sync
  - Fetch voting results from API
  - Find top-voted MVP and burden
  - Update profiles via vote-only mode
  - Return sync status

- **`scheduleAutoVotingSync()`** - 5-minute timer
  - Called on game victory
  - Ensures voting captured

**Integration**: Lines 482-516 in main.js (manual button)

---

### API Client (`src/api/`)

#### `playerApi.js` - Player Profile API Client (NEW)
**Purpose**: All communication with player profile backend

**Exports**:
- `searchPlayers(query, limit)` - Search with pagination
- `getPlayer(handle)` - Fetch profile
- `createPlayer(data)` - Create new profile
- `touchPlayer(handle)` - Update lastActiveAt
- `updatePlayerStats(handle, gameResult)` - Update session stats
- **`syncProfileStats(...)`** - Sync all players (lines 211-327)
  - Calculate relative rankings
  - Map honors to players
  - Extract teammates/opponents
  - Build gameResult for each player
  - Call updatePlayerStats API

- `validateHandle(handle)` - Client validation
- `getPlayStyleLabel(style)` - Map to Chinese
- `getPlayStyles()` - All 8 options

**syncProfileStats Parameters**:
1. historyEntry - Final round data
2. roomCode - Room identifier
3. players - All session players
4. sessionStats - Complete session stats
5. sessionHonors - Calculated honor winners
6. votingResults - Local vote results

---

## Backend API (`api/`)

### Room APIs (`api/rooms/`)
- `create.js` - Generate 6-digit codes
- `[code].js` - GET/PUT room data
- `vote/[code].js` - Submit/fetch votes
- `reset-vote/[code].js` - Clear votes/fingerprints and archive last result snapshot
- `favorite/[code].js` - Toggle favorite (1-year TTL)
- `list.js` - Browse favorited rooms

### Player APIs (`api/players/`) - NEW

#### `create.js` - Create Player Profile
**POST** `/api/players/create`

**Process**:
1. Validate all fields (lines 26-38)
2. Check handle uniqueness
3. Generate player ID (`PLR_` + 6 random chars)
4. Create player object with initialized stats
5. Store: `player:${handle}` (permanent, no TTL)
6. Reverse lookup: `player_id:${id}` → handle

**Validation**: Via `_utils.js` functions

#### `[handle].js` - Get/Update Profile
**GET** `/api/players/[handle]` - Fetch profile
**PUT** `/api/players/[handle]` - Update stats

**PUT Modes**:
1. **Full Update** (normal game completion)
   - Lines 135-259: Complete stats calculation
   - Session stats (+1 session, update averages)
   - Round stats (+N rounds, weighted average)
   - Time tracking (accumulate, update records)
   - Honor increments
   - Partner/opponent tracking (NEW)
   - Voting stats
   - Win/loss streaks
   - Recent games array
   - Achievement checking

2. **Vote-Only Update** (manual voting sync)
   - Lines 261-283: Only voting stats
   - Increment mvpVotes or burdenVotes
   - Skip everything else

**Achievement Checking** (lines 16-46): Inline function

#### `list.js` - Search Players
**GET** `/api/players/list?q=search&limit=20&offset=0`

**Process**:
1. Fetch all: `kv.keys('player:*')`
2. Filter by query (handle or displayName)
3. **Sort by lastActiveAt DESC** (most recent first)
4. Paginate (offset, limit)
5. Return compact summaries with hasMore flag

**Sorting**: Enables "recent players" feature
**Payload boundary**: List/search responses omit large or detailed profile
fields such as `photoBase64`, `recentGames`, achievements, voting history, and
partner/opponent maps. Fetch `/api/players/{handle}` for the full profile.

#### `touch.js` - Update Last Active
**POST** `/api/players/touch`

**Process**:
1. Get player by handle
2. Set `lastActiveAt = now()`
3. Save to KV

**Triggered**: When player added to game

#### `delete.js` - Delete Player
**POST** `/api/players/delete`

**Process**:
1. Delete `player:${handle}`
2. Delete `player_id:${id}`
3. Return deleted player

**Use**: Test cleanup, maintenance

#### `reset-stats.js` - Reset Stats
**POST** `/api/players/reset-stats`

**Process**:
1. Get player
2. Reset stats to `initializePlayerStats()`
3. Clear recentGames
4. Keep identity (handle, displayName, etc.)
5. Update lastActiveAt

#### `_utils.js` - Backend Helpers
**Exports**:
- `generatePlayerId()` - PLR_XXXXXX format
- `validateHandle(handle)` - 3-20 chars regex
- `validatePlayerData(data)` - All fields + playStyle enum
- **`initializePlayerStats()`** - Fresh stats object
  - Session stats (7 fields)
  - Round stats (2 fields)
  - Time stats (3 fields)
  - Voting stats (2 fields)
  - **Partner/opponent (2 objects)** - NEW
  - Legacy (4 fields)
  - Recent rankings array
  - Honors (14 fields)
  - Streaks (4 fields)

---

## Documentation (`docs/`)

### Architecture (`docs/architecture/`)

#### `TECHNICAL_ARCHITECTURE.md`
- System overview
- Data flow diagrams
- Module dependencies

#### `TECHNICAL_IMPLEMENTATION.md`
- Module structure
- Code patterns
- Implementation details

#### `DESIGN_DECISIONS.md`
- UX philosophy
- Design rationale

#### `KV_SCHEMA.md` (NEW)
- All Vercel KV key patterns
- Player keys: `player:${handle}`, `player_id:${id}`
- Room keys: `room:${code}`
- Data structures
- TTL management
- Query patterns

#### `PLAYER_PROFILE_ARCHITECTURE.md` (NEW - 420 lines)
- Complete technical reference
- All 10 APIs documented
- Frontend modules explained
- Data flow diagrams
- Key algorithms
- File-by-file breakdown
- Performance metrics

### Features (`docs/features/`)

#### `PLAYER_PROFILE_SPEC.md`
- Original specification
- Data models
- API contracts
- UI wireframes
- Implementation roadmap

#### `VOTING_SYSTEM.md`
- Voting requirements
- Technical challenges
- Implementation approach

### Guides (`docs/guides/`)

#### `DEPLOYMENT_GUIDE.md`
- Vercel deployment
- Environment setup

#### `DEVELOPMENT_METHODOLOGY.md`
- Tech stack
- Code standards

#### `REALTIME_SETUP.md`
- Vercel KV configuration
- Room sync setup

#### `USER_GUIDE.md`
- End-user instructions

---

## Configuration Files

### `vite.config.js` - Build Configuration
**Multi-Page Setup**:
```javascript
rollupOptions: {
  input: {
    main: 'index.html',
    players: 'players.html',
    profile: 'player-profile.html'
  }
}
```

**Output**: Optimized bundles with code-splitting

### `vercel.json` - Deployment
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": null
}
```

**Edge Functions**: Automatic for `api/` directory

### `package.json` - Dependencies
**Production**:
- `@vercel/kv` (^3.0.0) - Redis storage

**Dev**:
- `vite` (^5.0.0) - Build system

**Scripts**:
- `dev` - Development server (port 3000)
- `build` - Production build
- `preview` - Preview build

---

## Build Output (`dist/`)

**Generated** by `npm run build`

```
dist/
├── index.html                     # Main game
├── players.html                   # Player browser
├── player-profile.html            # Profiles
└── assets/
    ├── main-[hash].js            # Main bundle (89KB)
    ├── players-[hash].js         # Browser bundle (2.5KB)
    ├── profile-[hash].js         # Profile bundle (10KB)
    ├── playerApi-[hash].js       # Shared API (4.5KB)
    ├── playerCreateModal-[hash].js # Modal chunk (14KB)
    └── index-[hash].css          # Styles (6.4KB)
```

**Code-Splitting**: Optimized loading per page

---

## Module Dependency Graph

```
main.js (orchestrator)
├─ core/
│  ├─ utils.js
│  ├─ storage.js
│  ├─ events.js
│  ├─ state.js (+ sessionStartTime)
│  └─ config.js
│
├─ game/
│  ├─ calculator.js
│  ├─ rules.js (+ sessionDuration)
│  └─ history.js
│
├─ player/
│  ├─ playerManager.js (+ addFromProfile, remove)
│  ├─ playerRenderer.js (+ profile tiles, remove button)
│  ├─ playerSearch.js (NEW)
│  ├─ playerCreateModal.js (NEW)
│  ├─ dragDrop.js
│  └─ touchHandler.js
│
├─ ranking/
│  ├─ rankingManager.js
│  ├─ rankingRenderer.js (+ fixed checkGameEnded)
│  └─ rankingCalculator.js
│
├─ stats/
│  ├─ statistics.js
│  ├─ honors.js (+ used in sync)
│  └─ achievements.js (shared achievement re-export)
│
├─ ui/
│  ├─ teamDisplay.js
│  └─ victoryModal.js (+ MVP tagline)
│
├─ share/
│  ├─ roomManager.js
│  ├─ shareManager.js
│  ├─ votingManager.js
│  └─ votingSync.js (NEW)
│
├─ export/
│  ├─ exportHandlers.js
│  └─ exportMobile.js (+ MVP, duration)
│
└─ api/
   └─ playerApi.js (NEW - complete client)
```

---

## Data Flow: Game Completion → Profile Sync

```
1. User completes A-level victory
   ↓
2. applyGameResult() → finalWin: true
   ↓
3. showVictoryModal(teamName)
   ├─ Calculate MVP (lowest avg)
   ├─ Show tagline
   └─ Emit room voting event
   ↓
4. scheduleAutoVotingSync() → 5-min timer
   ↓
5. setTimeout(2000) → Preserve legacy delay before profile sync
   ↓
6. calculateHonors(mode) → 16 honor winners
   ↓
7. getVotingResults() → {mvp: null, burden: null}; room votes sync separately
   ↓
8. syncProfileStats(historyEntry, roomCode, players, sessionStats, sessionHonors, votingResults)
   ├─ Calculate relative rankings (1-8)
   ├─ Map honors to each player
   ├─ Extract teammates/opponents
   ├─ For each profile player:
   │  ├─ Build gameResult object
   │  └─ PUT /api/players/[handle]
   ↓
9. API processes each player:
   ├─ Update session/round/time stats
   ├─ Increment honor counts
   ├─ Track partners/opponents (NEW)
   ├─ Update voting stats
   ├─ Check achievements
   └─ Add to recentGames
   ↓
10. Profile pages show updated data immediately
```

---

## State Management Flow

```
LocalStorage (gd_v9_*)
  ↓
state.hydrate()
  ↓
GameState Singleton
  ├─ teams, levels, history
  ├─ players, stats
  ├─ sessionStartTime (timer)
  └─ emit events on changes
      ↓
      UI Modules listen and re-render
      ↓
      state.persist() → LocalStorage
```

---

## Key File Counts

- **Backend**: 13 API files (7 players, 6 rooms)
- **Frontend Core**: 5 files (utils, storage, events, state, config)
- **Game Logic**: 3 files
- **Player System**: 6 files (4 original + 2 new)
- **Ranking**: 3 files
- **Stats**: 3 files (2 original + 1 new)
- **UI**: 2 files (both enhanced)
- **Export**: 2 files (mobile enhanced)
- **Share**: 4 files (1 new voting sync)
- **API Client**: 1 new file
- **Pages**: 3 HTML files (1 original + 2 new)
- **Docs**: 12 files

**Total**: ~50 modules

---

## Recent Changes (2025-12-10)

**New Files** (13):
- api/players/* (7 files)
- src/api/playerApi.js
- src/player/playerSearch.js
- src/player/playerCreateModal.js
- src/stats/achievements.js
- src/share/votingSync.js
- players.html
- player-profile.html

**Enhanced Files** (8):
- src/main.js (+500 lines)
- src/player/playerManager.js (+50 lines)
- src/player/playerRenderer.js (+60 lines)
- src/core/state.js (+20 lines)
- src/game/rules.js (+1 line)
- src/ui/victoryModal.js (+100 lines)
- src/export/exportMobile.js (+35 lines)
- index.html (+25 lines)

**Total Addition**: ~5,500 lines

---

## Performance Impact

**Before Player Profiles**:
- Bundle: 87KB
- Modules: 29

**After Player Profiles**:
- Main bundle: 90KB (+3KB)
- Additional chunks: 31KB (code-split)
- Total: 121KB across all pages
- Modules: 32

**Optimizations**:
- Code-splitting for modal (14KB lazy-loaded)
- Separate page bundles
- Shared API chunk (4.5KB)

---

**This document serves as the definitive codebase reference!**
