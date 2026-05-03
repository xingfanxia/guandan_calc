// Get player profile - Vercel Edge Function
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';
import {
  validateHandle,
  initializePlayerStats,
  validatePlayerData,
  validateAdminToken,
  validateOwnershipToken,
  extractBearerToken,
  sanitizePlayer,
  constantTimeEqual
} from './_utils.js';

// Achievement checking - inline to avoid module imports in Edge Functions
function checkAchievements(stats, lastSession = null) {
  const earned = [];

  // Milestone achievements
  if ((stats.sessionsPlayed || stats.gamesPlayed) >= 1) earned.push('newbie');
  if ((stats.sessionsPlayed || stats.gamesPlayed) >= 10) earned.push('started');
  if ((stats.sessionsPlayed || stats.gamesPlayed) >= 100) earned.push('veteran');
  if ((stats.sessionsPlayed || stats.gamesPlayed) >= 1000) earned.push('legend');

  // Performance achievements
  if ((stats.sessionsWon || stats.wins) >= 1) earned.push('first_win');
  if (stats.longestWinStreak >= 5) earned.push('streak_5');
  if (stats.longestWinStreak >= 10) earned.push('streak_10');
  if ((stats.sessionsPlayed || stats.gamesPlayed) >= 20 && 
      (stats.sessionWinRate || stats.winRate || 0) >= 0.7) {
    earned.push('champion');
  }

  // Honor collection achievements
  const honors = stats.honors || {};
  const uniqueHonors = Object.values(honors).filter(count => count > 0).length;
  if (uniqueHonors >= 5) earned.push('honor_5');
  if (uniqueHonors >= 10) earned.push('honor_10');
  if (uniqueHonors >= 14) earned.push('honor_all');
  if ((honors['吕布'] || 0) >= 10) earned.push('lubu_10');

  // Session-specific achievements
  if (lastSession) {
    const rounds = lastSession.gamesInSession || 0;
    const avgRank = lastSession.ranking || 999;

    if (rounds > 50) earned.push('marathon');
    if (rounds < 15 && lastSession.teamWon) earned.push('quick_finish');
    if (avgRank <= 1.5) earned.push('perfect');
    if ((lastSession.lastPlaces || 0) >= 5 && lastSession.teamWon) earned.push('unlucky');
  }

  return earned;
}

