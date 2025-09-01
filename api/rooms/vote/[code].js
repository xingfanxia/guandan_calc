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

      console.log('Vote submission:', { mvpPlayerId, burdenPlayerId, roundId, gameRoundNumber });

      if (!mvpPlayerId || !burdenPlayerId || !roundId) {
        console.error('Missing vote data:', voteData);
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

      // Enhanced voter identification: IP + detailed browser fingerprint + 5-min time bucket
      const voterIP = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For') || 
                     'unknown';
      const userAgent = request.headers.get('User-Agent') || 'unknown';
      const acceptLanguage = request.headers.get('Accept-Language') || '';
      const acceptEncoding = request.headers.get('Accept-Encoding') || '';
      
      // Create enhanced browser fingerprint to distinguish users on same IP
      const browserFingerprint = btoa(userAgent + acceptLanguage + acceptEncoding).substring(0, 12);
      
      // 5-minute time bucket for rate limiting
      const now = Math.floor(Date.now() / 1000);
      const timeBucket = Math.floor(now / 300); // 5-minute buckets
      
      const voterHash = `${voterIP}_${browserFingerprint}_${timeBucket}`;

      // Initialize voting structure if needed
      if (!parsedRoom.voting) {
        parsedRoom.voting = {
          rounds: {},
          playerStats: {}
        };
      }

      // Ensure rounds object exists
      if (!parsedRoom.voting.rounds) {
        parsedRoom.voting.rounds = {};
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

      // Check for duplicate voting in current 5-minute window
      if (currentVoting.votes[voterHash]) {
        return new Response(JSON.stringify({ 
          error: '您在当前5分钟内已经投过票，请稍后再试' 
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
      
      // Get voting data for most recent completed round
      const gameRoundNumber = parsedRoom.state?.hist?.length || 0;
      const currentRoundId = gameRoundNumber > 0 ? `round_${gameRoundNumber}` : null;
      const currentRound = currentRoundId ? (parsedRoom.voting?.rounds?.[currentRoundId] || null) : null;
      
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