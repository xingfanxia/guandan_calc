/**
 * Honors System - Working honors with clickable explanations
 * Redesigned for 5-10 game threshold with dynamic updates
 */

import { getPlayers } from '../player/playerManager.js';
import state from '../core/state.js';
import { getManifest } from '../themes/_shared/themeManager.js';

/**
 * Calculate POPULATION variance (divides by N, not N-1).
 *
 * For n=1, the only datapoint equals the mean → variance is 0. That's
 * mathematically correct (no spread in a single observation) but
 * uninformative for volatility honors, where "this player has played one
 * game" should not classify them as stable. Variance-based honors below
 * gate on `rankings.length < 5` to avoid this case — DO NOT call
 * calculateVariance from a context that lacks a similar small-sample
 * guard.
 *
 * Population (N) is intentional: we treat each player's session-level
 * rankings as a complete observed history, not a sample drawn from a
 * larger distribution. Bessel's correction (N-1) would be appropriate
 * if we were estimating population variance from a sample, but here
 * "the population" is "this player's actual games to date".
 *
 * @param {number[]} rankings
 * @returns {number} variance (0 if rankings empty/null)
 */
function calculateVariance(rankings) {
  if (!rankings || rankings.length === 0) return 0;

  const mean = rankings.reduce((sum, val) => sum + val, 0) / rankings.length;
  const squaredDiffs = rankings.map(val => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / rankings.length;
}

/**
 * Calculate improvement (first half vs second half)
 */
function calculateImprovementScore(rankings) {
  if (rankings.length < 6) return 0;

  const third = Math.floor(rankings.length / 3);
  const early = rankings.slice(0, third);
  const late = rankings.slice(-third);

  const earlyAvg = early.reduce((sum, r) => sum + r, 0) / early.length;
  const lateAvg = late.reduce((sum, r) => sum + r, 0) / late.length;

  return earlyAvg - lateAvg; // Positive = improvement
}

/**
 * Calculate honors
 */
export function calculateHonors(totalPlayers = 8) {
  const players = getPlayers();
  const allStats = state.getPlayerStats();

  const honors = {};

  const eligible = players.filter(p => {
    const stats = allStats[p.id];
    return stats && stats.games >= 5;
  });

  if (eligible.length === 0) return honors;

  // Simple honors with tie-breakers
  let maxFirst = 0, mvpAvgRank = Infinity;
  let maxLast = 0, burdenAvgRank = 0;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    const avgRank = stats.totalRank / stats.games;

    // 吕布 - most first places, tie-breaker: lower avg rank (better)
    if (stats.firstPlaceCount > maxFirst) {
      maxFirst = stats.firstPlaceCount;
      mvpAvgRank = avgRank;
      honors.mvp = { player, score: stats.firstPlaceCount };
    } else if (stats.firstPlaceCount === maxFirst && stats.firstPlaceCount > 0) {
      // Tie-breaker: lower average rank wins
      if (avgRank < mvpAvgRank) {
        mvpAvgRank = avgRank;
        honors.mvp = { player, score: stats.firstPlaceCount };
      }
    }

    // 阿斗 - most last places, tie-breaker: higher avg rank (worse)
    if (stats.lastPlaceCount > maxLast) {
      maxLast = stats.lastPlaceCount;
      burdenAvgRank = avgRank;
      honors.burden = { player, score: stats.lastPlaceCount };
    } else if (stats.lastPlaceCount === maxLast && stats.lastPlaceCount > 0) {
      // Tie-breaker: higher average rank wins (is worse)
      if (avgRank > burdenAvgRank) {
        burdenAvgRank = avgRank;
        honors.burden = { player, score: stats.lastPlaceCount };
      }
    }
  });

  // Variance-based
  let minVar = Infinity, maxVar = 0;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    if (!stats.rankings || stats.rankings.length < 5) return;

    const variance = calculateVariance(stats.rankings);
    const avgRank = stats.totalRank / stats.games;

    // 石佛 (stable + good)
    if (avgRank <= 4.5 && variance < 4.5 && variance < minVar) {
      minVar = variance;
      honors.stable = { player, score: variance.toFixed(2) };
    }

    // 波动王
    if (variance > 2.5 && variance > maxVar) {
      maxVar = variance;
      honors.rollercoaster = { player, score: variance.toFixed(2) };
    }
  });

  // Improvement
  let maxImp = -Infinity;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    if (!stats.rankings || stats.rankings.length < 8) return;

    const imp = calculateImprovementScore(stats.rankings);

    if (imp > 1.0 && imp > maxImp) {
      maxImp = imp;
      honors.comeback = { player, score: `+${imp.toFixed(1)}` };
    }
  });

  // 翻车王 (Crash) - From top tier to dead last in consecutive games.
  // Top tier scales by mode: ceil(N/3) so 4P=top 1-2, 6P=top 1-2, 8P=top 1-3.
  // Previously hardcoded `<= 3`, which in 4P meant 75% of the field qualified — trivially true.
  let maxCrash = 0;
  const topTierThreshold = Math.max(1, Math.ceil(totalPlayers / 3));

  eligible.forEach(player => {
    const stats = allStats[player.id];
    let crashes = 0;

    for (let i = 1; i < stats.rankings.length; i++) {
      if (stats.rankings[i - 1] <= topTierThreshold && stats.rankings[i] === totalPlayers) {
        crashes++;
      }
    }

    if (crashes > maxCrash) {
      maxCrash = crashes;
      honors.fanche = { player, score: crashes };
    }
  });

  // Grand slam
  let maxComplete = 0;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    const unique = new Set(stats.rankings);
    const rate = unique.size / totalPlayers;

    if (rate > maxComplete) {
      maxComplete = rate;
      honors.complete = { player, score: `${unique.size}/${totalPlayers}` };
    }
  });

  // Win streak
  let maxStreak = 0;
  const mid = Math.ceil(totalPlayers / 2);

  eligible.forEach(player => {
    const stats = allStats[player.id];
    let streak = 0, best = 0;

    stats.rankings.forEach(r => {
      if (r <= mid) {
        streak++;
        best = Math.max(best, streak);
      } else {
        streak = 0;
      }
    });

    if (best >= 3 && best > maxStreak) {
      maxStreak = best;
      honors.streak = { player, score: best };
    }
  });

  // Median player
  const midRank = (totalPlayers + 1) / 2;
  let minDev = Infinity;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    const avg = stats.totalRank / stats.games;
    const dev = Math.abs(avg - midRank);

    if (dev < minDev) {
      minDev = dev;
      honors.median = { player, score: avg.toFixed(2) };
    }
  });

  // Frequent changes
  let maxChanges = 0;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    let changes = 0;

    for (let i = 1; i < stats.rankings.length; i++) {
      if (stats.rankings[i] !== stats.rankings[i - 1]) {
        changes++;
      }
    }

    if (changes > maxChanges) {
      maxChanges = changes;
      honors.frequent = { player, score: changes };
    }
  });

  // 鲤鱼王 (Comeback King) - From bottom tier to #1 in consecutive games.
  // Bottom tier scales by mode: top-third sized window from the bottom — 4P=bottom 1-2 (3,4),
  // 6P=bottom 1-2 (5,6), 8P=bottom 1-3 (6,7,8). Previously `>= totalPlayers - 2`, which in 4P
  // included rank 2 as "bottom 3" — too lax.
  let maxLeaps = 0;
  const bottomTierThreshold = totalPlayers - Math.max(1, Math.ceil(totalPlayers / 3)) + 1;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    let leaps = 0;

    for (let i = 1; i < stats.rankings.length; i++) {
      const prevRank = stats.rankings[i - 1];
      const currRank = stats.rankings[i];

      // From bottom tier to #1
      if (prevRank >= bottomTierThreshold && currRank === 1) {
        leaps++;
      }
    }

    if (leaps > maxLeaps && leaps > 0) {
      maxLeaps = leaps;
      honors.carp = { player, score: leaps };
    }
  });

  // 不粘锅 (Non-stick) - 0 last places, lowest average (best who never hit bottom)
  let bestNonstick = Infinity;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    const avgRank = stats.totalRank / stats.games;

    if (stats.lastPlaceCount === 0 && avgRank < bestNonstick && stats.games >= 5) {
      bestNonstick = avgRank;
      honors.nonstick = { player, score: avgRank.toFixed(2) };
    }
  });

  // 燃尽王 (Burnout) - Longest consecutive streak in bottom 4
  let maxBurnout = 0;
  const bottomThreshold = Math.ceil(totalPlayers * 0.5); // Bottom half

  eligible.forEach(player => {
    const stats = allStats[player.id];
    let currentStreak = 0;
    let longestStreak = 0;

    stats.rankings.forEach(rank => {
      if (rank > bottomThreshold) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });

    if (longestStreak >= 3 && longestStreak > maxBurnout) {
      maxBurnout = longestStreak;
      honors.burnout = { player, score: longestStreak };
    }
  });

  // 棋差一着 (Almost There) - Best average rank among those who never got 1st place
  let bestAlmost = Infinity;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    const avgRank = stats.totalRank / stats.games;

    // Must have 0 first places and at least 5 games
    if (stats.firstPlaceCount === 0 && stats.games >= 5 && avgRank < bestAlmost) {
      bestAlmost = avgRank;
      honors.almost = { player, score: avgRank.toFixed(2) };
    }
  });

  // 赌徒 (Gambler) - High first rate + high last rate (risky player)
  let maxGamblerScore = 0;

  eligible.forEach(player => {
    const stats = allStats[player.id];

    // Must have at least 1 first AND 1 last place to be a "gambler"
    if (stats.firstPlaceCount > 0 && stats.lastPlaceCount > 0) {
      const firstRate = stats.firstPlaceCount / stats.games;
      const lastRate = stats.lastPlaceCount / stats.games;

      // Gambler score: rewards having BOTH extremes
      // Use geometric mean to require balance of both
      const gamblerScore = Math.sqrt(firstRate * lastRate) * (stats.firstPlaceCount + stats.lastPlaceCount);

      if (gamblerScore > maxGamblerScore) {
        maxGamblerScore = gamblerScore;
        honors.gambler = {
          player,
          score: `${stats.firstPlaceCount}冠${stats.lastPlaceCount}末`
        };
      }
    }
  });

  // 🤡 (Clown) - Worst average rank among those who never got 1st place
  let worstClown = 0;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    const avgRank = stats.totalRank / stats.games;

    // Must have 0 first places and at least 5 games, find WORST (highest) average
    if (stats.firstPlaceCount === 0 && stats.games >= 5 && avgRank > worstClown) {
      worstClown = avgRank;
      honors.clown = { player, score: avgRank.toFixed(2) };
    }
  });

  return honors;
}

