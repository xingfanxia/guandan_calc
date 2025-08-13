# Modular Architecture Plan

## Module Structure

### 1. Core Modules

#### `gameState.js`
- Player management (add, remove, edit, assign teams)
- Team state (levels, A-failures, names, colors)
- Ranking state management
- Round level tracking
- Settings (autoApply, autoNext, strictA, must1)
- Persistence to localStorage

#### `calculator.js`
- Scoring calculations for 4/6/8 player modes
- Custom rule management
- A-level special rules
- Level advancement logic
- Victory detection

#### `statistics.js`
- Player statistics tracking
- Team MVP/Burden calculation
- Win streak tracking
- Average ranking calculations
- Game history management
- Historical data queries

#### `history.js`
- Match history storage
- Undo/redo functionality
- History entry management
- History export formatting

### 2. UI Modules

#### `ui/playerUI.js`
- Player tile creation
- Player pool rendering
- Team zone rendering
- Player name editing UI

#### `ui/rankingUI.js`
- Ranking slot creation
- Ranking area management
- Ranking status display
- Clear/random ranking buttons

#### `ui/resultsUI.js`
- Result display
- Winner selection buttons
- Apply/advance buttons
- Victory modal

#### `ui/statsUI.js`
- Statistics table rendering
- MVP/Burden display
- History table rendering
- Team stats display

#### `ui/settingsUI.js`
- Custom rules interface
- Settings toggles
- Team name/color editors

### 3. Interaction Modules

#### `dragDrop.js`
- Unified drag-drop for mouse and touch
- Player tile dragging
- Team assignment drops
- Ranking drops
- Visual feedback

#### `events.js`
- Event delegation
- Button click handlers
- Input change handlers
- Modal interactions

### 4. Utility Modules

#### `export.js`
- TXT export
- CSV export
- PNG export (canvas)
- Long PNG export
- Clipboard operations

#### `storage.js`
- localStorage wrapper
- State serialization
- Migration handling
- Data validation

#### `utils.js`
- DOM helpers
- Date formatting
- Random generators
- Validation functions

### 5. Main Application

#### `app.js`
- Module orchestration
- Initialization
- State management
- Event coordination
- Render cycles

## State Management Flow

```
User Action → Event Handler → State Update → Storage Save → UI Render
                    ↓
              Calculation/Logic
                    ↓
              Statistics Update
                    ↓
              History Update
```

## Data Flow

1. **Initialization**:
   - Load settings from storage
   - Load game state from storage
   - Initialize UI components
   - Bind event handlers

2. **Player Management**:
   - Generate players → Update state → Render player pool
   - Assign teams → Update state → Render team zones
   - Edit names → Update state → Save to storage

3. **Ranking Flow**:
   - Drag player → Update ranking state → Check completion
   - If complete → Auto-calculate → Display results
   - Apply results → Update team levels → Add to history

4. **History Management**:
   - Each round → Create history entry → Update statistics
   - Undo → Restore previous state → Recalculate stats
   - Export → Format data → Generate output

## Module Dependencies

```
app.js
  ├── gameState.js
  ├── calculator.js
  ├── statistics.js
  ├── history.js
  ├── dragDrop.js
  ├── events.js
  ├── export.js
  ├── storage.js
  ├── utils.js
  └── ui/
      ├── playerUI.js
      ├── rankingUI.js
      ├── resultsUI.js
      ├── statsUI.js
      └── settingsUI.js
```

## Key Improvements in Modular Version

1. **Separation of Concerns**: Each module has a single responsibility
2. **Testability**: Modules can be unit tested independently
3. **Maintainability**: Easy to locate and modify specific features
4. **Reusability**: UI components and utilities can be reused
5. **Performance**: Lazy loading and optimized rendering
6. **Type Safety**: Ready for TypeScript migration
7. **Scalability**: Easy to add new features or game modes

## Migration Strategy

1. Create all module files with exports
2. Move logic from monolithic HTML to appropriate modules
3. Update UI to use module functions
4. Add event delegation through events module
5. Test each feature thoroughly
6. Add missing features identified in analysis
7. Optimize and refactor