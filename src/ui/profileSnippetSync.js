/**
 * Profile Snippet Sync — bind the editorial profile snippet at the bottom of
 * index.html to the currently-active player's career data.
 *
 * Demo (docs/design/demos/demo-broadcast-v3.html lines 910-957):
 *   avatar (init char) + name + handle + badge
 *   6-stat grid: Sessions / Won / Rounds / Avg Rank / Play Time / 最C·最闹
 *   2 relations: TOP PARTNER (win-rate) + TOP RIVAL (loss-rate) with progress bars
 *
 * Active-player picker:
 *   1. Last viewed profile from localStorage (gd_active_profile_handle)
 *   2. First profile-player (with @handle) currently in the game
 *   3. Falls back to "访客" guest empty state
 */

import { $ } from '../core/utils.js';
import { on as onEvent } from '../core/events.js';
import { getPlayers } from '../player/playerManager.js';
import { getPlayer } from '../api/playerApi.js';

const ACTIVE_PROFILE_KEY = 'gd_active_profile_handle';

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function setBarWidth(id, pct) {
  const el = $(id);
  if (el) el.style.width = `${Math.min(100, Math.max(0, pct))}%`;
}

function avatarChar(name) {
  if (!name) return '玩';
  const trimmed = String(name).trim();
  if (!trimmed) return '玩';
  return Array.from(trimmed)[0];
}

function pickActiveHandle() {
  // Prefer explicit user choice
  try {
    const stored = localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (stored) return stored;
  } catch (_) { /* ignore */ }

  // Fall back to first profile-player in current session
  const players = getPlayers();
  for (const p of players) {
    if (p.handle) return p.handle;
  }
  return null;
}

function formatPlayTime(totalSeconds) {
  if (!totalSeconds || totalSeconds < 60) return '<1m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function pickTopRelation(relMap, key) {
  // relMap = { handle: { games, wins, winRate } }
  if (!relMap || typeof relMap !== 'object') return null;
  let best = null;
  for (const [h, data] of Object.entries(relMap)) {
    if (!data || data.games == null || data.games < 1) continue;
    if (!best || data.games > best.games) {
      best = { handle: h, ...data };
    }
  }
  return best;
}

function renderEmptyProfile() {
  setText('profileName', '访客');
  setText('profileHandle', '@guest');
  setText('profileBadge', 'SIGN IN VIA PROFILE');
  const avatar = $('profileAvatar');
  if (avatar) {
    avatar.replaceChildren();
    avatar.textContent = '玩';
  }
  setText('profileSessions', '—');
  setText('profileWon', '—');
  setText('profileRounds', '—');
  setText('profileAvgRank', '—');
  setText('profilePlayTime', '—');
  setText('profileVotes', '— / —');

  // Relations
  const partnerName = $('profilePartnerName');
  if (partnerName) partnerName.replaceChildren(
    document.createTextNode('— '),
    Object.assign(document.createElement('span'), { className: 'handle', textContent: '@—' })
  );
  setText('profilePartnerGames', '0 局同队');
  setText('profilePartnerPct', '—');
  setBarWidth('profilePartnerBar', 0);

  const rivalName = $('profileRivalName');
  if (rivalName) rivalName.replaceChildren(
    document.createTextNode('— '),
    Object.assign(document.createElement('span'), { className: 'handle', textContent: '@—' })
  );
  setText('profileRivalGames', '0 局对阵');
  setText('profileRivalPct', '—');
  setBarWidth('profileRivalBar', 0);

  const footnote = $('profileFootnote');
  if (footnote) footnote.style.display = '';
}

