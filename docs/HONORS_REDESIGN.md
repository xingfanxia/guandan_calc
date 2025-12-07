# Honors System Redesign - Better Metrics

## Problems with Current Metrics

**Issues identified**:
- Simple counting (most 1st, most last) doesn't tell full story
- Doesn't account for game context or difficulty
- Doesn't reward different play styles equally
- Some honors are too easy/hard to get

---

## Redesigned Honor System (8 Balanced Honors)

### Tier 1: Performance Honors (What you achieve)

**🥇 MVP王 (MVP King)**
- **Metric**: Weighted performance score
- **Calculation**: `(First places × 3) + (Top 3 finishes × 1) - (Last places × 2)`
- **Why better**: Rewards consistency in top tier, penalizes last place
- **Minimum**: 10+ games

**😅 拖油瓶 (Burden)**
- **Metric**: Reverse weighted score
- **Calculation**: `(Last places × 3) + (Bottom 3 × 1) - (First places × 2)`
- **Why better**: Identifies genuine burden, not just bad luck
- **Minimum**: 10+ games

### Tier 2: Consistency Honors (How you perform)

**🗿 稳如泰山 (Stable as Mountain)**
- **Metric**: Low standard deviation + middle performance
- **Calculation**: `stdDev(rankings) < 1.5 AND avgRank within 35-65th percentile`
- **Why better**: Rewards true consistency, not just always being mediocre
- **Minimum**: 15+ games

**🌊 过山车 (Rollercoaster)**
- **Metric**: High variance + extreme swings
- **Calculation**: `stdDev(rankings) > 2.5 AND (has 1st AND last place)`
- **Why better**: Identifies genuinely unpredictable players
- **Minimum**: 15+ games

### Tier 3: Trend Honors (How you evolve)

**📈 逆袭王 (Comeback King)**
- **Metric**: Improving trend with turning point
- **Calculation**:
  - Split games into thirds (early/mid/late)
  - `lateAvg - earlyAvg > 1.5 ranks improvement`
  - Must have visible upturn in mid-section
- **Why better**: Rewards genuine improvement, not just good finish
- **Minimum**: 20+ games

**📉 疲劳选手 (Fatigue Player)**
- **Metric**: Declining performance over time
- **Calculation**: `earlyAvg - lateAvg > 1.5 ranks decline`
- **Why better**: Identifies players who start strong but fade
- **Minimum**: 20+ games

### Tier 4: Team Contribution (How you help)

**🛡️ 团队之光 (Team Pillar)**
- **Metric**: Sacrifice score during team wins
- **Calculation**: `Count team wins where you finished bottom half / total team wins > 40%`
- **Why better**: Rewards actual sacrifice, not just being bad
- **Must have**: Team win rate > 40% (you actually help win)
- **Minimum**: 15+ games

**🎯 关键先生 (Clutch Player)**
- **Metric**: Top performance in close games
- **Calculation**:
  - Identify close games (score diff < 3 points in 6/8p mode)
  - Your avg rank in close games vs. avg rank in blowouts
  - Clutch score: `blowoutAvg - closeAvg > 0.5` (better in pressure)
- **Why better**: Identifies players who perform under pressure
- **Minimum**: 10+ close games

---

## Implementation Strategy

### Data Tracking Needed:
```javascript
playerStats[playerId] = {
  games: number,
  rankings: number[],          // All rankings (for stdDev)
  teamWins: number,             // Games where team won
  teamWinsBottomHalf: number,   // Team wins where player in bottom half
  closeGames: {                 // Score diff < 3
    count: number,
    ranks: number[]
  },
  blowouts: {                   // Score diff >= 3
    count: number,
    ranks: number[]
  }
}
```

### Calculation Functions:
```javascript
// Standard deviation
function stdDev(arr: number[]): number

// Percentile ranking
function getPercentile(value, arr): number

// Trend analysis (3-section split)
function analyzeTrend(rankings): {early, mid, late, trend}

// Close game detection
function isCloseGame(scoreA, scoreB): boolean
```

### Honor Assignment Logic:
```javascript
function calculateHonors(allPlayerStats) {
  const eligible = filterByMinGames(allPlayerStats);

  const honors = {
    mvp: findMaxBy(eligible, calculateMVPScore),
    burden: findMaxBy(eligible, calculateBurdenScore),
    stable: findMinBy(eligible, stdDev, withinPercentile),
    rollercoaster: findMaxBy(eligible, stdDev, hasExtremes),
    comeback: findMaxBy(eligible, improvementScore),
    fatigue: findMaxBy(eligible, declineScore),
    teamPillar: findMaxBy(eligible, sacrificeScore, teamWinRateCheck),
    clutch: findMaxBy(eligible, clutchScore, minCloseGames)
  };

  return honors;
}
```

---

## Display Format

**Badge Style**:
```
🥇 MVP王: 🐶豪 (得分: 45)
😅 拖油瓶: 🐱小 (得分: -23)
🗿 稳如泰山: 🦊大 (方差: 1.2)
🌊 过山车: 🐻姐 (方差: 3.1, 极差: 7)
📈 逆袭王: 🐼夫 (进步: +2.3 ranks)
🛡️ 团队之光: 🐨塔 (牺牲率: 55%)
🎯 关键先生: 🦁帆 (关键+0.8)
```

**Tooltip** (on click):
Shows detailed calculation breakdown and statistics

---

## Why This System is Better

1. **Balanced**: No honor is too easy or impossible
2. **Diverse**: Different play styles can win different honors
3. **Meaningful**: Each honor tells a real story about the player
4. **Fair**: Requires minimum games to prevent noise
5. **Contextual**: Considers game difficulty and team situation
6. **Explainable**: Clear calculations users can understand

---

**Next Steps**:
1. Implement data tracking during games
2. Add calculation functions to stats/statistics.js
3. Create stats/honors.js module
4. Update UI to show honors with tooltips
5. Test with real game data
