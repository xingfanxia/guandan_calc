import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PERSONAL_HONORS_BY_MODE,
  MAX_PERSONAL_HONORS_PER_PLAYER,
  MAX_TEAM_HONORS_PER_SESSION,
  calculateSessionHonors
} from '../shared/honorLogic.js';

function playersFor(mode) {
  return Array.from({ length: mode }, (_, index) => ({
    id: index + 1,
    name: `P${index + 1}`,
    team: index < mode / 2 ? 1 : 2
  }));
}

function hand(order) {
  const winKey = order[0].team === 1 ? 't1' : 't2';
  return {
    winKey,
    round: '2',
    prevRoundOwner: null,
    prevT1Lvl: '2',
    prevT2Lvl: '2',
    t1: '2',
    t2: '2',
    ranks: order.flatMap((player, index) => player.team === order[0].team ? [index + 1] : []),
    playerRankings: Object.fromEntries(order.map((player, index) => [index + 1, player]))
  };
}

function orderWithTargetRank(players, rank, offset = 0) {
  const [target, ...rest] = players;
  const rotated = rest.map((_, index) => rest[(index + offset) % rest.length]);
  rotated.splice(rank - 1, 0, target);
  return rotated;
}

test('v3 cancels session/player caps but still awards each personal key to one strongest player', () => {
  const players = playersFor(8);
  const ranks = [8, 1, 8, 1, 8, 1, 4, 4, 4, 4, 4, 4];
  const history = ranks.map((rank, index) => hand(orderWithTargetRank(players, rank, index)));
  const result = calculateSessionHonors({ history, players, mode: 8, ended: false });
  const targetHonors = result.personalHonors.filter((honor) => honor.playerId === 1);
  assert.equal(MAX_PERSONAL_HONORS_BY_MODE[8], Infinity);
  assert.equal(MAX_PERSONAL_HONORS_PER_PLAYER, Infinity);
  assert.ok(targetHonors.length > 2, '同一人满足不同荣誉时不再只保留两项');
  assert.equal(new Set(result.personalHonors.map((honor) => honor.key)).size, result.personalHonors.length);
});

test('both teams receive the same team honor when both independently satisfy it', () => {
  const players = playersFor(4);
  const t1 = [players[0], players[1], players[2], players[3]];
  const t2 = [players[2], players[3], players[0], players[1]];
  const history = [hand(t1), hand(t1), hand(t1), hand(t2), hand(t2), hand(t2)];
  const result = calculateSessionHonors({ history, players, mode: 4, ended: false });
  assert.equal(MAX_TEAM_HONORS_PER_SESSION, Infinity);
  assert.deepEqual(
    result.teamResults.filter((honor) => honor.key === 'dd_night').map((honor) => honor.team),
    [1, 2]
  );
});

test('a perfect personal evidence tie awards nobody instead of breaking by seat or id', () => {
  const players = playersFor(4);
  const left = [players[0], players[2], players[1], players[3]];
  const right = [players[1], players[2], players[0], players[3]];
  const history = Array.from({ length: 8 }, (_, index) => hand(index % 2 ? right : left));
  const result = calculateSessionHonors({ history, players, mode: 4, ended: false });
  assert.equal(result.personalHonors.some((honor) => honor.key === 'first_king'), false);
});
