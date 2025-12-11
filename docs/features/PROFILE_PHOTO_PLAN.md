# Profile Photo Feature - Implementation Plan

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

| Context | Size | Shape | Border |
|---------|------|-------|--------|
| Player tiles | 32x32px | Circular | 2px solid |
| Ranking tiles | 32x32px | Circular | 2px solid |
| Profile header | 72x72px | Circular | 3px solid |
| Profile browser | 48x48px | Circular | 2px solid |
| Compact roster | 24x24px | Circular | 1px solid |
| History display | 20x20px | Circular | 1px solid |
| Victory modal | 40x40px | Circular | 2px solid |

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