function renderProfile(player) {
  if (!player) {
    renderEmptyProfile();
    return;
  }

  setText('profileName', player.displayName || player.name || '玩家');
  setText('profileHandle', player.handle ? `@${player.handle}` : '—');
  const sessions = Number(player.sessionsPlayed) || 0;
  const wins = Number(player.sessionsWon) || 0;
  const winRate = sessions > 0 ? (wins / sessions * 100).toFixed(1) : null;
  setText('profileBadge', sessions > 0 ? `${sessions} SESSIONS` : 'NEW PROFILE');

  // Avatar — photo or first char
  const avatar = $('profileAvatar');
  if (avatar) {
    avatar.replaceChildren();
    if (player.photo) {
      const img = document.createElement('img');
      img.src = player.photo;
      img.alt = '';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      avatar.appendChild(img);
    } else {
      avatar.textContent = avatarChar(player.displayName || player.name);
    }
  }

  // 6-stat grid
  setText('profileSessions', String(sessions));

  const wonEl = $('profileWon');
  if (wonEl) {
    wonEl.replaceChildren();
    wonEl.appendChild(document.createTextNode(`${wins} `));
    if (winRate !== null) {
      const small = document.createElement('span');
      small.className = 'small';
      small.textContent = `/ ${winRate}%`;
      wonEl.appendChild(small);
    }
  }

  setText('profileRounds', String(Number(player.roundsPlayed) || 0));
  const avgRank = Number(player.avgRankingPerSession) || Number(player.avgRankingPerRound) || 0;
  setText('profileAvgRank', avgRank > 0 ? avgRank.toFixed(2) : '—');
  setText('profilePlayTime', formatPlayTime(Number(player.totalPlayTimeSeconds) || 0));

  const votesEl = $('profileVotes');
  if (votesEl) {
    const mvp = Number(player.mvpVotes) || 0;
    const burden = Number(player.burdenVotes) || 0;
    votesEl.replaceChildren();
    votesEl.appendChild(document.createTextNode(`${mvp} `));
    const small = document.createElement('span');
    small.className = 'small';
    small.textContent = `/ ${burden}`;
    votesEl.appendChild(small);
  }

  // Relations — top partner + top rival
  const topPartner = pickTopRelation(player.partners);
  const partnerName = $('profilePartnerName');
  if (partnerName) {
    partnerName.replaceChildren();
    if (topPartner) {
      partnerName.appendChild(document.createTextNode(`${topPartner.handle} `));
      const handleSpan = document.createElement('span');
      handleSpan.className = 'handle';
      handleSpan.textContent = `@${topPartner.handle}`;
      partnerName.appendChild(handleSpan);
    } else {
      partnerName.appendChild(document.createTextNode('— '));
      const handleSpan = document.createElement('span');
      handleSpan.className = 'handle';
      handleSpan.textContent = '@—';
      partnerName.appendChild(handleSpan);
    }
  }
  if (topPartner) {
    const winPct = Number(topPartner.winRate) || (topPartner.games > 0 ? topPartner.wins / topPartner.games * 100 : 0);
    setText('profilePartnerGames', `${topPartner.games} 局同队`);
    setText('profilePartnerPct', `胜率 ${winPct.toFixed(0)}%`);
    setBarWidth('profilePartnerBar', winPct);
  } else {
    setText('profilePartnerGames', '0 局同队');
    setText('profilePartnerPct', '—');
    setBarWidth('profilePartnerBar', 0);
  }

  const topRival = pickTopRelation(player.opponents);
  const rivalName = $('profileRivalName');
  if (rivalName) {
    rivalName.replaceChildren();
    if (topRival) {
      rivalName.appendChild(document.createTextNode(`${topRival.handle} `));
      const handleSpan = document.createElement('span');
      handleSpan.className = 'handle';
      handleSpan.textContent = `@${topRival.handle}`;
      rivalName.appendChild(handleSpan);
    } else {
      rivalName.appendChild(document.createTextNode('— '));
      const handleSpan = document.createElement('span');
      handleSpan.className = 'handle';
      handleSpan.textContent = '@—';
      rivalName.appendChild(handleSpan);
    }
  }
  if (topRival) {
    const winPct = Number(topRival.winRate) || (topRival.games > 0 ? topRival.wins / topRival.games * 100 : 0);
    const lossPct = Math.max(0, 100 - winPct);
    setText('profileRivalGames', `${topRival.games} 局对阵`);
    setText('profileRivalPct', `败率 ${lossPct.toFixed(0)}%`);
    setBarWidth('profileRivalBar', lossPct);
  } else {
    setText('profileRivalGames', '0 局对阵');
    setText('profileRivalPct', '—');
    setBarWidth('profileRivalBar', 0);
  }

  const footnote = $('profileFootnote');
  if (footnote) footnote.style.display = 'none';
}

let inFlight = null;

export async function renderProfileSnippet() {
  const handle = pickActiveHandle();
  if (!handle) {
    renderEmptyProfile();
    return;
  }

  // Cancel any prior in-flight request to avoid race conditions
  inFlight = handle;

  try {
    const response = await getPlayer(handle);
    if (inFlight !== handle) return; // newer request superseded
    if (response?.success && response.player) {
      renderProfile(response.player);
    } else {
      renderEmptyProfile();
    }
  } catch (err) {
    if (inFlight !== handle) return;
    console.warn('profileSnippet: failed to fetch profile', handle, err);
    renderEmptyProfile();
  }
}

/**
 * Set the snippet's active profile (e.g., when user clicks a roster row).
 */
export function setActiveProfileHandle(handle) {
  try {
    if (handle) localStorage.setItem(ACTIVE_PROFILE_KEY, handle);
    else localStorage.removeItem(ACTIVE_PROFILE_KEY);
  } catch (_) { /* ignore quota / privacy errors */ }
  renderProfileSnippet();
}

export function initProfileSnippetSync() {
  renderProfileSnippet();

  // Re-render when profile players join/leave the session
  onEvent('player:addedFromProfile', renderProfileSnippet);
  onEvent('player:removed', renderProfileSnippet);
  onEvent('player:teamAssigned', renderProfileSnippet);
  onEvent('player:generated', renderProfileSnippet);
  onEvent('state:historyAdded', renderProfileSnippet); // After A-level victory, stats may change
}
