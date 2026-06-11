// Favorite room management - Make rooms permanent
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';
import { handleCorsPreflight, jsonResponse } from '../../_cors.js';
import { authorizeRoomHost } from '../_auth.js';
import { parseRoomIndex } from '../_index.js';
import { buildFavoriteIndexEntry } from '../_summary.js';

const RESPONSE_OPTIONS = {
  methods: 'POST, DELETE, OPTIONS',
  allowedHeaders: 'Content-Type, Authorization'
};

export { buildFavoriteIndexEntry };

export function parseFavoriteIndex(value) {
  return parseRoomIndex(value);
}

export function addFavoriteIndexEntry(indexValue, entry) {
  const favorites = parseFavoriteIndex(indexValue);
  const [normalizedEntry] = parseRoomIndex([entry]);
  if (!normalizedEntry) return favorites;

  if (favorites.find(fav => fav.roomCode === normalizedEntry.roomCode)) {
    return favorites;
  }

  return [...favorites, normalizedEntry];
}

export function removeFavoriteIndexEntry(indexValue, roomCode) {
  return parseFavoriteIndex(indexValue)
    .filter(fav => fav.roomCode !== roomCode);
}

export function buildFavoriteRoomData(roomData, favoritedAt = new Date().toISOString()) {
  const { unfavoritedAt, ...roomWithoutUnfavoriteTime } = roomData;
  return {
    ...roomWithoutUnfavoriteTime,
    isFavorite: true,
    favoritedAt
  };
}

export function buildUnfavoriteRoomData(roomData, unfavoritedAt = new Date().toISOString()) {
  const { favoritedAt, ...roomWithoutFavoriteTime } = roomData;
  return {
    ...roomWithoutFavoriteTime,
    isFavorite: false,
    unfavoritedAt
  };
}

export default async function handler(request) {
  const preflight = handleCorsPreflight(request, 'POST, DELETE, OPTIONS', 'Content-Type, Authorization');
  if (preflight) return preflight;

  const url = new URL(request.url);
  const roomCode = url.pathname.split('/').pop();

  // Validate room code format
  if (!roomCode || !roomCode.match(/^[A-Z0-9]{6}$/)) {
    return jsonResponse({
      error: 'Invalid room code format'
    }, { ...RESPONSE_OPTIONS, status: 400 });
  }

  try {
    if (request.method !== 'POST' && request.method !== 'DELETE') {
      return jsonResponse({
        error: 'Method not allowed'
      }, { ...RESPONSE_OPTIONS, status: 405 });
    }

    const auth = await authorizeRoomHost(request, roomCode, RESPONSE_OPTIONS);
    if (!auth.ok) return auth.response;
    const parsedData = auth.room;

    if (request.method === 'POST') {
      // Add room to favorites (make permanent)
      // Mark as favorite and make permanent
      const favoriteData = buildFavoriteRoomData(parsedData);

      // Store without expiration (permanent)
      await kv.set(`room:${roomCode}`, JSON.stringify(favoriteData));

      // Also add to favorites index for browsing
      const favoritesKey = 'favorites:index';
      const existingFavorites = await kv.get(favoritesKey);

      // Add to favorites if not already there
      const favorites = addFavoriteIndexEntry(
        existingFavorites,
        buildFavoriteIndexEntry(favoriteData, favoriteData.favoritedAt, { roomCode })
      );
      await kv.set(favoritesKey, JSON.stringify(favorites));

      return jsonResponse({
        success: true,
        message: 'Room added to favorites and made permanent'
      }, RESPONSE_OPTIONS);

    } else if (request.method === 'DELETE') {
      // Remove from favorites (revert to 1-year TTL)
      // Remove favorite status and set 1-year expiration
      const unfavoriteData = buildUnfavoriteRoomData(parsedData);

      await kv.setex(`room:${roomCode}`, 31536000, JSON.stringify(unfavoriteData)); // 1 year

      // Remove from favorites index
      const favoritesKey = 'favorites:index';
      const existingFavorites = await kv.get(favoritesKey);
      const updatedFavorites = removeFavoriteIndexEntry(existingFavorites, roomCode);
      await kv.set(favoritesKey, JSON.stringify(updatedFavorites));

      return jsonResponse({
        success: true,
        message: 'Room removed from favorites, set to expire in 1 year'
      }, RESPONSE_OPTIONS);
    }

  } catch (error) {
    console.error('Favorite API error:', error);
    return jsonResponse({
      error: 'Internal server error'
    }, { ...RESPONSE_OPTIONS, status: 500 });
  }
}

export const config = {
  runtime: 'edge'
};
