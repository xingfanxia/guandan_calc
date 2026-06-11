import assert from 'node:assert/strict';

const elements = new Map();

function createElement(id = null) {
  let html = '';
  const element = {
    id,
    style: {},
    hidden: false,
    disabled: false,
    textContent: '',
    onclick: null,
    set innerHTML(value) {
      html = String(value);
      const idMatches = html.matchAll(/id="([^"]+)"/g);
      for (const match of idMatches) {
        if (!elements.has(match[1])) {
          elements.set(match[1], createElement(match[1]));
        }
      }
    },
    get innerHTML() {
      return html;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    appendChild() {},
    insertBefore() {}
  };
  return element;
}

['votingSection', 'hostVotingInterface', 'mvpStatsTable', 'burdenStatsTable'].forEach(id => {
  elements.set(id, createElement(id));
});
elements.get('votingSection').hidden = true;
elements.get('votingSection').style.display = 'none';
elements.get('hostVotingInterface').hidden = true;
elements.get('hostVotingInterface').style.display = 'none';

globalThis.document = {
  getElementById(id) {
    return elements.get(id) || null;
  },
  createElement() {
    return createElement();
  },
  querySelector() {
    return null;
  },
  addEventListener() {}
};

const alerts = [];
globalThis.alert = message => alerts.push(message);
globalThis.prompt = () => {
  throw new Error('host vote confirmation should not prompt for room auth');
};

globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};

globalThis.window = {
  location: {
    origin: 'http://localhost',
    pathname: '/index.html',
    search: ''
  }
};

const fetchCalls = [];
let votePayload = {
  success: false,
  error: 'no_votes'
};
let failVoteLeaderboardFetch = false;
globalThis.fetch = async (url, options = {}) => {
  const method = options.method || 'GET';
  fetchCalls.push({ url, method, options });

  if (url === '/api/rooms/create' && method === 'POST') {
    return new Response(JSON.stringify({
      success: true,
      roomCode: 'VOTE12',
      authToken: 'host-token'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (String(url).startsWith('/api/rooms/vote/VOTE12') && method === 'GET') {
    if (failVoteLeaderboardFetch) {
      throw new Error('temporary vote leaderboard outage');
    }
    return new Response(JSON.stringify(votePayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (String(url).endsWith('/api/players/alice') && method === 'PUT') {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (String(url).endsWith('/api/players/bob') && method === 'PUT') {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (url === '/api/rooms/reset-vote/VOTE12' && method === 'POST') {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  throw new Error(`Unexpected fetch: ${method} ${url}`);
};

const { default: state } = await import('../../src/core/state.js');
const { createRoom, getRoomInfo, leaveRoom } = await import('../../src/share/roomManager.js');
const { showHostVoting, updateVoteLeaderboard } = await import('../../src/share/votingManager.js');

state.setPlayers([
  { id: 1, name: 'Alice', emoji: 'A', team: 1, handle: 'alice' },
  { id: 2, name: 'Bob', emoji: 'B', team: 2, handle: 'bob' }
]);

const room = await createRoom();
assert.equal(room.roomCode, 'VOTE12');
assert.deepEqual(getRoomInfo(), {
  roomCode: 'VOTE12',
  isHost: true,
  isViewer: false,
  authToken: 'host-token',
  createdAt: getRoomInfo().createdAt,
  finishedAt: null,
  isFavorite: false
});

await showHostVoting();
assert.equal(elements.get('votingSection').hidden, false, 'host voting should clear the hidden flag on the voting section');
assert.equal(elements.get('votingSection').style.display, 'block', 'host voting should display the voting section');
assert.equal(elements.get('hostVotingInterface').hidden, false, 'host voting should clear the hidden flag on the host panel');
assert.equal(elements.get('hostVotingInterface').style.display, 'block', 'host voting should display the host panel');
assert.match(
  elements.get('hostVotingInterface').innerHTML,
  /暂无投票数据/,
  'host voting should not treat unsuccessful vote API responses as confirmable results'
);
assert.equal(
  elements.get('confirmVotes'),
  undefined,
  'host voting should not render confirmation controls for unsuccessful vote API responses'
);

votePayload = {
  success: true,
  votes: {
    mvp: {},
    burden: {},
    fingerprints: []
  }
};

await showHostVoting();
assert.ok(
  elements.get('confirmVotes'),
  'host voting should render confirmation controls even before votes arrive'
);

const emptyConfirmButton = elements.get('confirmVotes');
assert.equal(typeof emptyConfirmButton.onclick, 'function', 'empty voting confirmation button should be wired');

await emptyConfirmButton.onclick();
assert.ok(
  alerts.some(message => String(message).includes('投票结果同步失败')),
  'empty vote confirmation should tell the host that there are no votes to sync'
);
assert.equal(
  fetchCalls.some(call => call.method === 'POST' && call.url === '/api/rooms/reset-vote/VOTE12'),
  false,
  'empty vote confirmation should not clear/archive the active voting window'
);
assert.equal(emptyConfirmButton.disabled, false, 'empty vote confirmation should re-enable the button after failing');

failVoteLeaderboardFetch = true;
await assert.doesNotReject(
  () => updateVoteLeaderboard(),
  'host vote leaderboard polling should not surface transient fetch errors as unhandled rejections'
);
failVoteLeaderboardFetch = false;

votePayload = {
  success: true,
  votes: {
    mvp: { 1: 2 },
    burden: { 2: 1 },
    fingerprints: ['fp-1']
  }
};

await updateVoteLeaderboard();
assert.match(
  elements.get('mvpStatsTable').innerHTML,
  /Alice: <strong>2票/,
  'host vote leaderboard polling should refresh MVP totals after votes arrive'
);
assert.match(
  elements.get('burdenStatsTable').innerHTML,
  /Bob: <strong>1票/,
  'host vote leaderboard polling should refresh burden totals after votes arrive'
);
const confirmButton = elements.get('confirmVotes');
assert.equal(typeof confirmButton.onclick, 'function', 'confirmation button should be wired');

await confirmButton.onclick();

const profileUpdates = fetchCalls.filter(call =>
  call.method === 'PUT' && String(call.url).includes('/api/players/')
);
assert.equal(profileUpdates.length, 2, 'host confirmation should sync vote totals to eligible player profiles');
assert.deepEqual(
  profileUpdates.map(call => call.options.headers?.Authorization),
  ['Bearer host-token', 'Bearer host-token'],
  'profile vote sync should use the current room host token'
);

const resetCall = fetchCalls.find(call =>
  call.method === 'POST' && call.url === '/api/rooms/reset-vote/VOTE12'
);
assert.ok(resetCall, 'host confirmation should clear/archive active room votes after syncing');
assert.equal(
  resetCall.options.headers?.Authorization,
  'Bearer host-token',
  'vote reset should use the current room host token without prompting'
);

assert.ok(
  alerts.some(message => String(message).includes('投票结果已确认')),
  'host should receive confirmation feedback'
);

leaveRoom();

console.log('host vote confirmation checks passed');
