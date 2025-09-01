// Anonymous voting system for room viewers
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

  if (request.method === 'POST') {
    try {
      // Get vote data
      const voteData = await request.json();
      const { mvpPlayerId, burdenPlayerId, roundId } = voteData;

      if (!mvpPlayerId || !burdenPlayerId || !roundId) {
        return new Response(JSON.stringify({ 
          error: 'Missing vote data' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

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

      // Generate anonymous voter ID (based on IP + user agent hash)
      const voterIP = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For') || 
                     'unknown';
      const userAgent = request.headers.get('User-Agent') || 'unknown';
      const voterHash = btoa(voterIP + userAgent).substring(0, 16);

      // Initialize voting structure if needed
      if (!parsedRoom.voting) {
        parsedRoom.voting = {
          currentRound: null,
          history: [],
          playerStats: {}
        };
      }

      // Initialize current round voting if new round or doesn't exist
      if (!parsedRoom.voting.currentRound) {
        parsedRoom.voting.currentRound = {
          roundId: null,
          votes: {},
          results: { mvp: {}, burden: {} }
        };
      }

      const currentVoting = parsedRoom.voting.currentRound;

      // Check if this voter already voted for current session
      if (currentVoting.votes[voterHash]) {
        return new Response(JSON.stringify({ 
          error: 'Already voted for this session' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Record vote (accumulative)
      currentVoting.votes[voterHash] = {
        mvp: mvpPlayerId,
        burden: burdenPlayerId,
        timestamp: new Date().toISOString()
      };

      // Update vote counts (accumulative)
      currentVoting.results.mvp[mvpPlayerId] = (currentVoting.results.mvp[mvpPlayerId] || 0) + 1;
      currentVoting.results.burden[burdenPlayerId] = (currentVoting.results.burden[burdenPlayerId] || 0) + 1;

      // Save updated room data
      if (parsedRoom.isFavorite) {
        await kv.set(`room:${roomCode}`, JSON.stringify(parsedRoom));
      } else {
        await kv.setex(`room:${roomCode}`, 31536000, JSON.stringify(parsedRoom));
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Vote recorded successfully'
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
      console.error('Vote submission error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } else if (request.method === 'GET') {
    // Get current voting results
    try {
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
      const voting = parsedRoom.voting || { currentRound: null, history: [], playerStats: {} };

      return new Response(JSON.stringify({
        success: true,
        voting: voting
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
      console.error('Get voting error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } else {
    return new Response(JSON.stringify({ 
      error: 'Method not allowed' 
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export const config = {
  runtime: 'edge'
};