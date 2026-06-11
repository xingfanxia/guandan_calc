import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isClearingANote,
  openGameStatus,
  resolveGameStatus
} from '../../src/game/gameStatus.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const endedHistory = [
  {
    ts: '2026-06-10 20:15:00',
    win: '蓝队',
    winKey: 't1',
    aNote: '蓝队 A级通关（胜方无末游，在自己的A级）'
  }
];

assert.deepEqual(openGameStatus(), {
  ended: false,
  winnerKey: null,
  winnerName: null,
  reason: null
});

assert.deepEqual(
  resolveGameStatus(
    { ended: false, winnerKey: null, winnerName: null, reason: null },
    endedHistory
  ),
  {
    ended: true,
    winnerKey: 't1',
    winnerName: '蓝队',
    reason: 'A_LEVEL_CLEARED'
  },
  'an explicit open status must not override a completed latest history entry'
);

assert.deepEqual(
  resolveGameStatus(
    { ended: false, winnerKey: null, winnerName: null, reason: null },
    { hist: endedHistory }
  ),
  {
    ended: true,
    winnerKey: 't1',
    winnerName: '蓝队',
    reason: 'A_LEVEL_CLEARED'
  },
  'legacy state.hist should participate in game-status reconciliation'
);

assert.deepEqual(
  resolveGameStatus(
    {
      ended: true,
      winnerKey: 't2',
      winnerName: '红队',
      reason: 'A_LEVEL_CLEARED'
    },
    endedHistory
  ),
  {
    ended: true,
    winnerKey: 't2',
    winnerName: '红队',
    reason: 'A_LEVEL_CLEARED'
  },
  'an explicit completed status remains authoritative'
);

assert.deepEqual(
  resolveGameStatus(
    {
      ended: true,
      winnerKey: 't2',
      winnerName: '红队',
      reason: 'A_LEVEL_CLEARED'
    },
    [
      {
        ts: '2026-06-10 20:15:00',
        win: '蓝队',
        winKey: 't1',
        aNote: '蓝队 A级通关（胜方无末游，在自己的A级）',
        gameStatus: {
          ended: true,
          winnerKey: 't1',
          winnerName: '蓝队',
          reason: 'A_LEVEL_CLEARED'
        }
      }
    ]
  ),
  {
    ended: true,
    winnerKey: 't1',
    winnerName: '蓝队',
    reason: 'A_LEVEL_CLEARED'
  },
  'latest structured history status should override a conflicting top-level completed status'
);

assert.deepEqual(
  resolveGameStatus(
    {
      ended: true,
      winnerKey: 't1',
      winnerName: null,
      reason: 'A_LEVEL_CLEARED'
    },
    endedHistory
  ),
  {
    ended: true,
    winnerKey: 't1',
    winnerName: '蓝队',
    reason: 'A_LEVEL_CLEARED'
  },
  'completed status may fill missing display fields from latest history without changing the winner'
);

assert.deepEqual(
  resolveGameStatus(
    {
      ended: true,
      winnerKey: 't2',
      winnerName: null,
      reason: 'A_LEVEL_CLEARED'
    },
    endedHistory
  ),
  {
    ended: true,
    winnerKey: 't2',
    winnerName: null,
    reason: 'A_LEVEL_CLEARED'
  },
  'completed status must not borrow a winnerName from a mismatched latest history winner'
);

assert.deepEqual(
  resolveGameStatus(
    {
      ended: true,
      winnerKey: 't1',
      winnerName: { bad: true },
      reason: { bad: true }
    },
    endedHistory
  ),
  {
    ended: true,
    winnerKey: 't1',
    winnerName: '蓝队',
    reason: 'A_LEVEL_CLEARED'
  },
  'completed status should sanitize malformed display fields before syncing to viewers'
);

assert.deepEqual(
  resolveGameStatus(
    {
      ended: true,
      winnerKey: null,
      winnerName: null,
      reason: 'A_LEVEL_CLEARED'
    },
    []
  ),
  openGameStatus(),
  'ended status without any resolvable winner must not be treated as completed'
);

assert.deepEqual(
  resolveGameStatus(
    {
      ended: true,
      winnerKey: null,
      winnerName: null,
      reason: 'A_LEVEL_CLEARED'
    },
    endedHistory
  ),
  {
    ended: true,
    winnerKey: 't1',
    winnerName: '蓝队',
    reason: 'A_LEVEL_CLEARED'
  },
  'ended status may fill a missing winner from latest completed history'
);

assert.deepEqual(
  resolveGameStatus(
    {
      ended: true,
      winnerKey: null,
      winnerName: null,
      reason: 'A_LEVEL_CLEARED'
    },
    [
      {
        win: '蓝队',
        winKey: 't1',
        aNote: '蓝队 A级胜利（但本局级牌为K，需在自己的A级获胜才能通关）'
      }
    ]
  ),
  openGameStatus(),
  'ended status without a winner must not borrow winnerKey from a non-clearing history entry'
);

