/**
 * Photo Renderer Helper
 * Handles rendering player avatars (photo or emoji) for profile pages only
 */

import { escapeHtml } from '../core/utils.js';

const MAX_AVATAR_DATA_URL_LENGTH = 150000;
const AVATAR_DATA_URL_RE = /^data:image\/(?:jpeg|png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const ALLOWED_AVATAR_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

export function isAllowedAvatarPhoto(photoDataUrl) {
  return typeof photoDataUrl === 'string' &&
    photoDataUrl.length <= MAX_AVATAR_DATA_URL_LENGTH &&
    AVATAR_DATA_URL_RE.test(photoDataUrl);
}

export function isAllowedAvatarPhotoFile(file) {
  return Boolean(file && ALLOWED_AVATAR_PHOTO_MIME_TYPES.has(file.type));
}

export function resolveAvatarPhoto(player) {
  const avatarPhoto = player?.photoBase64 || player?.photo;
  return isAllowedAvatarPhoto(avatarPhoto) ? avatarPhoto : null;
}

/**
 * Render player avatar (photo or emoji) with proper sizing and fallback
 * @param {Object} player - Player object with emoji and optional photoBase64
 * @param {number} size - Size in pixels (width/height for square/circle)
 * @param {Object} options - Additional options (circular, border, marginRight, etc.)
 * @returns {string} HTML string for avatar
 */
export function renderProfileAvatar(player, size = 64, options = {}) {
  const {
    circular = true,
    borderWidth = 2,
    borderColor = '#444',
    className = 'player-avatar',
    marginRight = true
  } = options;

  const containerStyle = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: ${size}px;
    height: ${size}px;
    ${circular ? `border-radius: 50%;` : ''}
    overflow: hidden;
    flex-shrink: 0;
    ${marginRight ? 'margin-right: 16px;' : ''}
  `;

  const photoStyle = `
    width: 100%;
    height: 100%;
    object-fit: cover;
    border: ${borderWidth}px solid ${borderColor};
    ${circular ? `border-radius: 50%;` : ''}
  `;

  const emojiStyle = `
    font-size: ${size * 0.6}px;
    line-height: 1;
  `;

  const avatarPhoto = resolveAvatarPhoto(player);
  if (avatarPhoto) {
    // Show photo with emoji fallback
    return `
      <div class="${className}" style="${containerStyle}">
        <img
          src="${escapeHtml(avatarPhoto)}"
          alt="${escapeHtml(player.displayName || player.name)}"
          style="${photoStyle}"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div style="display: none; width: ${size}px; height: ${size}px; border-radius: 50%; background: #1a1a1a; border: ${borderWidth}px solid #444; align-items: center; justify-content: center; font-size: ${size * 0.6}px;">
          ${escapeHtml(player.emoji)}
        </div>
      </div>
    `;
  }

  // Show emoji (default)
  return `
    <div class="${className}" style="${containerStyle}">
      <span style="${emojiStyle}">${escapeHtml(player.emoji)}</span>
    </div>
  `;
}
