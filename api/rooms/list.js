// List favorite rooms for browsing
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
    // Get favorites index
    const favoritesKey = 'favorites:index';
    const favorites = await kv.get(favoritesKey) || [];
    const favoritesList = Array.isArray(favorites) ? favorites : [];

    // Sort by creation date (newest first)
    favoritesList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Return paginated results (limit 50 for performance)
    const page = parseInt(request.url.searchParams?.get('page') || '1');
    const limit = 50;
    const offset = (page - 1) * limit;
    const paginatedFavorites = favoritesList.slice(offset, offset + limit);

    return new Response(JSON.stringify({
      success: true,
      favorites: paginatedFavorites,
      pagination: {
        page: page,
        limit: limit,
        total: favoritesList.length,
        hasNext: offset + limit < favoritesList.length
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
    console.error('List favorites error:', error);
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