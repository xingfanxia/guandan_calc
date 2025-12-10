# Codebase Structure

## Project Root
```
/
├── src/               # Source code (ES6 modules)
├── api/               # Vercel Edge Functions
├── docs/              # Comprehensive documentation
├── public/            # Static assets
├── dist/              # Build output (generated)
├── index.html         # Entry HTML file
├── package.json       # Dependencies and scripts
├── vite.config.js     # Vite configuration
├── vercel.json        # Vercel deployment config
└── CLAUDE.md          # AI assistant instructions
```

## Source Code (`src/`)

### Core Layer (`src/core/`)
Foundation modules used across the application:
- `utils.js` - DOM helpers ($, on, now)
- `storage.js` - localStorage wrapper with gd_v9_* keys
- `events.js` - Pub/sub event system (on, emit, off, once)
- `state.js` - Game state singleton (GameState class)
- `config.js` - Settings manager with defaults

### Game Logic (`src/game/`)
Core game mechanics and rules:
- `calculator.js` - Pure calculation functions (parseRanks, calculateUpgrade, nextLevel)
- `rules.js` - A-level logic and rule application (checkALevelRules, applyGameResult)
- `history.js` - History rendering, rollback, and reset

### Player System (`src/player/`)
Player management and interaction:
- `playerManager.js` - Player data management with 77+ emoji avatars
- `playerRenderer.js` - Player tile rendering and team display
- `dragDrop.js` - Desktop drag-and-drop handlers
- `touchHandler.js` - Mobile touch event handling (200ms long-press)

### Ranking System (`src/ranking/`)
Ranking interface and calculation:
- `rankingManager.js` - Ranking state management
- `rankingRenderer.js` - Ranking UI with drag-drop integration
- `rankingCalculator.js` - Bridge to game calculator

### Statistics (`src/stats/`)
Player statistics and honors:
- `statistics.js` - Stats tracking, MVP/burden identification
- `honors.js` - 14 data-driven honor calculations

### UI Components (`src/ui/`)
User interface elements:
- `teamDisplay.js` - Team styling and display utilities
- `victoryModal.js` - Victory celebration with END-GAME VOTING

### Export (`src/export/`)
Data export functionality:
- `exportHandlers.js` - TXT/CSV export functions
- `exportMobile.js` - Mobile PNG generation (600px optimized)

### Share (`src/share/`)
Real-time features:
- `roomManager.js` - Room creation, sync, and management
- `shareManager.js` - Room code sharing and viewer links
- `votingManager.js` - Anonymous voting system

### Entry Point
- `main.js` - Application initialization, event binding, module coordination

## API Routes (`api/rooms/`)
Vercel Edge Functions for real-time features:
- `create.js` - Generate 6-digit room codes, initialize KV storage
- `[code].js` - GET/PUT room data with auth token validation
- `vote/[code].js` - Submit anonymous viewer votes
- `reset-vote/[code].js` - Clear voting results after confirmation
- `favorite/[code].js` - Toggle favorite status (1-year TTL)
- `list.js` - Retrieve all favorited rooms

## Documentation (`docs/`)
Organized documentation:
- `architecture/` - System design documents
- `features/` - Feature specifications (including PLAYER_PROFILE_SPEC.md)
- `guides/` - Development and deployment guides
- Root level docs for overview and game rules

## Key Files
- `index.html` - Entry point, loads `src/main.js`
- `src/style.css` - Global styles
- `package.json` - Dependencies and npm scripts
- `vite.config.js` - Vite build configuration (port 3000)
- `vercel.json` - Vercel deployment settings (build command, output dir)
- `.env.example` - Template for environment variables
- `.env.local` - Local environment variables (not in git)

## Legacy Reference
- `src/app.js` - Original 1,947-line monolithic implementation (preserved for reference)
