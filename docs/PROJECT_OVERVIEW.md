# Guandan Calculator - Project Overview

> 闹麻家族掼蛋计分器 - Real-time multiplayer scoring platform

## What We Built

A comprehensive **real-time multiplayer** Guandan (掼蛋) scoring calculator that evolved from a simple single-page tool into a sophisticated gaming platform with:

- **4/6/8 player modes** with team-based level progression (2→A)
- **Real-time room sharing** with 6-digit codes
- **14 data-driven honors** with cultural Chinese gaming references
- **Community voting** for MVP/burden selection
- **Mobile-optimized exports** (PNG, TXT, CSV)

---

## Development Phases

### Phase 1: Foundation
- Modularized 1,948-line monolith → 20 ES6 modules
- Modern Vite build system with HMR
- UTF-8 support for Chinese characters

### Phase 2: User Experience
- Bulk name input (space-separated)
- Quick start presets for all modes
- 77+ emoji avatars (animals + food)
- Smart reset preserving player setup

### Phase 3: Statistics & Honors
14 honor categories with Chinese gaming culture:
- 吕布, 阿斗, 石佛, 波动王, 奋斗王, 辅助王
- 翻车王, 赌徒, 大满贯, 连胜王, 佛系玩家
- 守门员, 慢热王, 闪电侠

### Phase 4: Real-Time Platform
- Room sharing with Vercel KV (Upstash Redis)
- 6-digit room codes (A1B2C3 format)
- Host authentication with secure tokens
- 10s host sync + 5s viewer polling

### Phase 5: Community Features
- Room favorites (1-year TTL)
- Anonymous voting system
- "人民的声音" results panel
- Mobile PNG optimization

### Phase 6: Polish
- Collapsible interfaces
- Host/viewer mode distinction
- Victory celebrations
- Touch-optimized controls

### Phase 7: Player Profiles (In Development)
- Persistent player identities (@handles)
- Career statistics tracking
- Game history with room links
- Honor collection across games
- Player and room browsers

---

## Architecture

```
src/
├── main.js                 # Entry point
├── core/                   # State, events, config, storage
├── game/                   # Calculator, rules, history
├── player/                 # Player management, drag-drop, touch
├── ranking/                # Ranking UI and calculations
├── stats/                  # Statistics and honors
├── ui/                     # Team display, victory modal
└── export/                 # TXT, CSV, PNG exports

api/
└── rooms/
    ├── create.js           # Room creation
    ├── [code].js           # Room GET/PUT
    ├── vote/[code].js      # Voting submission
    ├── reset-vote/[code].js# Vote reset
    ├── favorite/[code].js  # Favorite toggle
    └── list.js             # List favorites
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JS (ES6 modules) |
| Build | Vite |
| Backend | Vercel Edge Functions |
| Database | Vercel KV (Upstash Redis) |
| Hosting | Vercel (global edge) |

---

## Key Features

### For Players
- Quick setup (30 seconds to playing)
- Comprehensive game history
- Personal honor tracking
- Mobile-ready experience

### For Groups
- Real-time room sharing
- Simple 6-digit codes
- Host/viewer separation
- Easy social sharing

### For Communities
- MVP/burden voting
- Professional statistics
- Export for archiving
- Cultural gaming identity

---

## Usage Scenarios

1. **Offline Gathering**: Host manages scoring, others view via room codes
2. **Remote Gaming**: Video call + real-time scoring sync
3. **Tournament**: Official scoring with spectator access
4. **Casual Play**: Quick start presets for family games

---

## Performance

| Metric | Value |
|--------|-------|
| Initial load | <2s (3G) |
| Room sync | <500ms RTT |
| PNG export | <3s |
| Memory | <50MB |

---

## Roadmap

### Current: Player Profiles (Phase 7)
- Persistent player identities
- Career stats and honors
- Game history tracking
- `/players` and `/rooms` browsers

### Future
- Partner/rival statistics
- Achievement badges
- Seasons & leaderboards
- Authentication system

---

## Links

- **Live**: [Production URL]
- **Docs**: See `docs/` directory
- **Spec**: [Player Profile Spec](./features/PLAYER_PROFILE_SPEC.md)
