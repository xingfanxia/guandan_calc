# Guandan (掼蛋) Game Rules

## Overview

Guandan (掼蛋) is a climbing card game that originated in Jiangsu Province, China. It's played with two standard decks of cards (including jokers) by 4 players in fixed partnerships. The game has since evolved to support 6 and 8 player variants.

## Basic Gameplay

### Objective
Teams progress through card ranks (2→3→4→5→6→7→8→9→10→J→Q→K→A) by winning rounds. A team wins the match only by clearing its own A-level round without a last-place player; winning while playing another team's level only returns play to that team's own A-level round.

### Card Rankings
- Cards rank from 2 (lowest) to A (highest)
- The current level card is wild (e.g., if playing level 5, all 5s are wild)
- Jokers are always the highest cards

### Round Play
1. Players play cards in combinations (singles, pairs, triples, straights, etc.)
2. Each player must beat the previous play or pass
3. The round ends when one team has both players run out of cards first
4. Teams earn upgrade levels based on the finishing positions

## Scoring System

### 4-Player Mode
In 4-player mode, the two players from the winning team finish in specific positions, determining the level upgrade:
- Positions 1,2: Maximum upgrade (typically 3 levels)
- Positions 1,3: Medium upgrade (typically 2 levels)
- Positions 1,4: Minimum upgrade (typically 1 level)

### 6-Player Mode
Teams of 3 players each. Upgrades are based on the point differential between teams:
- Large point advantage (≥7 points): Upgrade 3 levels
- Medium point advantage (≥4 points): Upgrade 2 levels
- Small point advantage (≥1 point): Upgrade 1 level
- No upgrade if the winning team doesn't have first place (optional rule)

### 8-Player Mode
Teams of 4 players each. Similar to 6-player mode but with adjusted thresholds:
- **Special Rule**: If one team takes positions 1,2,3,4 (complete sweep), they upgrade 4 levels
- Large point advantage (≥11 points): Upgrade 3 levels
- Medium point advantage (≥5 points): Upgrade 2 levels
- Small point advantage (≥0 points): Upgrade 1 level
- No upgrade if the winning team doesn't have first place (optional rule)

## A-Level Special Rules

### Victory Conditions
When a team reaches A-level, special rules apply:

**Strict Mode**
- The team must win while playing at their own A-level to win the match
- If they win at the opponent's level, they don't win the match; play returns to that team's own A
- Winning on the team's own A-level with a last-place player counts as a failure
- Losing on the team's own A-level also counts as a failure
- After 3 own-A failures, that team is reset to level 2

**Lenient Mode**
- The team still must win on its own A-level round, without a last-place player, to win the match
- Winning at the opponent's level or another level returns play to that team's own A instead of clearing
- Own-A failures do not increment A-fail counters and do not demote the team

### A-Level Failures (strict mode)

- If an A-level team loses on its own A round or wins its own A round with a last-place player, it counts as a failure
- After 3 failures (A1 → A2 → A3), the team is reset to level 2
- The failure count is tracked separately for each team
- Failure tracking applies to 4-, 6-, and 8-player modes when `strictA` is enabled

### 6-Player and 8-Player Mode

6/8-player modes now follow the same strict-A failure policy as 4-player mode when `strictA`
is enabled. In lenient mode, A-fail chips are hidden and teams continue at A until a valid clear.

## Calculator-Specific Features

### Team Assignment
- Players are divided into two teams before the game starts
- Teams remain fixed throughout the entire match
- Each team has a customizable name and color

### Round Recording
After each round, record:
1. The game mode (4, 6, or 8 players)
2. The finishing positions of all players
3. The system automatically calculates:
   - Level upgrades based on positions
   - Next round's level
   - A-level victory/failure conditions
   - Team and player statistics

### Statistics Tracked
- **Player Stats**: Games played, average ranking, first place count, last place count
- **Team Stats**: Current level, A-level failure count, rounds won
- **MVP/Burden**: Best and worst performing players on each team

### Auto-progression Options
- **Auto Next Round**: Automatically advance to the next round after applying results
- **Auto Apply**: Automatically clear the ranking board after recording results
- **Strict A Mode**: Toggle whether own-A failures accumulate and demote after A3; clear still requires winning on the team's own A round

## Strategic Elements

### Level Progression Strategy
- Teams must balance aggressive play (trying for maximum upgrades) with safety (ensuring at least some upgrade)
- The "must have first place" rule adds strategic depth to team play

### A-Level Management
- Teams approaching A-level must decide whether to push for victory or play conservatively
- The 3-failure reset rule creates dramatic comeback opportunities

### Team Coordination
- In 6 and 8 player modes, teams must coordinate to optimize their collective finishing positions
- Sacrificial play (one player helping teammates at their own expense) is often crucial

## Variations

Different regions may play with variations:
- Point values for each position can be customized
- Upgrade thresholds can be adjusted
- Some groups play with bombs and special combinations
- The calculator supports these variations through its configuration panel
