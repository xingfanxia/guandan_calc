# Design Patterns and Guidelines

## Architectural Patterns

### Module Pattern
- **ES6 Modules**: All code organized as ES6 modules with explicit imports/exports
- **Single Responsibility**: Each module handles one domain (player, ranking, stats, etc.)
- **No Barrel Exports**: Direct imports from modules, no index.js re-exports

### Singleton Pattern
- **GameState**: Centralized state management via singleton class in `core/state.js`
- **Config**: Global configuration object in `core/config.js`
- **Storage**: localStorage wrapper as singleton in `core/storage.js`

### Observer Pattern (Pub/Sub)
- **Events System**: `core/events.js` provides pub/sub for cross-module communication
- **Decoupling**: Modules emit events instead of direct function calls
- **Event Names**: Use descriptive names (e.g., 'game:updated', 'player:moved', 'ranking:applied')

### Strategy Pattern
- **Game Rules**: Different strategies for 4/6/8 player modes
- **A-Level Rules**: Strict vs lenient mode strategies
- **Export Formats**: Different strategies for TXT/CSV/PNG exports

## Key Design Decisions

### State Management
- **Centralized State**: Single GameState singleton holds all game data
- **Immutability**: State mutations through controlled methods only
- **Persistence**: Automatic localStorage sync on state changes
- **Versioning**: Storage keys prefixed with `gd_v9_*` for version isolation

### Event-Driven Architecture
- **Cross-Module Communication**: Use events instead of direct imports
- **UI Updates**: UI components subscribe to state change events
- **Loose Coupling**: Modules don't need to know about each other

### Real-Time Synchronization
- **Host Auto-Sync**: Every 10 seconds + immediate on critical actions
- **Viewer Polling**: Every 5 seconds with smart change detection
- **Optimistic Updates**: UI updates immediately, then syncs to server
- **Auth Tokens**: Host-only control via secure tokens

### Mobile-First Interactions
- **Touch Events**: Custom long-press drag (200ms threshold)
- **Responsive Design**: Mobile and desktop optimized
- **Touch Feedback**: Visual clones and drop zone highlights

## Code Organization Principles

### Separation of Concerns
- **Pure Functions**: Calculations separated from side effects
- **Data vs Presentation**: Business logic separated from rendering
- **Storage Abstraction**: Direct localStorage access only in `storage.js`

### DRY (Don't Repeat Yourself)
- **Utility Functions**: Common DOM operations in `core/utils.js`
- **Reusable Renderers**: Player and ranking renderers used across features
- **Shared Config**: Settings centralized in `core/config.js`

### Progressive Enhancement
- **Core Functionality First**: Basic game works without real-time features
- **Feature Detection**: Touch events used only when available
- **Graceful Degradation**: Fallbacks for older browsers

## Data Flow

### Game Action Flow
1. User interaction (UI)
2. Event handler in module
3. State update via GameState methods
4. Event emitted ('game:updated')
5. Subscribers update UI
6. localStorage auto-save
7. Room sync (if host)

### Real-Time Room Flow
1. Host creates room → API generates code → KV storage
2. Host actions → Auto-sync to KV (10s + immediate)
3. Viewers poll → GET from KV (5s interval)
4. Smart updates → UI updates only on changes

### Honor Calculation Flow
1. Game completes
2. Statistics module processes history
3. 14 algorithms calculate scores
4. Results displayed with clickable explanations
5. Exported in all formats

## Naming Guidelines

### Events
- Format: `domain:action` (e.g., 'game:updated', 'player:moved')
- Use past tense for completed actions
- Use present tense for ongoing actions

### Functions
- Verb-first: `calculateUpgrade`, `renderPlayerTile`, `applyGameResult`
- Boolean functions: `isGameOver`, `hasALevelFailed`, `canUpgrade`
- Handlers: `handlePlayerDrag`, `onRankingApply`, `setupEventListeners`

### Variables
- Descriptive: `currentRound`, `teamLevels`, `playerHistory`
- Avoid abbreviations except common ones (e.g., `idx` for index)
- Arrays: Plural names (e.g., `players`, `rankings`, `honors`)

## Cultural Considerations

### Chinese Gaming Terms
- Honor names use Chinese characters with cultural significance
- Comments may include Chinese explanations for context
- UTF-8 encoding throughout for proper character support

### Game-Specific Logic
- A-level rules are complex - always reference `src/app.js` for working implementation
- roundOwner tracking is critical for strict mode
- 8-player sweep bonus is a special case to handle

## Anti-Patterns to Avoid

### Don't
- ❌ Direct localStorage access outside `storage.js`
- ❌ Direct state mutations (use GameState methods)
- ❌ Tight coupling between unrelated modules
- ❌ Global variables (use module scope or state)
- ❌ Mixed responsibilities in single module
- ❌ Inline styles (use CSS classes)
- ❌ Hard-coded values (use config)

### Do
- ✅ Use events for cross-module communication
- ✅ Keep functions pure when possible
- ✅ Use utility functions from `core/utils.js`
- ✅ Follow existing module patterns
- ✅ Maintain single responsibility per module
- ✅ Use semantic CSS classes
- ✅ Store settings in config
