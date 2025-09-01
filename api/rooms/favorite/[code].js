// Favorite room management - Make rooms permanent
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';

export default async function handler(request) {
  const url = new URL(request.url);
  const roomCode = url.pathname.split('/').pop();

  // Validate room code format
  if (!roomCode || !roomCode.match(/^[A-Z0-9]{6}$/)) {
    return new Response(JSON.stringify({ 
      error: 'Invalid room code format' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    if (request.method === 'POST') {
      // Add room to favorites (make permanent)
      const roomData = await kv.get(`room:${roomCode}`);
      
      if (!roomData) {
        return new Response(JSON.stringify({ 
          error: 'Room not found' 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const parsedData = typeof roomData === 'string' ? JSON.parse(roomData) : roomData;
      
      // Mark as favorite and make permanent
      const favoriteData = {
        ...parsedData,
        isFavorite: true,
        favoritedAt: new Date().toISOString()
      };

      // Store without expiration (permanent)
      await kv.set(`room:${roomCode}`, JSON.stringify(favoriteData));
      
      // Also add to favorites index for browsing
      const favoritesKey = 'favorites:index';
      const existingFavorites = await kv.get(favoritesKey) || [];
      const favorites = Array.isArray(existingFavorites) ? existingFavorites : [];
      
      // Add to favorites if not already there
      if (!favorites.find(fav => fav.roomCode === roomCode)) {
        favorites.push({
          roomCode: roomCode,
          createdAt: parsedData.createdAt,
          favoritedAt: favoriteData.favoritedAt,
          playerCount: parsedData.players ? parsedData.players.length : 0,
          gameCount: parsedData.state && parsedData.state.hist ? parsedData.state.hist.length : 0,
          teamNames: {
            t1: parsedData.settings.t1.name,
            t2: parsedData.settings.t2.name
          }
        });
        
        await kv.set(favoritesKey, JSON.stringify(favorites));
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Room added to favorites and made permanent'
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } else if (request.method === 'DELETE') {
      // Remove from favorites (revert to 1-year TTL)
      const roomData = await kv.get(`room:${roomCode}`);
      
      if (!roomData) {
        return new Response(JSON.stringify({ 
          error: 'Room not found' 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const parsedData = typeof roomData === 'string' ? JSON.parse(roomData) : roomData;
      
      // Remove favorite status and set 1-year expiration
      const unfavoriteData = {
        ...parsedData,
        isFavorite: false,
        unfavoritedAt: new Date().toISOString()
      };

      await kv.setex(`room:${roomCode}`, 31536000, JSON.stringify(unfavoriteData)); // 1 year
      
      // Remove from favorites index
      const favoritesKey = 'favorites:index';
      const existingFavorites = await kv.get(favoritesKey) || [];
      const favorites = Array.isArray(existingFavorites) ? existingFavorites : [];
      
      const updatedFavorites = favorites.filter(fav => fav.roomCode !== roomCode);
      await kv.set(favoritesKey, JSON.stringify(updatedFavorites));

      return new Response(JSON.stringify({
        success: true,
        message: 'Room removed from favorites, set to expire in 1 year'
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } else {
      return new Response(JSON.stringify({ 
        error: 'Method not allowed' 
      }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Favorite API error:', error);
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