/**
 * Honor metadata — 16 honor key (matches data-honor-id attributes in index.html).
 * For each honor: which calculateHonors() field maps to it, the display title,
 * and a stat-formatter that returns { primary, label } for the recipient block.
 */
const HONOR_META = {
  lyubu:        { honorKey: 'mvp',          title: '吕布',     fmtStat: (h, st) => ({ primary: `${st.firstPlaceCount} / ${st.games}`, label: '头游' }) },
  adou:         { honorKey: 'burden',       title: '阿斗',     fmtStat: (h, st) => ({ primary: `${st.lastPlaceCount} / ${st.games}`, label: '垫底' }) },
  shifo:        { honorKey: 'stable',       title: '石佛',     fmtStat: (h, st) => ({ primary: `σ ${h.score}`, label: `n=${st.games}` }) },
  bodongwang:   { honorKey: 'rollercoaster',title: '波动王',   fmtStat: (h, st) => ({ primary: `σ ${h.score}`, label: `${Math.min(...st.rankings)}–${Math.max(...st.rankings)}` }) },
  fendouwang:   { honorKey: 'comeback',     title: '奋斗王',   fmtStat: (h, st) => ({ primary: `${h.score}`, label: '位提升' }) },
  fanchewang:   { honorKey: 'fanche',       title: '翻车王',   fmtStat: (h, st) => ({ primary: `${h.score}`, label: '崩盘次' }) },
  dutu:         { honorKey: 'gambler',      title: '赌徒',     fmtStat: (h, st) => ({ primary: `${h.score}`, label: '高风险' }) },
  damanguan:    { honorKey: 'complete',     title: '大满贯',   fmtStat: (h, st) => ({ primary: `${h.score}`, label: '体验过' }) },
  lianshengewang:{honorKey: 'streak',       title: '连胜王',   fmtStat: (h, st) => ({ primary: `${h.score}`, label: '连胜' }) },
  foxiwanjia:   { honorKey: 'median',       title: '佛系玩家', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '平均名' }) },
  liyuwang:     { honorKey: 'carp',         title: '鲤鱼王',   fmtStat: (h, st) => ({ primary: `${h.score}`, label: '逆转次' }) },
  buzhanguo:    { honorKey: 'nonstick',     title: '不粘锅',   fmtStat: (h, st) => ({ primary: `${h.score}`, label: '平均名' }) },
  shandianxia:  { honorKey: 'frequent',     title: '闪电侠',   fmtStat: (h, st) => ({ primary: `${h.score} / ${st.games}`, label: '换名次' }) },
  ranjinwang:   { honorKey: 'burnout',      title: '燃尽王',   fmtStat: (h, st) => ({ primary: `${h.score}`, label: '连低迷' }) },
  qichayizhao:  { honorKey: 'almost',       title: '棋差一着', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '平均名' }) },
  xiaochou:     { honorKey: 'clown',        title: '🤡',       fmtStat: (h, st) => ({ primary: `${h.score}`, label: '平均名' }) }
};

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
 */
