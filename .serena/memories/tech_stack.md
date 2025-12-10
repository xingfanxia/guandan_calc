# Technology Stack

## Frontend
- **Language**: Vanilla JavaScript (ES6 modules)
- **Build System**: Vite 5.0+
- **Module System**: ES6 import/export
- **Type**: No TypeScript, pure JavaScript
- **Character Encoding**: UTF-8 for full Chinese character support

## Backend
- **Runtime**: Vercel Edge Functions (serverless)
- **API Framework**: Vercel Serverless Functions
- **Database**: Vercel KV (Upstash Redis)
- **Deployment**: Vercel (global edge network)

## Architecture
- **Modular Design**: 20 ES6 modules organized by domain:
  - `src/core/` - Foundation layer (utils, storage, events, state, config)
  - `src/game/` - Game mechanics (calculator, rules, history)
  - `src/player/` - Player management (playerManager, renderer, dragDrop, touchHandler)
  - `src/ranking/` - Ranking system (manager, renderer, calculator)
  - `src/stats/` - Statistics (statistics, honors)
  - `src/ui/` - UI components (teamDisplay, victoryModal)
  - `src/export/` - Export functionality (exportHandlers, exportMobile)
  - `src/share/` - Real-time features (roomManager, shareManager, votingManager)

## Dependencies
- **Production**: @vercel/kv (^3.0.0) for real-time room data storage
- **Dev**: vite (^5.0.0) for build and development server

## Data Storage
- **LocalStorage**: Individual user data (`gd_v9_*` keys)
- **Vercel KV**: Shared room data with TTL (24h default, 1 year for favorites)

## Performance
- Sub-second sync for real-time updates
- Global CDN via Vercel edge network
- Smart polling (UI updates only on data changes)
- Optimized production builds via Vite bundling
