# Implementation Plan: Mode-Specific Stats with Tab Switcher

**Status**: Planning
**Complexity**: Medium (backend schema + UI redesign)
**Impact**: High (accurate stats per game mode)

---

## Problem Statement

Current system mixes 4P, 6P, and 8P stats together:
- Rank 2 in 4P (50th percentile) vs Rank 2 in 8P (87.5th percentile) - very different!
- Average rankings across modes is meaningless
- Honors calculated incorrectly when mixing modes

---

## Solution: Mode-Specific Stats Storage

### Backend Schema Change

**Current (Wrong):**
```javascript
stats: {
  sessionsPlayed: 10,      // Mix of all modes!
  avgRankingPerSession: 3.2,  // Meaningless!
  // ...
}
```

**New (Correct):**
```javascript
stats: {
  // Overall (for backward compat)
  sessionsPlayed: 10,
  avgRankingPerSession: 3.2,

  // Mode-specific stats
  stats4P: {
    sessionsPlayed: 3,
    sessionsWon: 1,
    avgRankingPerSession: 2.5,
    // ... all same fields
  },
  stats6P: { /* ... */ },
  stats8P: { /* ... */ },

  // Mode distribution
  modeBreakdown: {
    '4P': 3,
    '6P': 2,
    '8P': 5
  }
}
```

---

## UI Changes: Profile Page Tabs

### Tab Switcher Design

```
┌─────────────────────────────────────┐
│  [ 全部 ] [ 4人 ] [ 6人 ] [ 8人 ]   │
└─────────────────────────────────────┘

Mode: 全部 (All Games)
─────────────────────────
📊 生涯统计
  游戏场次: 10
  胜率: 60%
  场均排名: 3.2

Mode: 8人 (8-Player Games)
─────────────────────────
📊 生涯统计
  游戏场次: 5
  胜率: 80%
  场均排名: 2.1  ← More meaningful!
```

---

## Implementation Steps

### Step 1: Update Backend Stats Structure ⏸️
**File**: `api/players/_utils.js:106-162`
**Action**: Add mode-specific stats initialization

```javascript
export function initializePlayerStats() {
  const baseStats = {
    sessionsPlayed: 0,
    sessionsWon: 0,
    sessionWinRate: 0,
    avgRankingPerSession: 0,
    // ... all existing fields
  };

  return {
    ...baseStats,  // Overall stats
    stats4P: { ...baseStats },  // 4-player specific
    stats6P: { ...baseStats },  // 6-player specific
    stats8P: { ...baseStats },  // 8-player specific
    modeBreakdown: { '4P': 0, '6P': 0, '8P': 0 }
  };
}
```

### Step 2: Update Stats Sync Logic ⏸️
**File**: `api/players/[handle].js:136-286`
**Action**: Sync to both overall AND mode-specific stats

```javascript
// Update overall stats (existing logic)
player.stats.sessionsPlayed += 1;

// Update mode-specific stats
const modeKey = gameResult.mode; // '4P', '6P', '8P'
const modeStats = `stats${modeKey}`;

if (!player.stats[modeStats]) {
  player.stats[modeStats] = initializePlayerStats();
}

player.stats[modeStats].sessionsPlayed += 1;
player.stats[modeStats].sessionsWon += gameResult.teamWon ? 1 : 0;
// ... update all mode-specific fields

// Update mode breakdown
player.stats.modeBreakdown[modeKey] = (player.stats.modeBreakdown[modeKey] || 0) + 1;
```

### Step 3: Add Tab Switcher UI ⏸️
**File**: `player-profile.html:606-650`
**Action**: Add mode tabs before stats section

```html
<!-- Mode Switcher Tabs -->
<div class="mode-tabs" style="display: flex; gap: 8px; margin-bottom: 20px; justify-content: center;">
  <button class="mode-tab active" data-mode="all">全部</button>
  <button class="mode-tab" data-mode="4P">4人</button>
  <button class="mode-tab" data-mode="6P">6人</button>
  <button class="mode-tab" data-mode="8P">8人</button>
</div>

<div id="statsContainer">
  <!-- Stats rendered here based on selected mode -->
</div>
```

