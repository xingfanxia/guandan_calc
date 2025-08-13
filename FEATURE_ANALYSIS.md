# Guandan Calculator - Complete Feature Analysis

## 🎮 Core Features

### 1. Player Management System
- **Player Generation**: Create 4, 6, or 8 players with unique emojis
- **Player Naming**: Editable player names (inline editing)
- **Team Assignment**: 
  - Manual drag-drop to teams
  - Random team shuffling
  - Visual team zones with colors (Blue/Red by default)
- **Player Pool**: Unassigned players area before team assignment

### 2. Ranking System
- **Drag-and-Drop Ranking**: 
  - Player pool for unranked players
  - Numbered ranking slots (1st to 8th place)
  - Visual feedback during drag operations
- **Mobile Support**: Touch events with long-press detection
- **Quick Actions**:
  - Clear all rankings
  - Random ranking generator
  - Manual calculation trigger
- **Auto-calculation**: When all players are ranked

### 3. Scoring & Calculation
- **Game Modes**: 
  - 4-player mode with specific scoring rules
  - 6-player mode with threshold-based scoring
  - 8-player mode with detailed point system
- **Customizable Rules**:
  - Adjustable scoring for each ranking combination
  - Threshold values for upgrade levels
  - Point values for each position
- **Must-have-first Rule**: Option to require rank 1 for victory

### 4. Team Management
- **Team Customization**:
  - Editable team names (default: 蓝队/红队)
  - Customizable team colors
- **Team Levels**: 
  - Current level tracking (2-14, represented as A,K,Q,J,10,9,8,7,6,5,4,3,2)
  - Next level preview
- **A-Level Special Rules**:
  - A-level failure counter (0-3)
  - Strict mode: Must win on own A-level to pass
  - Loose mode: Any A-level win counts
  - A3 penalty: Return to level 2 after 3 failures

### 5. Winner Selection
- **Manual Winner Selection**: Click buttons to choose winning team
- **Auto-detection**: Based on rank 1 player's team
- **Visual Feedback**: Winner display with team name

### 6. Result Application
- **Apply Results**: Update team levels and stats
- **Auto-apply**: Option to automatically apply after calculation
- **Auto-next**: Automatically advance to next round
- **Level Advancement**: Based on scoring results

### 7. History & Statistics

#### Game History
- **Match History Table**:
  - Round number
  - Timestamp
  - Player count
  - Winner combination
  - Full ranking
  - Upgrade details
  - Team levels
  - A-level status
- **Undo Function**: Rollback last round
- **Delete Specific Round**: Remove any history entry

#### Player Statistics
- **Individual Stats**:
  - Games played
  - Average ranking
  - First place count
  - Last place count
  - Win/loss record
- **Team Stats**:
  - MVP (best average ranking)
  - Burden (worst average ranking)
  - Win streaks

### 8. Export Features
- **TXT Export**: Plain text format
- **CSV Export**: Spreadsheet compatible
- **PNG Export**: Screenshot of results
- **Long PNG Export**: Full history as image
- **Clipboard Copy**: Quick sharing

### 9. UI/UX Features
- **Dark Theme**: Modern dark color scheme
- **Responsive Design**: Mobile and desktop compatible
- **Victory Modal**: Celebration screen when team wins
- **Tooltips & Hints**: Contextual help text
- **Loading States**: Visual feedback during operations
- **Error Messages**: Clear error handling

### 10. Settings & Persistence
- **LocalStorage**: 
  - Save all game state
  - Save custom rules
  - Save team names/colors
  - Save player stats
- **Settings Options**:
  - Auto-apply toggle
  - Auto-next toggle
  - Strict A-level toggle
  - Must-have-first toggle

### 11. Advanced Features
- **Ripple Effects**: Visual feedback on button clicks
- **Drag Animations**: Smooth drag-and-drop transitions
- **Touch Haptics**: Vibration feedback on mobile
- **Keyboard Shortcuts**: (if implemented)
- **Performance Optimizations**: Efficient rendering

## 📊 Data Structures

### Player Object
```javascript
{
  id: number,
  name: string,
  emoji: string,
  team: 1 | 2 | null
}
```

### Team State
```javascript
{
  name: string,
  color: string,
  level: number (2-14),
  aFail: number (0-3),
  aState: string
}
```

### Ranking State
```javascript
{
  1: playerId,
  2: playerId,
  ...
  8: playerId
}
```

### History Entry
```javascript
{
  time: string,
  mode: number,
  ranking: object,
  winner: 't1' | 't2',
  score: number,
  label: string,
  teamLevels: object,
  aStatus: object
}
```

## 🎨 Design System

### Color Palette
- Background: `#0b0b0c` (near black)
- Card: `#16171b` (dark gray)
- Text: `#f5f6f8` (off white)
- Muted: `#b4b8bf` (gray)
- Accent: `#e6b800` (gold)
- Team 1: `#3b82f6` (blue)
- Team 2: `#ef4444` (red)
- Success: `#4ade80` (green)
- Warning: `#f59e0b` (orange)

### Layout
- Max width: 1150px centered
- Card-based sections with rounded corners
- Grid layouts for responsive design
- Sticky table headers
- Floating action buttons

### Typography
- System font stack
- Variable font sizes (12px-22px)
- Font weight variations for hierarchy
- Tabular numbers for statistics

## 🔧 Technical Implementation

### Libraries/Dependencies
- Vanilla JavaScript (no frameworks)
- HTML5 Canvas for image export
- LocalStorage API for persistence
- Touch Events API for mobile
- Drag and Drop API for desktop

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Android)
- Touch device support
- Responsive breakpoints at 768px and mobile

### Performance Considerations
- Efficient DOM manipulation
- Event delegation where possible
- Debounced/throttled operations
- Lazy loading for history
- Optimized image exports