// List rooms for browsing (all rooms or favorites, with player filtering)
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';
import { handleCorsPreflight, jsonResponse } from '../_cors.js';
import { parseRoomIndex } from './_index.js';
import { summarizeRoomForList } from './_summary.js';

const RESPONSE_OPTIONS = { methods: 'GET, OPTIONS' };

function parsePositiveIntParam(searchParams, name, fallback, max) {
  const rawValue = searchParams.get(name);
  if (rawValue === null || rawValue === '') return { value: fallback };
  if (!/^\d+$/.test(rawValue)) {
    return { error: `Invalid ${name}. Must be an integer between 1 and ${max}.` };
  }

  const value = Number(rawValue);
  if (value < 1) {
    return { error: `Invalid ${name}. Must be an integer between 1 and ${max}.` };
  }
  return { value: Math.min(value, max) };
}

function normalizePlayerFilter(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function getRenderableTimestamp(room) {
  const rawValue = room?.lastUpdated || room?.createdAt;
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return null;

  const timestamp = Date.parse(rawValue);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export { summarizeRoomForList };

export default async function handler(request) {
  const preflight = handleCorsPreflight(request, 'GET, OPTIONS');
  if (preflight) return preflight;

  if (request.method !== 'GET') {
    return jsonResponse({
      error: 'Method not allowed' 
    }, { ...RESPONSE_OPTIONS, status: 405 });
  }

  try {
    const url = new URL(request.url);
    const filterPlayer = normalizePlayerFilter(url.searchParams.get('player')); // Filter by player handle
    const onlyFavorites = url.searchParams.get('favorites') === 'true';
    const pageParam = parsePositiveIntParam(url.searchParams, 'page', 1, 1000);
    const limitParam = parsePositiveIntParam(url.searchParams, 'limit', 20, 100);
    if (pageParam.error || limitParam.error) {
      return jsonResponse({
        error: pageParam.error || limitParam.error
      }, { ...RESPONSE_OPTIONS, status: 400 });
    }
    const page = pageParam.value;
    const limit = limitParam.value;

    let roomsList = [];

    const indexKey = onlyFavorites ? 'favorites:index' : 'rooms:index';
    const roomIndex = parseRoomIndex(await kv.get(indexKey));

    // Fetch live room data so cards use the canonical v10 room schema instead
    // of stale index snapshots.
    const roomDataPromises = roomIndex.map(async (entry) => {
      try {
        const roomData = await kv.get(`room:${entry.roomCode}`);
        if (!roomData) return null;
        return summarizeRoomForList(roomData, {
          ...entry,
          isFavorite: onlyFavorites || entry.isFavorite
        });
      } catch (err) {
        console.error(`Error fetching room ${entry.roomCode}:`, err);
        return null;
      }
    });

    const roomDataList = await Promise.all(roomDataPromises);
    roomsList = roomDataList.filter(r =>
      r !== null &&
      r.roomCode &&
      getRenderableTimestamp(r) !== null
    );

    // Filter out rooms with test players (handles starting with 'test_')
    roomsList = roomsList.filter(room => {
      if (!room.playerHandles || room.playerHandles.length === 0) return true;
      return !room.playerHandles.some(handle =>
        typeof handle === 'string' && handle.toLowerCase().startsWith('test_')
      );
    });

    // Filter by player handle if specified
    if (filterPlayer) {
      roomsList = roomsList.filter(room => 
        room.playerHandles?.some(h => 
          typeof h === 'string' && h.toLowerCase().includes(filterPlayer)
        )
      );
    }

    // Sort by lastUpdated (newest first)
    roomsList.sort((a, b) => {
      const dateA = getRenderableTimestamp(a) ?? 0;
      const dateB = getRenderableTimestamp(b) ?? 0;
      return dateB - dateA;
    });

    // Paginate results
    const offset = (page - 1) * limit;
    const paginatedRooms = roomsList.slice(offset, offset + limit);

    return jsonResponse({
      success: true,
      rooms: paginatedRooms,
      pagination: {
        page: page,
        limit: limit,
        total: roomsList.length,
        hasNext: offset + limit < roomsList.length
      }
    }, RESPONSE_OPTIONS);

  } catch (error) {
    console.error('List rooms error:', error);
    return jsonResponse({
      error: 'Internal server error' 
    }, { ...RESPONSE_OPTIONS, status: 500 });
  }
}

export const config = {
  runtime: 'edge'
};
