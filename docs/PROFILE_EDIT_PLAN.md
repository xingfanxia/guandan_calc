# Implementation Plan: Player Profile Editing Feature

**Status**: ⏳ In Progress
**Start Date**: 2025-12-13
**Complexity**: Medium (multi-file, cross-backend-frontend)

---

## Research Summary

### Current State
- Player profiles have 5 editable fields: displayName, emoji, photoBase64, playStyle, tagline
- Handle is immutable (unique identifier)
- Create modal exists with all UI components (src/player/playerCreateModal.js)
- Backend PUT endpoint exists but only handles game stats (api/players/[handle].js)
- Validation functions available in api/players/_utils.js

### What Needs to Be Built
1. Edit modal UI component (reuse create modal patterns)
2. Backend API enhancement to support profile updates
3. Frontend API client function for profile updates
4. Edit button on player-profile.html
5. Integration with existing profile page

---

## Implementation Steps

### Step 1: Create Edit Modal UI Component ⏸️
**File**: `src/player/playerEditModal.js` (NEW)
**Description**: Create new modal component for editing profiles, pre-populated with current data

**Details**:
- Copy structure from playerCreateModal.js
- Remove handle input field (non-editable)
- Add handle display (read-only) at top
- Pre-fill all fields with current player data
- Reuse emoji selector, photo upload, form validation
- Submit button → "保存更改" instead of "创建玩家"

**Code Pattern**:
```javascript
// Key differences from create modal:
// 1. Accept player object as parameter
export function showEditModal(player) {
  // ... modal HTML with pre-filled values
  // displayName: player.displayName
  // emoji: player.emoji (pre-select in grid)
  // photoBase64: player.photoBase64 (show preview if exists)
  // playStyle: player.playStyle (pre-select in dropdown)
  // tagline: player.tagline
}

// 2. Call updatePlayerProfile() instead of createPlayer()
const result = await updatePlayerProfile(player.handle, {
  displayName,
  emoji,
  photoBase64: selectedPhotoBase64,
  playStyle,
  tagline
});
```

**Test**: Open modal with existing player data → fields pre-filled correctly

---

### Step 2: Add Frontend API Client Function ⏸️
**File**: `src/api/playerApi.js:330-360` (INSERT)
**Description**: Add updatePlayerProfile() function to API client

**Code**:
```javascript
/**
 * Update player profile fields (NOT stats)
 * @param {string} handle - Player handle (immutable identifier)
 * @param {Object} updates - Fields to update
 * @param {string} updates.displayName - New display name
 * @param {string} updates.emoji - New emoji avatar
 * @param {string} updates.photoBase64 - New photo (or null to remove)
 * @param {string} updates.playStyle - New play style
 * @param {string} updates.tagline - New tagline
 * @returns {Promise<{success: boolean, player: Object}>}
 */
export async function updatePlayerProfile(handle, updates) {
  try {
    const response = await fetch(`${API_BASE}/api/players/${handle}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mode: 'PROFILE_UPDATE',  // New mode to distinguish from stats updates
        ...updates
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Update profile failed: ${response.statusText}`);
    }

    return result;
  } catch (error) {
    console.error('updatePlayerProfile error:', error);
    throw error;
  }
}
```

**Test**: Call function with test data → returns success response

---

### Step 3: Enhance Backend PUT Endpoint ⏸️
**File**: `api/players/[handle].js:102-112` (MODIFY)
**Description**: Add profile update mode to existing PUT handler

**Change Location**: Right after line 105 (gameResult parsing)

**Code**:
```javascript
// After line 105: const gameResult = await request.json();
// Add mode detection:
const requestData = await request.json();

// Check if this is a profile update (not a game stats update)
if (requestData.mode === 'PROFILE_UPDATE') {
  // Profile update flow
  const updates = requestData;

  // Validate fields
  const validation = validatePlayerData({
    handle,  // For validation only (not updated)
    displayName: updates.displayName,
    emoji: updates.emoji,
    photoBase64: updates.photoBase64,
    playStyle: updates.playStyle,
    tagline: updates.tagline
  });

  if (!validation.valid) {
    return new Response(JSON.stringify({
      error: validation.error
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get existing player
  const playerData = await kv.get(`player:${handle}`);
  if (!playerData) {
    return new Response(JSON.stringify({
      error: 'Player not found'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const player = typeof playerData === 'string' ? JSON.parse(playerData) : playerData;

  // Update ONLY profile fields (not stats)
  if (updates.displayName !== undefined) player.displayName = updates.displayName;
  if (updates.emoji !== undefined) player.emoji = updates.emoji;
  if (updates.photoBase64 !== undefined) player.photoBase64 = updates.photoBase64;
  if (updates.playStyle !== undefined) player.playStyle = updates.playStyle;
  if (updates.tagline !== undefined) player.tagline = updates.tagline;

  // Update lastActiveAt
  player.lastActiveAt = new Date().toISOString();

  // Save to KV
  await kv.set(`player:${handle}`, JSON.stringify(player));

  return new Response(JSON.stringify({
    success: true,
    player: player
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

// Otherwise, continue with game stats update flow (existing code)
const gameResult = requestData;
// ... rest of existing stats update code
```

