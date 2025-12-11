/**
 * Photo Renderer Helper
 * Handles rendering player avatars (photo or emoji) for profile pages only
 */

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

  if (player.photoBase64) {
    // Show photo with emoji fallback
    return `
      <div class="${className}" style="${containerStyle}">
        <img
          src="${player.photoBase64}"
          alt="${player.displayName || player.name}"
          style="${photoStyle}"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div style="display: none; width: ${size}px; height: ${size}px; border-radius: 50%; background: #1a1a1a; border: ${borderWidth}px solid #444; align-items: center; justify-content: center; font-size: ${size * 0.6}px;">
          ${player.emoji}
        </div>
      </div>
    `;
  }

  // Show emoji (default)
  return `
    <div class="${className}" style="${containerStyle}">
      <span style="${emojiStyle}">${player.emoji}</span>
    </div>
  `;
}
