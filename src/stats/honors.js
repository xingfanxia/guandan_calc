/**
 * Honors System - Working honors with clickable explanations
 * Redesigned for 5-10 game threshold with dynamic updates
 */

import { getPlayers } from '../player/playerManager.js';
import state from '../core/state.js';
import { resolveAvatarPhoto } from '../player/photoRenderer.js';

import { calculateHonorsFromData, resolveHonorPlayerCount, MIN_HONOR_GAMES } from '../../shared/honorLogic.js';

function getActiveHonorPlayerCount() {
  const modeValue = typeof document !== 'undefined'
    ? document.getElementById('mode')?.value
    : undefined;
  return resolveHonorPlayerCount(modeValue, getPlayers().length);
}
export { calculateHonorsFromData, resolveHonorPlayerCount };
/**
 * Calculate honors from the current live session state.
 */
export function calculateHonors(totalPlayers = 8) {
  const players = getPlayers();
  const allStats = state.getPlayerStats();
  return calculateHonorsFromData(players, allStats, totalPlayers);
}

/**
 * Honor metadata — 16 honor key (matches data-honor-id attributes in index.html).
 * For each honor: which calculateHonors() field maps to it, the display title,
 * and a stat-formatter that returns { primary, label } for the recipient block.
 */
const HONOR_META = {
  lyubu:         { honorKey: 'mvp',           title: '吕布',     glyph: '🥇', color: '#d4af37', fmtStat: (h, st) => ({ primary: `${st.firstPlaceCount} / ${st.games}`, label: '头游' }) },
  adou:          { honorKey: 'burden',        title: '阿斗',     glyph: '😅', color: '#8b4513', fmtStat: (h, st) => ({ primary: `${st.lastPlaceCount} / ${st.games}`, label: '垫底' }) },
  shifo:         { honorKey: 'stable',        title: '石佛',     glyph: '🗿', color: '#708090', fmtStat: (h, st) => ({ primary: `σ ${h.score}`, label: `n=${st.games}` }) },
  bodongwang:    { honorKey: 'rollercoaster', title: '波动王',   glyph: '🌊', color: '#ff4500', fmtStat: (h, st) => ({ primary: `Σ ${h.score}`, label: `${Math.min(...st.rankings)}–${Math.max(...st.rankings)}` }) },
  fendouwang:    { honorKey: 'comeback',      title: '奋斗王',   glyph: '📈', color: '#32cd32', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '位提升' }) },
  fanchewang:    { honorKey: 'fanche',        title: '翻车王',   glyph: '🎪', color: '#dc143c', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '崩盘次' }) },
  dutu:          { honorKey: 'gambler',       title: '赌徒',     glyph: '🎲', color: '#8b5cf6', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '高风险' }) },
  damanguan:     { honorKey: 'complete',      title: '大满贯',   glyph: '👑', color: '#ffd700', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '体验过' }) },
  lianshengewang:{ honorKey: 'streak',        title: '连段王',   glyph: '🔥', color: '#ff6347', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '上半区连段' }) },
  foxiwanjia:    { honorKey: 'median',        title: '团队中轴', glyph: '🧭', color: '#9370db', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '强于队友均值' }) },
  liyuwang:      { honorKey: 'carp',          title: '逆转核心', glyph: '📈', color: '#f97316', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '后程提升' }) },
  buzhanguo:     { honorKey: 'nonstick',      title: '保底核心', glyph: '🛡️', color: '#10b981', fmtStat: (h, st) => ({ primary: `${st.lastPlaceCount} / ${st.games}`, label: '垫底' }) },
  shandianxia:   { honorKey: 'frequent',      title: '节奏核心', glyph: '⚡', color: '#ffa500', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '队伍领先局' }) },
  ranjinwang:    { honorKey: 'burnout',       title: '燃尽王',   glyph: '🔥', color: '#b91c1c', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '后程下滑' }) },
  qichayizhao:   { honorKey: 'almost',        title: '棋差一着', glyph: '🎯', color: '#3b82f6', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '差一名' }) },
  xiaochou:      { honorKey: 'resilient',     title: '抗压王',   glyph: '🧱', color: '#0f766e', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '反弹/承压' }) }
};

export function buildHonorExportRows(honors = {}, allStats = {}) {
  return Object.entries(HONOR_META).map(([id, meta]) => {
    const honorData = honors[meta.honorKey];
    const player = honorData?.player || null;
    const stats = player
      ? (honorData.stats || allStats[player.id] || {
        games: 0,
        totalRank: 0,
        firstPlaceCount: 0,
        lastPlaceCount: 0,
        rankings: []
      })
      : null;
    const stat = player ? meta.fmtStat(honorData, stats) : null;
    return {
      id,
      title: meta.title,
      glyph: meta.glyph,
      color: meta.color,
      playerText: player ? `${player.emoji || ''}${player.name || '玩家'}` : '—',
      metricText: stat ? `${stat.primary}${stat.label ? ` ${stat.label}` : ''}` : '进行中'
    };
  });
}

function avatarChar(player) {
  if (!player) return '?';
  // Profile players (with @handle): use first char of display name (Chinese surname feel).
  // Session players (玩家1, 玩家2…): use the player's emoji — much more visually
  // distinct than the digit; matches the small emoji shown next to their name.
  if (player.handle) {
    const name = (player.name || '').trim();
    if (name) return Array.from(name)[0];
  }
  return player.emoji || '?';
}

function teamColorClass(player) {
  if (!player) return '';
  return Number(player.team) === 1 ? 'honor__avatar--blue' : (Number(player.team) === 2 ? 'honor__avatar--red' : 'honor__avatar--empty');
}

