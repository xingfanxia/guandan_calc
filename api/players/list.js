// List and search players - Vercel Edge Function
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';

export default async function handler(request) {
  // Only allow GET requests
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Parse query parameters
    const url = new URL(request.url);
    const searchQuery = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Validate parameters
    if (limit < 1 || limit > 100) {
      return new Response(JSON.stringify({
        error: 'Invalid limit. Must be between 1 and 100.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (offset < 0) {
      return new Response(JSON.stringify({
        error: 'Invalid offset. Must be 0 or greater.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all player keys
    const playerKeys = await kv.keys('player:*');

    // Fetch all players
    const playerPromises = playerKeys.map(key => kv.get(key));
    const playerData = await Promise.all(playerPromises);

    // Parse and filter players
    let players = playerData
      .filter(data => data !== null)
      .map(data => typeof data === 'string' ? JSON.parse(data) : data);

    // Apply search filter if query provided
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      players = players.filter(player =>
        player.handle.toLowerCase().includes(query) ||
        player.displayName.toLowerCase().includes(query)
      );
    }

    // Sort by lastActiveAt DESC (most recently active first), fallback to createdAt
    players.sort((a, b) => {
      const aTime = new Date(a.lastActiveAt || a.createdAt);
      const bTime = new Date(b.lastActiveAt || b.createdAt);
      return bTime - aTime;
    });

    // Get total count before pagination
    const total = players.length;

    // Apply pagination
    const paginatedPlayers = players.slice(offset, offset + limit);

    // Check if there are more results
    const hasMore = (offset + limit) < total;

    // Return results
    return new Response(JSON.stringify({
      players: paginatedPlayers,
      total: total,
      hasMore: hasMore
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Failed to list players:', error);
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
