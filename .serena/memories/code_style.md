# Code Style and Conventions

## Language and Modules
- **Module System**: ES6 modules with explicit imports/exports
- **File Extensions**: `.js` for all JavaScript files
- **No TypeScript**: Pure JavaScript without type annotations

## Naming Conventions
- **Functions**: camelCase (e.g., `calculateUpgrade`, `renderPlayerTile`)
- **Variables**: camelCase (e.g., `gameState`, `playerData`)
- **Constants**: camelCase for module-level constants (e.g., `gameState`, `config`)
- **Classes**: PascalCase (e.g., `GameState`, `PlayerManager`)
- **Private/Internal**: No special prefix, rely on module scope

## Code Organization
- **Single Responsibility**: Each module handles one domain concern
- **Pub/Sub Events**: Use `events.js` for cross-module communication
- **State Management**: Centralized in `state.js` via singleton `GameState` class
- **Storage Keys**: Prefixed with `gd_v9_*` for versioning (e.g., `gd_v9_settings`, `gd_v9_state`)

## Function Structure
- **Pure Functions**: Prefer pure functions for calculations (see `game/calculator.js`)
- **Side Effects**: Isolate side effects in dedicated modules (storage, DOM updates)
- **Parameters**: Use object destructuring for multiple parameters when appropriate
- **Return Values**: Always return explicit values, avoid implicit undefined

## Comments and Documentation
- **Inline Comments**: Used sparingly, only for complex logic or non-obvious decisions
- **Chinese Characters**: Comments may include Chinese explanations for cultural gaming terms
- **JSDoc**: Not consistently used, minimal documentation in code
- **External Docs**: Comprehensive documentation in `docs/` directory

## DOM Manipulation
- **Selectors**: Use utility functions from `core/utils.js` (`$`, `on`, `now`)
- **Event Handling**: Centralized event binding in `main.js` and module event handlers
- **HTML Templates**: String concatenation or template literals, no JSX

## Error Handling
- **API Calls**: Try-catch blocks for network requests
- **User Input**: Validation at entry points
- **Edge Cases**: Handled within business logic functions

## Module Exports
- **Default Exports**: Used for singleton objects (e.g., `export default gameState`)
- **Named Exports**: Used for multiple utilities from a module
- **No Barrel Exports**: Direct imports, no index.js re-exports
