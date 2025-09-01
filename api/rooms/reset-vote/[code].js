// Reset voting for new round
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

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ 
      error: 'Method not allowed' 
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get room data
    const roomData = await kv.get(`room:${roomCode}`);
    if (!roomData) {
      return new Response(JSON.stringify({ 
        error: 'Room not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const parsedRoom = typeof roomData === 'string' ? JSON.parse(roomData) : roomData;

    // Archive current voting to history and reset for new round
    if (parsedRoom.voting && parsedRoom.voting.currentRound) {
      // Move current round to history
      if (!parsedRoom.voting.history) {
        parsedRoom.voting.history = [];
      }
      
      parsedRoom.voting.history.push({
        ...parsedRoom.voting.currentRound,
        completedAt: new Date().toISOString()
      });

      // Reset current round
      parsedRoom.voting.currentRound = {
        roundId: null,
        votes: {},
        results: { mvp: {}, burden: {} }
      };

      // Save updated room data
      if (parsedRoom.isFavorite) {
        await kv.set(`room:${roomCode}`, JSON.stringify(parsedRoom));
      } else {
        await kv.setex(`room:${roomCode}`, 31536000, JSON.stringify(parsedRoom));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Voting reset for new round'
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Reset vote error:', error);
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