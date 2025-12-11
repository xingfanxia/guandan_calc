// List rooms for browsing (all rooms or favorites, with player filtering)
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';

export default async function handler(request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ 
      error: 'Method not allowed' 
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);
    const filterPlayer = url.searchParams.get('player'); // Filter by player handle
    const onlyFavorites = url.searchParams.get('favorites') === 'true';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    let roomsList = [];

    if (onlyFavorites) {
      // Get favorites index
      const favoritesKey = 'favorites:index';
      const favorites = await kv.get(favoritesKey) || [];
      roomsList = Array.isArray(favorites) ? favorites : [];
    } else {
      // Scan all room keys to get recent rooms
      // Note: Vercel KV doesn't have native SCAN, so we'll use a rooms index
      // If no index exists, we'll need to build one incrementally
      const roomsIndexKey = 'rooms:index';
      let roomsIndex = await kv.get(roomsIndexKey) || [];
      
      if (!Array.isArray(roomsIndex)) {
        roomsIndex = [];
      }

      // Fetch room data for each room code
      const roomDataPromises = roomsIndex.map(async (entry) => {
        try {
          const roomData = await kv.get(`room:${entry.roomCode}`);
          if (!roomData) return null;
          
          const parsed = typeof roomData === 'string' ? JSON.parse(roomData) : roomData;
          
          // Extract player handles for filtering
          const playerHandles = parsed.players
            ?.map(p => p.profileHandle)
            .filter(h => h && h !== 'session');
          
          return {
            roomCode: entry.roomCode,
            createdAt: parsed.createdAt,
            lastUpdated: parsed.lastUpdated,
            isFavorite: parsed.isFavorite || false,
            playerCount: parsed.players?.length || 0,
            playerHandles: playerHandles || [],
            currentRound: parsed.state?.roundNumber || 0,
            isFinished: parsed.state?.gameEnded || false,
            teamNames: [
              parsed.settings?.team1Name,
              parsed.settings?.team2Name,
              parsed.settings?.team3Name,
              parsed.settings?.team4Name
            ].filter(Boolean)
          };
        } catch (err) {
          console.error(`Error fetching room ${entry.roomCode}:`, err);
          return null;
        }
      });

      const roomDataList = await Promise.all(roomDataPromises);
      roomsList = roomDataList.filter(r => r !== null);
    }

    // Filter out rooms with test players (handles starting with 'test_')
    roomsList = roomsList.filter(room => {
      if (!room.playerHandles || room.playerHandles.length === 0) return true;
      return !room.playerHandles.some(handle => 
        handle && handle.toLowerCase().startsWith('test_')
      );
    });

    // Filter by player handle if specified
    if (filterPlayer) {
      roomsList = roomsList.filter(room => 
        room.playerHandles?.some(h => 
          h.toLowerCase().includes(filterPlayer.toLowerCase())
        )
      );
    }

    // Sort by lastUpdated (newest first)
    roomsList.sort((a, b) => {
      const dateA = new Date(a.lastUpdated || a.createdAt);
      const dateB = new Date(b.lastUpdated || b.createdAt);
      return dateB - dateA;
    });

    // Paginate results
    const offset = (page - 1) * limit;
    const paginatedRooms = roomsList.slice(offset, offset + limit);

    return new Response(JSON.stringify({
      success: true,
      rooms: paginatedRooms,
      pagination: {
        page: page,
        limit: limit,
        total: roomsList.length,
        hasNext: offset + limit < roomsList.length
      }
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
    console.error('List rooms error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export const config = {
  runtime: 'edge'
};