function updateHonorArticle(article, honorData, meta) {
  // Status badge — only shown when there's NO clear winner (i.e., honor is still calculating).
  // When a winner exists, the recipient row already conveys leadership; the badge is noise.
  const statusEl = article.querySelector('.honor__status');
  if (statusEl) {
    statusEl.classList.remove('honor__status--leading', 'honor__status--inprog', 'honor__status--locked');
    if (honorData?.player) {
      // Winner exists — hide the badge entirely
      statusEl.hidden = true;
      statusEl.textContent = '';
    } else {
      statusEl.hidden = false;
      statusEl.textContent = '进行中';
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
    const st = allStats[p.id] || { games: 0, totalRank: 0, firstPlaceCount: 0, lastPlaceCount: 0, rankings: [] };

    // Avatar
    if (avatar) {
      avatar.className = `honor__avatar ${teamColorClass(p)}`;
      avatar.replaceChildren();
      if (p.photo) {
        const img = document.createElement('img');
        img.src = p.photo;
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
      handle.textContent = p.handle ? `@${p.handle}` : (p.emoji || '');
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
      nm.textContent = '数据采集中';
      playerBlock.appendChild(nm);
      const handle = document.createElement('span');
      handle.className = 'honor__handle';
      handle.textContent = '需更多数据';
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
  const honors = calculateHonors(getPlayers().length);
  const articles = document.querySelectorAll('.honor[data-honor-id]');
  const portraitsMode = getManifest().honorPortraits;

  articles.forEach(article => {
    const honorId = article.dataset.honorId;
    const meta = HONOR_META[honorId];
    if (!meta) return;
    meta.idForName = honorId;
    const data = honors[meta.honorKey];
    syncHonorPortrait(article, honorId, portraitsMode);
    updateHonorArticle(article, data, meta);
  });
}

/**
 * Inject or remove the ink-brush honor portrait based on the active theme's
 * feature manifest. When manifest.honorPortraits === 'photo', the article
 * gets a leading <img> referencing public/themes/teatable/honors/<id>.jpg.
 * Other manifest values strip the portrait so theme switches are clean.
 *
 * Idempotent — safe to call on every render. The image element is reused
 * across renders (only its src is updated if needed) so the browser doesn't
 * re-fetch every time honors recalculate.
 */
function syncHonorPortrait(article, honorId, portraitsMode) {
  const existing = article.querySelector(':scope > .honor__portrait');
  if (portraitsMode !== 'photo') {
    if (existing) existing.remove();
    return;
  }
  const src = `/themes/teatable/honors/${honorId}.jpg`;
  if (existing) {
    if (existing.getAttribute('src') !== src) existing.setAttribute('src', src);
    return;
  }
  const img = document.createElement('img');
  img.className = 'honor__portrait';
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.setAttribute('src', src);
  // Insert as the first child so the .honor flex layout puts it at the left.
  article.insertBefore(img, article.firstChild);
}