**Test**: Send PUT with mode='PROFILE_UPDATE' → profile fields updated, stats unchanged

---

### Step 4: Add Edit Button to Profile Page ⏸️
**File**: `player-profile.html:69-75` (MODIFY)
**Description**: Add edit button next to page title

**Change**:
```html
<!-- Replace lines 69-75 -->
<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
  <h1>玩家资料</h1>
  <div>
    <button
      id="editProfileBtn"
      style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 16px; font-size: 14px; font-weight: 500; transition: all 0.2s;"
      onmouseover="this.style.background='#2563eb'"
      onmouseout="this.style.background='#3b82f6'"
    >
      ✏️ 编辑资料
    </button>
    <a href="/players.html" style="color: #3b82f6; text-decoration: none; margin-right: 16px;">浏览所有玩家</a>
    <a href="/" style="color: #3b82f6; text-decoration: none;">返回游戏</a>
  </div>
</div>
```

**Test**: Edit button appears on profile page, styled correctly

---

### Step 5: Wire Up Edit Button Handler ⏸️
**File**: `player-profile.html:84-560` (MODIFY - in script section)
**Description**: Import edit modal and add click handler

**Add imports** (after line 85):
```javascript
import { showEditModal, initializeEditModal } from '/src/player/playerEditModal.js';
```

**Add handler** (after profile loads, around line 560):
```javascript
// After profile is loaded and rendered
const editBtn = document.getElementById('editProfileBtn');
if (editBtn && player) {
  // Initialize edit modal with callback
  initializeEditModal((updatedPlayer) => {
    console.log('Profile updated:', updatedPlayer);
    // Reload page to show updated data
    window.location.reload();
  });

  editBtn.addEventListener('click', () => {
    showEditModal(player);
  });
}
```

**Test**: Click edit button → modal opens with pre-filled data

---

### Step 6: Handle Photo Removal ⏸️
**File**: `src/player/playerEditModal.js` (in photo upload section)
**Description**: Add "Remove Photo" button for users with existing photos

**Code Pattern**:
```javascript
// In photo upload section, if player has photoBase64:
if (player.photoBase64) {
  // Show current photo with remove option
  <div id="currentPhotoSection">
    <img src="${player.photoBase64}" style="width: 120px; height: 120px; border-radius: 50%; border: 2px solid #22c55e;" />
    <button type="button" id="removePhotoBtn" style="...">
      🗑️ 移除照片
    </button>
  </div>
}

// Handler:
removePhotoBtn.addEventListener('click', () => {
  selectedPhotoBase64 = null;  // Will send null to clear photo
  currentPhotoSection.style.display = 'none';
  photoUploadContainer.style.display = 'block';
});
```

**Test**: User with photo can remove it → photo cleared in profile

---

### Step 7: Security Consideration (Optional - Discuss with User)
**Decision Needed**: Should profile edits require admin token?

**Option A: Open Editing (Simpler)**
- Any user can edit any profile
- Pros: Easy to use, no auth needed
- Cons: No protection against vandalism
- Good for: Trusted friend groups

**Option B: Admin Token Required (Secure)**
- Require `xiaofei0214` token like delete/reset
- Pros: Protected from unauthorized edits
- Cons: Only admin can edit profiles
- Good for: Public deployments

**Recommendation**: Start with Option A (open), add Option B later if needed.

---

### Step 8: Add Success/Error Feedback ⏸️
**File**: `src/player/playerEditModal.js` (in submit handler)
**Description**: Show user-friendly messages after save attempt

