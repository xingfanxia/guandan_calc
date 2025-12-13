# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Guandan (掼蛋) Calculator - A comprehensive web-based scoring and progression tracking system for the Chinese climbing card game. Supports 4/6/8 player modes with team-based level progression (2→A), real-time room sharing, community voting, player profiles with photos, and 14 data-driven honor calculations.

## Architecture Status

### Modern Modular Implementation ✅ v10.0

**ES6 Modular Architecture**: 38 modules with clean separation of concerns
- Entry: `index.html` → `src/main.js` (509 lines, -69% from refactoring)
- Build: `npm run build` → `dist/`
- Development: `npm run dev` (port 5173)
- Storage: Fresh `gd_v9_*` localStorage keys + Vercel KV

**Legacy Reference**: `src/app.js` (1,947 lines)
- Original monolithic IIFE preserved for reference
- Contains all original game logic
- Useful for understanding complex A-level rules

### Module Organization (38 modules):

**Core (5 modules)**: Foundation layer
- `core/utils.js` - DOM helpers ($, on, now)
- `core/storage.js` - localStorage wrapper with gd_v9_* keys
- `core/events.js` - Pub/sub event system (on, emit, off, once)
- `core/state.js` - Game state singleton with controlled mutations
- `core/config.js` - Settings manager with defaults for all modes

**Controllers (5 modules)**: NEW - Refactored from main.js
- `controllers/gameControls.js` - Apply, advance, undo, reset handlers
- `controllers/playerControls.js` - Generate, shuffle, search, profile
- `controllers/exportControls.js` - TXT, CSV, PNG export handlers
- `controllers/roomControls.js` - Create, join, browse, leave
- `controllers/settingsControls.js` - Mode, preferences, team config

**Game Logic (3 modules)**: Core game mechanics
- `game/calculator.js` - Pure calculation functions (parseRanks, calculateUpgrade, nextLevel)
- `game/rules.js` - A-level logic and rule application (checkALevelRules, applyGameResult)
- `game/history.js` - History rendering, rollback, and reset

**Player System (4 modules)**: Player management and interaction
- `player/playerManager.js` - Player data management with 77+ emoji avatars
- `player/playerRenderer.js` - Player tile rendering and team display
- `player/dragDrop.js` - Desktop drag-and-drop handlers
- `player/touchHandler.js` - Mobile touch event handling (200ms long-press)
- `player/photoRenderer.js` - Profile photo rendering helper (NEW v10.0)

**Ranking System (3 modules)**: Ranking interface and calculation
- `ranking/rankingManager.js` - Ranking state management
- `ranking/rankingRenderer.js` - Ranking UI with drag-drop integration
- `ranking/rankingCalculator.js` - Bridge to game calculator

**Statistics (1 module)**: Player stats tracking
- `stats/statistics.js` - Stats tracking, MVP/burden identification

**Statistics (3 modules)**: Player stats and achievements
- `stats/statistics.js` - Session stats tracking, MVP/burden identification
- `stats/honors.js` - 14 honor calculations with sophisticated algorithms
- `stats/achievements.js` - 20 achievement badge system

**Player Profile System (6 modules)**: Persistent player identities
- `api/playerApi.js` - Complete API client for backend
- `player/playerSearch.js` - Real-time search UI component
- `player/playerCreateModal.js` - Full profile creation modal with photo upload
- `share/votingSync.js` - Voting result integration
- Plus: 10 backend API files in `api/players/`
- Plus: 3 standalone pages (`players.html`, `player-profile.html`, `rooms.html`)

**UI Components (4 modules)**: User interface elements
- `ui/teamDisplay.js` - Team styling and display utilities
- `ui/victoryModal.js` - Victory celebration with END-GAME VOTING ⭐
- `ui/panelManager.js` - Panel collapse/expand, team roster (NEW v10.0)
- `share/roomUI.js` - Room banners, viewer controls (NEW v10.0)

**Export (1 module)**: Data export functionality
- `export/exportHandlers.js` - TXT/CSV/PNG export functions

**Entry Point (1 module)**: Application orchestration
- `main.js` - Initialization, event binding, module coordination

---

## v10.0 New Features (2025-12-11)

### Room Browser
- Browse all active rooms with `/rooms.html`
- Filter by player handle (@fufu)
- Toggle between all rooms and favorites
- Auto-filter test players
- Click to join/view rooms
- Pagination (20 per page)

### Profile Photo System
- Upload square photos (auto-resize to 400x400 JPEG)
- Display in player browser (64px) and profile page (120px)
- MVP photos in victory modal and PNG export (320px)
- Emoji fallback everywhere
- Base64 storage in player profiles

