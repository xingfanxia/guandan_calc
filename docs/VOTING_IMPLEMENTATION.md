# End-Game Voting Implementation Plan

## Requirements

**When**: Only when a team reaches A-level and wins (end of game)
**Who**: Remote viewers vote from their own devices
**How**: Host confirms votes and syncs final results

---

## Flow

### 1. A-Level Victory Triggers
- Team reaches level A and wins
- Victory modal appears for HOST
- Event emitted: `game:victoryAchieved`
- Notification sent to all viewers in room

### 2. Viewers Vote (Remote)
- Viewers see voting interface on their devices
- Vote for game MVP (最C)
- Vote for game burden (最闹)
- Votes submitted to API: `POST /api/rooms/vote/{roomCode}`
- Votes stored per game (not per round)

### 3. Host Sees Results
- Host's victory modal shows:
  - Celebration message
  - **Aggregated viewer votes** (live updating)
  - List of players with vote counts
- Updates every 1 second to show live votes

### 4. Host Confirms
- Host reviews votes
- Clicks "确认投票结果" button
- Results recorded to "人民的声音" section
- Synced to all viewers
- Voting cleared for next game

### 5. "人民的声音" Display
- Shows cumulative results across all games
- Format: "游戏 #1: MVP - 🐶豪 | 最闹 - 🐱小"
- Visible to all (host and viewers)
- Persists in room data

---

## Implementation

### Changes Needed:

1. **Victory Modal** (ui/victoryModal.js):
   - Detect if in room mode
   - Host: Show live vote aggregation
   - Viewers: Show voting interface
   - Host confirmation button

2. **Voting API Integration**:
   - Use game number (total games played) as identifier
   - Store votes per game, not per round
   - Clear votes after host confirmation

3. **"人民的声音" Section**:
   - Add to room state
   - Display historical voting results
   - Update when host confirms

4. **Sync Logic**:
   - Host confirmation updates room data
   - Viewers poll and see updated "人民的声音"
   - Victory modal closes for all after confirmation

---

**Proceeding with implementation...**
