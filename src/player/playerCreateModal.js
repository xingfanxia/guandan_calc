// Player Creation Modal
// Modal UI for creating new player profiles

import { createPlayer, validateHandle, getPlayStyles } from '../api/playerApi.js';
import { $ } from '../core/utils.js';
import Cropper from 'cropperjs';

// Import emoji list from playerManager
import { ANIMAL_EMOJIS } from './playerManager.js';

let onPlayerCreatedCallback = null;
let modalElement = null;
let cropperInstance = null;
let selectedPhotoBase64 = null;

/**
 * Initialize player creation modal
 * @param {Function} onPlayerCreated - Callback when player is created
 */
export function initializeCreateModal(onPlayerCreated) {
  onPlayerCreatedCallback = onPlayerCreated;
}

/**
 * Show create player modal
 */
export function showCreateModal() {
  // Remove existing modal if any
  if (modalElement) {
    modalElement.remove();
  }

  // Create modal HTML
  modalElement = document.createElement('div');
  modalElement.id = 'createPlayerModal';
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
      <h2 style="margin-top: 0; margin-bottom: 20px;">创建玩家资料</h2>

      <form id="createPlayerForm">
        <!-- Handle -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-weight: bold;">
            用户名 <span style="color: #ef4444;">*</span>
          </label>
          <input
            type="text"
            id="handleInput"
            placeholder="xiaoming (3-20个字符)"
            style="width: 100%; padding: 8px 12px; background: #0b0b0c; border: 1px solid #333; border-radius: 6px; color: white;"
            required
          />
          <div id="handleError" style="color: #ef4444; font-size: 0.85em; margin-top: 4px; display: none;"></div>
          <div style="color: #888; font-size: 0.85em; margin-top: 4px;">
            只能包含字母、数字和下划线，显示时会加上 @ 符号
          </div>
        </div>

        <!-- Display Name -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-weight: bold;">
            昵称 <span style="color: #ef4444;">*</span>
          </label>
          <input
            type="text"
            id="displayNameInput"
            placeholder="小明"
            style="width: 100%; padding: 8px 12px; background: #0b0b0c; border: 1px solid #333; border-radius: 6px; color: white;"
            required
          />
        </div>

        <!-- Emoji & Photo -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-weight: bold;">
            头像 <span style="color: #ef4444;">*</span>
          </label>
          
          <!-- Toggle between emoji and photo -->
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <button type="button" id="useEmojiBtn" class="avatar-mode-btn active" style="flex: 1; padding: 8px; background: #3b82f6; border: none; border-radius: 6px; color: white; cursor: pointer; transition: all 0.2s;">
              😊 使用表情
            </button>
            <button type="button" id="usePhotoBtn" class="avatar-mode-btn" style="flex: 1; padding: 8px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; color: #888; cursor: pointer; transition: all 0.2s;">
              📷 上传照片
            </button>
          </div>

          <!-- Emoji selector (default visible) -->
          <div id="emojiSelectorContainer">
            <div id="emojiSelector" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); gap: 8px; max-height: 200px; overflow-y: auto; padding: 8px; background: #0b0b0c; border: 1px solid #333; border-radius: 6px;">
              ${ANIMAL_EMOJIS.map(emoji => `
                <button type="button" class="emoji-option" data-emoji="${emoji}" style="font-size: 24px; padding: 8px; background: transparent; border: 2px solid transparent; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                  ${emoji}
                </button>
              `).join('')}
            </div>
            <input type="hidden" id="emojiInput" required />
          </div>

          <!-- Photo upload section (initially hidden) -->
          <div id="photoUploadContainer" style="display: none;">
            <input type="file" id="photoInput" accept="image/jpeg,image/png,image/webp" style="display: none;" />
            <button type="button" id="selectPhotoBtn" style="width: 100%; padding: 12px; background: #0b0b0c; border: 2px dashed #333; border-radius: 6px; color: #888; cursor: pointer; transition: all 0.2s;">
              📁 选择图片文件
            </button>
            
            <!-- Crop container (shown after file selection) -->
            <div id="cropContainer" style="margin-top: 12px; display: none;">
              <div style="max-width: 100%; max-height: 300px; overflow: hidden; background: #0b0b0c; border: 1px solid #333; border-radius: 6px;">
                <img id="cropImage" style="max-width: 100%; display: block;" />
              </div>
              <div style="display: flex; gap: 8px; margin-top: 12px;">
                <button type="button" id="rotateLeftBtn" style="padding: 8px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; color: white; cursor: pointer;">
                  ↺ 左转
                </button>
                <button type="button" id="rotateRightBtn" style="padding: 8px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; color: white; cursor: pointer;">
                  ↻ 右转
                </button>
                <button type="button" id="applyCropBtn" style="flex: 1; padding: 8px 12px; background: #22c55e; border: none; border-radius: 6px; color: white; cursor: pointer;">
                  ✓ 确认裁剪
                </button>
              </div>
            </div>

            <!-- Photo preview (shown after crop) -->
            <div id="photoPreview" style="margin-top: 12px; display: none; text-align: center;">
              <div style="color: #22c55e; margin-bottom: 8px;">✓ 照片已准备</div>
              <img id="croppedPreview" style="width: 72px; height: 72px; border-radius: 50%; border: 2px solid #22c55e; object-fit: cover;" />
              <button type="button" id="changePhotoBtn" style="margin-top: 8px; padding: 6px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; color: #888; cursor: pointer;">
                更换照片
              </button>
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
              <option value="${style.value}">${style.label}</option>
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
            id="cancelCreateButton"
            style="flex: 1; padding: 12px; background: #333; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;"
          >
            取消
          </button>
          <button
            type="submit"
            id="submitCreateButton"
            style="flex: 1; padding: 12px; background: #22c55e; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold;"
          >
            创建玩家
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
  const form = $('createPlayerForm');
  const handleInput = $('handleInput');
  const handleError = $('handleError');
  const cancelButton = $('cancelCreateButton');
  const emojiInput = $('emojiInput');
  const formError = $('formError');

  // Handle input validation
  if (handleInput) {
    handleInput.addEventListener('input', () => {
      const validation = validateHandle(handleInput.value);
      if (!validation.valid && handleInput.value) {
        handleError.textContent = validation.error;
        handleError.style.display = 'block';
      } else {
        handleError.style.display = 'none';
      }
    });
  }

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

  // Avatar mode toggle (emoji vs photo)
  const useEmojiBtn = $('useEmojiBtn');
  const usePhotoBtn = $('usePhotoBtn');
  const emojiSelectorContainer = $('emojiSelectorContainer');
  const photoUploadContainer = $('photoUploadContainer');

  if (useEmojiBtn) {
    useEmojiBtn.addEventListener('click', () => {
      // Switch to emoji mode
      useEmojiBtn.style.background = '#3b82f6';
      useEmojiBtn.style.color = 'white';
      useEmojiBtn.style.border = 'none';
      usePhotoBtn.style.background = '#1a1a1a';
      usePhotoBtn.style.color = '#888';
      usePhotoBtn.style.border = '1px solid #333';
      
      emojiSelectorContainer.style.display = 'block';
      photoUploadContainer.style.display = 'none';
      
      // Clear photo selection
      selectedPhotoBase64 = null;
    });
  }

  if (usePhotoBtn) {
    usePhotoBtn.addEventListener('click', () => {
      // Switch to photo mode
      usePhotoBtn.style.background = '#3b82f6';
      usePhotoBtn.style.color = 'white';
      usePhotoBtn.style.border = 'none';
      useEmojiBtn.style.background = '#1a1a1a';
      useEmojiBtn.style.color = '#888';
      useEmojiBtn.style.border = '1px solid #333';
      
      emojiSelectorContainer.style.display = 'none';
      photoUploadContainer.style.display = 'block';
    });
  }

  // Photo upload handlers
  const photoInput = $('photoInput');
  const selectPhotoBtn = $('selectPhotoBtn');
  const cropContainer = $('cropContainer');
  const cropImage = $('cropImage');
  const rotateLeftBtn = $('rotateLeftBtn');
  const rotateRightBtn = $('rotateRightBtn');
  const applyCropBtn = $('applyCropBtn');
  const photoPreview = $('photoPreview');
  const croppedPreview = $('croppedPreview');
  const changePhotoBtn = $('changePhotoBtn');

  if (selectPhotoBtn && photoInput) {
    selectPhotoBtn.addEventListener('click', () => {
      photoInput.click();
    });
  }

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
        if (cropImage) {
          cropImage.src = event.target.result;
          cropContainer.style.display = 'block';
          photoPreview.style.display = 'none';
          selectPhotoBtn.style.display = 'none';

          // Destroy existing cropper if any
          if (cropperInstance) {
            cropperInstance.destroy();
          }

          // Initialize Cropper.js
          cropperInstance = new Cropper(cropImage, {
            aspectRatio: 1,  // Square (1:1)
            viewMode: 2,  // Restrict crop box to container
            dragMode: 'move',  // Move image, not crop box
            autoCropArea: 0.9,  // Crop box fills 90% of image
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
            minCropBoxWidth: 100,
            minCropBoxHeight: 100,
            responsive: true,
            background: true,
            modal: true,
            scalable: true,
            zoomable: true,
            zoomOnWheel: true,
            wheelZoomRatio: 0.1
          });
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Rotation controls
  if (rotateLeftBtn) {
    rotateLeftBtn.addEventListener('click', () => {
      if (cropperInstance) {
        cropperInstance.rotate(-90);
      }
    });
  }

  if (rotateRightBtn) {
    rotateRightBtn.addEventListener('click', () => {
      if (cropperInstance) {
        cropperInstance.rotate(90);
      }
    });
  }

  // Apply crop
  if (applyCropBtn) {
    applyCropBtn.addEventListener('click', () => {
      if (!cropperInstance) return;

      // Get cropped canvas (400x400 max)
      const canvas = cropperInstance.getCroppedCanvas({
        width: 400,
        height: 400,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      });

      // Convert to JPEG base64 (80% quality)
      selectedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.8);

      // Show preview
      if (croppedPreview) {
        croppedPreview.src = selectedPhotoBase64;
      }
      cropContainer.style.display = 'none';
      photoPreview.style.display = 'block';

      console.log('Photo cropped, base64 size:', selectedPhotoBase64.length, 'bytes');
    });
  }

  // Change photo (reset)
  if (changePhotoBtn) {
    changePhotoBtn.addEventListener('click', () => {
      photoPreview.style.display = 'none';
      selectPhotoBtn.style.display = 'block';
      selectedPhotoBase64 = null;
      if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
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

      const submitButton = $('submitCreateButton');
      if (formError) formError.style.display = 'none';

      // Validate all fields
      const handle = handleInput?.value.trim();
      const displayName = $('displayNameInput')?.value.trim();
      const emoji = $('emojiInput')?.value;
      const playStyle = $('playStyleInput')?.value;
      const tagline = $('taglineInput')?.value.trim();

      if (!handle || !displayName || !emoji || !playStyle || !tagline) {
        if (formError) {
          formError.textContent = '请填写所有必填项';
          formError.style.display = 'block';
        }
        return;
      }

      // Validate handle
      const validation = validateHandle(handle);
      if (!validation.valid) {
        if (formError) {
          formError.textContent = validation.error;
          formError.style.display = 'block';
        }
        return;
      }

      // Disable submit button
      if (submitButton) {
        submitButton.textContent = '创建中...';
        submitButton.disabled = true;
      }

      try {
        const result = await createPlayer({
          handle,
          displayName,
          emoji,
          playStyle,
          tagline,
          ...(selectedPhotoBase64 && { photoBase64: selectedPhotoBase64 })  // Include photo if uploaded
        });

        if (result.success && onPlayerCreatedCallback) {
          onPlayerCreatedCallback(result.player);
          closeModal();
        }
      } catch (error) {
        console.error('Create player error:', error);
        if (formError) {
          formError.textContent = error.message || '创建失败，请重试';
          formError.style.display = 'block';
        }

        // Re-enable submit button
        if (submitButton) {
          submitButton.textContent = '创建玩家';
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
}

/**
 * Export closeModal for external use
 */
export { closeModal };
