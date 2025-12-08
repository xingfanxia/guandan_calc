// End-game voting - with fingerprint deduplication
import { kv } from '@vercel/kv';

export default async function handler(request) {
  const url = new URL(request.url);
  const roomCode = url.pathname.split('/').pop();

  if (request.method === 'POST') {
    try {
      const { mvpPlayerId, burdenPlayerId, fingerprint } = await request.json();

      if (!mvpPlayerId || !burdenPlayerId) {
        return new Response(JSON.stringify({ error: 'Missing player IDs' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validate: MVP and burden cannot be the same person
      if (mvpPlayerId === burdenPlayerId) {
        return new Response(JSON.stringify({ error: 'same_person' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get room
      const roomData = await kv.get(`room:${roomCode}`);
      if (!roomData) {
        return new Response(JSON.stringify({ error: 'Room not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const room = typeof roomData === 'string' ? JSON.parse(roomData) : roomData;

      // Initialize vote structure if needed
      if (!room.endGameVotes) {
        room.endGameVotes = { mvp: {}, burden: {}, fingerprints: [] };
      }

      // Ensure fingerprints array exists
      if (!room.endGameVotes.fingerprints) {
        room.endGameVotes.fingerprints = [];
      }

      // Check for duplicate fingerprint
      if (fingerprint && room.endGameVotes.fingerprints.includes(fingerprint)) {
        console.log('Duplicate fingerprint detected:', fingerprint);
        return new Response(JSON.stringify({ error: 'duplicate_fingerprint' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Store vote
      room.endGameVotes.mvp[mvpPlayerId] = (room.endGameVotes.mvp[mvpPlayerId] || 0) + 1;
      room.endGameVotes.burden[burdenPlayerId] = (room.endGameVotes.burden[burdenPlayerId] || 0) + 1;

      // Store fingerprint to prevent duplicate voting
      if (fingerprint) {
        room.endGameVotes.fingerprints.push(fingerprint);
      }

      console.log('Saving votes:', room.endGameVotes);

      // Save
      await kv.setex(`room:${roomCode}`, 31536000, JSON.stringify(room));

      console.log('Votes saved successfully');

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Vote error:', error);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } else if (request.method === 'GET') {
    try {
      const roomData = await kv.get(`room:${roomCode}`);

      if (!roomData) {
        return new Response(JSON.stringify({
          success: true,
          votes: { mvp: {}, burden: {} }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const room = typeof roomData === 'string' ? JSON.parse(roomData) : roomData;

      console.log('GET votes:', room.endGameVotes);

      return new Response(JSON.stringify({
        success: true,
        votes: room.endGameVotes || { mvp: {}, burden: {} }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('GET error:', error);
      return new Response(JSON.stringify({ error: 'Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } else {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export const config = {
  runtime: 'edge'
};
