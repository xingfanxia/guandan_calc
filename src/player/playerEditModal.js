// Player Edit Modal
// Modal UI for editing existing player profiles

import { updatePlayerProfile, validateHandle, getPlayStyles } from '../api/playerApi.js';
import { $ } from '../core/utils.js';

// Import emoji list from playerManager
import { ANIMAL_EMOJIS } from './playerManager.js';

let onPlayerUpdatedCallback = null;
let modalElement = null;
let selectedPhotoBase64 = null;
let currentPlayer = null;

/**
 * Initialize player edit modal
 * @param {Function} onPlayerUpdated - Callback when player is updated
 */
export function initializeEditModal(onPlayerUpdated) {
  onPlayerUpdatedCallback = onPlayerUpdated;
}

/**
 * Show edit player modal
 * @param {Object} player - Player object to edit
 */
export function showEditModal(player) {
  if (!player) {
    console.error('Cannot show edit modal without player data');
    return;
  }

  currentPlayer = player;
  selectedPhotoBase64 = player.photoBase64 || null;

  // Remove existing modal if any
  if (modalElement) {
    modalElement.remove();
  }

  // Create modal HTML
  modalElement = document.createElement('div');
  modalElement.id = 'editPlayerModal';
  modalElement.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;

  const playStyles = getPlayStyles();

  modalElement.innerHTML = `
    <div style="background: #1a1a1a; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto; border: 1px solid #333;">
      <h2 style="margin-top: 0; margin-bottom: 20px;">编辑玩家资料</h2>

      <!-- Read-only Handle Display -->
      <div style="background: #0b0b0c; border: 1px solid #333; border-radius: 6px; padding: 12px; margin-bottom: 20px;">
        <div style="color: #888; font-size: 0.85em; margin-bottom: 4px;">用户名 (不可修改)</div>
        <div style="font-size: 18px; font-weight: bold; color: #3b82f6;">@${player.handle}</div>
      </div>

      <form id="editPlayerForm">
        <!-- Display Name -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-weight: bold;">
            昵称 <span style="color: #ef4444;">*</span>
          </label>
          <input
            type="text"
            id="displayNameInput"
            placeholder="小明"
            value="${player.displayName || ''}"
            style="width: 100%; padding: 8px 12px; background: #0b0b0c; border: 1px solid #333; border-radius: 6px; color: white;"
            required
          />
        </div>

        <!-- Emoji & Photo -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-weight: bold;">
            头像表情 <span style="color: #ef4444;">*</span>
          </label>

          <!-- Emoji selector (always visible, required) -->
          <div id="emojiSelector" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); gap: 8px; max-height: 200px; overflow-y: auto; padding: 8px; background: #0b0b0c; border: 1px solid #333; border-radius: 6px;">
            ${ANIMAL_EMOJIS.map(emoji => {
              const isSelected = emoji === player.emoji;
              return `
                <button type="button" class="emoji-option" data-emoji="${emoji}" style="font-size: 24px; padding: 8px; background: ${isSelected ? '#1a2e1a' : 'transparent'}; border: 2px solid ${isSelected ? '#22c55e' : 'transparent'}; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                  ${emoji}
                </button>
              `;
            }).join('')}
          </div>
          <input type="hidden" id="emojiInput" value="${player.emoji || ''}" required />
          <div style="color: #888; font-size: 0.85em; margin-top: 6px;">
            必选 - 用于游戏中显示，也是照片加载失败时的备用头像
          </div>
        </div>

        <!-- Profile Photo Section -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-weight: bold;">
            📷 个人照片 (可选)
          </label>

          <!-- Current photo (if exists) -->
          ${player.photoBase64 ? `
            <div id="currentPhotoSection" style="text-align: center; margin-bottom: 12px;">
              <img id="currentPhotoImg" src="${player.photoBase64}" style="width: 120px; height: 120px; border-radius: 50%; border: 3px solid #22c55e; object-fit: cover;" />
              <div style="margin-top: 8px; display: flex; gap: 8px; justify-content: center;">
                <button type="button" id="changePhotoBtn" style="padding: 6px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; color: #888; cursor: pointer;">
                  更换照片
                </button>
                <button type="button" id="removePhotoBtn" style="padding: 6px 12px; background: #2a1a1a; border: 1px solid #ef4444; border-radius: 6px; color: #ef4444; cursor: pointer;">
                  🗑️ 移除照片
                </button>
              </div>
            </div>
          ` : ''}

          <!-- Photo upload section -->
          <div id="photoUploadContainer" style="${player.photoBase64 ? 'display: none;' : ''}">
            <input type="file" id="photoInput" accept="image/jpeg,image/png,image/webp" style="display: none;" />
            <button type="button" id="selectPhotoBtn" style="width: 100%; padding: 12px; background: #0b0b0c; border: 2px dashed #333; border-radius: 6px; color: #888; cursor: pointer; transition: all 0.2s;">
              📁 ${player.photoBase64 ? '选择新照片' : '上传照片'} (1:1比例)
            </button>
            <div style="color: #888; font-size: 0.85em; margin-top: 6px;">
              仅接受正方形图片，将自动压缩至400x400
            </div>

            <!-- Photo preview (shown after new upload) -->
            <div id="photoPreview" style="margin-top: 12px; display: none; text-align: center;">
              <div style="color: #22c55e; margin-bottom: 8px;">✓ 新照片已准备</div>
              <img id="photoPreviewImg" style="width: 120px; height: 120px; border-radius: 50%; border: 3px solid #22c55e; object-fit: cover;" />
              <div style="margin-top: 8px;">
                <button type="button" id="cancelNewPhotoBtn" style="padding: 6px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; color: #888; cursor: pointer;">
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Play Style -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-weight: bold;">
            游戏风格 <span style="color: #ef4444;">*</span>
          </label>
          <select
            id="playStyleInput"
            style="width: 100%; padding: 8px 12px; background: #0b0b0c; border: 1px solid #333; border-radius: 6px; color: white;"
            required
          >
            <option value="">选择风格...</option>
            ${playStyles.map(style => `
              <option value="${style.value}" ${style.value === player.playStyle ? 'selected' : ''}>${style.label}</option>
            `).join('')}
          </select>
        </div>

        <!-- Tagline -->
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 6px; font-weight: bold;">
            个性签名 <span style="color: #ef4444;">*</span>
          </label>
          <input
            type="text"
            id="taglineInput"
            placeholder="运筹帷幄，决胜千里"
            maxlength="50"
            value="${player.tagline || ''}"
            style="width: 100%; padding: 8px 12px; background: #0b0b0c; border: 1px solid #333; border-radius: 6px; color: white;"
            required
          />
          <div style="color: #888; font-size: 0.85em; margin-top: 4px;">
            最多50个字符，会在胜利时显示
          </div>
        </div>

        <!-- Error Message -->
        <div id="formError" style="color: #ef4444; margin-bottom: 16px; display: none;"></div>

        <!-- Buttons -->
        <div style="display: flex; gap: 12px;">
          <button
            type="button"
            id="cancelEditButton"
            style="flex: 1; padding: 12px; background: #333; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;"
          >
            取消
          </button>
          <button
            type="submit"
            id="submitEditButton"
            style="flex: 1; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold;"
          >
            保存更改
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modalElement);

  // Setup event handlers
  setupModalHandlers();
}

/**
 * Setup modal event handlers
 */
function setupModalHandlers() {
  const form = $('editPlayerForm');
  const cancelButton = $('cancelEditButton');
  const emojiInput = $('emojiInput');
  const formError = $('formError');

  // Emoji selection
  const emojiOptions = document.querySelectorAll('.emoji-option');
  emojiOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Remove previous selection
      emojiOptions.forEach(opt => {
        opt.style.borderColor = 'transparent';
        opt.style.background = 'transparent';
      });

      // Highlight selected
      option.style.borderColor = '#22c55e';
      option.style.background = '#1a2e1a';

      // Set hidden input value
      if (emojiInput) {
        emojiInput.value = option.dataset.emoji;
      }
    });
  });

  // Photo management handlers
  const photoInput = $('photoInput');
  const selectPhotoBtn = $('selectPhotoBtn');
  const changePhotoBtn = $('changePhotoBtn');
  const removePhotoBtn = $('removePhotoBtn');
  const currentPhotoSection = $('currentPhotoSection');
  const photoUploadContainer = $('photoUploadContainer');
  const photoPreview = $('photoPreview');
  const photoPreviewImg = $('photoPreviewImg');
  const cancelNewPhotoBtn = $('cancelNewPhotoBtn');

  // Select/Change photo button
  if (selectPhotoBtn && photoInput) {
    selectPhotoBtn.addEventListener('click', () => {
      photoInput.click();
    });
  }

  if (changePhotoBtn && photoInput) {
    changePhotoBtn.addEventListener('click', () => {
      photoInput.click();
    });
  }

  // Remove photo button
  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', () => {
      selectedPhotoBase64 = null;  // Will send null to clear photo
      if (currentPhotoSection) {
        currentPhotoSection.style.display = 'none';
      }
      if (photoUploadContainer) {
        photoUploadContainer.style.display = 'block';
      }
      console.log('Photo marked for removal');
    });
  }

  // Photo file input handler
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        return;
      }

      // Validate file size (max 5MB original)
      if (file.size > 5 * 1024 * 1024) {
        alert('图片太大，请选择小于5MB的文件');
        return;
      }

      // Read file as data URL
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement('img');
        img.src = event.target.result;
        img.onload = () => {
          // Resize to 400x400 (center crop)
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const size = Math.min(img.width, img.height);
          canvas.width = 400;
          canvas.height = 400;
          ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 400, 400);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

          // Set preview
          if (photoPreviewImg) {
            photoPreviewImg.src = dataUrl;
          }
          if (photoPreview) {
            photoPreview.style.display = 'block';
          }

          // Hide current photo and upload button
          if (currentPhotoSection) {
            currentPhotoSection.style.display = 'none';
          }
          if (selectPhotoBtn) {
            selectPhotoBtn.style.display = 'none';
          }

          // Store base64
          selectedPhotoBase64 = dataUrl;

          console.log('New photo uploaded, base64 size:', selectedPhotoBase64.length, 'bytes');
        };
      };
      reader.readAsDataURL(file);
    });
  }

  // Cancel new photo
  if (cancelNewPhotoBtn) {
    cancelNewPhotoBtn.addEventListener('click', () => {
      // Restore original photo state
      selectedPhotoBase64 = currentPlayer.photoBase64 || null;

      if (photoPreview) {
        photoPreview.style.display = 'none';
      }

      if (currentPlayer.photoBase64) {
        // Had photo originally, show it
        if (currentPhotoSection) {
          currentPhotoSection.style.display = 'block';
        }
      } else {
        // No photo originally, show upload button
        if (selectPhotoBtn) {
          selectPhotoBtn.style.display = 'block';
        }
      }
    });
  }

  // Cancel button
  if (cancelButton) {
    cancelButton.addEventListener('click', closeModal);
  }

  // Close on outside click
  modalElement.addEventListener('click', (e) => {
    if (e.target === modalElement) {
      closeModal();
    }
  });

  // Form submission
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitButton = $('submitEditButton');
      if (formError) formError.style.display = 'none';

      // Validate all fields
      const displayName = $('displayNameInput')?.value.trim();
      const emoji = $('emojiInput')?.value;
      const playStyle = $('playStyleInput')?.value;
      const tagline = $('taglineInput')?.value.trim();

      if (!displayName || !emoji || !playStyle || !tagline) {
        if (formError) {
          formError.textContent = '请填写所有必填项';
          formError.style.display = 'block';
        }
        return;
      }

      // Disable submit button
      if (submitButton) {
        submitButton.textContent = '保存中...';
        submitButton.disabled = true;
      }

      try {
        const payload = {
          displayName,
          emoji,
          playStyle,
          tagline,
          photoBase64: selectedPhotoBase64  // Can be null (removes photo), string (new/existing), or undefined
        };

        console.log('Updating player profile:', {
          handle: currentPlayer.handle,
          ...payload,
          photoBase64: payload.photoBase64 ? `${payload.photoBase64.substring(0, 50)}... (${payload.photoBase64.length} bytes)` : payload.photoBase64 === null ? 'REMOVE' : 'unchanged'
        });

        const result = await updatePlayerProfile(currentPlayer.handle, payload);

        if (result.success) {
          // Success message
          alert('✅ 资料更新成功！');
          if (onPlayerUpdatedCallback) {
            onPlayerUpdatedCallback(result.player);
          }
          closeModal();
        }
      } catch (error) {
        console.error('Update profile error:', error);
        if (formError) {
          if (error.message.includes('Unauthorized')) {
            formError.textContent = '❌ 权限不足，无法修改资料';
          } else if (error.message.includes('not found')) {
            formError.textContent = '❌ 玩家不存在';
          } else if (error.message.includes('Invalid')) {
            formError.textContent = `❌ ${error.message}`;
          } else {
            formError.textContent = '❌ 更新失败，请重试';
          }
          formError.style.display = 'block';
        }

        // Re-enable submit button
        if (submitButton) {
          submitButton.textContent = '保存更改';
          submitButton.disabled = false;
        }
      }
    });
  }
}

/**
 * Close modal
 */
function closeModal() {
  if (modalElement) {
    modalElement.remove();
    modalElement = null;
  }
  currentPlayer = null;
  selectedPhotoBase64 = null;
}

/**
 * Export closeModal for external use
 */
export { closeModal };