/**
 * Update one honor article with awarded data or empty placeholder.
 *
 * @param {boolean} sessionHasEnoughData - true once at least one honor has a
 *   winner this session, i.e. someone has played ≥ MIN_HONOR_GAMES rounds.
 *   Distinguishes "still collecting data" from "computed, nobody qualified" so
 *   the empty-state copy reads correctly even after a long session.
 */
function updateHonorArticle(article, honorData, meta, sessionHasEnoughData) {
  // Status badge — only shown when there's NO clear winner. With enough data
  // an unawarded honor means "nobody met the criteria this session", not "still
  // calculating", so the badge wording flips accordingly.
  const statusEl = article.querySelector('.honor__status');
  if (statusEl) {
    statusEl.classList.remove('honor__status--leading', 'honor__status--inprog', 'honor__status--locked');
    if (honorData?.player) {
      // Winner exists — hide the badge entirely
      statusEl.hidden = true;
      statusEl.textContent = '';
    } else {
      statusEl.hidden = false;
      statusEl.textContent = sessionHasEnoughData ? '本场无人' : '进行中';
      statusEl.classList.add('honor__status--inprog');
    }
  }

  // Article modifier — keep the orange accent strip on populated cards (visual hierarchy)
  article.classList.remove('honor--leading', 'honor--inprog');
  article.classList.add(honorData?.player ? 'honor--leading' : 'honor--inprog');

  // Recipient block
  const recipient = article.querySelector('.honor__recipient');
  if (!recipient) return;

  const avatar = recipient.querySelector('.honor__avatar');
  const playerBlock = recipient.querySelector('.honor__player');
  const playerName = recipient.querySelector('.honor__playername');
  let stat = recipient.querySelector('.honor__stat');

  if (honorData?.player) {
    const p = honorData.player;
    const allStats = state.getPlayerStats() || {};
    const st = honorData.stats || allStats[p.id] || { games: 0, totalRank: 0, firstPlaceCount: 0, lastPlaceCount: 0, rankings: [] };

    // Avatar
    if (avatar) {
      avatar.className = `honor__avatar ${teamColorClass(p)}`;
      avatar.replaceChildren();
      const avatarPhoto = resolveAvatarPhoto(p);
      if (avatarPhoto) {
        const img = document.createElement('img');
        img.src = avatarPhoto;
        img.alt = '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        avatar.appendChild(img);
      } else {
        avatar.textContent = avatarChar(p);
      }
    }

    // Player block — name + handle (or emoji fallback)
    if (playerBlock) {
      playerBlock.replaceChildren();
      const nm = document.createElement('span');
      nm.className = 'honor__playername';
      nm.id = playerName?.id || meta.idForName;
      nm.textContent = p.name || '玩家';
      playerBlock.appendChild(nm);

      const handle = document.createElement('span');
      handle.className = 'honor__handle';
      // Session players: avatar already shows the emoji — no second line.
      handle.textContent = p.handle ? `@${p.handle}` : '';
      playerBlock.appendChild(handle);
    }

    // Stat block
    const fmt = meta.fmtStat(honorData, st);
    if (!stat) {
      stat = document.createElement('div');
      recipient.appendChild(stat);
    }
    stat.className = 'honor__stat';
    stat.replaceChildren();
    const big = document.createElement('span');
    big.className = 'honor__stat--big';
    big.textContent = fmt.primary;
    stat.appendChild(big);
    if (fmt.label) {
      const label = document.createElement('span');
      label.className = 'honor__stat-label';
      label.textContent = fmt.label;
      stat.appendChild(label);
    }
  } else {
    // Empty state — placeholder avatar + "—" + placeholder stat
    if (avatar) {
      avatar.className = 'honor__avatar honor__avatar--empty';
      avatar.replaceChildren();
      avatar.textContent = '?';
    }
    if (playerBlock) {
      playerBlock.replaceChildren();
      const nm = document.createElement('span');
      nm.className = 'honor__playername honor__playername--placeholder';
      nm.id = playerName?.id || meta.idForName;
      // Computed-but-empty (enough games, no qualifier) vs still-collecting.
      nm.textContent = sessionHasEnoughData ? '本场无人达成' : '数据采集中';
      playerBlock.appendChild(nm);
      const handle = document.createElement('span');
      handle.className = 'honor__handle';
      handle.textContent = sessionHasEnoughData ? '无人符合条件' : `打满 ${MIN_HONOR_GAMES} 局解锁`;
      playerBlock.appendChild(handle);
    }
    if (stat) {
      stat.className = 'honor__stat honor__stat--placeholder';
      stat.replaceChildren();
      stat.textContent = '—';
    }
  }
}

/**
 * Render all 16 honors with editorial recipient blocks.
 */
export function renderHonors() {
  const honors = calculateHonors(getActiveHonorPlayerCount());
  const articles = document.querySelectorAll('.honor[data-honor-id]');

  // If ANY honor has a winner, at least one player cleared MIN_HONOR_GAMES, so
  // the session has enough data — unawarded honors then mean "nobody qualified"
  // rather than "still collecting".
  const sessionHasEnoughData = Object.values(honors).some(h => h && h.player);

  articles.forEach(article => {
    const honorId = article.dataset.honorId;
    const meta = HONOR_META[honorId];
    if (!meta) return;
    meta.idForName = honorId;
    const data = honors[meta.honorKey];
    updateHonorArticle(article, data, meta, sessionHasEnoughData);
  });
}