### Enhanced Partner/Rival Display
- Chart.js bar charts for all teammates/opponents
- Sortable by win rate, games, or wins
- Color-coded performance (green/blue/red)
- Clickable to view profiles
- Win rate visualization

### Admin Mode
- Password-protected player management (xiaofei0214)
- Delete players with confirmation
- Reset player stats
- Visual feedback on correct password
- Located on players.html page

### Timer System Overhaul
- Server-side timestamps (createdAt, finishedAt)
- Timer persists across page refreshes
- Stops automatically when game ends
- Works for both host and viewer modes
- No more timer reset bugs

### Voting System Enhancement
- Syncs ALL players who received votes (not just winners)
- Idempotent voting with votingHistory tracking
- Actual vote counts tracked (3 votes = +3, not +1)
- Safe to sync multiple times (latest votes applied)
- Vote leaderboard updates for both host and viewer
- Accurate popularity metrics

### Major Refactoring
- main.js: 1,607 → 509 lines (-69%)
- 7 new controller and UI modules extracted
- 100% functional parity verified
- Better code organization and maintainability

---

## Backend Infrastructure

**API Routes** (`api/rooms/`):
- `create.js` - Generate 6-digit room codes, initialize KV storage
- `[code].js` - GET/PUT room data with auth token validation
- `vote/[code].js` - Submit anonymous viewer votes for MVP/burden
- `reset-vote/[code].js` - Clear voting results after host confirmation
- `favorite/[code].js` - Toggle favorite status (1-year TTL)
- `list.js` - Retrieve all favorited rooms

**Data Storage**:
- Vercel KV (Upstash Redis) for real-time room data
- Default TTL: 24 hours, favorited rooms: 1 year
- Global edge network distribution

## Development Commands

```bash
# Modular version development (USE WITH CAUTION - may have issues)
npm run dev        # Port 5173 with Vite HMR

# Production build (deploys modular version)
npm run build
npm run preview

# Legacy single-file development (KNOWN WORKING)
python -m http.server 8000
# Then open http://localhost:8000/guodan_calc.html
```

## Key Implementation Details (from working src/app.js)

### Game Rules Engine

**4-Player Mode**: Fixed upgrade table
- `(1,2)`, `(1,3)`, `(1,4)` positions → specific level upgrades

**6/8-Player Mode**: Point-based thresholds
- Point difference between teams → 1, 2, or 3 level upgrades
- Configurable thresholds via settings

**A-Level Logic** (lines 1533-1592 in src/app.js):
- Strict mode: Must win at own A-level round (`ST.roundOwner === aTeam`)
- Lenient mode: Can win at any level once at A
- Failure tracking: 3 A-level failures = reset to level 2
- Winner's level becomes next round's base (`nextBaseByRule`)

**Critical A-Level Implementation Details**:
- Check `ST.roundOwner` to determine whose round it is
- Only increment A-fail counter on team's own round
- In strict mode, verify both `ST.roundLevel === 'A'` AND `ST.roundOwner === aTeam`

**8-Player Sweep Bonus** (lines 1442-1444):
- Positions 1,2,3,4 grant 4-level upgrade

### Real-Time Room Sync System

**Auto-Sync Strategy**:
- Host games sync every 10 seconds automatically
- Immediate sync on critical actions (apply results, round finish)
- Auth token validation prevents unauthorized control

**Viewer Polling**:
- Poll every 5 seconds with smart change detection
- UI updates only when `lastUpdated` timestamp changes
- Visual notification system for new updates

**Room Code Generation**: 6-digit alphanumeric (e.g., `A1B2C3`)
- Format: 3 letters + 3 numbers in alternating pattern
- Collision detection with retry logic

### Community Voting System

**Voting Flow** (implemented in votingManager.js):
1. Viewers submit anonymous votes for MVP (最C) and burden (最闹)
2. Host sees live vote counts with 1-second updates
3. Host reviews and confirms final selections
4. Results recorded in "人民的声音" panel
5. Vote data cleared after confirmation

**Vote Storage**: Round-specific data in KV with host auth validation

### Honor Calculation System (14 Honors)

Implemented in `statsManager.js` with sophisticated algorithms:
- **吕布** (First place ratio): Quality over quantity with reliability threshold
- **阿斗** (Last place ratio): Consecutive penalty system
- **石佛** (Excellence + stability): Top 25% with low variance
- **波动王** (Volatility): High variance + extreme range bonus
- **奋斗王** (Progressive improvement): 3-segment trend analysis
- **辅助王** (Team support): Bottom-half performance during team wins
- **翻车王** (Dramatic drops): Top 3 to last place collapses
- **赌徒** (High risk high reward): High first + high last rates
- **大满贯** (Position completion): Experience all ranking positions
- **连胜王** (Longest streak): Consecutive top-half finishes
- **佛系玩家** (Median ranking): Closest to middle way
- **守门员** (Teammate protection): Prevent last place during team losses
- **慢热王** (Slow start pattern): Poor start but strong finish
- **闪电侠** (Ranking changes): Most frequent position changes

