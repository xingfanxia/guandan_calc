# Modular Version Testing Checklist

## Testing URL
**Development**: http://localhost:3000/
**Command**: `npm run dev`

---

## Core Functionality Tests

### Player Management
- [ ] Click "生成玩家" - Players generate with emojis
- [ ] Edit player names - Names update and persist
- [ ] Bulk name input - "超 豪 姐 哥 帆 夫 塔 小" works
- [ ] Quick start button - Applies names and shuffles teams
- [ ] Drag player to team zone - Player assigned to team
- [ ] Drag player to unassigned - Player removed from team
- [ ] "随机分配队伍" - Players distributed evenly
- [ ] Team full validation - Alert shows when team is full

### Ranking System
- [ ] Drag player from pool to ranking slot - Player ranked
- [ ] Drag player between ranking slots - Positions swap
- [ ] Drag player from ranking back to pool - Player unranked
- [ ] "随机排名" - All players randomly ranked
- [ ] "清空排名" - All ranking cleared
- [ ] Auto-calculate triggers when all positions filled
- [ ] Calculation display shows winner and upgrade
- [ ] Manual calc button works

### Game Flow
- [ ] Apply button - Results applied, history added
- [ ] Auto-apply when enabled - Applies automatically after ranking
- [ ] Teams advance to correct levels
- [ ] Round level updates correctly
- [ ] Next round preview shows correctly
- [ ] Advance button - Manual round advancement works

### A-Level Rules
- [ ] Team at A-level wins without last place → Victory modal
- [ ] Team at A-level wins with last place → Failure counted
- [ ] A-failure counter increments (max 3)
- [ ] 3 A-failures reset team to level 2
- [ ] Strict mode: Must win at own A-level
- [ ] Lenient mode: Can win at any level
- [ ] Opponent round doesn't count failures

### History & Rollback
- [ ] History table shows all games
- [ ] Player rankings displayed with colors
- [ ] "回滚至此前" button works
- [ ] "撤销上局" button works
- [ ] "重置整场" preserves player names and teams
- [ ] History persists across page reload

### Statistics
- [ ] Player stats table shows games, avg rank, 1st/last counts
- [ ] Team MVP identified correctly (best avg rank)
- [ ] Team burden identified correctly (worst avg rank)
- [ ] Stats persist across page reload
- [ ] Stats update after each game

### Custom Rules
- [ ] Edit 4-player rule inputs, click "保存4人规则"
- [ ] Edit 6-player thresholds, click "保存6人规则"
- [ ] Edit 8-player points, click "保存8人规则"
- [ ] Rule hint updates after save
- [ ] Custom rules persist across page reload
- [ ] Calculations use custom rules

### Settings
- [ ] "必须第1名" checkbox - Toggles must1 preference
- [ ] "自动进入下一局" checkbox - Toggles autoNext
- [ ] "自动应用" checkbox - Toggles autoApply
- [ ] "严格A级规则" checkbox - Toggles strictA
- [ ] Settings persist across page reload

### Export Functions
- [ ] "导出TXT" - Downloads .txt file with game data
- [ ] "导出CSV" - Downloads .csv file with game data
- [ ] "导出长图PNG" - Downloads .png image with history
- [ ] Export tip shows "已导出 XXX" message
- [ ] Export files have v9 in filename

### Victory Modal & End-Game Voting
- [ ] Modal appears when team reaches A-level
- [ ] Correct team name and color displayed
- [ ] Voting interface shows all players
- [ ] Click MVP vote button - Vote count increases
- [ ] Click burden vote button - Vote count increases
- [ ] Vote results display shows winners
- [ ] Close button closes modal
- [ ] Votes cleared when modal closes

### Mobile/Touch (Chrome DevTools Device Mode)
- [ ] Long-press player tile (200ms) - Drag starts
- [ ] Drag clone follows finger
- [ ] Drop zones highlight during drag
- [ ] Drop on team zone - Player assigned
- [ ] Drop on ranking - Player ranked
- [ ] Touch clone cleaned up after drop
- [ ] Input fields still editable (not hijacked by touch)

### Persistence & Page Reload
- [ ] Play a few games, reload page - History persists
- [ ] Change team names, reload - Names persist
- [ ] Modify custom rules, reload - Rules persist
- [ ] Generate players, reload - Same players load
- [ ] All localStorage uses gd_v9_* keys

---

## Known Limitations (Expected)

### Not Implemented (Placeholders):
- ⚠️ Create room - Shows alert
- ⚠️ Join room - Shows alert
- ⚠️ Browse rooms - Shows alert
- ⚠️ Export mobile PNG - Shows alert
- ⚠️ Share game - Shows alert
- ⚠️ Round-by-round voting section - Hidden

### To Implement Later:
- Real-time room sharing (requires backend integration)
- Mobile-optimized PNG export
- Static URL sharing
- Enhanced voting system across rounds

---

## Bug Tracking

### Found Bugs:
_Record any issues found during testing here_

1.
2.
3.

### Fixed:
_Record fixes here_

1. ✅ Touch handlers not attached - FIXED
2. ✅ Drag handlers missing from ranking tiles - FIXED
3. ✅ Custom rules save buttons - FIXED
4. ✅ Window global exports - FIXED
5. ✅ Calculation display not updating - FIXED
6. ✅ Auto-apply not working - FIXED
