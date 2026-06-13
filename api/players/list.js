// List and search players - Vercel Edge Function
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';
import { handleCorsPreflight, jsonResponse } from '../_cors.js';
import { parseListPagination, parsePlayerRecord, summarizePlayerForList, validateHandle } from './_utils.js';

const RESPONSE_OPTIONS = { methods: 'GET, OPTIONS' };

function normalizeSearchText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function matchesSearch(player, query) {
  if (!query) return true;
  return normalizeSearchText(player?.handle).includes(query) ||
    normalizeSearchText(player?.displayName).includes(query);
}

function hasListableHandle(player) {
  return typeof player?.handle === 'string' && validateHandle(player.handle);
}

function normalizePlayerKeyHandle(key) {
  if (typeof key !== 'string' || !key.startsWith('player:')) return null;
  const keyHandle = key.slice('player:'.length).toLowerCase();
  return validateHandle(keyHandle) ? keyHandle : null;
}

function normalizeRecordHandle(player) {
  if (!hasListableHandle(player)) return null;
  return player.handle.toLowerCase();
}

function parseListEntry(entry) {
  const keyHandle = normalizePlayerKeyHandle(entry?.key);
  if (!keyHandle) return null;

  const player = parsePlayerRecord(entry.value);
  return normalizeRecordHandle(player) === keyHandle ? player : null;
}

function getSortablePlayerTimestamp(player) {
  const rawValue = player?.lastActiveAt || player?.createdAt;
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return 0;

  const timestamp = Date.parse(rawValue);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getLadderRating(player) {
  const rating = Number(player?.stats?.ladder?.rating);
  return Number.isFinite(rating) ? rating : 0;
}

function getLadderSessions(player) {
  const sessions = Number(player?.stats?.ladder?.sessions);
  return Number.isFinite(sessions) && sessions > 0 ? sessions : 0;
}

// 天梯榜: ranked players (≥1 ladder session) first, by rating DESC; never-ranked
// players fall to the bottom in recency order so the board reads as a leaderboard.
function compareByLadder(a, b) {
  const aRanked = getLadderSessions(a) > 0;
  const bRanked = getLadderSessions(b) > 0;
  if (aRanked !== bRanked) return aRanked ? -1 : 1;
  if (aRanked && bRanked) {
    const byRating = getLadderRating(b) - getLadderRating(a);
    if (byRating !== 0) return byRating;
  }
  return getSortablePlayerTimestamp(b) - getSortablePlayerTimestamp(a);
}

export default async function handler(request) {
  const preflight = handleCorsPreflight(request, 'GET, OPTIONS');
  if (preflight) return preflight;

  // Only allow GET requests
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, { ...RESPONSE_OPTIONS, status: 405 });
  }

  try {
    // Parse query parameters
    const url = new URL(request.url);
    const searchQuery = normalizeSearchText(url.searchParams.get('q') || '');
    const sortBy = url.searchParams.get('sort') === 'ladder' ? 'ladder' : 'recent';
    const pagination = parseListPagination(url.searchParams);

    // Validate parameters
    if (pagination.error) {
      return jsonResponse({ error: pagination.error }, { ...RESPONSE_OPTIONS, status: 400 });
    }

    const { limit, offset } = pagination;

    // Get all player keys
    const playerKeys = await kv.keys('player:*');

    // Fetch all players
    const playerPromises = playerKeys.map(async key => ({
      key,
      value: await kv.get(key)
    }));
    const playerEntries = await Promise.all(playerPromises);

    // Parse and filter players
    let players = playerEntries
      .map(parseListEntry)
      .filter(Boolean);

    // Apply search filter if query provided
    if (searchQuery) {
      players = players.filter(player => matchesSearch(player, searchQuery));
    }

    // Sort: ladder leaderboard, or lastActiveAt DESC (default).
    players.sort(sortBy === 'ladder'
      ? compareByLadder
      : (a, b) => getSortablePlayerTimestamp(b) - getSortablePlayerTimestamp(a));

    // Get total count before pagination
    const total = players.length;

    // Apply pagination
    const paginatedPlayers = players.slice(offset, offset + limit);

    // Check if there are more results
    const hasMore = (offset + limit) < total;

    // Return compact list summaries. Full profiles include large photoBase64
    // blobs and private-ish history maps; clients fetch /api/players/{handle}
    // after selection when they need a complete profile.
    const summaries = paginatedPlayers.map(summarizePlayerForList);

    // Return results
    return jsonResponse({
      players: summaries,
      total: total,
      hasMore: hasMore
    }, RESPONSE_OPTIONS);

  } catch (error) {
    console.error('Failed to list players:', error);
    return jsonResponse({ error: 'Internal server error' }, { ...RESPONSE_OPTIONS, status: 500 });
  }
}

// Handle CORS preflight requests
export const config = {
  runtime: 'edge'
};
