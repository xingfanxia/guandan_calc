# Mobile Touch Issue - Ranking Tiles

**Date**: 2025-12-07
**Status**: Unresolved
**Priority**: Medium

## Problem Description

**Symptom**: Touch drag doesn't work on ranking pool tiles on real mobile devices (iOS Chrome tested)

**Specific Issue**:
- ❌ Cannot drag tiles from player pool to ranking slots on initial page load
- ✅ Team assignment tiles work fine (can drag between teams)
- ✅ Works perfectly in Chrome DevTools mobile simulator
- ✅ Works after clicking "随机排名" (random ranking) button
- ✅ Works after clicking "清空排名" (clear ranking) button

## What Works

1. **Desktop**: Full drag/drop works perfectly
2. **Chrome DevTools Simulator**: Touch drag works
3. **Mobile after random/clear ranking**: Touch works

## What Doesn't Work

1. **Real iOS Chrome**: Initial load - cannot drag pool tiles to ranking

## Investigation

### Observations

**Key Finding**: Touch works AFTER triggering ranking events:
- Click "随机排名" → Touch works
- Click "清空排名" → Touch works
- Initial load → Touch doesn't work

**What these actions have in common**:
- Both trigger `ranking:updated` or `ranking:cleared` events
- Both call `attachTouchHandlersToAllTiles()`
- Touch starts working immediately after

### Hypothesis

**Touch handlers not attached on initial render for ranking tiles**

Evidence:
- Team tiles work (handlers attached during `renderPlayers()`)
- Ranking tiles don't work initially
- After ranking event → tiles recreated/handlers reattached → works

## Attempted Fixes

### Attempt 1: Add playerData to ranking tiles
**Commit**: 939c50d
**Result**: No change
**Reasoning**: Thought detection was failing

### Attempt 2: Add inline touch handlers (like original)
**Commit**: 7a28227
**Result**: No change
**Reasoning**: Original app.js attaches inline

### Attempt 3: Call attachTouchHandlersToAllTiles after renderRankingArea
**Commit**: dea1ccb
**Result**: No change
**Reasoning**: Ensure handlers attach after rendering

### Attempt 4: Use setTimeout(100ms)
**Commit**: 9055e3e
**Result**: No change
**Reasoning**: Give DOM time to update

### Attempt 5: Increase to setTimeout(1000ms)
**Commit**: b183478
**Result**: Not tested yet
**Reasoning**: Mobile DOM might need more time

## Code Comparison

### Original app.js (WORKS on mobile)
```javascript
// Touch events attached INLINE when creating tile
tile.addEventListener('touchstart', function(e) {
  handleTouchStart(e, player);
}, { passive: false });
```

### Modular version (doesn't work initially)
```javascript
// Handlers attached via separate function
attachTouchHandlers(tile, player, handleTouchStart, handleTouchMove, handleTouchEnd);
```

**Both use same addEventListener with passive:false**

## Theories

### Theory 1: Timing Issue
- Ranking tiles created asynchronously
- attachTouchHandlersToAllTiles runs before tiles exist
- After random ranking, tiles definitely exist → works

**Evidence**:
- setTimeout delays don't fix it
- But event-triggered attachment works

### Theory 2: Handler Lifecycle
- Handlers attached but then removed/overwritten
- Something in initial render clears them
- Event handlers reattach fresh → works

**Evidence**:
- Team tiles work (rendered differently)
- Ranking tiles don't (rendered differently)

### Theory 3: iOS Safari Specifics
- iOS handles touch events differently than Chrome
- Simulator uses desktop Chrome engine → works
- Real iOS Safari → doesn't work
- Something about initial state prevents touch

**Evidence**:
- Works in simulator
- Doesn't work on real phone
- Same code, different behavior

## Next Steps

1. **Debug with on-screen logging**: See if tiles found (commit 048153d)
2. **Try requestAnimationFrame**: Instead of setTimeout
3. **Try MutationObserver**: Attach handlers when tiles appear in DOM
4. **Compare original vs modular**: Side-by-side code review
5. **Test on Android**: See if iOS-specific

## Workaround

**Current user workaround**: Click "随机排名" or "清空排名" once to enable touch.

Not ideal but functional.

## Files Involved

- `src/player/touchHandler.js` - Touch event logic
- `src/player/playerRenderer.js` - Touch handler attachment
- `src/ranking/rankingRenderer.js` - Ranking tile creation
- `src/main.js` - attachTouchHandlersToAllTiles() and initial render

## Related Commits

- 939c50d: Add playerData to ranking tiles
- 7a28227: Inline touch handlers
- dea1ccb: Call attach after render
- 9055e3e: setTimeout(100)
- b183478: setTimeout(1000)
- 048153d: On-screen debug

## Original Code Reference

`src/app.js` lines 188-381, 711-718, 962-969 - Touch drag implementation that WORKS on mobile.

---

**Status**: Documented for future investigation. Workaround available.