### Step 4: Dynamic Stats Rendering ⏸️
**File**: `player-profile.html` (script section)
**Action**: Render different stats based on selected mode

```javascript
function renderStats(player, mode = 'all') {
  const stats = mode === 'all' ? player.stats : player.stats[`stats${mode}`];

  // Render stats for selected mode
  document.getElementById('statsContainer').innerHTML = `
    <div class="stat-grid">
      <div class="stat-item">
        <span class="stat-value">${stats.sessionsPlayed}</span>
        <span class="stat-label">游戏场次</span>
      </div>
      <!-- ... -->
    </div>
  `;
}

// Tab click handlers
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const mode = tab.dataset.mode;
    // Update active tab styling
    // Re-render stats for selected mode
    renderStats(player, mode);
  });
});
```

### Step 5: Mode-Specific Honors ⏸️
**File**: `stats/honors.js`
**Action**: Calculate honors separately per mode

- Track mode in honor calculations
- Store honors per mode: `honors4P`, `honors6P`, `honors8P`
- Show mode-specific honors in profile

### Step 6: Backward Compatibility ⏸️
**Action**: Migrate existing player data

- For players with existing stats, initialize mode-specific stats
- Distribute existing games to modes based on `recentGames` mode field
- Or default all to `stats8P` (most common mode)

---

## Testing Protocol

### Unit Tests
- [ ] Create player in 4P → stats4P increments
- [ ] Create player in 8P → stats8P increments
- [ ] Mixed modes → both stats update correctly
- [ ] Tab switching → shows correct stats
- [ ] Overall tab → aggregates all modes

### Edge Cases
- [ ] Player with only one mode (others show 0)
- [ ] New player (all modes at 0)
- [ ] Migrated player (backward compat)
- [ ] Honors calculated per mode

---

## Files to Modify

1. `api/players/_utils.js` - Stats initialization
2. `api/players/[handle].js` - Stats update logic
3. `player-profile.html` - Tab UI + rendering
4. `src/stats/honors.js` - Mode-aware honors (optional)

**Estimated**: ~300 lines changed

---

## Migration Strategy

For existing players:
```javascript
if (!player.stats.stats4P) {
  // Initialize mode-specific stats
  player.stats.stats4P = initializePlayerStats();
  player.stats.stats6P = initializePlayerStats();
  player.stats.stats8P = initializePlayerStats();

  // Migrate based on recentGames mode distribution
  // Or default all to overall stats
}
```

---

## UI Mockup

```
┌───────────────────────────────────────┐
│ @fufu - 躺平大师 🛋️                    │
│ "运筹帷幄，决胜千里"                    │
└───────────────────────────────────────┘

[ 全部 ] [ 4人 ] [ 6人 ] [ 8人 ]
  ✓

📊 生涯统计 (全部模式)
┌─────────┬─────────┬─────────┐
│ 场次: 10│ 胜率: 60%│ 场均: 3.2│
└─────────┴─────────┴─────────┘

🏆 荣誉墙 (全部模式)
吕布 x3 | 石佛 x1 | ...

Switch to "8人" tab:
━━━━━━━━━━━━━━━━━━━━
📊 生涯统计 (8人模式)
┌─────────┬─────────┬─────────┐
│ 场次: 5 │ 胜率: 80%│ 场均: 2.1│
└─────────┴─────────┴─────────┘

🏆 荣誉墙 (8人模式)
吕布 x2 | 连段王 x1 | ...
```

---

## Next Steps

**Approve this approach?**
- [ ] Separate stats by mode (stats4P, stats6P, stats8P)
- [ ] Tab switcher in profile page
- [ ] Keep overall stats for comparison
- [ ] Migrate existing player data

**Estimated Time**: 2-3 hours for full implementation

**Ready to proceed?** 🎯
