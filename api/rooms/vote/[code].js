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
      const { mvpPlayerId, burdenPlayerId, roundId, gameRoundNumber } = voteData;

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

      // Generate voter ID with 5-minute time bucket for rate limiting
      const voterIP = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For') || 
                     'unknown';
      const userAgent = request.headers.get('User-Agent') || 'unknown';
      
      // Create 5-minute time bucket (300 seconds)
      const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
      const timeBucket = Math.floor(now / 300); // 5-minute buckets
      
      const voterHash = btoa(voterIP + userAgent + timeBucket).substring(0, 16);

      // Initialize voting structure if needed
      if (!parsedRoom.voting) {
        parsedRoom.voting = {
          rounds: {}, // Store votes by round ID
          playerStats: {}
        };
      }

      // Initialize specific round voting if needed
      if (!parsedRoom.voting.rounds[roundId]) {
        parsedRoom.voting.rounds[roundId] = {
          roundId: roundId,
          gameRoundNumber: gameRoundNumber,
          votes: {},
          results: { mvp: {}, burden: {} },
          createdAt: new Date().toISOString()
        };
      }

      const currentVoting = parsedRoom.voting.rounds[roundId];

      // Check for voting in current 5-minute window
      if (currentVoting.votes[voterHash]) {
        const lastVoteTime = new Date(currentVoting.votes[voterHash].timestamp);
        const timeLeft = Math.ceil((lastVoteTime.getTime() + 300000 - Date.now()) / 1000);
        
        return new Response(JSON.stringify({ 
          error: `请等待 ${Math.max(0, timeLeft)} 秒后再投票` 
        }), {
          status: 429, // Too Many Requests
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validate that MVP and burden are different
      if (mvpPlayerId === burdenPlayerId) {
        return new Response(JSON.stringify({ 
          error: 'MVP and burden cannot be the same player' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Record vote atomically (both MVP and burden together)
      currentVoting.votes[voterHash] = {
        mvp: mvpPlayerId,
        burden: burdenPlayerId,
        timestamp: new Date().toISOString()
      };

      // Update vote counts atomically - BOTH must succeed
      currentVoting.results.mvp[mvpPlayerId] = (currentVoting.results.mvp[mvpPlayerId] || 0) + 1;
      currentVoting.results.burden[burdenPlayerId] = (currentVoting.results.burden[burdenPlayerId] || 0) + 1;

      // Verify consistency: total MVP votes should equal total burden votes
      const totalMvpVotes = Object.values(currentVoting.results.mvp).reduce((sum, count) => sum + count, 0);
      const totalBurdenVotes = Object.values(currentVoting.results.burden).reduce((sum, count) => sum + count, 0);
      
      if (totalMvpVotes !== totalBurdenVotes) {
        console.error('Vote count inconsistency detected:', { totalMvpVotes, totalBurdenVotes });
        // Don't save inconsistent data
        return new Response(JSON.stringify({ 
          error: 'Vote count inconsistency detected' 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Update room's lastUpdated timestamp
      parsedRoom.lastUpdated = new Date().toISOString();

      // Save updated room data with voting information
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
      
      // Get current round voting data
      const gameRoundNumber = parsedRoom.state?.hist?.length + 1 || 1;
      const currentRoundId = `round_${gameRoundNumber}`;
      const currentRound = parsedRoom.voting?.rounds?.[currentRoundId] || null;
      
      const voting = {
        currentRound: currentRound,
        allRounds: parsedRoom.voting?.rounds || {},
        playerStats: parsedRoom.voting?.playerStats || {}
      };

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