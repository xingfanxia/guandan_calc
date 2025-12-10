// Player Creation Modal
// Modal UI for creating new player profiles

import { createPlayer, validateHandle, getPlayStyles } from '../api/playerApi.js';
import { $ } from '../core/utils.js';

// Import emoji list from playerManager
import { ANIMAL_EMOJIS } from './playerManager.js';

let onPlayerCreatedCallback = null;
let modalElement = null;

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

        <!-- Emoji -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-weight: bold;">
            头像 <span style="color: #ef4444;">*</span>
          </label>
          <div id="emojiSelector" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); gap: 8px; max-height: 200px; overflow-y: auto; padding: 8px; background: #0b0b0c; border: 1px solid #333; border-radius: 6px;">
            ${ANIMAL_EMOJIS.map(emoji => `
              <button type="button" class="emoji-option" data-emoji="${emoji}" style="font-size: 24px; padding: 8px; background: transparent; border: 2px solid transparent; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                ${emoji}
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="emojiInput" required />
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
          tagline
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