assert.deepEqual(
  resolveGameStatus(
    {
      ended: true,
      winnerKey: 'bad',
      winnerName: '坏数据',
      reason: 'A_LEVEL_CLEARED'
    },
    []
  ),
  openGameStatus(),
  'ended status with an invalid winner key must not be treated as completed'
);

assert.deepEqual(
  resolveGameStatus(
    null,
    [
      {
        win: '蓝队',
        aNote: '蓝队 A级通关（胜方无末游，在自己的A级）'
      }
    ]
  ),
  openGameStatus(),
  'legacy clear-note history without a winner key must not produce an ambiguous completed status'
);

assert.deepEqual(
  resolveGameStatus(
    null,
    [
      {
        win: '坏数据',
        winKey: 'bad',
        aNote: '坏数据 A级通关（胜方无末游，在自己的A级）'
      }
    ]
  ),
  openGameStatus(),
  'legacy clear-note history with an invalid winner key must not produce a completed status'
);

assert.deepEqual(
  resolveGameStatus(
    null,
    [
      {
        win: { bad: true },
        winKey: 't1',
        aNote: '蓝队 A级通关（胜方无末游，在自己的A级）'
      }
    ]
  ),
  {
    ended: true,
    winnerKey: 't1',
    winnerName: null,
    reason: 'A_LEVEL_CLEARED'
  },
  'legacy clear-note history should not expose malformed winner display names'
);

assert.deepEqual(
  resolveGameStatus(
    null,
    [
      {
        win: '蓝队',
        winKey: 't1',
        aNote: '蓝队 A级胜利（但本局级牌为K，需在自己的A级获胜才能通关）'
      }
    ]
  ),
  openGameStatus(),
  'non-clearing A-level notes must stay open'
);

[
  '蓝队 在自己的A级胜方含末游，不通关，继续打到通关',
  '蓝队 A级胜利（但本局级牌为K，需在自己的A级获胜才能通关）',
  '红队 在对方回合（蓝队的级）胜但含末游，不通关，但A失败不计',
  '红队 A级通关（胜方无末游）'
].forEach(note => {
  assert.equal(isClearingANote(note), false, `${note} should not be treated as a clear`);
});

assert.equal(
  isClearingANote('蓝队 A级通关（胜方无末游，在自己的A级）'),
  true,
  'explicit A-level clear note should remain a clear'
);

[
  '但丁队 A级通关（胜方无末游，在自己的A级）',
  '需求队 A级通关（胜方无末游，在自己的A级）'
].forEach(note => {
  assert.equal(isClearingANote(note), true, `${note} should remain a clear`);
});

const roomManagerSource = readFileSync(resolve(repoRoot, 'src/share/roomManager.js'), 'utf8');
const shareManagerSource = readFileSync(resolve(repoRoot, 'src/share/shareManager.js'), 'utf8');
const historyRendererSource = readFileSync(resolve(repoRoot, 'src/game/history.js'), 'utf8');

assert.ok(
  roomManagerSource.includes('resolveGameStatus'),
  'room manager should use the shared game-status reconciliation helper'
);
assert.ok(
  shareManagerSource.includes('resolveGameStatus'),
  'share manager should use the shared game-status reconciliation helper'
);
assert.equal(
  roomManagerSource.includes('s.gameStatus || deriveGameStatusFromHistory'),
  false,
  'room loading should not blindly trust an explicit open gameStatus over ended history'
);
assert.equal(
  shareManagerSource.includes('s.gameStatus || deriveGameStatusFromHistory'),
  false,
  'share loading should not blindly trust an explicit open gameStatus over ended history'
);
assert.ok(
  roomManagerSource.includes('const history = state.getHistory();') &&
    roomManagerSource.includes('const gameStatus = resolveGameStatus(state.getGameStatus(), history);'),
  'room sync should persist the reconciled gameStatus, not a stale open local status'
);
assert.ok(
  historyRendererSource.includes("import { isClearingANote } from './gameStatus.js';"),
  'history renderer should use the shared A-level clear-note parser'
);
assert.equal(
  historyRendererSource.includes("aNote.includes('A级通关')"),
  false,
  'history renderer should not use a narrower clear-note check than room/viewer status reconciliation'
);
assert.ok(
  historyRendererSource.includes('function getEntryWinnerName'),
  'history renderer should centralize winner display fallback for restored ended history entries'
);
assert.equal(
  historyRendererSource.includes('`${entry.win}通关`'),
  false,
  'history renderer should not show undefined通关 when restored ended history lacks entry.win'
);

console.log('game status reconciliation checks passed');
