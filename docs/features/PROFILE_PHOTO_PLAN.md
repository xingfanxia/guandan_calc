# Profile Photo Feature - Implementation Plan

**Status**: ✅ COMPLETE  
**Implemented**: 2025-12-11  
**Commits**: 15+ commits  
**Bundle Impact**: playerCreateModal 14KB → 18KB (+4KB)

## Implementation Status

- ✅ **Phase 1**: Backend Schema (Complete)
- ✅ **Phase 2**: Upload UI (Complete - Simplified, no cropper)
- ✅ **Phase 3**: Display Helper (Complete - photoRenderer.js)
- ✅ **Phase 4**: Display Contexts (Complete - 2 pages only)
- ✅ **Phase 5**: PNG Export (Complete - async with 320px photo)

**Final Implementation**: Simpler than planned!
- Removed Cropper.js (complex, 60KB)
- Simple square image upload with auto-crop center
- Canvas-based resize to 400x400 JPEG
- Display only in profile pages (not game tiles)

---

## Overview
Allow users to upload and crop square profile photos to replace emojis throughout the app.

## Technical Decisions

### Storage
- **Method**: Base64 encoding in Vercel KV
- **Format**: JPEG at 80% quality
- **Size**: 400x400px max (30-50KB original → 40-66KB base64)
- **Rationale**: Simpler than Vercel Blob, well within KV 1MB limit

### Crop Library
- **Library**: Cropper.js (20KB, touch-friendly)
- **Aspect Ratio**: 1:1 (square enforced)
- **Features**: Touch support for mobile, preview, zoom

## Implementation Steps

### Phase 1: Backend Schema (15 min)
- [ ] Add `photoBase64` field to player schema in `api/players/_utils.js`
- [ ] Update validation to make it optional
- [ ] Update `[handle].js` API to accept photo data

### Phase 2: Upload & Crop UI (45-60 min)
- [ ] Install cropperjs: `npm install cropperjs` ✅ DONE
- [ ] Import Cropper.js CSS and JS in `playerCreateModal.js`
- [ ] Add file input to modal
- [ ] Create crop preview area
- [ ] Initialize Cropper instance on image load
- [ ] Convert cropped canvas to base64 JPEG
- [ ] Include in player creation payload

### Phase 3: Display Helper (30 min)
- [ ] Create `player/photoRenderer.js` utility
- [ ] Function: `renderPlayerAvatar(player, size)`
  - Returns `<img>` if photoBase64 exists
  - Returns emoji `<span>` otherwise
  - Sizes: 20px, 24px, 32px, 48px, 72px
  - Style: circular with border
- [ ] Handle image load errors (fallback to emoji)

### Phase 4: Update All Display Contexts (30 min)
- [ ] `player/playerRenderer.js` - Player tiles (32px)
- [ ] `ranking/rankingRenderer.js` - Ranking tiles (32px)
- [ ] `ui/panelManager.js` - Compact roster (24px)
- [ ] `game/history.js` - History display (20px)
- [ ] `players.html` - Browser cards (48px)
- [ ] `player-profile.html` - Profile header (72px)

### Phase 5: PNG Export (30-45 min)
- [ ] Update `export/exportMobile.js`
- [ ] Make export function async
- [ ] Load images with `new Image()` and wait for `onload`
- [ ] Use `ctx.drawImage()` for photos
- [ ] Use `Promise.all()` for multiple player images
- [ ] Fallback to emoji text if image fails

## Display Sizes by Context

| Context | Avatar Type | Size | Shape | Border |
|---------|-------------|------|-------|--------|
| Player tiles | **Emoji only** | 32px | - | - |
| Ranking tiles | **Emoji only** | 32px | - | - |
| Profile browser (players.html) | **Photo or Emoji** | 64px | Circular | 2px solid |
| Profile page header (player-profile.html) | **Photo or Emoji** | 120px | Circular | 3px solid |
| Compact roster | **Emoji only** | 24px | - | - |
| History display | **Emoji only** | 20px | - | - |
| Victory modal | **Emoji only** | 40px | - | - |
| PNG export | **Emoji only** | - | - | - |

**Rationale:** 
- Small contexts (tiles, history, roster) look better with emoji
- Large contexts (browser cards, profile header) showcase photos nicely
- Simpler implementation - only 2 places to update

## Data Structure

### Player Object (Enhanced)
```javascript
{
  handle: 'fufu',
  displayName: '夫夫',
  emoji: '🦊',
  photoBase64: 'data:image/jpeg;base64,/9j/4AAQ...', // Optional
  playStyle: 'chill',
  tagline: '躺平快乐'
}
```

### Avatar Rendering Logic
```javascript
function renderAvatar(player, size) {
  if (player.photoBase64) {
    return `<img src="${player.photoBase64}"
                 style="width:${size}px; height:${size}px;
                        border-radius:50%; object-fit:cover;
                        border: 2px solid #444;"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
            <span style="display:none; font-size:${size}px;">${player.emoji}</span>`;
  }
  return `<span style="font-size:${size}px;">${player.emoji}</span>`;
}
```

## Testing Checklist

- [ ] Upload photo in creation modal
- [ ] Crop to square
- [ ] Photo appears in all player tiles
- [ ] Photo appears in ranking
- [ ] Photo appears in profile page
- [ ] Photo appears in history
- [ ] Photo renders in PNG export
- [ ] Fallback to emoji on load error
- [ ] Works on mobile touch
- [ ] Build size acceptable

## Risks & Mitigation

**Risk**: Large base64 strings bloat KV storage
- **Mitigation**: Limit to 400x400, JPEG 80%, ~50KB per photo

**Risk**: PNG export async breaks existing code
- **Mitigation**: Update all export calls to handle Promise

**Risk**: Image load failures
- **Mitigation**: onerror handler shows emoji fallback

## Success Criteria

✅ Users can upload and crop profile photos
✅ Photos display correctly at all sizes
✅ Photos render in PNG exports
✅ Emoji fallback works
✅ Mobile-friendly
✅ Build passes
