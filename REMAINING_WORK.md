# Remaining Work for v9.0 Complete

## Summary

**Current Status**: Core game fully functional (22 commits, 20 modules)

**Remaining**: 4 major features to implement

---

## High Priority Tasks

### 1. Room Features (Backend Integration) 🔴 COMPLEX
**Scope**: ~800-1000 lines of code
**Modules**: 3 new files
- `src/share/roomManager.js` - Vercel KV integration
- `src/share/shareManager.js` - Static URL sharing
- `src/share/votingManager.js` - Remote voting coordination

**Features**:
- Create room (6-digit codes, auth tokens)
- Join room (viewer mode)
- Browse/favorite rooms
- Auto-sync (10s interval for host, 5s poll for viewers)
- Host/viewer mode detection
- Room state persistence (24h TTL, 1yr for favorites)

**API Integration**:
- `POST /api/rooms/create` - Generate room + auth
- `GET/PUT /api/rooms/[code]` - Fetch/update room data
- `POST /api/rooms/vote/[code]` - Submit votes
- `POST /api/rooms/reset-vote/[code]` - Clear votes
- `POST /api/rooms/favorite/[code]` - Toggle favorite
- `GET /api/rooms/list` - List favorites

**Estimate**: 6-8 hours

### 2. Remote Voting System 🔴 MEDIUM
**Scope**: ~300-400 lines
**Dependencies**: Requires room features above

**Features**:
- Viewers vote from own devices
- Votes sync through Vercel KV
- Host sees aggregated results
- Real-time vote count updates
- Host confirmation before recording

**Integration**:
- Replace local voting in victory modal
- Add round-by-round voting option
- Sync votes with room state

**Estimate**: 2-3 hours (after rooms done)

---

## Medium Priority Tasks

### 3. Honors System (Redesigned) 🟡 COMPLEX
**Scope**: ~500-600 lines
**Module**: `src/stats/honors.js`

**New Honors** (8 balanced categories):
1. 🥇 MVP王 - Weighted performance score
2. 😅 拖油瓶 - Reverse weighted score
3. 🗿 稳如泰山 - Low variance + middle performance
4. 🌊 过山车 - High variance + extreme swings
5. 📈 逆袭王 - Improving trend analysis
6. 📉 疲劳选手 - Declining performance
7. 🛡️ 团队之光 - Sacrifice score in team wins
8. 🎯 关键先生 - Clutch performance in close games

**Implementation Steps**:
1. Enhanced data tracking (close games, team win context)
2. Statistical functions (stdDev, percentile, trend analysis)
3. Honor calculation logic
4. UI display with clickable tooltips
5. Real-time updates as games are played

**Estimate**: 4-5 hours

**Design Doc**: See `docs/HONORS_REDESIGN.md`

### 4. Mobile PNG Export 🟡 SIMPLE
**Scope**: ~150-200 lines
**Module**: Update `src/export/exportHandlers.js`

**Features**:
- 600px width (mobile-optimized)
- Larger fonts (readable on phones)
- Include honors in export
- Auto-wrap long text
- Dynamic height calculation

**Estimate**: 1-2 hours

---

## Total Remaining Effort

**Time Estimate**: 13-18 hours total
- Room features: 6-8h
- Remote voting: 2-3h
- Honors system: 4-5h
- Mobile PNG: 1-2h

**Complexity**: High (room features require backend integration)

**Dependencies**:
```
Room Features (foundation)
    ↓
Remote Voting (depends on rooms)
    ↓
Honors System (independent)
    ↓
Mobile PNG (independent)
```

---

## Implementation Order

### Phase 1: Room Features (Day 1)
1. Create share/roomManager.js
2. Implement create/join room flow
3. Add auto-sync for host
4. Add polling for viewers
5. Browse and favorite functionality

### Phase 2: Remote Voting (Day 1-2)
1. Create share/votingManager.js
2. Implement viewer voting UI
3. Add host confirmation flow
4. Sync votes through API
5. Replace local voting with remote

### Phase 3: Honors System (Day 2)
1. Design honor metrics (see HONORS_REDESIGN.md)
2. Implement statistical functions
3. Create stats/honors.js module
4. Add UI display with tooltips
5. Test with real game data

### Phase 4: Mobile PNG (Day 2)
1. Add exportMobilePNG() function
2. Optimize layout for 600px width
3. Include honors in export
4. Test on mobile devices

---

## Current File Structure (Before Room Features)

```
src/
├── main.js ✅
├── core/ ✅ (5 modules)
├── game/ ✅ (3 modules)
├── player/ ✅ (4 modules)
├── ranking/ ✅ (3 modules)
├── stats/ ✅ (1 module) → Will add honors.js
├── ui/ ✅ (2 modules)
├── export/ ✅ (1 module)
└── share/ ❌ (NEEDS 3 modules: roomManager, shareManager, votingManager)
```

---

**Ready to proceed?** I'll start with room features first, then voting, then honors, then mobile PNG.

This will complete the full-featured v9.0 modular version! 🚀
