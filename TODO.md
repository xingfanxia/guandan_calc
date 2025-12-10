# Implementation Plan: Player Profile System - Frontend Integration

## Backend Status: ✅ COMPLETE
All 3 player APIs tested and working on production (https://gd.ax0x.ai)

---

## Frontend Integration Plan

### Current Flow (Session-Only)
1. Click "生成玩家" → `generatePlayers(count)` creates `{ id, name, emoji, team }`
2. Bulk input → `applyBulkNames()` updates names
3. Drag-drop → assigns teams
4. State stored in localStorage (session-only)

### Target Flow (Profile-Based)
1. Click "搜索玩家" → Search existing profiles OR create new
2. Select player → Add to game with full profile data
3. Drag-drop → assigns teams (same as before)
4. State includes profile handles for stats updates after game

---

## Steps

- [ ] **Step 1**: Create player API client module `src/api/playerApi.js`
  - File: `src/api/playerApi.js` (new)
  - Functions:
    ```javascript
    searchPlayers(query)    // GET /api/players/list?q={query}
    getPlayer(handle)       // GET /api/players/{handle}
    createPlayer(data)      // POST /api/players/create
    ```
  - Test: Call each function from browser console

- [ ] **Step 2**: Create player search UI component
  - File: `src/player/playerSearch.js` (new)
  - Features:
    - Search input with real-time filtering
    - Player results list (handle, displayName, emoji, playStyle)
    - "Create New Player" button
    - Selection callback to add player to game
  - UI location: Replace or augment "批量输入姓名" section
  - Test: Search shows results, clicking adds player

- [ ] **Step 3**: Create "Create Player" modal
  - File: `src/player/playerCreateModal.js` (new)
  - Features:
    - Form: handle, displayName, emoji selector, playStyle dropdown, tagline
    - Validation (client-side + server response)
    - Success → auto-add to game
  - Test: Create player, verify added to game

- [ ] **Step 4**: Update playerManager to support profile data
  - File: `src/player/playerManager.js`
  - Changes:
    - Extend player object: `{ id, name, emoji, team, handle, playerId, playStyle, tagline }`
    - Add `addPlayerFromProfile(profile)` function
    - Keep backward compatibility for session-only players
  - Test: Mix profile and session players in same game

- [ ] **Step 5**: Update main.js event handlers
  - File: `src/main.js`
  - Changes:
    - Add event bindings for search UI
    - Add event bindings for create modal
    - Keep existing "generatePlayers" as fallback/quick-start
  - Test: All player setup flows work

- [ ] **Step 6**: Update HTML with new UI elements
  - File: `index.html`
  - Changes:
    - Add player search section before bulk names
    - Add "或 手动添加" toggle for session-only players
    - Keep existing UI as fallback option
  - Test: UI renders correctly, responsive

- [ ] **Step 7**: Add "Recent Players" localStorage cache
  - File: `src/player/recentPlayers.js` (new)
  - Features:
    - Cache last 10 used player handles
    - Show as quick-select buttons
    - LocalStorage key: `gd_v9_recent_players`
  - Test: Recent players persist across sessions

- [ ] **Step 8**: Integration testing
  - Test scenarios:
    - Search and select existing player
    - Create new player and use immediately
    - Mix profile + session players
    - Recent players quick-select
    - Backward compat: old games still work
  - Verify: All player data correctly stored

## Progress Log
| Step | Status | Notes | Commit |
|------|--------|-------|--------|
| 1 | Pending | API client module | |
| 2 | Pending | Search UI component | |
| 3 | Pending | Create player modal | |
| 4 | Pending | playerManager updates | |
| 5 | Pending | Event handler updates | |
| 6 | Pending | HTML UI updates | |
| 7 | Pending | Recent players cache | |
| 8 | Pending | Integration testing | |

## Design Decisions

### Backward Compatibility
- Keep existing "生成玩家" + "批量输入" as quick-start option
- Session-only players work without profiles (handle = null)
- Gradual migration: users can adopt profiles at their own pace

### UI Layout
```
👥 玩家设置
  [搜索玩家] [🔍]
  Recent: [@xiaoming] [@lili] [@testplayer]
  --- 或 ---
  [生成玩家] [批量输入姓名] (existing flow)
```

### Data Model Enhancement
```javascript
// Before (session-only)
{ id: 1, name: "小明", emoji: "🐱", team: 1 }

// After (profile-linked)
{
  id: 1,              // Session ID (for drag-drop)
  name: "小明",       // Display name
  emoji: "🐱",
  team: 1,
  handle: "xiaoming", // NEW: Link to profile
  playerId: "PLR_X7K2M9", // NEW: For stats updates
  playStyle: "steady",    // NEW: From profile
  tagline: "稳如老狗"     // NEW: For victory screen
}
```

### Stats Update Flow (Future)
After game ends:
1. For each player with `handle`:
2. Call `PUT /api/players/{handle}/stats` with game results
3. Update: gamesPlayed, wins, honors, recentGames array

---

## Next: Start Step 1 - Create API Client Module