// Migrate historical games to mode-specific stats (runs once per player)
function migrateToModeStats(player) {
  // Check if already migrated
  if (player.stats.stats4P && player.stats.stats4P.sessionsPlayed !== undefined) {
    return false; // Already migrated
  }

  console.log(`Migrating historical games for @${player.handle}`);

  // Initialize mode-specific stats (initializePlayerStats imported at top — Edge runtime is ESM-only,
  // a CommonJS `require` here was dead code that would have thrown if this branch ever ran)
  const freshStats = initializePlayerStats();
  player.stats.stats4P = { ...freshStats.stats4P };
  player.stats.stats6P = { ...freshStats.stats6P };
  player.stats.stats8P = { ...freshStats.stats8P };
  player.stats.modeBreakdown = { '4P': 0, '6P': 0, '8P': 0 };

  // Replay recent games to populate mode stats
  // Note: recentGames is stored newest-first, so reverse for chronological replay
  if (player.recentGames && Array.isArray(player.recentGames)) {
    const gamesOldestFirst = [...player.recentGames].reverse();
    const overallRecentRankings = player.stats.recentRankings || [];
    const rankingsByMode = { '4P': [], '6P': [], '8P': [] }; // Collect rankings per mode

    gamesOldestFirst.forEach((game, gameIndex) => {
      const mode = game.mode; // '4P', '6P', '8P'
      if (!mode) {
        console.log(`Skipping game ${gameIndex}: no mode`);
        return;
      }

      const modeStats = player.stats[`stats${mode}`];
      if (!modeStats) {
        console.log(`Skipping game ${gameIndex}: no stats for ${mode}`);
        return;
      }

      console.log(`Processing game ${gameIndex}: ${mode}, room=${game.roomCode}, duration=${game.duration}`);

      // Increment session counter
      modeStats.sessionsPlayed++;
      if (game.teamWon) modeStats.sessionsWon++;

      // Update win rate
      modeStats.sessionWinRate = modeStats.sessionsWon / modeStats.sessionsPlayed;

      // Update average ranking per session
      const prevTotal = modeStats.avgRankingPerSession * (modeStats.sessionsPlayed - 1);
      modeStats.avgRankingPerSession = (prevTotal + game.ranking) / modeStats.sessionsPlayed;

      // Update rounds tracking
      if (game.rounds) {
        modeStats.roundsPlayed += game.rounds;
        const prevRoundsTotal = modeStats.avgRoundsPerSession * (modeStats.sessionsPlayed - 1);
        modeStats.avgRoundsPerSession = (prevRoundsTotal + game.rounds) / modeStats.sessionsPlayed;

        // Update avgRankingPerRound (weighted by rounds in this session)
        const prevRoundRankTotal = modeStats.avgRankingPerRound * (modeStats.roundsPlayed - game.rounds);
        modeStats.avgRankingPerRound = (prevRoundRankTotal + (game.ranking * game.rounds)) / modeStats.roundsPlayed;

        if (game.rounds > modeStats.longestSessionRounds) {
          modeStats.longestSessionRounds = game.rounds;
        }
      }

      // Update time tracking
      if (game.duration) {
        const before = modeStats.totalPlayTimeSeconds || 0;
        modeStats.totalPlayTimeSeconds = before + game.duration;
        console.log(`[${mode}] Time: ${before} + ${game.duration} = ${modeStats.totalPlayTimeSeconds}`);

        if (game.duration > (modeStats.longestSessionSeconds || 0)) {
          modeStats.longestSessionSeconds = game.duration;
        }
        modeStats.avgSessionSeconds = modeStats.totalPlayTimeSeconds / modeStats.sessionsPlayed;
      } else {
        console.log(`[${mode}] No duration for game`);
      }

      // Add to recent rankings per mode (collect, will trim to 10 later)
      // Use overall recentRankings at corresponding index (they're in same order)
      const rankingIndex = player.recentGames.length - 1 - gameIndex; // Convert to index in original array
      const ranking = overallRecentRankings[rankingIndex];
      if (ranking !== undefined) {
        rankingsByMode[mode].push(ranking);
      }

      // Update mode breakdown
      player.stats.modeBreakdown[mode]++;

      // Update win/loss streaks (calculate from game outcomes in chronological order)
      if (game.teamWon) {
        modeStats.currentWinStreak = (modeStats.currentWinStreak || 0) + 1;
        modeStats.currentLossStreak = 0;
        if (modeStats.currentWinStreak > (modeStats.longestWinStreak || 0)) {
          modeStats.longestWinStreak = modeStats.currentWinStreak;
        }
      } else {
        modeStats.currentLossStreak = (modeStats.currentLossStreak || 0) + 1;
        modeStats.currentWinStreak = 0;
        if (modeStats.currentLossStreak > (modeStats.longestLossStreak || 0)) {
          modeStats.longestLossStreak = modeStats.currentLossStreak;
        }
      }
    });

    // Assign collected rankings to each mode (keep last 10, newest first)
    player.stats.stats4P.recentRankings = rankingsByMode['4P'].slice(-10).reverse();
    player.stats.stats6P.recentRankings = rankingsByMode['6P'].slice(-10).reverse();
    player.stats.stats8P.recentRankings = rankingsByMode['8P'].slice(-10).reverse();

    console.log(`Migration complete: 4P=${player.stats.modeBreakdown['4P']}, 6P=${player.stats.modeBreakdown['6P']}, 8P=${player.stats.modeBreakdown['8P']}`);
    console.log(`Time stats BEFORE aggregation: 6P=${player.stats.stats6P?.totalPlayTimeSeconds}, 8P=${player.stats.stats8P?.totalPlayTimeSeconds}`);

    // ===== AGGREGATE ALL STATS FROM MODE-SPECIFIC TO OVERALL =====
    const s4 = player.stats.stats4P || {};
    const s6 = player.stats.stats6P || {};
    const s8 = player.stats.stats8P || {};

    // Session stats (sum across modes)
    player.stats.sessionsPlayed = (s4.sessionsPlayed || 0) + (s6.sessionsPlayed || 0) + (s8.sessionsPlayed || 0);
    player.stats.sessionsWon = (s4.sessionsWon || 0) + (s6.sessionsWon || 0) + (s8.sessionsWon || 0);
    player.stats.sessionWinRate = player.stats.sessionsPlayed > 0
      ? player.stats.sessionsWon / player.stats.sessionsPlayed
      : 0;

    // Avg ranking per session (weighted average)
    const totalRankingSum =
      (s4.avgRankingPerSession || 0) * (s4.sessionsPlayed || 0) +
      (s6.avgRankingPerSession || 0) * (s6.sessionsPlayed || 0) +
      (s8.avgRankingPerSession || 0) * (s8.sessionsPlayed || 0);
    player.stats.avgRankingPerSession = player.stats.sessionsPlayed > 0
      ? totalRankingSum / player.stats.sessionsPlayed
      : 0;

    // Avg rounds per session (weighted average)
    const totalRoundsSum =
      (s4.avgRoundsPerSession || 0) * (s4.sessionsPlayed || 0) +
      (s6.avgRoundsPerSession || 0) * (s6.sessionsPlayed || 0) +
      (s8.avgRoundsPerSession || 0) * (s8.sessionsPlayed || 0);
    player.stats.avgRoundsPerSession = player.stats.sessionsPlayed > 0
      ? totalRoundsSum / player.stats.sessionsPlayed
      : 0;

    // Longest session (max across modes)
    player.stats.longestSessionRounds = Math.max(
      s4.longestSessionRounds || 0,
      s6.longestSessionRounds || 0,
      s8.longestSessionRounds || 0
    );

    // Round stats (sum across modes)
    player.stats.roundsPlayed = (s4.roundsPlayed || 0) + (s6.roundsPlayed || 0) + (s8.roundsPlayed || 0);
    const totalRoundRankSum =
      (s4.avgRankingPerRound || 0) * (s4.roundsPlayed || 0) +
      (s6.avgRankingPerRound || 0) * (s6.roundsPlayed || 0) +
      (s8.avgRankingPerRound || 0) * (s8.roundsPlayed || 0);
    player.stats.avgRankingPerRound = player.stats.roundsPlayed > 0
      ? totalRoundRankSum / player.stats.roundsPlayed
      : 0;

    // Time stats (sum and max)
    player.stats.totalPlayTimeSeconds =
      (s4.totalPlayTimeSeconds || 0) +
      (s6.totalPlayTimeSeconds || 0) +
      (s8.totalPlayTimeSeconds || 0);

    player.stats.longestSessionSeconds = Math.max(
      s4.longestSessionSeconds || 0,
      s6.longestSessionSeconds || 0,
      s8.longestSessionSeconds || 0
    );

    player.stats.avgSessionSeconds = player.stats.sessionsPlayed > 0
      ? player.stats.totalPlayTimeSeconds / player.stats.sessionsPlayed
      : 0;

    // Streaks (use overall, not mode-specific)
    // Current streaks are per-mode, overall tracks the latest game across all modes
    // For now, use the most recent mode's streak (can enhance later)
    const modes = ['4P', '6P', '8P'];
    let maxLongestWin = 0;
    let maxLongestLoss = 0;
    modes.forEach(mode => {
      const mStats = player.stats[`stats${mode}`];
      if (mStats) {
        maxLongestWin = Math.max(maxLongestWin, mStats.longestWinStreak || 0);
        maxLongestLoss = Math.max(maxLongestLoss, mStats.longestLossStreak || 0);
      }
    });
    player.stats.longestWinStreak = maxLongestWin;
    player.stats.longestLossStreak = maxLongestLoss;

    // Legacy fields (for backward compat)
    player.stats.gamesPlayed = player.stats.sessionsPlayed;
    player.stats.wins = player.stats.sessionsWon;
    player.stats.winRate = player.stats.sessionWinRate;
    player.stats.avgRanking = player.stats.avgRankingPerSession;
  }

  return true; // Migration performed
}

