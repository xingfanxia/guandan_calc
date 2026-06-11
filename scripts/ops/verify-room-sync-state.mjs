import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const storage = new Map();

globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  }
};

globalThis.window = {
  location: {
    origin: 'http://localhost',
    pathname: '/index.html',
    search: ''
  }
};

globalThis.alert = message => {
  throw new Error(`Unexpected alert: ${message}`);
};

const originalConsoleError = console.error;
const consoleErrors = [];
console.error = (...args) => {
  consoleErrors.push(args.map(String).join(' '));
  originalConsoleError(...args);
};

const existingRoom = {
  roomCode: 'ABC123',
  createdAt: '2026-06-10T10:00:00.000Z',
  finishedAt: '2026-06-10T11:00:00.000Z',
  isFavorite: true,
  favoritedAt: '2026-06-10T10:30:00.000Z',
  settings: {
    t1: { name: '蓝队', color: '#3b82f6' },
    t2: { name: '红队', color: '#ef4444' }
  },
  state: {
    gameStatus: {
      ended: false,
      winnerKey: null,
      winnerName: null,
      reason: null
    },
    history: []
  },
  players: [],
  endGameVotes: {
    mvp: { 1: 2 },
    burden: { 2: 1 },
    fingerprints: ['old-voter']
  },
  endGameVotesHistory: [
    {
      mvp: { 3: 4 },
      burden: { 4: 1 },
      fingerprints: ['archived-voter'],
      completedAt: '2026-06-10T10:45:00.000Z'
    }
  ]
};

const customRuleSettings = {
  c4: { '1,2': 5, '1,3': 4, '1,4': 2 },
  t6: { g3: 8, g2: 5, g1: 2 },
  p6: { 1: 6, 2: 5, 3: 4, 4: 3, 5: 1, 6: 0 },
  t8: { g3: 12, g2: 6, g1: 1 },
  p8: { 1: 8, 2: 7, 3: 6, 4: 5, 5: 3, 6: 2, 7: 1, 8: 0 }
};

let putPayload = null;
let createPayload = null;
let createResponseMode = 'valid';
let nonJsonRoomCode = null;
let delayHostPut = false;
let hostPutPayload = null;
let hostPutStartedResolve = null;
let hostPutRelease = null;
let pollUpdateVersion = 1;
const invalidAuthFetches = [];
const validAuthFetches = [];

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

