import assert from 'node:assert/strict';

globalThis.localStorage = {
  _data: new Map(),
  getItem(key) {
    return this._data.has(key) ? this._data.get(key) : null;
  },
  setItem(key, value) {
    this._data.set(key, String(value));
  },
  removeItem(key) {
    this._data.delete(key);
  },
  clear() {
    this._data.clear();
  }
};

globalThis.window = {
  location: {
    origin: 'http://localhost'
  },
  localStorage: globalThis.localStorage
};

const { default: state } = await import('../../src/core/state.js');
const {
  calculateHonors,
  calculateHonorsFromData,
  resolveHonorPlayerCount
} = await import('../../src/stats/honors.js');
const { MAX_POSITIVE_HONORS_PER_PLAYER } = await import('../../shared/honorLogic.js');

// Positive (capped) honor keys — the anti-sweep cap applies only to these.
const POSITIVE_HONOR_KEYS = [
  'mvp', 'frequent', 'resilient', 'carp', 'comeback', 'nonstick', 'median', 'streak', 'stable'
];

function positiveHonorCounts(honors) {
  const counts = {};
  for (const key of POSITIVE_HONOR_KEYS) {
    const id = honors[key]?.player?.id;
    if (id != null) counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

const players = [
  { id: 1, name: '统治者', emoji: 'A', team: 1 },
  { id: 2, name: '低迷者', emoji: 'B', team: 2 },
  { id: 3, name: '逆转者', emoji: 'C', team: 1 },
  { id: 4, name: '大波动', emoji: 'D', team: 2 },
  { id: 5, name: '中游锚', emoji: 'E', team: 1 },
  { id: 6, name: '万年二', emoji: 'F', team: 2 }
];

const rankings = {
  1: [1, 2, 1, 2, 1, 2, 1, 2],
  2: [6, 5, 6, 5, 6, 5, 6, 5],
  3: [6, 6, 5, 4, 3, 2, 1, 1],
  4: [1, 6, 1, 6, 1, 6, 1, 6],
  5: [3, 4, 3, 4, 3, 4, 3, 4],
  6: [2, 2, 2, 2, 2, 2, 2, 2]
};

function statsFromRankings(rankList, totalPlayers) {
  return {
    games: rankList.length,
    totalRank: rankList.reduce((sum, rank) => sum + rank, 0),
    firstPlaceCount: rankList.filter(rank => rank === 1).length,
    lastPlaceCount: rankList.filter(rank => rank === totalPlayers).length,
    rankings: rankList.slice()
  };
}

assert.doesNotThrow(
  () => calculateHonorsFromData(null, null, 'bad-mode'),
  'honor calculation should tolerate malformed player/stat inputs from corrupted snapshots'
);
assert.deepEqual(
  calculateHonorsFromData(null, null, 'bad-mode'),
  {},
  'honor calculation should return no honors for malformed player/stat inputs'
);
assert.doesNotThrow(
  () => calculateHonorsFromData([null, { bad: true }, players[0]], null, players.length),
  'honor calculation should skip malformed player entries instead of throwing'
);

const shortSessionHonors = calculateHonorsFromData(players, {
  1: statsFromRankings([1, 2, 1, 2], players.length),
  2: statsFromRankings([6, 5, 6, 5], players.length),
  3: statsFromRankings([6, 5, 4, 3], players.length),
  4: statsFromRankings([1, 6, 1, 6], players.length),
  5: statsFromRankings([3, 4, 3, 4], players.length),
  6: statsFromRankings([2, 2, 2, 2], players.length)
}, players.length);

assert.deepEqual(
  shortSessionHonors,
  {},
  'full-session honors should stay pending until at least 5 rounds of evidence exist'
);

state.resetAll();
state.setPlayers(players);
const sessionStats = Object.fromEntries(
  Object.entries(rankings).map(([id, rankList]) => [id, statsFromRankings(rankList, players.length)])
);
state.setPlayerStats(sessionStats);

// SCORING assertions use the UNCAPPED computation: they verify which player SCORES
// highest per honor, independent of the anti-sweep cap's assignment-layer
// redistribution. The capped result (what calculateHonors / the UI returns) is
// exercised separately below for the cap invariant.
const honors = calculateHonorsFromData(players, sessionStats, players.length, { applyCap: false });

assert.equal(honors.mvp?.player.id, 1, '吕布 should reward full-session dominance');
assert.equal(honors.burden?.player.id, 2, '阿斗 should identify the worst full-session burden');
assert.equal(honors.rollercoaster?.player.id, 4, '波动王 should use rank movement magnitude, not just count changes');
assert.equal(honors.frequent?.player.id, 1, '节奏核心 should reward sustained team-leading pressure instead of duplicating rank movement');
assert.equal(honors.frequent?.score, '75%', '节奏核心 should summarize team-leading rounds instead of total rank movement');
assert.equal(honors.comeback?.player.id, 3, '奋斗王 should identify the strongest early-to-late improvement');
assert.equal(honors.carp?.player.id, 3, '逆转核心 should reward bottom-to-top global comeback arcs');
assert.equal(honors.complete?.player.id, 3, '大满贯 should require covering every rank in the player count');
assert.equal(honors.median?.player.id, 6, '团队中轴 should prefer a player who consistently outperforms teammates over a context-free middle rank');
assert.equal(honors.almost?.player.id, 6, '棋差一着 should reward repeated second-place finishes without firsts');
assert.equal(honors.resilient?.player.id, 4, '抗压王 should reward repeated rebounds after pressure rounds');
assert.equal(
  honors.burnout,
  undefined,
  '燃尽王 should stay pending when the only low performer was consistently bad rather than burning out late'
);

// Anti-sweep cap (default behavior). 万年二 (id6) tops 石佛/团队中轴/保底核心/连段王 by
// score, but the cap lets them keep only two, so 团队中轴 redistributes to the next
// teammate-outperformer (id4). This 6p synthetic is a near-degenerate roster (the
// consistency honors all resolve to a tiny qualifier pool), so the soft second pass
// over-caps one player rather than leave a qualified honor empty — that's the
// graceful-degradation path, NOT the 8p strict-cap path (see verify-honor-spread).
const cappedHonors = calculateHonors(players.length);
assert.equal(cappedHonors.mvp?.player.id, 1, '吕布 (flagship) stays truthful under the anti-sweep cap');
assert.notEqual(
  cappedHonors.median?.player.id, 6,
  '团队中轴 should redistribute off id6 once the cap claims their other consistency honors'
);
// The cap redistributes winners but never starves a qualified honor: the SET of
// awarded positive honors is identical capped vs uncapped (no false 本场无人).
const awardedPositive = h => POSITIVE_HONOR_KEYS.filter(key => h[key]?.player).sort();
assert.deepEqual(
  awardedPositive(cappedHonors),
  awardedPositive(honors),
  'the cap must not leave any qualified positive honor unawarded'
);
// And it spreads positives across at least as many players as the uncapped result.
assert.ok(
  Object.keys(positiveHonorCounts(cappedHonors)).length >= Object.keys(positiveHonorCounts(honors)).length,
  'the cap should spread positive honors across no fewer players than the uncapped result'
);

const invalidPlayerCountHonors = calculateHonorsFromData(
  players,
  Object.fromEntries(
    Object.entries(rankings).map(([id, rankList]) => [id, statsFromRankings(rankList, players.length)])
  ),
  'bad-mode',
  { applyCap: false }
);

assert.equal(
  invalidPlayerCountHonors.mvp?.player.id,
  1,
  'honor algorithm entrypoint should normalize invalid player counts instead of suppressing all honors'
);

const incompleteCoverageHonors = calculateHonorsFromData(players, {
  1: statsFromRankings([1, 2, 1, 2, 1, 2], players.length),
  2: statsFromRankings([5, 6, 5, 6, 5, 6], players.length),
  3: statsFromRankings([2, 3, 4, 2, 3, 4], players.length),
  4: statsFromRankings([1, 6, 1, 6, 1, 6], players.length),
  5: statsFromRankings([3, 4, 3, 4, 3, 4], players.length),
  6: statsFromRankings([2, 2, 2, 2, 2, 2], players.length)
}, players.length);

assert.equal(
  incompleteCoverageHonors.complete,
  undefined,
  '大满贯 should stay pending when no player has experienced every rank'
);

const corruptedCounterHonors = calculateHonorsFromData(players, {
  1: {
    games: 100,
    totalRank: 100,
    firstPlaceCount: 100,
    lastPlaceCount: 0,
    rankings: [1, 1, 1]
  },
  2: statsFromRankings([6, 5, 6, 5, 6, 5, 6, 5], players.length),
  3: statsFromRankings([6, 6, 5, 4, 3, 2, 1, 1], players.length),
  4: statsFromRankings([1, 6, 1, 6, 1, 6, 1, 6], players.length),
  5: statsFromRankings([3, 4, 3, 4, 3, 4, 3, 4], players.length),
  6: statsFromRankings([2, 2, 2, 2, 2, 2, 2, 2], players.length)
}, players.length, { applyCap: false });

assert.ok(
  corruptedCounterHonors.mvp,
  'one corrupted games counter should not raise the honor eligibility threshold and suppress all session honors'
);
assert.notEqual(
  corruptedCounterHonors.mvp?.player.id,
  1,
  'honor scoring should use actual ranking history, not inflated legacy counters'
);

const unevenParticipationHonors = calculateHonorsFromData(players, {
  1: statsFromRankings([2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3], players.length),
  2: statsFromRankings([1, 1, 1, 1, 1], players.length),
  3: statsFromRankings([6, 5, 6, 5, 6], players.length),
  4: statsFromRankings([4, 4, 4, 4, 4], players.length),
  5: statsFromRankings([3, 4, 3, 4, 3], players.length),
  6: statsFromRankings([2, 2, 2, 2, 2], players.length)
}, players.length, { applyCap: false });

assert.equal(
  unevenParticipationHonors.mvp?.player.id,
  2,
  'honors should not exclude a player with 5 valid rankings just because another player has a longer history'
);

const teamContextPlayers = [
  { id: 1, name: '强队头游', emoji: 'A', team: 1 },
  { id: 2, name: '强队二游', emoji: 'B', team: 1 },
  { id: 3, name: '弱队支点', emoji: 'C', team: 2 },
  { id: 4, name: '弱队低位', emoji: 'D', team: 2 }
];
const teamContextHonors = calculateHonorsFromData(teamContextPlayers, {
  1: statsFromRankings([1, 1, 2, 1, 2, 1], teamContextPlayers.length),
  2: statsFromRankings([2, 2, 1, 2, 1, 2], teamContextPlayers.length),
  3: statsFromRankings([3, 3, 3, 3, 3, 3], teamContextPlayers.length),
  4: statsFromRankings([4, 4, 4, 4, 4, 4], teamContextPlayers.length)
}, teamContextPlayers.length, { applyCap: false });

assert.equal(
  teamContextHonors.nonstick?.player.id,
  3,
  '保底核心 should use teammate context, rewarding the player who keeps a weaker team from total collapse instead of a stronger no-last finisher'
);

const noPressureHonors = calculateHonorsFromData(players, {
  1: statsFromRankings([1, 2, 1, 2, 1, 2], players.length),
  2: statsFromRankings([2, 3, 2, 3, 2, 3], players.length),
  3: statsFromRankings([3, 4, 3, 4, 3, 4], players.length),
  4: statsFromRankings([2, 3, 2, 3, 2, 3], players.length),
  5: statsFromRankings([3, 4, 3, 4, 3, 4], players.length),
  6: statsFromRankings([2, 2, 2, 2, 2, 2], players.length)
}, players.length);

assert.equal(
  noPressureHonors.resilient,
  undefined,
  '抗压王 should stay pending when nobody has bottom-tier pressure rounds'
);

const noPressureReboundHonors = calculateHonorsFromData(players, {
  1: statsFromRankings([1, 2, 1, 2, 1, 2], players.length),
  2: statsFromRankings([2, 3, 2, 3, 2, 3], players.length),
  3: statsFromRankings([3, 4, 3, 4, 3, 4], players.length),
  4: statsFromRankings([5, 4, 4, 3, 3, 3], players.length),
  5: statsFromRankings([3, 4, 3, 4, 3, 4], players.length),
  6: statsFromRankings([2, 2, 2, 2, 2, 2], players.length)
}, players.length);

assert.equal(
  noPressureReboundHonors.resilient,
  undefined,
  '抗压王 should require an actual rebound from bottom-tier pressure into the top half'
);

const resilienceQualityHonors = calculateHonorsFromData(players, {
  1: statsFromRankings([6, 1, 6, 1, 6, 1, 6, 1], players.length),
  2: statsFromRankings([6, 2, 3, 2, 3, 2, 3, 2], players.length),
  3: statsFromRankings([3, 4, 3, 4, 3, 4, 3, 4], players.length),
  4: statsFromRankings([4, 3, 4, 3, 4, 3, 4, 3], players.length),
  5: statsFromRankings([5, 5, 5, 5, 5, 5, 5, 5], players.length),
  6: statsFromRankings([6, 5, 6, 5, 6, 5, 6, 5], players.length)
}, players.length, { applyCap: false });

assert.equal(
  resilienceQualityHonors.resilient?.player.id,
  2,
  '抗压王 should prioritize rebound efficiency and sustained recovery over repeated volatility'
);

const burnoutArcHonors = calculateHonorsFromData(players, {
  1: statsFromRankings([1, 1, 2, 2, 5, 6, 6, 5], players.length),
  2: statsFromRankings([6, 5, 6, 5, 6, 5, 6, 5], players.length),
  3: statsFromRankings([3, 4, 3, 4, 3, 4, 3, 4], players.length),
  4: statsFromRankings([4, 3, 4, 3, 4, 3, 4, 3], players.length),
  5: statsFromRankings([2, 2, 2, 2, 2, 2, 2, 2], players.length),
  6: statsFromRankings([1, 2, 1, 2, 1, 2, 1, 2], players.length)
}, players.length, { applyCap: false });

assert.equal(
  burnoutArcHonors.burnout?.player.id,
  1,
  '燃尽王 should reward a real early-to-late collapse instead of constant bottom-half play'
);
assert.match(
  String(burnoutArcHonors.burnout?.score),
  /^\+\d+\.\d$/,
  '燃尽王 should summarize late decline magnitude rather than bottom-half streak length'
);

assert.equal(
  resolveHonorPlayerCount('4', 8),
  4,
  'live honor rendering should use the active game mode instead of the whole player pool size'
);
assert.equal(resolveHonorPlayerCount(6, 8), 6);
assert.equal(resolveHonorPlayerCount('8', 4), 8);
assert.equal(
  resolveHonorPlayerCount('', 6),
  6,
  'honor player-count resolution should fall back to a valid player pool size when mode is unavailable'
);
assert.equal(
  resolveHonorPlayerCount('5', 5),
  8,
  'invalid mode and invalid pool size should fall back to the default 8-player board'
);

console.log('honor algorithm checks passed');
