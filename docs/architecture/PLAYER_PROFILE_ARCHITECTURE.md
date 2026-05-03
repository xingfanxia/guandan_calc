# Player Profile System - Technical Architecture

> Complete technical documentation of the Player Profile System implementation

**Status**: Production Ready ✅
**Version**: 1.0
**Commits**: 30
**Lines of Code**: ~5,000

> **Security note (2026-05):** `PUT /api/players/<handle>` with `mode: 'PROFILE_UPDATE'` now
> requires `adminToken` in the request body (validated against `ADMIN_TOKEN` env var via
> constant-time compare). Per-user ownership tokens are TBD — until they ship, regular users
> cannot self-edit their profiles via `playerEditModal`. Admin can edit by entering the token
> in `players.html`. See `docs/SECURITY.md` and `docs/HANDOFF-2026-05-02-audit.md` P0.
>
> Stats updates (the non-`PROFILE_UPDATE` PUT path) remain unauthenticated. Vote counts
> are still client-supplied; server-side authoritative fetch is a P1 follow-up.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Backend Architecture](#backend-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Data Flow](#data-flow)
5. [File Structure](#file-structure)
6. [Key Algorithms](#key-algorithms)

---

## System Overview

The Player Profile System transforms Guandan Calculator from a session-based tool into a persistent gaming platform with:

- **Persistent player identities** with unique @handles
- **Dual stat tracking** (session-level + round-level)
- **Time tracking** (duration, longest, average)
- **14 honor system** with career tracking
- **20 achievement badges** with auto-unlock
- **Community voting** (MVP + burden recognition)
- **Profile pages** with complete career history

---

## Backend Architecture

### API Endpoints (10 total)

Located in `api/players/`

#### 1. **create.js** - Create Player Profile
```
POST /api/players/create
```

**Purpose**: Create new player profile with unique handle

**Request**:
```json
{
  "handle": "xiaoming",
  "displayName": "小明",
  "emoji": "🐱",
  "playStyle": "steady",
  "tagline": "稳如老狗"
}
```

**Process**:
1. Validate handle format (3-20 chars, alphanumeric + underscore)
2. Check handle uniqueness
3. Generate player ID (`PLR_XXXXXX`)
4. Initialize stats with `initializePlayerStats()`
5. Store in KV: `player:${handle}`
6. Create reverse lookup: `player_id:${id}` → handle

**Response**: Full player object with initialized stats

---

#### 2. **[handle].js** - Get/Update Player Profile
```
GET  /api/players/[handle]
PUT  /api/players/[handle]
```

**GET Purpose**: Fetch complete player profile

**PUT Purpose**: Update stats after game completion

**PUT Request**:
```json
{
  "roomCode": "A1B2C3",
  "ranking": 3.63,           // Session average
  "team": 1,
  "teamWon": true,
  "gamesInSession": 30,      // Rounds played
  "sessionDuration": 2700,   // Seconds
  "firstPlaces": 7,
  "lastPlaces": 2,
  "honorsEarned": ["吕布", "连胜王"],
  "votedMVP": false,
  "votedBurden": false,
  "mode": "8P"
}
```

**PUT Process**:
1. Check if `mode === 'VOTE_ONLY'` (voting-only update)
2. If vote-only: Only increment mvpVotes/burdenVotes
3. If full update:
   - Update session stats (sessionsPlayed, sessionsWon, avgRankingPerSession)
   - Update round stats (roundsPlayed, avgRankingPerRound)
   - Update time stats (totalPlayTime, longest, average)
   - Increment honor counts
   - Update win/loss streaks
   - Add to recentGames array
   - Check and award achievements
4. Save to KV

**Achievements Checked**:
- Milestone (games played)
- Performance (streaks, win rate)
- Honor collection (unique honors, specific honor counts)
- Session-specific (marathon, perfect, quick finish)

---

#### 3. **list.js** - Search Players
```
GET /api/players/list?q=search&limit=20&offset=0
```

**Purpose**: List and search all players

**Process**:
1. Fetch all players via `kv.keys('player:*')`
2. Filter by search query (handle or displayName)
3. Sort by `lastActiveAt DESC` (most recent first)
4. Paginate (offset, limit)
5. Return with `hasMore` flag

**Use Cases**:
- Player browser page
- Search in game setup
- Quick start (gets recent players)

---

#### 4. **touch.js** - Update Last Active
```
POST /api/players/touch
```

**Purpose**: Update `lastActiveAt` when player joins game

**Process**:
1. Get player by handle
2. Set `lastActiveAt` to current timestamp
3. Save to KV

**Triggered When**:
- Player added to game (search/create)
- Quick start selects player

---

#### 5. **delete.js** - Delete Player
```
POST /api/players/delete
```

**Purpose**: Permanently remove player profile

**Process**:
1. Delete `player:${handle}`
2. Delete `player_id:${id}` reverse lookup
3. Return deleted player info

**Use Case**: Test cleanup, data maintenance

---

#### 6. **reset-stats.js** - Reset Player Stats
```
POST /api/players/reset-stats
```

**Purpose**: Clear stats but keep profile identity

**Process**:
1. Reset stats to `initializePlayerStats()`
2. Clear `recentGames` array
3. Keep: handle, displayName, emoji, playStyle, tagline
4. Update `lastActiveAt`

**Use Case**: Fresh start for testing

---

#### 7. **_utils.js** - Helper Functions

**Exports**:
- `generatePlayerId()` - Random PLR_XXXXXX format
- `validateHandle(handle)` - Check 3-20 chars, alphanumeric + _
- `validatePlayerData(data)` - Validate all required fields
- `initializePlayerStats()` - Fresh stats object with all fields

**Stats Schema** (from initializePlayerStats):
```javascript
{
  // Session-level (complete games)
  sessionsPlayed: 0,
  sessionsWon: 0,
  sessionWinRate: 0,
  avgRankingPerSession: 0,
  avgRoundsPerSession: 0,
  longestSessionRounds: 0,

  // Round-level (individual rounds)
  roundsPlayed: 0,
  avgRankingPerRound: 0,

  // Time tracking
  totalPlayTimeSeconds: 0,
  longestSessionSeconds: 0,
  avgSessionSeconds: 0,

  // Community voting
  mvpVotes: 0,
  burdenVotes: 0,

  // Legacy (backward compatibility)
  gamesPlayed: 0,
  wins: 0,
  winRate: 0,
  avgRanking: 0,

  // Recent performance
  recentRankings: [],

  // Honors (14 total)
  honors: {
    '吕布': 0, '阿斗': 0, '石佛': 0,
    '波动王': 0, '奋斗王': 0, '辅助王': 0,
    '翻车王': 0, '赌徒': 0, '大满贯': 0,
    '连胜王': 0, '佛系玩家': 0, '守门员': 0,
    '慢热王': 0, '闪电侠': 0
  },

  // Streaks
  currentWinStreak: 0,
  longestWinStreak: 0,
  currentLossStreak: 0,
  longestLossStreak: 0
}
```

---

## Frontend Architecture

### Core API Client

**File**: `src/api/playerApi.js`

**Exports**:
- `searchPlayers(query, limit)` - Search with pagination
- `getPlayer(handle)` - Fetch individual profile
- `createPlayer(data)` - Create new profile
- `touchPlayer(handle)` - Update lastActiveAt
- `updatePlayerStats(handle, gameResult)` - Update session stats
- `syncProfileStats(...)` - Sync all players after victory
- `validateHandle(handle)` - Client-side validation
- `getPlayStyleLabel(style)` - Map style to Chinese label
- `getPlayStyles()` - All 8 play styles

**Key Function**: `syncProfileStats()`
```javascript
syncProfileStats(historyEntry, roomCode, players, sessionStats, sessionHonors, votingResults)
```

**Process**:
1. Map honors to players (from calculateHonors result)
2. For each player with profile:
   - Calculate session average ranking
   - Extract honors earned
   - Check voting results
   - Build gameResult object
   - Call updatePlayerStats API
3. Log sync progress

---

### Player Management

#### **playerManager.js** - Player Data Management

**Key Functions**:
- `generatePlayers(count)` - Create session players
- `addPlayerFromProfile(profile)` - Add profile player to game
  - Calls `touchPlayer()` to update lastActiveAt
  - Emits `player:addedFromProfile` event
- `removePlayer(playerId)` - Remove from game
- `getPlayers()`, `getPlayersByTeam()` - Access players
- `shuffleTeams()`, `applyBulkNames()` - Player operations

**Player Object** (session):
```javascript
{
  id: 1,                      // Session ID
  name: "小明",               // Display name
  emoji: "🐱",
  team: 1,
  handle: "xiaoming",         // Profile link
  playerId: "PLR_X7K2M9",    // For stats updates
  playStyle: "steady",
  tagline: "稳如老狗"         // For victory screen
}
```

---

#### **playerSearch.js** - Search UI Component

**Purpose**: Real-time player search interface

**Functions**:
- `initializePlayerSearch(onSelect, onCreate)` - Setup search
- `performSearch(query)` - Execute search with debounce
- `renderSearchResults(players)` - Display results
- `showInitialPlayers()` - Load recent players
- `clearSearchResults()` - Reset UI

**Features**:
- 300ms debounce on input
- Hover effects on results
- Click anywhere on card to select
- Shows: emoji, displayName, @handle, playStyle, games count

---

#### **playerCreateModal.js** - Creation Modal

**Purpose**: Full-screen modal for creating players

**Functions**:
- `initializeCreateModal(onCreated)` - Setup modal
- `showCreateModal()` - Display modal
- `closeModal()` - Hide modal
- `setupModalHandlers()` - Wire up form

**Form Fields**:
- Handle (with real-time validation)
- Display Name
- Emoji (77+ grid selector)
- Play Style (8 options dropdown)
- Tagline (max 50 chars)

**Features**:
- Client-side validation
- Visual emoji selection
- Error handling with specific messages
- Auto-close on success

---

### UI Components

#### **victoryModal.js** - Victory Celebration

**Purpose**: A-level victory modal with MVP tagline

**Key Functions**:
- `showVictoryModal(teamName)` - Display victory
- `closeVictoryModal()` - Hide modal
- `getVotingResults()` - Extract top voted players

**MVP Calculation**:
```javascript
// Find player with LOWEST average ranking
winningPlayers.forEach(player => {
  const avgRank = stats.totalRank / stats.games;
  if (avgRank < bestAvg) {
    bestAvg = avgRank;
    mvpPlayer = player;
  }
});
```

**Displays**:
- Team name with color
- MVP tagline if profile player
- Voting interface (in-modal)
- Export buttons

---

### Statistics Modules

#### **honors.js** - Honor Calculation

**Purpose**: Calculate 14 honors from session stats

**Function**: `calculateHonors(totalPlayers)`

**Returns**: Object mapping honor keys to winners
```javascript
{
  mvp: { player, score: 7 },         // 吕布
  burden: { player, score: 5 },      // 阿斗
  stable: { player, score: 2.1 },    // 石佛
  rollercoaster: { player, score: 5.3 }, // 波动王
  // ... 10 more honors
}
```

**Algorithms**:
- Variance calculation for stability/volatility
- 3-segment trend analysis for improvement
- Consecutive streak tracking
- Position frequency analysis

---

#### **achievements.js** - Achievement System

**Purpose**: Define and check 20 achievements

**Constant**: `ACHIEVEMENTS` - All 20 badge definitions
```javascript
{
  newbie: { name: '初来乍到', badge: '🐣', desc: '完成第一场游戏' },
  started: { name: '小试牛刀', badge: '⭐', desc: '完成10场游戏' },
  // ... 18 more
}
```

**Function**: `checkAchievements(stats, lastSession)`

**Categories**:
1. **Milestone** (4): Games played thresholds
2. **Performance** (4): Win streaks and win rate
3. **Honor Collection** (4): Honor diversity and counts
4. **Social** (3): Session-specific feats
5. **Special** (5): Unique accomplishments

---

### Voting System

#### **votingManager.js** - Remote Voting (Existing)

**Purpose**: Viewer voting in room mode

**Key Functions**:
- `submitEndGameVotes(mvp, burden)` - Viewer submits
- `getEndGameVotingResults()` - Host fetches results
- `showHostVoting()` - Display results to host
- `updateVoteLeaderboard()` - Live update display

**Storage**: Vercel KV via `/api/rooms/vote/[code]`

---

#### **votingSync.js** - Profile Integration (NEW)

**Purpose**: Sync voting results to player profiles

**Functions**:
- `syncVotingToProfiles()` - Manual/auto sync
  - Fetches voting results from API
  - Finds top-voted MVP and burden
  - Updates their profiles (vote-only mode)
  - Returns sync status

- `scheduleAutoVotingSync()` - Auto-sync after 5 minutes
  - Called on game victory
  - Ensures voting results captured

**Flow**:
```
Game Ends →
  Viewers Vote →
  API stores votes →
  5 min timer OR manual button →
  syncVotingToProfiles() →
  Increment mvpVotes/burdenVotes →
  Display on profile page
```

---

### Export System

#### **exportMobile.js** - Mobile PNG Export

**Enhanced for Profiles**:

**MVP Display** (lines 62-87):
- Calculate MVP from session stats (lowest average)
- Display: "MVP 🦁 豪 (平均3.63名)"
- Show tagline on next line
- Gold color with proper formatting

**Session Duration** (lines 89-98):
- Get from `historyEntry.sessionDuration`
- Format: "游戏时长: 45分钟" or "2小时15分"
- Positioned after MVP tagline

---

## Frontend Integration

### Main Application

**File**: `src/main.js` (1,500+ lines)

**Key Integrations**:

#### Player Profile Imports (lines 16-30)
```javascript
import { addPlayerFromProfile, removePlayer } from './player/playerManager.js';
import { initializePlayerSearch, showInitialPlayers } from './player/playerSearch.js';
import { initializeCreateModal, showCreateModal } from './player/playerCreateModal.js';
import { syncProfileStats } from './api/playerApi.js';
import { calculateHonors } from './stats/honors.js';
import { syncVotingToProfiles, scheduleAutoVotingSync } from './share/votingSync.js';
```

#### Session Timer (lines 96-100)
```javascript
if (!state.getSessionStartTime()) {
  state.setSessionStartTime(Date.now());
  console.log('⏱️ Session timer started');
}
```

#### Player Search Initialization (lines 312-340)
- Wires up search callbacks
- Initializes create modal
- Shows initial players on load

#### Victory Handling (lines 230-251, 736-759)
```javascript
if (applyResult.finalWin) {
  showVictoryModal(winnerName);
  scheduleAutoVotingSync();  // 5-min auto sync

  setTimeout(() => {
    const sessionHonors = calculateHonors(mode);
    const votingResults = getVotingResults();  // Local votes
    const sessionStats = state.getPlayerStats();

    syncProfileStats(
      applyResult.historyEntry,
      roomCode,
      players,
      sessionStats,
      sessionHonors,
      votingResults
    );
  }, 2000);  // Wait for voting
}
```

#### Manual Voting Sync (lines 482-516)
- Button click handler
- Calls `syncVotingToProfiles()`
- Shows success/failure status
- 3-second cooldown

#### Room Banner Timers (lines 1099-1214)
- Live session timer (updates every second)
- Stops when `checkGameEnded()` returns true
- Shows final time with checkmark
- Both host and viewer banners

---

### State Management

**File**: `src/core/state.js`

**New Fields**:
```javascript
this.sessionStartTime = null;  // Track session start
```

**New Methods**:
```javascript
getSessionStartTime()          // Get start timestamp
setSessionStartTime(timestamp) // Set start (don't persist)
getSessionDuration()           // Calculate elapsed seconds
```

**Usage**:
- Started on app init or game reset
- Calculated on every timer update
- Stored in historyEntry on game completion

---

### Game Rules

**File**: `src/game/rules.js`

**Enhancement** (line 213):
```javascript
const historyEntry = {
  // ... existing fields
  sessionDuration: state.getSessionDuration(),  // NEW
  playerRankings: playerRankingData || {}
};
```

**Used For**:
- Storing session duration in history
- Syncing duration to player profiles
- Displaying in recent games

---

## Standalone Pages

### Player Browser

**File**: `players.html`

**Features**:
- Search input with real-time filter
- Player grid cards (responsive)
- Pagination (20 per page)
- Create player button (opens modal)

**Card Display**:
- 48px emoji
- displayName + @handle
- Play style label
- Session stats (games, wins, winrate, avg ranking)
- Tagline in gold
- Click to view profile

**Imports**:
```javascript
import { searchPlayers, getPlayStyleLabel } from '/src/api/playerApi.js';
import { initializeCreateModal, showCreateModal } from '/src/player/playerCreateModal.js';
```

---

### Player Profile Page

**File**: `player-profile.html`

**URL**: `/player-profile.html?handle=xiaoming`

**Sections**:

1. **Profile Header**
   - 72px emoji
   - displayName (36px)
   - @handle (18px)
   - Play style with emoji
   - Tagline (italic, gold)

2. **生涯统计** - Career Stats
   - **游戏场次** (Sessions): 6 metrics
     - 游戏场次, 获胜场次, 胜率
     - 场均排名, 场均局数, 最长局数
     - 当前连胜

   - **单局数据** (Rounds): 3 metrics
     - 总轮次, 局均排名, 最长连胜

   - **游戏时长** (Time): 3 metrics
     - 总游戏时长, 最长对局, 场均时长

   - **最近10场排名**: Visual chips (green/blue/grey)

3. **荣誉收藏** - Honor Collection
   - Top 5 honors with counts
   - Progress indicator

4. **票选荣誉** - Community Voting
   - MVP votes (green)
   - Burden votes (red)
   - Total recognition

5. **成就徽章** - Achievements
   - Grid layout (200px cards)
   - Badge emoji, Chinese name, description
   - Progress: "X/20"

6. **最近游戏** - Recent Games (last 10)
   - Win/loss indicator
   - Mode, avg ranking, rounds, duration
   - Date and room link
   - Honors earned (gold chips)

**Helper**:
```javascript
function formatDuration(seconds) {
  // Converts 2700 → "45分钟"
  // Converts 8100 → "2小时15分"
}
```

---

## Data Flow Diagrams

### Game Completion Flow

```
User Completes Game (A-level victory)
  ↓
applyGameResult() → finalWin: true
  ↓
showVictoryModal(teamName)
  ├─ Calculate MVP (lowest avg)
  ├─ Show tagline
  └─ Enable voting (if room mode)
  ↓
scheduleAutoVotingSync() → 5-min timer
  ↓
setTimeout(2000) → Wait for local voting
  ↓
calculateHonors(mode) → Get 14 honor winners
  ↓
getVotingResults() → Extract local votes
  ↓
syncProfileStats(...) → For each profile player:
  ├─ Calculate session metrics
  ├─ Map honors to this player
  ├─ Check voting winner
  ├─ Build gameResult
  └─ PUT /api/players/[handle]
      ↓
      API Updates:
      ├─ Session stats (+1 session, +30 rounds)
      ├─ Round stats (weighted avg)
      ├─ Time stats (+duration)
      ├─ Honors (increment counts)
      ├─ Voting (if voted)
      ├─ Achievements (check & unlock)
      └─ Recent games (add entry)
```

### Voting Sync Flow

```
Viewers Vote in Room
  ↓
POST /api/rooms/vote/[code]
  ↓
5 Minutes Pass OR Manual Button Click
  ↓
syncVotingToProfiles()
  ├─ GET /api/rooms/vote/[code]
  ├─ Find top MVP (most votes)
  ├─ Find top burden (most votes)
  └─ For each winner:
      PUT /api/players/[handle]
      mode: 'VOTE_ONLY'
      votedMVP: true/false
      votedBurden: true/false
        ↓
        API: Only increment vote counts
        Skip all other stats
```

---

## File Structure Reference

### Backend (api/players/)
```
api/players/
├── create.js          # POST - Create player profile
├── [handle].js        # GET/PUT - Fetch/update profile
├── list.js            # GET - Search players
├── touch.js           # POST - Update lastActiveAt
├── delete.js          # POST - Remove player
├── reset-stats.js     # POST - Clear stats
└── _utils.js          # Helpers & validation
```

### Frontend Core (src/)
```
src/
├── api/
│   └── playerApi.js           # API client for all endpoints
│
├── player/
│   ├── playerManager.js       # Data management + profiles
│   ├── playerRenderer.js      # Tile rendering
│   ├── playerSearch.js        # Search UI component
│   ├── playerCreateModal.js   # Create modal
│   ├── dragDrop.js            # Desktop D&D (unchanged)
│   └── touchHandler.js        # Mobile touch (unchanged)
│
├── stats/
│   ├── statistics.js          # Session stats (unchanged)
│   ├── honors.js              # Honor calculation (used for sync)
│   └── achievements.js        # Achievement system (NEW)
│
├── ui/
│   ├── victoryModal.js        # Enhanced with MVP tagline
│   └── teamDisplay.js         # (unchanged)
│
├── share/
│   ├── votingManager.js       # Remote voting (existing)
│   └── votingSync.js          # Profile sync (NEW)
│
├── export/
│   └── exportMobile.js        # Enhanced with MVP + duration
│
└── core/
    └── state.js               # Added sessionStartTime
```

### Standalone Pages
```
/
├── index.html              # Main game (enhanced)
├── players.html            # Player browser (NEW)
└── player-profile.html     # Individual profiles (NEW)
```

---

## Key Algorithms

### 1. MVP Calculation (Session-Based)

**Location**: `src/ui/victoryModal.js:55-68`, `src/export/exportMobile.js:62-76`

```javascript
let mvpPlayer = null;
let bestAvg = Infinity;

winningPlayers.forEach(player => {
  const stats = playerStats[player.id];
  if (stats && stats.games > 0) {
    const avgRank = stats.totalRank / stats.games;
    if (avgRank < bestAvg) {
      bestAvg = avgRank;
      mvpPlayer = player;
    }
  }
});
```

**Why**: Lower average = better performance across all rounds

---

### 2. Dual Stat Calculation

**Location**: `api/players/[handle].js:135-157`

**Session Average**:
```javascript
const prevSessionTotal = avgRankingPerSession * (sessionsPlayed - 1);
avgRankingPerSession = (prevSessionTotal + newSessionAvg) / sessionsPlayed;
```

**Round Weighted Average**:
```javascript
const prevRoundTotal = avgRankingPerRound * (roundsPlayed - gamesInSession);
const newRoundTotal = sessionAvg * gamesInSession;
avgRankingPerRound = (prevRoundTotal + newRoundTotal) / roundsPlayed;
```

**Result**: Two independent metrics for different perspectives

---

### 3. Honor Mapping

**Location**: `src/api/playerApi.js:218-244`

```javascript
const playerHonors = {};
Object.entries(sessionHonors).forEach(([honorKey, honorData]) => {
  const playerId = honorData.player.id;
  if (!playerHonors[playerId]) playerHonors[playerId] = [];

  const honorNames = {
    mvp: '吕布',
    burden: '阿斗',
    stable: '石佛',
    // ... 11 more
  };

  playerHonors[playerId].push(honorNames[honorKey]);
});
```

**Usage**: Each player gets array of honors earned in session

---

### 4. Achievement Checking

**Location**: `api/players/[handle].js:16-46`

**Logic**:
```javascript
// Milestone
if (sessionsPlayed >= 1) earned.push('newbie');
if (sessionsPlayed >= 10) earned.push('started');

// Performance
if (longestWinStreak >= 5) earned.push('streak_5');
if (sessionsPlayed >= 20 && sessionWinRate >= 0.7) earned.push('champion');

// Honor Collection
const uniqueHonors = Object.values(honors).filter(c => c > 0).length;
if (uniqueHonors >= 5) earned.push('honor_5');

// Session-specific
if (lastSession.gamesInSession > 50) earned.push('marathon');
if (lastSession.ranking <= 1.5) earned.push('perfect');
```

---

### 5. Time Tracking

**Location**: `src/core/state.js:247-259`

```javascript
getSessionDuration() {
  if (!this.sessionStartTime) return 0;
  return Math.floor((Date.now() - this.sessionStartTime) / 1000);
}
```

**Updates**: Every second in room banners
**Stored**: In historyEntry on game completion
**Synced**: To player profiles (totalPlayTime, longest, average)

---

## Configuration & Build

### Vite Config

**File**: `vite.config.js`

**Multi-Page Setup**:
```javascript
rollupOptions: {
  input: {
    main: resolve(__dirname, 'index.html'),
    players: resolve(__dirname, 'players.html'),
    profile: resolve(__dirname, 'player-profile.html')
  }
}
```

**Output**: Separate bundles for each page with shared chunks

---

## Performance Metrics

**Bundle Sizes**:
- Main game: 89.82 KB (29.27 KB gzipped)
- Player browser: 2.48 KB
- Profile page: 10.34 KB
- Player API: 4.55 KB (shared)
- Create modal: 14.12 KB (code-split)

**API Response Times**:
- Search players: <200ms
- Get profile: <100ms
- Update stats: <300ms

**Total Bundle**: ~90 KB (optimized with code-splitting)

---

## Deployment

**Platform**: Vercel Edge Functions + KV

**Build Command**: `npm run build`

**Output**: `dist/`
- index.html + chunks
- players.html + chunks
- player-profile.html + chunks

**KV Storage**:
- Players: Permanent (no TTL)
- Rooms: 1 year TTL

---

## Testing

**Test Data**: 10 players with `test_` prefix
- @test_hao, @test_fan, @test_xiao, etc.
- All stats reset to 0
- Ready for production testing

**Test Endpoints**:
```bash
# Create player
curl -X POST https://gd.ax0x.ai/api/players/create -d '{...}'

# Get player
curl https://gd.ax0x.ai/api/players/test_hao

# Search
curl "https://gd.ax0x.ai/api/players/list?q=test"

# Reset stats
curl -X POST https://gd.ax0x.ai/api/players/reset-stats -d '{"handle":"test_hao"}'

# Delete
curl -X POST https://gd.ax0x.ai/api/players/delete -d '{"handle":"test_hao"}'
```

---

## What's Next

### Implemented ✅
- All MVP features from spec
- Dual stat tracking
- Time tracking
- Honor sync
- Achievement system
- Voting integration

### Phase 2 (Future)
- Partner/rival statistics
- Season leaderboards
- Authentication system
- Room browser enhancements

---

**Last Updated**: 2025-12-10
**Implementation**: Complete and Production-Ready 🚀