export default async function handler(request) {
  // Only allow GET and PUT requests
  if (request.method !== 'GET' && request.method !== 'PUT') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Extract handle from URL
    const url = new URL(request.url);
    const handle = url.pathname.split('/').pop().toLowerCase();

    // Validate handle format
    if (!validateHandle(handle)) {
      return new Response(JSON.stringify({
        error: 'Invalid handle format'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'GET') {
      // Get player data from KV
      const playerData = await kv.get(`player:${handle}`);

      if (!playerData) {
        return new Response(JSON.stringify({
          error: 'Player not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Parse player data (might be string or object)
      const player = typeof playerData === 'string' ? JSON.parse(playerData) : playerData;

      // Check if migration requested via query param
      const url = new URL(request.url);
      if (url.searchParams.get('migrate') === 'true') {
        const migrated = migrateToModeStats(player);
        if (migrated) {
          await kv.set(`player:${handle}`, JSON.stringify(player));
          console.log(`✅ Migrated @${handle} via GET param`);
        }
      }

      // Return full player profile (strip token hash — internal-only)
      return new Response(JSON.stringify({
        success: true,
        player: sanitizePlayer(player)
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });

    } else if (request.method === 'PUT') {
      // Parse request body
      const requestData = await request.json();

      // Check if this is a profile update (not a game stats update)
      if (requestData.mode === 'PROFILE_UPDATE') {
        // ===== PROFILE UPDATE MODE =====
        const updates = requestData;

        // Get existing player FIRST — needed both for the ownership check
        // (must compare Bearer against stored hash) and for the update target.
        const existingData = await kv.get(`player:${handle}`);
        if (!existingData) {
          return new Response(JSON.stringify({
            error: 'Player not found'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        const player = typeof existingData === 'string' ? JSON.parse(existingData) : existingData;

        // Auth: admin token (body) OR ownership Bearer (header).
        // Admin always overrides; owner only works if the player record was created
        // with the new ownership-token flow (legacy records have no hash, fall through to admin-only).
        const adminOk = validateAdminToken(updates.adminToken);
        let ownerOk = false;
        if (!adminOk) {
          const bearer = extractBearerToken(request);
          if (bearer && player.ownershipTokenHash) {
            ownerOk = await validateOwnershipToken(bearer, player.ownershipTokenHash);
          }
        }

        if (!adminOk && !ownerOk) {
          return new Response(JSON.stringify({
            error: 'Unauthorized — profile updates require ownership token or admin token'
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        const validation = validatePlayerData({
          handle,  // For validation only (not updated)
          displayName: updates.displayName || 'dummy',  // Required for validation
          emoji: updates.emoji || '🐶',  // Required for validation
          photoBase64: updates.photoBase64,  // Optional
          playStyle: updates.playStyle || 'steady',  // Required for validation
          tagline: updates.tagline || 'dummy'  // Required for validation
        });

        if (!validation.valid) {
          return new Response(JSON.stringify({
            error: validation.error
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Update ONLY profile fields (not stats, not handle, not ownershipTokenHash)
        if (updates.displayName !== undefined) player.displayName = updates.displayName;
        if (updates.emoji !== undefined) player.emoji = updates.emoji;
        if (updates.photoBase64 !== undefined) player.photoBase64 = updates.photoBase64;  // Can be null to remove
        if (updates.playStyle !== undefined) player.playStyle = updates.playStyle;
        if (updates.tagline !== undefined) player.tagline = updates.tagline;

        // Update lastActiveAt
        player.lastActiveAt = new Date().toISOString();

        // Save to KV
        await kv.set(`player:${handle}`, JSON.stringify(player));

        console.log(`Profile updated for @${handle} (auth: ${adminOk ? 'admin' : 'owner'})`);

        return new Response(JSON.stringify({
          success: true,
          player: sanitizePlayer(player)
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

      // ===== GAME STATS UPDATE MODE (existing logic) =====
      const gameResult = requestData;

      // Validate required fields
      if (!gameResult.roomCode || gameResult.ranking === undefined || !gameResult.team) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: roomCode, ranking, team'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get existing player data
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

      // Load the room once (single KV roundtrip) — used by BOTH the auth gate
      // (host-Bearer check needs room.authToken + room.players[]) and the
      // authoritative vote-count fetch later (P1 #2 fix: don't trust
      // client-supplied mvpVoteCount / burdenVoteCount). LOCAL games and
      // malformed roomCodes skip the load — `_room` stays null.
      // ACCEPTED LOW (security review 2026-05-03): timing oracle for "room
      // exists?" is acceptable since room codes are already public via
      // /api/rooms/list.
      const submittedRoomCode = gameResult.roomCode;
      const isRealRoomCode = typeof submittedRoomCode === 'string' && /^[A-Z0-9]{6}$/.test(submittedRoomCode);
      let _room = null;
      if (isRealRoomCode) {
        const roomData = await kv.get(`room:${submittedRoomCode}`);
        if (roomData) {
          _room = typeof roomData === 'string' ? JSON.parse(roomData) : roomData;
        }
      }

      // ===== AUTH GATE for stats path =====
      // Three valid credentials, in priority order. Any one passes:
      //   1. adminToken in body — admin override (always valid)
      //   2. Authorization: Bearer <ownershipToken> matching THIS player's hash —
      //      owner self-update from their own device
      //   3. Authorization: Bearer <roomAuthToken> matching the stored token of
      //      the room identified by gameResult.roomCode AND target handle is
      //      listed in that room's players[] — host writing for a participant
      //
      // For LOCAL games (no room), only paths 1 and 2 are available. Without this
      // gate, an unauthenticated client could pollute any player's career stats
      // (ranking averages, MVP votes, partner graph, win streaks) by spamming PUT.
      const _bearer = extractBearerToken(request);
      const _adminOk = validateAdminToken(gameResult.adminToken);
      let _ownerOk = false;
      let _hostOk = false;

      if (!_adminOk && _bearer) {
        if (player.ownershipTokenHash) {
          _ownerOk = await validateOwnershipToken(_bearer, player.ownershipTokenHash);
        }

        if (!_ownerOk && _room && _room.authToken && constantTimeEqual(_bearer, _room.authToken)) {
          const roomPlayers = Array.isArray(_room.players) ? _room.players : [];
          const inRoom = roomPlayers.some(p => p && typeof p.handle === 'string' && p.handle.toLowerCase() === handle);
          if (inRoom) _hostOk = true;
        }
      }

      if (!_adminOk && !_ownerOk && !_hostOk) {
        return new Response(JSON.stringify({
          error: 'Unauthorized — stats updates require room-host bearer, owner bearer, or admin token'
        }), {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'WWW-Authenticate': 'Bearer realm="player-stats"'
          }
        });
      }

      // ===== AUTHORITATIVE VOTE COUNTS (P1 #2 fix) =====
      // For room games, override client-supplied mvpVoteCount / burdenVoteCount
      // with the server's actual stored counts. Even an authenticated host
      // shouldn't be able to inflate vote totals — auth proves identity, not
      // truth-of-claim. For LOCAL games there's no shared store, so client
      // values are the only source — accepted (LOCAL stats only update the
      // client's own profile via owner-Bearer, so the worst case is self-spam).
      if (_room) {
        const roomPlayers = Array.isArray(_room.players) ? _room.players : [];
        const targetPlayer = roomPlayers.find(
          p => p && typeof p.handle === 'string' && p.handle.toLowerCase() === handle
        );
        if (targetPlayer && targetPlayer.id !== undefined) {
          const mvpMap = (_room.endGameVotes && _room.endGameVotes.mvp) || {};
          const burdenMap = (_room.endGameVotes && _room.endGameVotes.burden) || {};
          gameResult.mvpVoteCount = Math.max(0, Number(mvpMap[targetPlayer.id]) || 0);
          gameResult.burdenVoteCount = Math.max(0, Number(burdenMap[targetPlayer.id]) || 0);
        } else {
          // Defensive (LOW finding from review 2026-05-03): if room metadata is
          // malformed and targetPlayer.id can't be resolved, force authoritative
          // values to 0 rather than leaving client values to flow through. The
          // host-Bearer path already passed (target handle was in players[]),
          // but a missing/undefined id means we can't index the vote map, so
          // refusing to inherit anything is the safest behavior.
          gameResult.mvpVoteCount = 0;
          gameResult.burdenVoteCount = 0;
        }
      }

      // Defense in depth: even with the gate above, snapshot security-sensitive
      // fields BEFORE any mutation so the stats path cannot mutate
      // `ownershipTokenHash` or `id` even if `gameResult` smuggled in matching
      // keys via a future code path. Restore the snapshot before save.
      const _frozenOwnershipHash = player.ownershipTokenHash;
      const _frozenId = player.id;

      // Run migration if needed (once per player)
      const migrated = migrateToModeStats(player);
      if (migrated) {
        console.log(`✅ Migrated @${player.handle} to mode-specific stats`);
      }

      // Update stats - now receiving SESSION stats (multiple rounds)
      const gamesInSession = gameResult.gamesInSession || 1;

      // Check if this is vote-only update
      const isVoteOnly = gameResult.mode === 'VOTE_ONLY';
      
      if (!isVoteOnly) {
        // ===== UPDATE OVERALL STATS =====
        // Snapshot the OLD count BEFORE incrementing — running averages must use N_old.
        // Previously: prevSessionTotal multiplied by (sessionsPlayed - 1) AFTER increment,
        // which is mathematically `N_new - 1 = N_old`, but only by accident on first session
        // (because `|| 1` masked N_old=0). On subsequent sessions, the new ranking was
        // double-counted in the running average.
        const prevSessionsPlayed = player.stats.sessionsPlayed || 0;

        player.stats.sessionsPlayed = prevSessionsPlayed + 1;
        if (gameResult.teamWon) {
          player.stats.sessionsWon = (player.stats.sessionsWon || 0) + 1;
        }
        player.stats.sessionWinRate = player.stats.sessionsPlayed > 0
          ? player.stats.sessionsWon / player.stats.sessionsPlayed
          : 0;

        // Running average using N_old (snapshotted above)
        const prevSessionTotal = (player.stats.avgRankingPerSession || 0) * prevSessionsPlayed;
        player.stats.avgRankingPerSession = (prevSessionTotal + gameResult.ranking) / player.stats.sessionsPlayed;

        const prevRoundsTotal = (player.stats.avgRoundsPerSession || 0) * prevSessionsPlayed;
        player.stats.avgRoundsPerSession = (prevRoundsTotal + gamesInSession) / player.stats.sessionsPlayed;
        
        // Update longest session by rounds
        if (gamesInSession > (player.stats.longestSessionRounds || 0)) {
          player.stats.longestSessionRounds = gamesInSession;
        }
        
        // Round-level stats (weighted by actual rounds)
        player.stats.roundsPlayed = (player.stats.roundsPlayed || 0) + gamesInSession;
        const prevRoundTotal = (player.stats.avgRankingPerRound || 0) * ((player.stats.roundsPlayed || gamesInSession) - gamesInSession);
        player.stats.avgRankingPerRound = (prevRoundTotal + (gameResult.ranking * gamesInSession)) / player.stats.roundsPlayed;
        
        // Time tracking
        const sessionDuration = gameResult.sessionDuration || 0;
        if (sessionDuration > 0) {
          player.stats.totalPlayTimeSeconds = (player.stats.totalPlayTimeSeconds || 0) + sessionDuration;
          
          if (sessionDuration > (player.stats.longestSessionSeconds || 0)) {
            player.stats.longestSessionSeconds = sessionDuration;
          }
          
          player.stats.avgSessionSeconds = player.stats.totalPlayTimeSeconds / player.stats.sessionsPlayed;
        }
        
        // Legacy fields (for backward compatibility)
        player.stats.gamesPlayed = player.stats.sessionsPlayed;
        player.stats.wins = player.stats.sessionsWon;
        player.stats.winRate = player.stats.sessionWinRate;
        player.stats.avgRanking = player.stats.avgRankingPerSession;

        // Update recent rankings - add relative position within session
        player.stats.recentRankings = player.stats.recentRankings || [];
        player.stats.recentRankings.unshift(gameResult.relativeRank || Math.round(gameResult.ranking));
        if (player.stats.recentRankings.length > 10) {
          player.stats.recentRankings = player.stats.recentRankings.slice(0, 10);
        }

        // Update honors (from session calculation)
        if (gameResult.honorsEarned && Array.isArray(gameResult.honorsEarned)) {
          gameResult.honorsEarned.forEach(honor => {
            if (player.stats.honors[honor] !== undefined) {
              player.stats.honors[honor] = (player.stats.honors[honor] || 0) + 1;
            }
          });
        }

        // Update community voting stats (idempotent with votingHistory)
        const roomCode = gameResult.roomCode;
        player.stats.votingHistory = player.stats.votingHistory || {};

        const oldVotes = player.stats.votingHistory[roomCode] || { mvp: 0, burden: 0 };
        // Use ?? not || so explicit `0` from client is respected (0 votes received).
        // Previously `||` would fall through to the votedMVP boolean and flip 0 to 1.
        const newMvpVotes = gameResult.mvpVoteCount ?? (gameResult.votedMVP ? 1 : 0);
        const newBurdenVotes = gameResult.burdenVoteCount ?? (gameResult.votedBurden ? 1 : 0);

        const mvpDelta = newMvpVotes - oldVotes.mvp;
        const burdenDelta = newBurdenVotes - oldVotes.burden;

        // Clamp running totals at 0 — `votingHistory` deltas can legitimately
        // go negative (vote reset, authoritative read drops below previously-
        // synced count), so without the clamp legacy/inflated histories could
        // push lifetime totals below zero.
        player.stats.mvpVotes = Math.max(0, (player.stats.mvpVotes || 0) + mvpDelta);
        player.stats.burdenVotes = Math.max(0, (player.stats.burdenVotes || 0) + burdenDelta);

        // Update room history (overwrite)
        player.stats.votingHistory[roomCode] = {
          mvp: newMvpVotes,
          burden: newBurdenVotes,
          lastSynced: new Date().toISOString()
        };

        // Update partner/opponent tracking
        player.stats.partners = player.stats.partners || {};
        player.stats.opponents = player.stats.opponents || {};

        // Track teammates
        if (gameResult.teammates && Array.isArray(gameResult.teammates)) {
          gameResult.teammates.forEach(teammateHandle => {
            if (!player.stats.partners[teammateHandle]) {
              player.stats.partners[teammateHandle] = { games: 0, wins: 0, winRate: 0 };
            }
            player.stats.partners[teammateHandle].games += 1;
            if (gameResult.teamWon) {
              player.stats.partners[teammateHandle].wins += 1;
            }
            player.stats.partners[teammateHandle].winRate = 
              player.stats.partners[teammateHandle].wins / player.stats.partners[teammateHandle].games;
          });
        }

        // Track opponents
        if (gameResult.opponents && Array.isArray(gameResult.opponents)) {
          gameResult.opponents.forEach(opponentHandle => {
            if (!player.stats.opponents[opponentHandle]) {
              player.stats.opponents[opponentHandle] = { games: 0, wins: 0, winRate: 0 };
            }
            player.stats.opponents[opponentHandle].games += 1;
            if (gameResult.teamWon) {
              player.stats.opponents[opponentHandle].wins += 1;
            }
            player.stats.opponents[opponentHandle].winRate = 
              player.stats.opponents[opponentHandle].wins / player.stats.opponents[opponentHandle].games;
          });
        }

        // Update win/loss streaks (session counts as 1)
        // Defensive `|| 0` guards against legacy players where a NaN/undefined could
        // poison the field permanently (NaN + 1 = NaN forever after).
        if (gameResult.teamWon) {
          player.stats.currentWinStreak = (player.stats.currentWinStreak || 0) + 1;
          player.stats.currentLossStreak = 0;
          if (player.stats.currentWinStreak > (player.stats.longestWinStreak || 0)) {
            player.stats.longestWinStreak = player.stats.currentWinStreak;
          }
        } else {
          player.stats.currentLossStreak = (player.stats.currentLossStreak || 0) + 1;
          player.stats.currentWinStreak = 0;
          if (player.stats.currentLossStreak > (player.stats.longestLossStreak || 0)) {
            player.stats.longestLossStreak = player.stats.currentLossStreak;
          }
        }

        // Add to recent games (keep last 20)
        player.recentGames = player.recentGames || [];
        player.recentGames.unshift({
          roomCode: gameResult.roomCode,
          date: new Date().toISOString(),
          mode: gameResult.mode || '8P',
          ranking: Math.round(gameResult.ranking * 10) / 10,  // Session average
          team: gameResult.team,
          teamWon: gameResult.teamWon,
          rounds: gamesInSession,  // How many rounds in this session
          duration: sessionDuration,  // Session duration in seconds
          firstPlaces: gameResult.firstPlaces || 0,
          lastPlaces: gameResult.lastPlaces || 0,
          honorsEarned: gameResult.honorsEarned || []
        });
        if (player.recentGames.length > 20) {
          player.recentGames = player.recentGames.slice(0, 20);
        }

        // Update lastActiveAt
        player.lastActiveAt = new Date().toISOString();

        // Check for new achievements
        const oldAchievements = player.achievements || [];
        const newAchievements = checkAchievements(player.stats, gameResult);
        player.achievements = newAchievements;
        const unlockedAchievements = newAchievements.filter(id => !oldAchievements.includes(id));

        // ===== UPDATE MODE-SPECIFIC STATS =====
        const gameMode = gameResult.mode; // '4P', '6P', '8P'
        if (gameMode && player.stats[`stats${gameMode}`]) {
          const modeStats = player.stats[`stats${gameMode}`];

          // Snapshot OLD count before increment — same fix as overall stats above
          const mPrevSessionsPlayed = modeStats.sessionsPlayed || 0;

          modeStats.sessionsPlayed = mPrevSessionsPlayed + 1;
          if (gameResult.teamWon) {
            modeStats.sessionsWon = (modeStats.sessionsWon || 0) + 1;
          }
          modeStats.sessionWinRate = modeStats.sessionsPlayed > 0
            ? modeStats.sessionsWon / modeStats.sessionsPlayed
            : 0;

          // Running averages using N_old
          const mPrevSessionTotal = (modeStats.avgRankingPerSession || 0) * mPrevSessionsPlayed;
          modeStats.avgRankingPerSession = (mPrevSessionTotal + gameResult.ranking) / modeStats.sessionsPlayed;

          const mPrevRoundsTotal = (modeStats.avgRoundsPerSession || 0) * mPrevSessionsPlayed;
          modeStats.avgRoundsPerSession = (mPrevRoundsTotal + gamesInSession) / modeStats.sessionsPlayed;
          
          // Update longest session by rounds
          if (gamesInSession > (modeStats.longestSessionRounds || 0)) {
            modeStats.longestSessionRounds = gamesInSession;
          }
          
          // Round-level stats
          modeStats.roundsPlayed = (modeStats.roundsPlayed || 0) + gamesInSession;
          const mPrevRoundTotal = (modeStats.avgRankingPerRound || 0) * ((modeStats.roundsPlayed || gamesInSession) - gamesInSession);
          modeStats.avgRankingPerRound = (mPrevRoundTotal + (gameResult.ranking * gamesInSession)) / modeStats.roundsPlayed;
          
          // Time tracking
          const sessionDuration = gameResult.sessionDuration || 0;
          if (sessionDuration > 0) {
            modeStats.totalPlayTimeSeconds = (modeStats.totalPlayTimeSeconds || 0) + sessionDuration;
            
            if (sessionDuration > (modeStats.longestSessionSeconds || 0)) {
              modeStats.longestSessionSeconds = sessionDuration;
            }
            
            modeStats.avgSessionSeconds = modeStats.totalPlayTimeSeconds / modeStats.sessionsPlayed;
          }
          
          // Update mode breakdown counter
          player.stats.modeBreakdown = player.stats.modeBreakdown || { '4P': 0, '6P': 0, '8P': 0 };
          player.stats.modeBreakdown[gameMode] = (player.stats.modeBreakdown[gameMode] || 0) + 1;
          
          // Add to mode-specific recent rankings
          modeStats.recentRankings = modeStats.recentRankings || [];
          modeStats.recentRankings.unshift(gameResult.relativeRank || Math.round(gameResult.ranking));
          if (modeStats.recentRankings.length > 10) {
            modeStats.recentRankings = modeStats.recentRankings.slice(0, 10);
          }
          
          // Update streaks for this mode
          if (gameResult.teamWon) {
            modeStats.currentWinStreak = (modeStats.currentWinStreak || 0) + 1;
            modeStats.currentLossStreak = 0;
            if (modeStats.currentWinStreak > (modeStats.longestWinStreak || 0)) {
              modeStats.longestWinStreak = modeStats.currentWinStreak;
            }
          } else {
            modeStats.currentLossStreak = (modeStats.currentLossStreak || 0) + 1;
            modeStats.currentWinStreak = 0;
            if (modeStats.currentLossStreak > (modeStats.longestLossStreak || 0)) {
              modeStats.longestLossStreak = modeStats.currentLossStreak;
            }
          }
        }

        // Restore the snapshotted security-sensitive fields. The stats path
        // shouldn't be able to overwrite these even by accident.
        if (_frozenOwnershipHash !== undefined) player.ownershipTokenHash = _frozenOwnershipHash;
        if (_frozenId !== undefined) player.id = _frozenId;

        // Save updated player
        await kv.set(`player:${handle}`, JSON.stringify(player));

        return new Response(JSON.stringify({
          success: true,
          updatedStats: player.stats,
          newAchievements: unlockedAchievements  // Return newly unlocked achievements
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });
      } else {
        // Vote-only mode: only update voting stats (idempotent with votingHistory)
        const roomCode = gameResult.roomCode;
        player.stats.votingHistory = player.stats.votingHistory || {};

        const oldVotes = player.stats.votingHistory[roomCode] || { mvp: 0, burden: 0 };
        // Use ?? not || — see comment in non-vote-only path above
        const newMvpVotes = gameResult.mvpVoteCount ?? (gameResult.votedMVP ? 1 : 0);
        const newBurdenVotes = gameResult.burdenVoteCount ?? (gameResult.votedBurden ? 1 : 0);

        const mvpDelta = newMvpVotes - oldVotes.mvp;
        const burdenDelta = newBurdenVotes - oldVotes.burden;

        // Clamp running totals at 0 — `votingHistory` deltas can legitimately
        // go negative (vote reset, authoritative read drops below previously-
        // synced count), so without the clamp legacy/inflated histories could
        // push lifetime totals below zero.
        player.stats.mvpVotes = Math.max(0, (player.stats.mvpVotes || 0) + mvpDelta);
        player.stats.burdenVotes = Math.max(0, (player.stats.burdenVotes || 0) + burdenDelta);

        // Update room history (overwrite)
        player.stats.votingHistory[roomCode] = {
          mvp: newMvpVotes,
          burden: newBurdenVotes,
          lastSynced: new Date().toISOString()
        };

        // Restore the snapshotted security-sensitive fields (see stats path above)
        if (_frozenOwnershipHash !== undefined) player.ownershipTokenHash = _frozenOwnershipHash;
        if (_frozenId !== undefined) player.id = _frozenId;

        // Save updated player
        await kv.set(`player:${handle}`, JSON.stringify(player));

        return new Response(JSON.stringify({
          success: true,
          updatedStats: player.stats,
          newAchievements: []  // No new achievements in vote-only mode
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
    }

  } catch (error) {
    console.error('Failed to get player:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle CORS preflight requests
export const config = {
  runtime: 'edge'
};