globalThis.fetch = async (url, options = {}) => {
  const method = options.method || 'GET';

  if (url === '/api/rooms/create' && method === 'POST') {
    createPayload = JSON.parse(options.body);
    if (createResponseMode === 'missingAuthToken') {
      return jsonResponse({
        success: true,
        roomCode: 'NOAUTH'
      });
    }
    if (createResponseMode === 'htmlSuccess') {
      return new Response('<html><body>edge create error</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    return jsonResponse({
      success: true,
      roomCode: 'ABC123',
      authToken: 'host-token',
      createdAt: '2026-06-10T09:00:00.000Z',
      finishedAt: '2026-06-10T09:30:00.000Z'
    });
  }

  if (url === '/api/rooms/HTML00' && method === 'GET') {
    nonJsonRoomCode = 'HTML00';
    return new Response('<html><body>edge room detail error</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (url === '/api/rooms/ABC123' && method === 'GET') {
    return jsonResponse({
      success: true,
      data: existingRoom
    });
  }

  if (url === '/api/rooms/ABC123' && method === 'PUT') {
    putPayload = JSON.parse(options.body);
    return jsonResponse({
      success: true,
      lastUpdated: '2026-06-10T12:00:00.000Z'
    });
  }

  if (url === '/api/rooms/ZXCVBN' && method === 'GET') {
    const authHeader = options.headers?.Authorization || options.headers?.authorization || null;
    invalidAuthFetches.push(authHeader);

    if (authHeader === 'Bearer bad-token') {
      return jsonResponse({
        error: 'Unauthorized — invalid host token for this room'
      }, 403);
    }

    return jsonResponse({
      success: true,
      data: {
        ...existingRoom,
        roomCode: 'ZXCVBN',
        isFavorite: false
      }
    });
  }

  if (url === '/api/rooms/HOST12' && method === 'GET') {
    const authHeader = options.headers?.Authorization || options.headers?.authorization || null;
    validAuthFetches.push(authHeader);

    if (authHeader === 'Bearer valid-token') {
      return jsonResponse({
        success: true,
        hostVerified: true,
        data: {
          ...existingRoom,
          roomCode: 'HOST12',
          isFavorite: true
        }
      });
    }

    return jsonResponse({
      success: true,
      data: {
        ...existingRoom,
        roomCode: 'HOST12',
        isFavorite: true
      }
    });
  }

  if (url === '/api/rooms/HOST12' && method === 'PUT') {
    hostPutPayload = JSON.parse(options.body);
    if (hostPutStartedResolve) {
      hostPutStartedResolve();
      hostPutStartedResolve = null;
    }
    if (delayHostPut) {
      await new Promise(resolve => {
        hostPutRelease = resolve;
      });
    }
    return jsonResponse({
      success: true,
      lastUpdated: '2026-06-10T12:30:00.000Z'
    });
  }

  if (url === '/api/rooms/POLLUP' && method === 'GET') {
    return jsonResponse({
      success: true,
      data: {
        ...existingRoom,
        roomCode: 'POLLUP',
        lastUpdated: `2026-06-10T13:00:0${pollUpdateVersion}.000Z`,
        isFavorite: false
      }
    });
  }

  if (url === '/api/rooms/BADCFG' && method === 'GET') {
    return jsonResponse({
      success: true,
      data: {
        ...existingRoom,
        roomCode: 'BADCFG',
        settings: {
          t1: { name: '污染队', color: '#111111' },
          strictA: 'false'
        },
        state: {
          teams: {
            t1: { lvl: '2' }
          }
        }
      }
    });
  }

  if (url === '/api/rooms/BADRUL' && method === 'GET') {
    return jsonResponse({
      success: true,
      data: {
        ...existingRoom,
        roomCode: 'BADRUL',
        settings: {
          ...existingRoom.settings,
          c4: { '1,2': { bad: true }, '1,3': 2, '1,4': 1 }
        },
        state: {
          teams: {
            t1: { lvl: '2' },
            t2: { lvl: '2' }
          }
        }
      }
    });
  }

  if (url === '/api/rooms/RULES1' && method === 'GET') {
    return jsonResponse({
      success: true,
      data: {
        ...existingRoom,
        roomCode: 'RULES1',
        settings: {
          ...existingRoom.settings,
          ...customRuleSettings,
          must1: false,
          autoNext: true,
          autoApply: false,
          strictA: true
        },
        state: {
          teams: {
            t1: { lvl: '2' },
            t2: { lvl: '2' }
          },
          history: []
        }
      }
    });
  }

  if (url === '/api/rooms/ENDWNR' && method === 'GET') {
    return jsonResponse({
      success: true,
      data: {
        ...existingRoom,
        roomCode: 'ENDWNR',
        state: {
          teams: {
            t1: { lvl: 'K', aFail: 0 },
            t2: { lvl: 'A', aFail: 0 }
          },
          roundLevel: 'A',
          roundOwner: 't2',
          nextRoundBase: 'K',
          gameStatus: {
            ended: true,
            winnerKey: 't2',
            winnerName: '红队',
            reason: 'A_LEVEL_CLEARED'
          },
          winner: 't1',
          history: [
            {
              ts: '2026-06-10 12:40:00',
              mode: '4',
              win: '红队',
              winKey: 't2',
              ranks: [1, 3],
              aNote: '红队 A级通关（胜方无末游，在自己的A级）',
              gameStatus: {
                ended: true,
                winnerKey: 't2',
                winnerName: '红队',
                reason: 'A_LEVEL_CLEARED'
              }
            }
          ]
        }
      }
    });
  }

  if (url === '/api/rooms/BADRNK' && method === 'GET') {
    return jsonResponse({
      success: true,
      data: {
        ...existingRoom,
        roomCode: 'BADRNK',
        currentRanking: {
          1: { id: 1 },
          99: 2
        }
      }
    });
  }

  if (url === '/api/rooms/BADPLY' && method === 'GET') {
    return jsonResponse({
      success: true,
      data: {
        ...existingRoom,
        roomCode: 'BADPLY',
        players: [null]
      }
    });
  }

  if (url === '/api/rooms/BADSTS' && method === 'GET') {
    return jsonResponse({
      success: true,
      data: {
        ...existingRoom,
        roomCode: 'BADSTS',
        players: [
          { id: 1, name: '统计污染玩家', emoji: 'S', team: 1 }
        ],
        playerStats: {
          1: {
            games: '2',
            totalRank: 2,
            firstPlaceCount: 1,
            lastPlaceCount: 0,
            rankings: [1, 1]
          }
        }
      }
    });
  }

  if (url === '/api/rooms/NOSTAT' && method === 'GET') {
    return jsonResponse({
      success: true,
      data: {
        ...existingRoom,
        roomCode: 'NOSTAT',
        players: [
          { id: 1, name: 'Legacy Same Player', emoji: 'L', team: 1 }
        ],
        lastUpdated: '2026-06-10T12:45:00.000Z'
      }
    });
  }

  if (url === '/api/rooms/LEGTMS' && method === 'GET') {
    return jsonResponse({
      success: true,
      data: {
        ...existingRoom,
        roomCode: 'LEGTMS',
        players: [
          { id: 1, name: 'Legacy Blue Team', emoji: 'B', team: 'A' },
          { id: 2, name: 'Legacy Red Team', emoji: 'R', team: 'B' }
        ],
        lastUpdated: '2026-06-10T12:46:00.000Z'
      }
    });
  }

  if (url === '/api/rooms/NOHIST' && method === 'GET') {
    return jsonResponse({
      success: true,
      data: {
        ...existingRoom,
        roomCode: 'NOHIST',
        state: {
          teams: {
            t1: { lvl: '2', aFail: 0 },
            t2: { lvl: '2', aFail: 0 }
          },
          gameStatus: {
            ended: false,
            winnerKey: null,
            winnerName: null,
            reason: null
          }
        },
        players: [
          { id: 1, name: 'Legacy No History', emoji: 'H', team: 1 }
        ],
        lastUpdated: '2026-06-10T12:47:00.000Z'
      }
    });
  }

  if (url === '/api/rooms/NOPLAY' && method === 'GET') {
    const { players, playerStats, currentRanking, ...roomWithoutDependentState } = existingRoom;
    return jsonResponse({
      success: true,
      data: {
        ...roomWithoutDependentState,
        roomCode: 'NOPLAY',
        lastUpdated: '2026-06-10T12:50:00.000Z'
      }
    });
  }

  if (url === '/api/rooms/BADSTA' && method === 'GET') {
    return jsonResponse({
      success: true,
      data: {
        ...existingRoom,
        roomCode: 'BADSTA',
        settings: {
          t1: { name: '状态污染队', color: '#111111' },
          t2: { name: '红队', color: '#ef4444' }
        },
        state: {
          nextRoundBase: { bad: true },
          winner: 'bad',
          gameStatus: {
            ended: true,
            winnerKey: { bad: true },
            winnerName: 7,
            reason: []
          }
        }
      }
    });
  }

  if (url === '/api/rooms/BADHIS' && method === 'GET') {
    return jsonResponse({
      success: true,
      data: {
        ...existingRoom,
        roomCode: 'BADHIS',
        settings: {
          t1: { name: '历史污染队', color: '#111111' },
          t2: { name: '红队', color: '#ef4444' }
        },
        state: {
          history: [
            {
              winKey: { bad: true },
              aNote: '历史污染队 A级通关',
              gameStatus: {
                ended: true,
                winnerKey: { bad: true },
                winnerName: 7,
                reason: []
              },
              prevRound: { bad: true },
              playerRankings: {
                1: null
              }
            }
          ]
        }
      }
    });
  }

  if (url === '/api/rooms/NOWIN1' && method === 'GET') {
    return jsonResponse({
      success: true,
      data: {
        ...existingRoom,
        roomCode: 'NOWIN1',
        settings: {
          t1: { name: '无赢家污染队', color: '#111111' },
          t2: { name: '红队', color: '#ef4444' }
        },
        state: {
          history: [],
          gameStatus: {
            ended: true,
            winnerKey: null,
            winnerName: null,
            reason: 'A_LEVEL_CLEARED'
          }
        }
      }
    });
  }

  throw new Error(`Unexpected fetch: ${method} ${url}`);
};

const {
  createRoom,
  getRoomInfo,
  joinRoom,
  leaveRoom,
  syncToRoom
} = await import('../../src/share/roomManager.js');
const { on: onEvent } = await import('../../src/core/events.js');
const { default: state } = await import('../../src/core/state.js');
const { default: config } = await import('../../src/core/config.js');
const { generateShareURL, loadFromShareURL } = await import('../../src/share/shareManager.js');

state.setPlayers([
  { id: 1, name: '~~', emoji: 'T', team: 1 }
]);
state.setCurrentRanking({ 1: 1 });
state.setWinner('t1');
state.setHistory([
  {
    ts: '2026-06-10 09:30:00',
    win: '红队',
    winKey: 't2',
    aNote: '红队 A级通关（胜方无末游，在自己的A级）'
  }
]);
state.clearGameStatus();
state.setNextRoundBase('K');

const created = await createRoom();
assert.equal(created.roomCode, 'ABC123');
assert.equal(getRoomInfo().isHost, true);
assert.equal(
  getRoomInfo().createdAt,
  '2026-06-10T09:00:00.000Z',
  'room creation should use server-owned createdAt from the create response'
);
assert.equal(
  getRoomInfo().finishedAt,
  '2026-06-10T09:30:00.000Z',
  'completed room creation should use server-owned finishedAt from the create response'
);
assert.equal(
  createPayload.state.gameStatus.ended,
  true,
  'room creation should reconcile stale-open local status with completed history'
);
assert.equal(createPayload.state.gameStatus.winnerKey, 't2');
assert.equal(createPayload.state.gameStatus.winnerName, '红队');
assert.equal(
  createPayload.state.winner,
  't2',
  'room creation should keep legacy winner aligned with reconciled completed status'
);
assert.equal(
  createPayload.state.nextRoundBase,
  null,
  'room creation should not send stale pending next-round state once history resolves to completed'
);

const generatedShareURL = generateShareURL();
const rawShareParam = generatedShareURL.match(/[?&]share=([^&]+)/)?.[1] || '';
assert.equal(
  rawShareParam.includes('+'),
  false,
  'static share URL should percent-encode base64 + characters before putting them in query params'
);
const shareUrl = new URL(generatedShareURL);
assert.equal(
  shareUrl.searchParams.get('share').includes(' '),
  false,
  'static share URL searchParams value should not contain spaces from raw + decoding'
);
const shareData = JSON.parse(decodeURIComponent(atob(shareUrl.searchParams.get('share'))));
assert.equal(
  shareData.state.gameStatus.ended,
  true,
  'static share URLs should reconcile stale-open local status with completed history'
);
assert.equal(shareData.state.gameStatus.winnerKey, 't2');
assert.equal(shareData.state.gameStatus.winnerName, '红队');
assert.equal(
  shareData.state.winner,
  't2',
  'static share URLs should keep legacy winner aligned with reconciled completed status'
);
assert.equal(
  shareData.state.nextRoundBase,
  null,
  'static share URLs should not encode stale pending next-round state once history resolves to completed'
);
assert.deepEqual(
  shareData.currentRanking,
  { 1: 1 },
  'static share URLs should include the current ranking snapshot just like room sync'
);
state.setWinner('t1');
state.setCurrentRanking({});
window.location.search = `?share=${encodeURIComponent(shareUrl.searchParams.get('share'))}`;
assert.equal(
  loadFromShareURL(),
  true,
  'static share URLs with an aligned winner should load'
);
assert.equal(
  state.getWinner(),
  't2',
  'static share URL loading should restore legacy winner from the snapshot'
);
assert.deepEqual(
  state.getCurrentRanking(),
  { 1: 1 },
  'static share URL loading should restore the current ranking snapshot'
);
window.location.search = '';

const staleWinnerShareData = {
  ...shareData,
  state: {
    ...shareData.state,
    winner: 't1'
  }
};
const staleWinnerShareParam = btoa(encodeURIComponent(JSON.stringify(staleWinnerShareData)));
state.setWinner('t1');
window.location.search = `?share=${encodeURIComponent(staleWinnerShareParam)}`;
assert.equal(
  loadFromShareURL(),
  true,
  'static share URLs with stale legacy winner but completed status should load'
);
assert.equal(
  state.getWinner(),
  't2',
  'static share URL loading should prefer authoritative completed game status over stale legacy winner'
);
window.location.search = '';

state.setPlayers([
  { id: 1, name: 'Legacy Same Player', emoji: 'L', team: 1 }
]);
state.setTeamLevel('t1', 'K');
state.setTeamAFail('t1', 2);
state.setTeamLevel('t2', 'A');
state.setTeamAFail('t2', 1);
state.setRoundLevel('A');
state.setRoundOwner('t2');
state.setNextRoundBase('A');
state.setWinner('t2');
state.setPlayerStats({
  1: {
    games: 3,
    totalRank: 3,
    firstPlaceCount: 3,
    lastPlaceCount: 0,
    rankings: [1, 1, 1]
  }
});
state.setCurrentRanking({ 1: 1 });
state.setHistory([
  {
    ts: '2026-06-10 13:05:00',
    mode: '4',
    win: '蓝队',
    winKey: 't1',
    ranks: [1, 3],
    aNote: '蓝队 A级通关（胜方无末游，在自己的A级）',
    gameStatus: {
      ended: true,
      winnerKey: 't1',
      winnerName: '蓝队',
      reason: 'A_LEVEL_CLEARED'
    }
  }
]);
state.setGameStatus({
  ended: true,
  winnerKey: 't1',
  winnerName: '蓝队',
  reason: 'A_LEVEL_CLEARED'
});
state.setTeamLevel('t1', 'K');
state.setTeamAFail('t1', 2);
state.setTeamLevel('t2', 'A');
state.setTeamAFail('t2', 1);
state.setRoundLevel('A');
state.setRoundOwner('t2');
state.setNextRoundBase('A');
state.setWinner('t2');
const legacyShareWithoutStats = btoa(encodeURIComponent(JSON.stringify({
  state: {
    gameStatus: {
      ended: false,
      winnerKey: null,
      winnerName: null,
      reason: null
    }
  },
  players: [
    { id: 1, name: 'Legacy Same Player', emoji: 'L', team: 1 }
  ]
})));
window.location.search = `?share=${encodeURIComponent(legacyShareWithoutStats)}`;
assert.equal(
  loadFromShareURL(),
  true,
  'legacy static share snapshots without optional stats should still load'
);
assert.deepEqual(
  state.getTeam('t1'),
  { lvl: '2', aFail: 0 },
  'static share loading should reset stale local team 1 state when the snapshot omits teams'
);
assert.deepEqual(
  state.getTeam('t2'),
  { lvl: '2', aFail: 0 },
  'static share loading should reset stale local team 2 state when the snapshot omits teams'
);
assert.equal(
  state.getRoundLevel(),
  '2',
  'static share loading should reset stale local round level when the snapshot omits roundLevel'
);
assert.equal(
  state.getRoundOwner(),
  null,
  'static share loading should clear stale local round owner when the snapshot omits roundOwner'
);
assert.equal(
  state.getNextRoundBase(),
  null,
  'static share loading should clear stale local pending next round when the snapshot omits nextRoundBase'
);
assert.equal(
  state.getWinner(),
  't1',
  'static share loading should reset stale legacy winner when the snapshot omits a resolvable winner'
);
assert.deepEqual(
  state.getPlayerStats(),
  {},
  'static share loading should clear stale local playerStats when the snapshot omits playerStats'
);
assert.deepEqual(
  state.getCurrentRanking(),
  {},
  'static share loading should clear stale local currentRanking when the snapshot omits currentRanking'
);
assert.deepEqual(
  state.getHistory(),
  [],
  'static share loading should clear stale local history when the snapshot omits history'
);
assert.deepEqual(
  state.getGameStatus(),
  {
    ended: false,
    winnerKey: null,
    winnerName: null,
    reason: null
  },
  'static share loading should not derive completed status from stale local history when snapshot omits history'
);
window.location.search = '';

const legacyShareWithPlayerTeams = btoa(encodeURIComponent(JSON.stringify({
  state: {
    gameStatus: {
      ended: false,
      winnerKey: null,
      winnerName: null,
      reason: null
    }
  },
  players: [
    { id: 1, name: 'Legacy Blue Team', emoji: 'B', team: 'A' },
    { id: 2, name: 'Legacy Red Team', emoji: 'R', team: 'B' }
  ]
})));
window.location.search = `?share=${encodeURIComponent(legacyShareWithPlayerTeams)}`;
assert.equal(
  loadFromShareURL(),
  true,
  'legacy static share snapshots with A/B player teams should still load'
);
assert.deepEqual(
  state.getPlayers().map(player => player.team),
  [1, 2],
  'static share loading should canonicalize legacy A/B player teams to numeric teams'
);
window.location.search = '';

const dependentBaselineTeam = config.getTeam('t1');
const dependentBaselineStats = state.getPlayerStats();
const malformedDependentShareData = btoa(encodeURIComponent(JSON.stringify({
  settings: {
    t1: { name: '依赖污染队', color: '#111111' },
    t2: { name: '红队', color: '#ef4444' }
  },
  playerStats: {
    1: {
      games: 1,
      totalRank: 1,
      firstPlaceCount: 1,
      lastPlaceCount: 0,
      rankings: [1]
    }
  }
})));
window.location.search = `?share=${encodeURIComponent(malformedDependentShareData)}`;
assert.equal(
  loadFromShareURL(),
  false,
  'static share snapshots with playerStats but no players should fail closed'
);
assert.deepEqual(
  config.getTeam('t1'),
  dependentBaselineTeam,
  'static share snapshots with dependent data but no players should not partially mutate config'
);
assert.deepEqual(
  state.getPlayerStats(),
  dependentBaselineStats,
  'static share snapshots with dependent data but no players should not mutate stats'
);
window.location.search = '';

config.set4PlayerRules(customRuleSettings.c4);
config.set6PlayerRules({ thresholds: customRuleSettings.t6, points: customRuleSettings.p6 });
config.set8PlayerRules({ thresholds: customRuleSettings.t8, points: customRuleSettings.p8 });

const customRulesShareURL = generateShareURL();
const customRulesShareParam = new URL(customRulesShareURL).searchParams.get('share');
config.resetToDefaults();
window.location.search = `?share=${encodeURIComponent(customRulesShareParam)}`;
assert.equal(
  loadFromShareURL(),
  true,
  'share URLs with valid custom rule settings should load'
);
assert.deepEqual(config.get4PlayerRules(), customRuleSettings.c4);
assert.deepEqual(config.get6PlayerRules(), {
  thresholds: customRuleSettings.t6,
  points: customRuleSettings.p6
});
assert.deepEqual(config.get8PlayerRules(), {
  thresholds: customRuleSettings.t8,
  points: customRuleSettings.p8
});
window.location.search = '';

const originalTeam = config.getTeam('t1');
const malformedShareData = btoa(encodeURIComponent(JSON.stringify({
  settings: {
    t1: { name: '污染队', color: '#111111' }
  },
  state: {
    teams: {}
  }
})));
window.location.search = `?share=${encodeURIComponent(malformedShareData)}`;
assert.equal(
  loadFromShareURL(),
  false,
  'malformed share URLs should fail closed'
);
assert.deepEqual(
  config.getTeam('t1'),
  originalTeam,
  'malformed share URLs should not partially mutate configuration before failing'
);
window.location.search = '';

const staleOpenStatusTeam = config.getTeam('t1');
const staleOpenStatusShareData = btoa(encodeURIComponent(JSON.stringify({
  settings: {
    t1: { name: '状态污染队', color: '#111111' },
    t2: { name: '红队', color: '#ef4444' }
  },
  state: {
    gameStatus: {
      ended: false,
      winnerKey: 't1',
      winnerName: '蓝队',
      reason: 'stale-clear'
    },
    history: []
  },
  players: []
})));
window.location.search = `?share=${encodeURIComponent(staleOpenStatusShareData)}`;
assert.equal(
  loadFromShareURL(),
  false,
  'static share snapshots with open gameStatus and stale winner fields should fail closed'
);
assert.deepEqual(
  config.getTeam('t1'),
  staleOpenStatusTeam,
  'static share snapshots with stale open winner fields should not partially mutate configuration before failing'
);
window.location.search = '';

const rulesBaseline = {
  c4: config.get4PlayerRules(),
  six: config.get6PlayerRules(),
  eight: config.get8PlayerRules()
};
const malformedRulesShareData = btoa(encodeURIComponent(JSON.stringify({
  settings: {
    t1: { name: '规则污染队', color: '#111111' },
    t2: { name: '红队', color: '#ef4444' },
    c4: { '1,2': { bad: true }, '1,3': 2, '1,4': 1 }
  },
  state: {
    teams: {
      t1: { lvl: '2' },
      t2: { lvl: '2' }
    }
  }
})));
window.location.search = `?share=${encodeURIComponent(malformedRulesShareData)}`;
assert.equal(
  loadFromShareURL(),
  false,
  'share URLs with malformed rule settings should fail closed'
);
assert.deepEqual(
  {
    c4: config.get4PlayerRules(),
    six: config.get6PlayerRules(),
    eight: config.get8PlayerRules()
  },
  rulesBaseline,
  'share URLs with malformed rule settings should not mutate custom rules'
);
assert.deepEqual(
  config.getTeam('t1'),
  originalTeam,
  'share URLs with malformed rule settings should not partially mutate team config'
);
window.location.search = '';

const originalT1Level = state.getTeamLevel('t1');
const invalidLevelShareData = btoa(encodeURIComponent(JSON.stringify({
  state: {
    teams: {
      t1: { lvl: { bad: true } },
      t2: { lvl: 'A' }
    }
  }
})));
window.location.search = `?share=${encodeURIComponent(invalidLevelShareData)}`;
assert.equal(
  loadFromShareURL(),
  false,
  'share URLs with invalid team levels should fail closed'
);
assert.equal(
  state.getTeamLevel('t1'),
  originalT1Level,
  'share URLs with invalid team levels should not mutate game state'
);
window.location.search = '';

const originalPreferences = config.getPreferences();
const malformedPreferenceShareData = btoa(encodeURIComponent(JSON.stringify({
  settings: {
    t1: { name: '半污染队', color: '#111111' },
    strictA: 'false'
  },
  state: {
    teams: {
      t1: { lvl: '2' },
      t2: { lvl: '2' }
    }
  }
})));
window.location.search = `?share=${encodeURIComponent(malformedPreferenceShareData)}`;
assert.equal(
  loadFromShareURL(),
  false,
  'share URLs with malformed preference settings should fail closed'
);
assert.deepEqual(
  config.getTeam('t1'),
  originalTeam,
  'share URLs with malformed preference settings should not partially mutate team config'
);
assert.deepEqual(
  config.getPreferences(),
  originalPreferences,
  'share URLs with malformed preference settings should not mutate preferences'
);
window.location.search = '';

const originalTeam2 = config.getTeam('t2');
const malformedSettingsShareData = btoa(encodeURIComponent(JSON.stringify({
  settings: {
    t1: { name: '半污染队', color: '#111111' },
    t2: null
  },
  state: {
    teams: {
      t1: { lvl: '2' },
      t2: { lvl: '2' }
    }
  }
})));
window.location.search = `?share=${encodeURIComponent(malformedSettingsShareData)}`;
assert.equal(
  loadFromShareURL(),
  false,
  'share URLs with malformed team settings should fail closed'
);
assert.deepEqual(
  config.getTeam('t1'),
  originalTeam,
  'share URLs with malformed team settings should not partially mutate team 1'
);
assert.deepEqual(
  config.getTeam('t2'),
  originalTeam2,
  'share URLs with malformed team settings should not mutate team 2'
);
window.location.search = '';

state.resetGame();

const synced = await syncToRoom();
assert.equal(synced, true);
assert.ok(putPayload, 'syncToRoom should send a PUT payload');
assert.equal(putPayload.finishedAt, null, 'open games should clear stale finishedAt');
assert.equal(putPayload.isFavorite, true, 'host sync should preserve favorite flag');
assert.equal(putPayload.favoritedAt, existingRoom.favoritedAt, 'host sync should preserve favoritedAt');
assert.deepEqual(
  putPayload.endGameVotes,
  { mvp: {}, burden: {}, fingerprints: [] },
  'open games should clear stale active end-game votes'
);
assert.deepEqual(
  putPayload.endGameVotesHistory,
  existingRoom.endGameVotesHistory,
  'host sync should preserve archived vote history'
);
assert.equal(getRoomInfo().isFavorite, true);

state.setHistory([
  {
    ts: '2026-06-10 12:30:00',
    win: '蓝队',
    winKey: 't1',
    aNote: '蓝队 A级通关（胜方无末游，在自己的A级）'
  }
]);
state.clearGameStatus();
state.setNextRoundBase('K');
putPayload = null;

const staleStatusSynced = await syncToRoom();
assert.equal(staleStatusSynced, true);
assert.equal(
  putPayload.state.gameStatus.ended,
  true,
  'host sync should persist reconciled ended status when local status is stale-open but history is completed'
);
assert.equal(putPayload.state.gameStatus.winnerKey, 't1');
assert.equal(putPayload.state.gameStatus.winnerName, '蓝队');
assert.equal(
  putPayload.state.nextRoundBase,
  null,
  'host sync should not send stale pending next-round state once history resolves to completed'
);
assert.equal(
  putPayload.finishedAt,
  existingRoom.finishedAt,
  'completed stale-status sync should preserve an existing room finishedAt'
);

createResponseMode = 'missingAuthToken';
const missingTokenRoom = await createRoom();
assert.equal(
  missingTokenRoom,
  null,
  'room creation should fail closed when the server does not return a host auth token'
);
assert.deepEqual(
  getRoomInfo(),
  {
    roomCode: null,
    isHost: false,
    isViewer: false,
    authToken: null,
    createdAt: null,
    finishedAt: null,
    isFavorite: false
  },
  'failed replacement room creation must clear the previous host connection'
);
createResponseMode = 'valid';

createResponseMode = 'htmlSuccess';
consoleErrors.length = 0;
const htmlCreateRoom = await createRoom();
assert.equal(
  htmlCreateRoom,
  null,
  'room creation should fail closed on non-JSON success responses'
);
assert.deepEqual(
  getRoomInfo(),
  {
    roomCode: null,
    isHost: false,
    isViewer: false,
    authToken: null,
    createdAt: null,
    finishedAt: null,
    isFavorite: false
  },
  'non-JSON room creation responses must not leave a stale host connection active'
);
assert.equal(
  consoleErrors.some(message => /Unexpected token|SyntaxError/.test(message)),
  false,
  'non-JSON room creation responses should not surface as JSON parse errors'
);
createResponseMode = 'valid';

leaveRoom();
assert.deepEqual(getRoomInfo(), {
  roomCode: null,
  isHost: false,
  isViewer: false,
  authToken: null,
  createdAt: null,
  finishedAt: null,
  isFavorite: false
});

config.resetToDefaults();
state.resetGame();
const roomBaselineTeam = config.getTeam('t1');
const roomBaselinePrefs = config.getPreferences();
const previousAlert = globalThis.alert;
const joinAlerts = [];
globalThis.alert = message => joinAlerts.push(message);

consoleErrors.length = 0;
const nonJsonRoomJoin = await joinRoom('HTML00');
assert.equal(nonJsonRoomJoin, false, 'non-JSON room detail responses should not be joined');
assert.equal(nonJsonRoomCode, 'HTML00');
assert.deepEqual(
  getRoomInfo(),
  {
    roomCode: null,
    isHost: false,
    isViewer: false,
    authToken: null,
    createdAt: null,
    finishedAt: null,
    isFavorite: false
  },
  'non-JSON room detail responses should not leave room mode active'
);
assert.equal(
  consoleErrors.some(message => /Unexpected token|SyntaxError/.test(message)),
  false,
  'non-JSON room detail responses should not surface as JSON parse errors'
);

const malformedRoomJoin = await joinRoom('BADCFG');
globalThis.alert = previousAlert;

assert.equal(malformedRoomJoin, false, 'malformed room snapshots should not be joined');
assert.deepEqual(
  config.getTeam('t1'),
  roomBaselineTeam,
  'malformed room snapshots should not partially mutate team config'
);
assert.deepEqual(
  config.getPreferences(),
  roomBaselinePrefs,
  'malformed room snapshots should not mutate preferences'
);
assert.deepEqual(
  getRoomInfo(),
  {
    roomCode: null,
    isHost: false,
    isViewer: false,
    authToken: null,
    createdAt: null,
    finishedAt: null,
    isFavorite: false
  },
  'malformed room snapshots should not leave room mode active'
);
assert.deepEqual(joinAlerts, ['加入房间失败', '加入房间失败']);

const badRulesBaseline = {
  c4: config.get4PlayerRules(),
  six: config.get6PlayerRules(),
  eight: config.get8PlayerRules(),
  team: config.getTeam('t1')
};
const badRulesAlerts = [];
globalThis.alert = message => badRulesAlerts.push(message);

const malformedRulesJoin = await joinRoom('BADRUL');
globalThis.alert = previousAlert;

assert.equal(malformedRulesJoin, false, 'room snapshots with malformed rule settings should not be joined');
assert.deepEqual(
  {
    c4: config.get4PlayerRules(),
    six: config.get6PlayerRules(),
    eight: config.get8PlayerRules(),
    team: config.getTeam('t1')
  },
  badRulesBaseline,
  'room snapshots with malformed rule settings should not mutate config'
);
assert.deepEqual(
  getRoomInfo(),
  {
    roomCode: null,
    isHost: false,
    isViewer: false,
    authToken: null,
    createdAt: null,
    finishedAt: null,
    isFavorite: false
  },
  'room snapshots with malformed rule settings should not leave room mode active'
);
assert.deepEqual(badRulesAlerts, ['加入房间失败']);

config.resetToDefaults();
const customRulesJoin = await joinRoom('RULES1');
assert.equal(customRulesJoin, true, 'room snapshots with valid custom rule settings should be joined');
assert.deepEqual(config.get4PlayerRules(), customRuleSettings.c4);
assert.deepEqual(config.get6PlayerRules(), {
  thresholds: customRuleSettings.t6,
  points: customRuleSettings.p6
});
assert.deepEqual(config.get8PlayerRules(), {
  thresholds: customRuleSettings.t8,
  points: customRuleSettings.p8
});
leaveRoom();

state.setWinner('t1');
const endedWinnerJoin = await joinRoom('ENDWNR');
assert.equal(endedWinnerJoin, true, 'ended room snapshots with stale legacy winner should still load');
assert.equal(state.getGameStatus().winnerKey, 't2');
assert.equal(
  state.getWinner(),
  't2',
  'room loading should derive legacy winner from authoritative completed game status'
);
assert.equal(
  state.getNextRoundBase(),
  null,
  'room loading should clear stale pending next-round state from completed snapshots'
);
leaveRoom();

state.setPlayers([{ id: 1, name: 'Baseline', team: 1 }]);
state.setCurrentRanking({ 1: 1 });
const rankingBaseline = state.getCurrentRanking();
const rankingAlerts = [];
globalThis.alert = message => rankingAlerts.push(message);

const malformedRankingJoin = await joinRoom('BADRNK');
globalThis.alert = previousAlert;

assert.equal(malformedRankingJoin, false, 'room snapshots with malformed current rankings should not be joined');
assert.deepEqual(
  state.getCurrentRanking(),
  rankingBaseline,
  'room snapshots with malformed current rankings should not mutate ranking state'
);
assert.deepEqual(
  getRoomInfo(),
  {
    roomCode: null,
    isHost: false,
    isViewer: false,
    authToken: null,
    createdAt: null,
    finishedAt: null,
    isFavorite: false
  },
  'room snapshots with malformed current rankings should not leave room mode active'
);
assert.deepEqual(rankingAlerts, ['加入房间失败']);

state.setPlayers([
  { id: 1, name: '保留玩家', emoji: 'P', team: 1 }
]);
const playersBaseline = state.getPlayers();
const playerAlerts = [];
globalThis.alert = message => playerAlerts.push(message);

const malformedPlayersJoin = await joinRoom('BADPLY');
globalThis.alert = previousAlert;

assert.equal(malformedPlayersJoin, false, 'room snapshots with malformed players should not be joined');
assert.deepEqual(
  state.getPlayers(),
  playersBaseline,
  'room snapshots with malformed players should not mutate player state'
);
assert.deepEqual(
  getRoomInfo(),
  {
    roomCode: null,
    isHost: false,
    isViewer: false,
    authToken: null,
    createdAt: null,
    finishedAt: null,
    isFavorite: false
  },
  'room snapshots with malformed players should not leave room mode active'
);
assert.deepEqual(playerAlerts, ['加入房间失败']);

state.setPlayerStats({
  1: {
    games: 1,
    totalRank: 1,
    firstPlaceCount: 1,
    lastPlaceCount: 0,
    rankings: [1]
  }
});
const statsBaseline = state.getPlayerStats();
const statsAlerts = [];
globalThis.alert = message => statsAlerts.push(message);

const malformedStatsJoin = await joinRoom('BADSTS');
globalThis.alert = previousAlert;

assert.equal(malformedStatsJoin, false, 'room snapshots with malformed player stats should not be joined');
assert.deepEqual(
  state.getPlayerStats(),
  statsBaseline,
  'room snapshots with malformed player stats should not mutate stats state'
);
assert.deepEqual(
  getRoomInfo(),
  {
    roomCode: null,
    isHost: false,
    isViewer: false,
    authToken: null,
    createdAt: null,
    finishedAt: null,
    isFavorite: false
  },
  'room snapshots with malformed player stats should not leave room mode active'
);
assert.deepEqual(statsAlerts, ['加入房间失败']);

state.setPlayers([
  { id: 1, name: 'Legacy Same Player', emoji: 'L', team: 1 }
]);
state.setPlayerStats({
  1: {
    games: 3,
    totalRank: 3,
    firstPlaceCount: 3,
    lastPlaceCount: 0,
    rankings: [1, 1, 1]
  }
});
state.setCurrentRanking({ 1: 1 });

const legacyNoStatsJoin = await joinRoom('NOSTAT');
assert.equal(legacyNoStatsJoin, true, 'legacy room snapshots without optional stats should still be joined');
assert.deepEqual(
  state.getTeam('t1'),
  { lvl: '2', aFail: 0 },
  'room loading should reset stale local team 1 state when the room snapshot omits teams'
);
assert.deepEqual(
  state.getTeam('t2'),
  { lvl: '2', aFail: 0 },
  'room loading should reset stale local team 2 state when the room snapshot omits teams'
);
assert.equal(
  state.getRoundLevel(),
  '2',
  'room loading should reset stale local round level when the room snapshot omits roundLevel'
);
assert.equal(
  state.getRoundOwner(),
  null,
  'room loading should clear stale local round owner when the room snapshot omits roundOwner'
);
assert.equal(
  state.getNextRoundBase(),
  null,
  'room loading should clear stale local pending next round when the room snapshot omits nextRoundBase'
);
assert.equal(
  state.getWinner(),
  't1',
  'room loading should reset stale legacy winner when the room snapshot omits a resolvable winner'
);
assert.deepEqual(
  state.getPlayerStats(),
  {},
  'room loading should clear stale local playerStats when the room snapshot omits playerStats'
);
assert.deepEqual(
  state.getCurrentRanking(),
  {},
  'room loading should clear stale local currentRanking when the room snapshot omits currentRanking'
);
leaveRoom();

const legacyPlayerTeamsJoin = await joinRoom('LEGTMS');
assert.equal(legacyPlayerTeamsJoin, true, 'legacy room snapshots with A/B player teams should still be joined');
assert.deepEqual(
  state.getPlayers().map(player => player.team),
  [1, 2],
  'room loading should canonicalize legacy A/B player teams to numeric teams'
);
leaveRoom();

state.setHistory([
  {
    ts: '2026-06-10 13:00:00',
    mode: '4',
    win: '蓝队',
    winKey: 't1',
    ranks: [1, 3],
    aNote: '蓝队 A级通关（胜方无末游，在自己的A级）',
    gameStatus: {
      ended: true,
      winnerKey: 't1',
      winnerName: '蓝队',
      reason: 'A_LEVEL_CLEARED'
    }
  }
]);
state.setGameStatus({
  ended: true,
  winnerKey: 't1',
  winnerName: '蓝队',
  reason: 'A_LEVEL_CLEARED'
});
const legacyNoHistoryJoin = await joinRoom('NOHIST');
assert.equal(legacyNoHistoryJoin, true, 'legacy room snapshots without history should still be joined');
assert.deepEqual(
  state.getHistory(),
  [],
  'room loading should clear stale local history when the room snapshot omits history'
);
assert.deepEqual(
  state.getGameStatus(),
  {
    ended: false,
    winnerKey: null,
    winnerName: null,
    reason: null
  },
  'room loading should not derive completed status from stale local history when snapshot omits history'
);
leaveRoom();

state.setPlayers([
  { id: 1, name: 'Legacy Same Player', emoji: 'L', team: 1 }
]);
state.setPlayerStats({
  1: {
    games: 3,
    totalRank: 3,
    firstPlaceCount: 3,
    lastPlaceCount: 0,
    rankings: [1, 1, 1]
  }
});
state.setCurrentRanking({ 1: 1 });

const legacyNoPlayersJoin = await joinRoom('NOPLAY');
assert.equal(legacyNoPlayersJoin, true, 'legacy room snapshots without player data should still be joined');
assert.deepEqual(
  state.getPlayers(),
  [],
  'room loading should clear stale local players when the room snapshot omits players'
);
assert.deepEqual(
  state.getPlayerStats(),
  {},
  'room loading should clear stale local playerStats when the room snapshot omits players'
);
assert.deepEqual(
  state.getCurrentRanking(),
  {},
  'room loading should clear stale local currentRanking when the room snapshot omits players'
);
leaveRoom();

const stateBaselineTeam = config.getTeam('t1');
const stateBaselineNextRoundBase = state.getNextRoundBase();
const stateBaselineGameStatus = state.getGameStatus();
const stateAlerts = [];
globalThis.alert = message => stateAlerts.push(message);

const malformedStateJoin = await joinRoom('BADSTA');
globalThis.alert = previousAlert;

assert.equal(malformedStateJoin, false, 'room snapshots with malformed state fields should not be joined');
assert.deepEqual(
  config.getTeam('t1'),
  stateBaselineTeam,
  'room snapshots with malformed state fields should not partially mutate team config'
);
assert.equal(
  state.getNextRoundBase(),
  stateBaselineNextRoundBase,
  'room snapshots with malformed state fields should not mutate next-round preview'
);
assert.deepEqual(
  state.getGameStatus(),
  stateBaselineGameStatus,
  'room snapshots with malformed state fields should not mutate game status'
);
assert.deepEqual(
  getRoomInfo(),
  {
    roomCode: null,
    isHost: false,
    isViewer: false,
    authToken: null,
    createdAt: null,
    finishedAt: null,
    isFavorite: false
  },
  'room snapshots with malformed state fields should not leave room mode active'
);
assert.deepEqual(stateAlerts, ['加入房间失败']);

const historyBaselineTeam = config.getTeam('t1');
const historyBaseline = state.getHistory();
const historyBaselineStatus = state.getGameStatus();
const historyAlerts = [];
globalThis.alert = message => historyAlerts.push(message);

const malformedHistoryJoin = await joinRoom('BADHIS');
globalThis.alert = previousAlert;

assert.equal(malformedHistoryJoin, false, 'room snapshots with malformed history should not be joined');
assert.deepEqual(
  config.getTeam('t1'),
  historyBaselineTeam,
  'room snapshots with malformed history should not partially mutate team config'
);
assert.deepEqual(
  state.getHistory(),
  historyBaseline,
  'room snapshots with malformed history should not mutate game history'
);
assert.deepEqual(
  state.getGameStatus(),
  historyBaselineStatus,
  'room snapshots with malformed history should not mutate derived game status'
);
assert.deepEqual(
  getRoomInfo(),
  {
    roomCode: null,
    isHost: false,
    isViewer: false,
    authToken: null,
    createdAt: null,
    finishedAt: null,
    isFavorite: false
  },
  'room snapshots with malformed history should not leave room mode active'
);
assert.deepEqual(historyAlerts, ['加入房间失败']);

const noWinnerBaselineTeam = config.getTeam('t1');
const noWinnerBaselineStatus = state.getGameStatus();
const noWinnerAlerts = [];
globalThis.alert = message => noWinnerAlerts.push(message);

const noWinnerJoin = await joinRoom('NOWIN1');
globalThis.alert = previousAlert;

assert.equal(noWinnerJoin, false, 'ended room snapshots without a resolvable winner should not be joined');
assert.deepEqual(
  config.getTeam('t1'),
  noWinnerBaselineTeam,
  'ended room snapshots without a resolvable winner should not partially mutate team config'
);
assert.deepEqual(
  state.getGameStatus(),
  noWinnerBaselineStatus,
  'ended room snapshots without a resolvable winner should not mutate game status'
);
assert.deepEqual(
  getRoomInfo(),
  {
    roomCode: null,
    isHost: false,
    isViewer: false,
    authToken: null,
    createdAt: null,
    finishedAt: null,
    isFavorite: false
  },
  'ended room snapshots without a resolvable winner should not leave room mode active'
);
assert.deepEqual(noWinnerAlerts, ['加入房间失败']);

const invalidHostJoin = await joinRoom('ZXCVBN', 'bad-token');
assert.equal(invalidHostJoin, true, 'invalid host token should still allow viewer fallback');
assert.equal(
  invalidAuthFetches[0],
  'Bearer bad-token',
  'joining with auth should ask the server to verify the host token'
);
assert.ok(
  invalidAuthFetches.includes(null),
  'invalid host token should retry the room load without auth for viewer mode'
);
assert.equal(getRoomInfo().roomCode, 'ZXCVBN');
assert.equal(getRoomInfo().isHost, false, 'invalid host token must not enter host mode');
assert.equal(getRoomInfo().isViewer, true, 'invalid host token should fall back to viewer mode');
assert.equal(getRoomInfo().authToken, null, 'invalid host token must not be retained');
leaveRoom();

const validHostJoin = await joinRoom('HOST12', 'valid-token');
assert.equal(validHostJoin, true, 'valid host token should allow host join');
assert.deepEqual(
  validAuthFetches,
  ['Bearer valid-token'],
  'valid host join should verify auth once and should not retry as viewer'
);
assert.equal(getRoomInfo().roomCode, 'HOST12');
assert.equal(getRoomInfo().isHost, true, 'verified host token should enter host mode');
assert.equal(getRoomInfo().isViewer, false, 'verified host token should not enter viewer mode');
assert.equal(getRoomInfo().authToken, 'valid-token');

const staleSyncEvents = [];
const unsubscribeStaleSync = onEvent('room:synced', event => staleSyncEvents.push(event));
delayHostPut = true;
const hostPutStarted = new Promise(resolve => {
  hostPutStartedResolve = resolve;
});
const staleSyncPromise = syncToRoom();
await hostPutStarted;
assert.ok(hostPutPayload, 'host sync should send a PUT before stale completion test');
leaveRoom();
hostPutRelease();
const staleSyncResult = await staleSyncPromise;
unsubscribeStaleSync();
delayHostPut = false;
hostPutRelease = null;

assert.equal(
  staleSyncResult,
  false,
  'sync completing after the user leaves should be treated as stale'
);
assert.deepEqual(
  staleSyncEvents,
  [],
  'stale sync completions should not emit room:synced for the current UI'
);
assert.deepEqual(
  getRoomInfo(),
  {
    roomCode: null,
    isHost: false,
    isViewer: false,
    authToken: null,
    createdAt: null,
    finishedAt: null,
    isFavorite: false
  },
  'stale sync completions should not repopulate room metadata after leave'
);
leaveRoom();

const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;
let capturedPollInterval = null;
globalThis.setInterval = (callback, delay) => {
  if (delay === 2000) {
    capturedPollInterval = callback;
    return 'poll-interval';
  }
  return originalSetInterval(callback, delay);
};
globalThis.clearInterval = id => {
  if (id === 'poll-interval') return;
  return originalClearInterval(id);
};

const pollUpdatedEvents = [];
const unsubscribePollUpdated = onEvent('room:updated', event => pollUpdatedEvents.push(event));
try {
  const pollJoin = await joinRoom('POLLUP');
  assert.equal(pollJoin, true, 'polling regression fixture should join as viewer');
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
  pollUpdatedEvents.length = 0;
  pollUpdateVersion = 2;
  assert.equal(typeof capturedPollInterval, 'function', 'viewer polling interval callback should be captured');
  await capturedPollInterval();
  await new Promise(resolve => setTimeout(resolve, 0));
} finally {
  unsubscribePollUpdated();
  leaveRoom();
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
}

assert.equal(
  pollUpdatedEvents.length,
  1,
  'one changed viewer poll should emit one room:updated event'
);

const roomManagerSource = readFileSync(resolve(repoRoot, 'src/share/roomManager.js'), 'utf8');
assert.ok(
  roomManagerSource.includes('const pollRoomCode = currentRoomCode;'),
  'viewer polling should capture the room code at request start'
);
assert.ok(
  roomManagerSource.includes('currentRoomCode !== pollRoomCode || isHost'),
  'viewer polling should discard responses that arrive after leaving or switching rooms'
);
assert.ok(
  roomManagerSource.includes("typeof requestAnimationFrame === 'function'"),
  'viewer polling should not require requestAnimationFrame in non-browser verification environments'
);
assert.equal(
  roomManagerSource.includes("from '../ranking/rankingRenderer.js'"),
  false,
  'room sync should not depend on renderer-level checkGameEnded; resolved gameStatus is the source of truth'
);

console.log('room sync state checks passed');