All algorithms scale properly for 4/6/8 player modes.

### LocalStorage Keys

- `gd_v7_5_1_settings` - Game rules, team names/colors, preferences
- `gd_v7_5_1_state` - Current game state, team levels, A-fail counters, history
- `gd_players` - Player info (names, emojis, team assignments)
- `gd_player_stats` - Performance statistics for honor calculations

### Drag and Drop System (lines 188-599 in src/app.js)

**Desktop**: HTML5 native drag/drop API
- `dragstart`, `dragover`, `drop` events
- `draggedPlayer` variable tracks current drag

**Mobile**: Custom touch event handlers
- Long-press detection (200ms threshold) to initiate drag
- Visual feedback during drag with clone element
- Touch move tracking with position calculation
- Drop zone detection using `elementFromPoint`

## Critical Testing Areas

1. **A-Level Logic** (src/app.js:1533-1592):
   - Strict mode victory at own A-level round
   - `ST.roundOwner` tracking and validation
   - Failure counter incrementing only on own round

2. **Room Sync**:
   - Auto-sync timing (10s interval + immediate on actions)
   - Viewer poll updates (5s interval)
   - Auth token validation

3. **Voting System**:
   - Anonymous submission flow
   - Live counting with 1s updates
   - Host confirmation and reset

4. **Honor Calculations**:
   - Algorithm correctness across 4/6/8 player modes
   - Variance analysis and trend detection
   - Clickable explanations with detailed stats

5. **Favorite Rooms**:
   - TTL extension to 1 year
   - Browse modal with room previews

6. **Mobile Touch** (src/app.js:188-381):
   - Long-press drag initiation
   - Touch clone cleanup
   - Drop zone detection on iOS/Android

7. **Canvas Export** (src/app.js:1818-1893):
   - PNG long image generation
   - UTF-8 Chinese character rendering
   - Team color visualization

## Deployment

**Current Vercel Setup** (`vercel.json`):
- Runs `npm run build` to build modular version
- Serves from `dist/` directory
- Edge Functions for `/api/rooms/*` routes
- Vercel KV integration for real-time data

**Production Deployment Status**:
- Check if `npm run build` completes successfully
- Verify modular version works in production
- Consider falling back to `guodan_calc.html` if issues persist

## Development Workflow

**When Making Changes**:
1. **Reference**: Consult `src/app.js` (1,947 lines) for working implementation
2. **Modify**: Update modular files in `src/` directory
3. **Test Locally**: Run `npm run dev` and test thoroughly
4. **Verify Build**: Run `npm run build` and check for errors
5. **Fallback**: If issues occur, `guodan_calc.html` is the working baseline

**When Debugging**:
- `src/app.js` contains all working game logic as single reference
- Check console logs for state transitions and ranking updates
- Verify LocalStorage keys for state persistence
- Test drag/drop on both desktop and mobile devices

## Documentation

Comprehensive documentation in `docs/`:
- `GAME_RULES.md` - Detailed game mechanics and scoring rules
- `TECHNICAL_ARCHITECTURE.md` - System design and data flow
- `VOTING_SYSTEM.md` - Community voting implementation
- `REALTIME_SETUP.md` - Room sync and Vercel KV setup
- `DEPLOYMENT_GUIDE.md` - Production deployment procedures
- `FEATURE_STATUS.md` - Current feature completion status
- `REFACTORING.md` - Module refactoring notes

## Important Notes

- **Always test modular version before assuming it works**
- **src/app.js is the source of truth for game logic**
- **Mobile touch handling requires careful testing on actual devices**
- **A-level logic is complex - verify roundOwner tracking carefully**
- **Room sync requires Vercel KV environment variables configured**

---

## Player Profile System (Dec 2025 - Major Addition)

**Status**: ✅ Production Ready | **Commits**: 34 | **Code**: ~5,500 lines

### What It Does

Transforms the app from session-based to a **persistent gaming platform** with:
- Player profiles with unique @handles
- Career stat tracking (dual metrics: sessions + rounds)
- Time tracking (total, longest, average)
- All 14 honors synced to profiles
- 20 achievement badges (auto-unlock)
- Community voting integration
- Partner/rival relationship tracking
- Player browser and profile pages

### Key Files to Know

