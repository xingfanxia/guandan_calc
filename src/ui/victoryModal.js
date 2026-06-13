/**
 * Victory Modal - A-Level Victory Celebration
 * Room voting lives in src/share/votingManager.js.
 */

import { $, escapeHtml } from '../core/utils.js';
import config from '../core/config.js';
import state from '../core/state.js';
import { emit } from '../core/events.js';
import { renderProfileAvatar } from '../player/photoRenderer.js';
import { normalizeTeamNumber } from '../player/playerManager.js';
import { getPlayerDisplayData } from '../api/playerApi.js';
import { getRoomInfo } from '../share/roomManager.js';
import { normalizePlayerCountMode } from '../core/playerCountMode.js';

/**
 * Legacy local-vote hook used by final-win profile sync.
 * Current votes are submitted through the room voting flow instead.
 * @returns {Object} {mvp: playerId, burden: playerId}
 */
export function getVotingResults() {
  return { mvp: null, burden: null };
}

/**
 * Resolve a team's display color for inline-styled celebration text.
 *
 * If the team still uses its default color, return the live `--team-blue`/
 * `--team-red` CSS token (which has per-mode light/dark variants) so the text
 * is readable in both modes. If the user customized the color, honor their hex.
 * Falls back to `--accent` when the team key is unknown.
 *
 * @param {('t1'|'t2'|null)} teamKey
 * @returns {string} CSS color value
 */
function resolveTeamColorToken(teamKey) {
  const read = (name, fallback) => {
    if (typeof getComputedStyle !== 'function') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };
  if (teamKey !== 't1' && teamKey !== 't2') return read('--accent', '#15694B');
  const tokenName = teamKey === 't1' ? '--team-blue' : '--team-red';
  const configColor = config.getTeamColor(teamKey);
  const isDefault = config.isDefaultTeamColor
    ? config.isDefaultTeamColor(teamKey)
    : true; // config without the helper → treat as default and use the token
  return isDefault ? read(tokenName, configColor) : configColor;
}

/**
 * Show victory modal with celebration and voting
 * @param {string} teamName - Winning team name
 */
export async function showVictoryModal(teamName) {
  const modal = $('victoryModal');
  if (!modal) return;

  const modalContent = modal.querySelector('.victory-modal__inner');
  const teamNameEl = $('victoryTeamName');

  // Determine winning team color. Use the team-* CSS tokens (per-mode
  // light/dark variants) rather than the config hex so the celebration text
  // stays readable in both modes; only a user-customized non-default color
  // falls back to the stored hex.
  const winningTeamKey =
    teamName === config.getTeamName('t1') ? 't1' :
    teamName === config.getTeamName('t2') ? 't2' : null;
  const winningTeamColor = resolveTeamColorToken(winningTeamKey);

  // Update modal content
  if (teamNameEl) {
    teamNameEl.textContent = teamName;
    teamNameEl.style.color = winningTeamColor;
  }

  const existingTagline = modal.querySelector('.mvp-tagline');
  if (existingTagline) existingTagline.remove();

  // Expose the winning team color as a CSS custom property so per-theme
  // styles can use it without inline rule overrides. Pre-2026-05-05 we set
  // borderColor + boxShadow inline here, which clobbered each theme's
  // border treatment (Atelier gold-top, Trading amber-frame, etc.).
  if (modalContent) {
    modal.style.setProperty('--winning-team-color', winningTeamColor);
  }

  // Find MVP from winning team and show tagline
  try {
    const players = state.getPlayers();
    const playerStats = state.getPlayerStats();
    const winningTeamNum = teamName === config.getTeamName('t1') ? 1 : 2;

    // Get winning team players
    const winningPlayers = players.filter(p => normalizeTeamNumber(p.team) === winningTeamNum);

    // Find MVP: player with LOWEST average ranking (best performance)
    let mvpPlayer = null;
    let bestAvg = Infinity;

    winningPlayers.forEach(player => {
      const stats = playerStats[player.id];
      if (stats && stats.games > 0) {
        const avgRank = stats.totalRank / stats.games;
        if (avgRank < bestAvg) {
          bestAvg = avgRank;
          mvpPlayer = player;
        }
      }
    });

    // Fetch current profile data for MVP (with fallback to stored data)
    if (mvpPlayer) {
      mvpPlayer = await getPlayerDisplayData(mvpPlayer);
    }

    // Show tagline if MVP has profile. Color/size/style come from the
    // .mvp-tagline rule in src/style.css (var(--gold-a)) — no inline color so
    // it resolves correctly in light AND dark mode.
    if (mvpPlayer && mvpPlayer.tagline) {
      const taglineEl = document.createElement('p');
      taglineEl.className = 'mvp-tagline';
      taglineEl.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 12px;">
          ${renderProfileAvatar(mvpPlayer, 64, { marginRight: false })}
          <div style="text-align: left;">
            <div style="color: ${winningTeamColor}; font-weight: bold; font-size: 18px;">MVP ${escapeHtml(mvpPlayer.name)}</div>
            <div style="color: var(--ink-dim); font-size: 14px;">平均 ${bestAvg.toFixed(2)}名</div>
          </div>
        </div>
        <div style="font-style: italic;">"${escapeHtml(mvpPlayer.tagline)}"</div>
      `;
      
      // Insert after team name
      if (teamNameEl && teamNameEl.nextSibling) {
        teamNameEl.parentNode.insertBefore(taglineEl, teamNameEl.nextSibling);
      }
    }
  } catch (error) {
    console.error('Failed to show MVP tagline:', error);
    // Don't prevent modal from showing
  }

  // Emit voting event BEFORE checking room mode (so viewers receive it)
  emit('ui:victoryModalShown', { teamName });
  emit('game:victoryForVoting', { teamName }); // Signal for remote voting

  const roomInfo = getRoomInfo();
  if (roomInfo.roomCode && roomInfo.isViewer) {
    modal.style.display = 'none';
    return;
  }

  modal.style.display = 'flex';
}

/**
 * Close victory modal
 */
export function closeVictoryModal() {
  const modal = $('victoryModal');
  if (modal) {
    modal.style.display = 'none';
  }

  emit('ui:victoryModalClosed');
}

/**
 * Update rule hint text
 * @param {string} mode - Game mode
 */
export function updateRuleHint(mode) {
  const ruleHint = $('ruleHint');
  if (!ruleHint) return;

  const cfg = config.getAll();
  const modeKey = normalizePlayerCountMode(mode);

  if (modeKey === 4) {
    ruleHint.textContent = `4人：固定表 (${cfg.c4['1,2']},${cfg.c4['1,3']},${cfg.c4['1,4']})`;
  } else if (modeKey === 6) {
    ruleHint.textContent = `6人：分差≥${cfg.t6.g3} 升3；≥${cfg.t6.g2} 升2；≥${cfg.t6.g1} 升1`;
  } else if (modeKey === 8) {
    ruleHint.textContent = `8人：分差≥${cfg.t8.g3} 升3；≥${cfg.t8.g2} 升2；≥${cfg.t8.g1} 升1`;
  } else {
    ruleHint.textContent = '模式无效，请重新选择游戏人数';
  }
}

// Make closeVictoryModal globally accessible for HTML onclick
if (typeof window !== 'undefined') {
  window.closeVictoryModal = closeVictoryModal;
}