**Code**:
```javascript
// After updatePlayerProfile call:
try {
  const result = await updatePlayerProfile(player.handle, payload);

  if (result.success) {
    // Success message
    alert('✅ 资料更新成功！');
    if (onPlayerUpdatedCallback) {
      onPlayerUpdatedCallback(result.player);
    }
    closeModal();
  }
} catch (error) {
  console.error('Update error:', error);

  // Show specific error message
  if (formError) {
    if (error.message.includes('Unauthorized')) {
      formError.textContent = '❌ 权限不足，无法修改资料';
    } else if (error.message.includes('not found')) {
      formError.textContent = '❌ 玩家不存在';
    } else {
      formError.textContent = `❌ ${error.message}`;
    }
    formError.style.display = 'block';
  }

  // Re-enable submit button
  submitButton.textContent = '保存更改';
  submitButton.disabled = false;
}
```

**Test**: Successful update → success message; error → specific error shown

---

## Progress Log

| Step | Status | Notes | Commit |
|------|--------|-------|--------|
| 1. Edit modal UI | ⏸️ Pending | Reuse create modal patterns | |
| 2. API client function | ⏸️ Pending | Add updatePlayerProfile() | |
| 3. Backend PUT enhancement | ⏸️ Pending | Add PROFILE_UPDATE mode | |
| 4. Edit button | ⏸️ Pending | Add to profile page header | |
| 5. Wire handler | ⏸️ Pending | Connect button to modal | |
| 6. Photo removal | ⏸️ Pending | Handle null photoBase64 | |
| 7. Security decision | ⏸️ Discuss | Admin token or open editing? | |
| 8. User feedback | ⏸️ Pending | Success/error messages | |

---

## Testing Protocol

### Unit Tests
- [ ] Edit modal opens with pre-filled data
- [ ] Emoji selection updates correctly
- [ ] Photo upload works (new photo)
- [ ] Photo removal works (set to null)
- [ ] Validation catches invalid inputs
- [ ] Profile fields update correctly
- [ ] Stats remain unchanged

### Integration Tests
- [ ] Full flow: Open modal → Edit → Save → Page reloads with new data
- [ ] Profile page reflects changes immediately
- [ ] Player browser shows updated data
- [ ] Game session uses updated emoji/display name
- [ ] Multiple edits in sequence work

### Edge Cases
- [ ] Update with same data (no-op)
- [ ] Update with very long tagline (should fail validation)
- [ ] Update with invalid play style (should fail validation)
- [ ] Update with oversized photo (should fail validation)
- [ ] Concurrent updates from different tabs (last write wins)

---

## Security Considerations

### Current Design (Open Editing)
1. **No Admin Token**: Any user can edit profiles (simplicity)
2. **Immutable Handle**: Backend NEVER updates handle field
3. **Validation**: All fields validated server-side (never trust client)
4. **Photo Size**: 150KB limit enforced (prevent storage bloat)
5. **CORS**: Proper headers for cross-origin requests

### Future Enhancement (if needed)
- Add admin token requirement (like delete/reset APIs)
- Add edit history/audit log
- Add "Claim Profile" system with passwords

---

## Rollback Plan

If issues arise:
1. Remove edit button from player-profile.html (disable feature)
2. Revert backend changes (remove PROFILE_UPDATE mode)
3. Remove playerEditModal.js and API client function
4. Previous version remains functional (read-only profiles)

---

## Files to Create/Modify

### New Files (1)
- `src/player/playerEditModal.js` - Edit modal component (~450 lines)

### Modified Files (3)
- `src/api/playerApi.js` - Add updatePlayerProfile() (~40 lines)
- `api/players/[handle].js` - Add PROFILE_UPDATE mode (~80 lines)
- `player-profile.html` - Add edit button + handler (~30 lines)

### Total Estimated Lines
- **Total: ~600 lines**

---

## Notes for Implementation

### Key Decisions Made
1. ✅ Reuse create modal patterns (DRY principle)
2. ✅ Mode-based API design (PROFILE_UPDATE vs game stats)
3. ✅ Photo removal with null value (simple)
4. ⏸️ Security: Start open, add auth later if needed

### Questions for User
1. **Security**: Should profile edits require admin password? (Recommend: No for now)
2. **Confirmation**: Show "Are you sure?" before saving? (Recommend: No, just show success)
3. **History**: Track edit history for audit? (Recommend: Future enhancement)

---

## Next Actions

**User Approval Needed:**
- [ ] Review plan for completeness
- [ ] Approve security approach (open editing)
- [ ] Confirm UI patterns (reuse create modal)
- [ ] Give go-ahead to proceed with implementation

**After Approval:**
- [ ] Create playerEditModal.js (Step 1)
- [ ] Add API client function (Step 2)
- [ ] Enhance backend endpoint (Step 3)
- [ ] Continue with remaining steps...

---

**Ready for Phase 3 (Implementation) after user approval!** 🚀