**Backend APIs** (`api/players/`):
- `create.js` - POST create profiles
- `[handle].js` - GET/PUT fetch/update with dual modes (full + vote-only)
- `list.js` - GET search by lastActiveAt
- `touch.js`, `delete.js`, `reset-stats.js` - Utilities
- `_utils.js` - Schema and validation

**Frontend Integration** (`src/`):
- `api/playerApi.js` - Complete API client, `syncProfileStats()` is critical
- `player/playerSearch.js` - Search component
- `player/playerCreateModal.js` - Creation modal
- `player/playerManager.js` - Enhanced with `addPlayerFromProfile()`, `removePlayer()`
- `share/votingSync.js` - Voting to profile sync
- `stats/achievements.js` - 20 badge definitions

**Pages**:
- `players.html` - Browse all players (search, pagination)
- `player-profile.html` - Individual stats (8 sections)

### Critical Data Structures

**Player Stats** (in KV):
```javascript
{
  // Session-level (complete games)
  sessionsPlayed, sessionsWon, sessionWinRate,
  avgRankingPerSession, avgRoundsPerSession, longestSessionRounds,

  // Round-level
  roundsPlayed, avgRankingPerRound,

  // Time tracking
  totalPlayTimeSeconds, longestSessionSeconds, avgSessionSeconds,

  // Community
  mvpVotes, burdenVotes,

  // Social (NEW)
  partners: { handle: { games, wins, winRate } },
  opponents: { handle: { games, wins, winRate } },

  // Recent performance
  recentRankings: [1, 2, 1, 3],  // Relative positions (1-8)

  // Honors + Streaks + Legacy fields...
}
```

### How Stats Sync Works

**Trigger**: A-level victory (`applyResult.finalWin === true`)

**Flow** (main.js lines 230-251, 736-759):
1. Show victory modal
2. Schedule auto voting sync (5 min)
3. Wait 2 seconds for local voting
4. Calculate session honors
5. Get voting results
6. **Call `syncProfileStats()`** with 6 parameters:
   - historyEntry (has sessionDuration)
   - roomCode
   - players array (all 8 players)
   - sessionStats (from state.getPlayerStats())
   - sessionHonors (from calculateHonors)
   - votingResults (from getVotingResults)

**syncProfileStats** (playerApi.js lines 211-327):
- Calculate relative rankings (1-8) within session
- Map honors to each player
- Extract teammates and opponents
- For each profile player:
  - Build complete gameResult object
  - Call `PUT /api/players/[handle]`
  - API updates all stats

### MVP Calculation (CRITICAL!)

**NOT**: First place finisher in last round
**IS**: Player with LOWEST average ranking across entire session

**Code**: victoryModal.js lines 48-68, exportMobile.js lines 62-76

Lower average = better performance (e.g., 3.63 beats 4.20)

### Recent Rankings (IMPORTANT!)

**Shows**: Relative position within each session (#1, #2, #8)
**NOT**: Session average (3.63)

Calculated in `playerApi.js` by sorting all players by avgRank.

### Testing

**Test Data**: 10 players with `test_` prefix (easy cleanup)
- All stats reset to 0 as of 2025-12-10
- Use for development/testing
- Delete before production launch

**Test Commands**:
```bash
# Create test player
curl -X POST https://gd.ax0x.ai/api/players/create -d '{...}'

# Reset all test_ players
curl -X POST https://gd.ax0x.ai/api/players/reset-stats -d '{"handle":"test_hao"}'
```

### Common Issues

**Victory modal not showing**: Check console, ensure state imported, wrap tagline in try-catch

**Stats not syncing**: Verify all 6 params to syncProfileStats, check console logs

**Recent rankings wrong**: Should be #1-8 not averages, check relativeRank calculation

**Timer keeps running**: Should stop when checkGameEnded() returns true

**Ranking buttons greyed**: Don't lock clearRanking/randomRanking during gameplay

### Documentation

**Must Read**:
- [CODEBASE_STRUCTURE.md](docs/architecture/CODEBASE_STRUCTURE.md) - **File-by-file reference**
- [PLAYER_PROFILE_ARCHITECTURE.md](docs/architecture/PLAYER_PROFILE_ARCHITECTURE.md) - System details
- [TODO.md](TODO.md) - Next steps and priorities

**Reference**:
- [FEATURE_STATUS.md](docs/FEATURE_STATUS.md) - What's complete
- [KV_SCHEMA.md](docs/architecture/KV_SCHEMA.md) - Database patterns

### Next Steps

**High Priority**:
1. Room browser with player filter
2. Achievement unlock notifications
3. Enhanced partner/rival displays

**See TODO.md for complete roadmap**

---

**The Player Profile System is complete and production-ready!** 🚀
