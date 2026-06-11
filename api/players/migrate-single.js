// Single Player Migration - Faster, no timeout
// POST /api/players/migrate-single with { handle: "fufu" }

import { kv } from '@vercel/kv';
import { handleCorsPreflight, jsonResponse, parseJsonBody } from '../_cors.js';
import { initializePlayerStats, normalizeRecordMap, parsePlayerRecord, validateAdminToken, validateHandle } from './_utils.js';
import { applyLegacyRecentGamesToModeStats } from './_modeMigration.js';
import { normalizeHonorCounter } from '../../shared/honorCatalog.js';

const RESPONSE_OPTIONS = { methods: 'POST, OPTIONS' };

export default async function handler(request) {
  const preflight = handleCorsPreflight(request, 'POST, OPTIONS');
  if (preflight) return preflight;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { ...RESPONSE_OPTIONS, status: 405 });
  }

  try {
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return jsonResponse({ error: parsedBody.error }, { ...RESPONSE_OPTIONS, status: 400 });
    }

    const { handle, adminToken } = parsedBody.data;

    if (!validateAdminToken(adminToken)) {
      return jsonResponse({
        error: 'Unauthorized - Invalid admin token'
      }, { ...RESPONSE_OPTIONS, status: 403 });
    }

    if (!handle) {
      return jsonResponse({ error: 'Missing handle' }, { ...RESPONSE_OPTIONS, status: 400 });
    }

    if (!validateHandle(handle)) {
      return jsonResponse({ error: 'Invalid handle format' }, { ...RESPONSE_OPTIONS, status: 400 });
    }

    // Get player
    const playerData = await kv.get(`player:${handle.toLowerCase()}`);
    if (!playerData) {
      return jsonResponse({ error: 'Player not found' }, { ...RESPONSE_OPTIONS, status: 404 });
    }

    const player = parsePlayerRecord(playerData);
    if (!player) {
      return jsonResponse({ error: 'Player not found' }, { ...RESPONSE_OPTIONS, status: 404 });
    }
    const honorsBefore = JSON.stringify(player.stats?.honors || null);
    let statsInitialized = false;
    if (!player.stats || typeof player.stats !== 'object') {
      player.stats = initializePlayerStats();
      statsInitialized = true;
    }
    player.stats.honors = normalizeHonorCounter(player.stats.honors);
    const normalizedSessionHistory = normalizeRecordMap(player.stats.sessionHistory);
    const sessionHistoryChanged = normalizedSessionHistory !== player.stats.sessionHistory;
    player.stats.sessionHistory = normalizedSessionHistory;
    const honorsChanged = honorsBefore !== JSON.stringify(player.stats.honors);

    // Check if already migrated
    if (player.stats.stats4P && player.stats.stats4P.sessionsPlayed !== undefined) {
      if (statsInitialized || honorsChanged || sessionHistoryChanged) {
        await kv.set(`player:${handle.toLowerCase()}`, JSON.stringify(player));
      }
      return jsonResponse({
        success: true,
        message: 'Already migrated',
        normalizedHonors: statsInitialized || honorsChanged,
        normalizedSessionHistory: statsInitialized || sessionHistoryChanged,
        breakdown: player.stats.modeBreakdown
      }, RESPONSE_OPTIONS);
    }

    // Initialize mode stats
    const freshStats = initializePlayerStats();
    player.stats.stats4P = { ...freshStats.stats4P };
    player.stats.stats6P = { ...freshStats.stats6P };
    player.stats.stats8P = { ...freshStats.stats8P };
    player.stats.modeBreakdown = { '4P': 0, '6P': 0, '8P': 0 };

    let migratedGames = 0;

    // Process recent games
    if (player.recentGames && Array.isArray(player.recentGames)) {
      migratedGames = applyLegacyRecentGamesToModeStats(player);
    }

    // Save
    await kv.set(`player:${handle.toLowerCase()}`, JSON.stringify(player));

    return jsonResponse({
      success: true,
      handle,
      migratedGames,
      breakdown: player.stats.modeBreakdown
    }, RESPONSE_OPTIONS);

  } catch (error) {
    console.error('Migration error:', error);
    return jsonResponse({ error: error.message }, { ...RESPONSE_OPTIONS, status: 500 });
  }
}

export const config = {
  runtime: 'edge'
};
