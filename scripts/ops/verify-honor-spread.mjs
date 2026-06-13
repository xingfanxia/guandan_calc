/**
 * Anti-sweep cap regression test.
 *
 * A single dominant player used to win nearly every positive honor at once
 * (吕布 + 石佛 + 连段王 + 团队中轴 + 保底核心 + 节奏核心 + 抗压王…), which made the
 * awards meaningless. honorLogic now caps positive honors at
 * MAX_POSITIVE_HONORS_PER_PLAYER and redistributes the overflow to the next-best
 * qualifier. This test proves the cap actually bites on realistic data while the
 * flagship awards (吕布/阿斗) stay truthful.
 *
 * Scoring is intentionally NOT changed — `{ applyCap: false }` reproduces the old
 * uncapped winners, so the contrast below is purely the assignment layer.
 */
import assert from 'node:assert/strict';
import {
  calculateHonorsFromData,
  MAX_POSITIVE_HONORS_PER_PLAYER
} from '../../shared/honorLogic.js';

const POSITIVE_HONOR_KEYS = [
  'mvp', 'frequent', 'resilient', 'carp', 'comeback', 'nonstick', 'median', 'streak', 'stable'
];

function statsFromRankings(rankList, totalPlayers) {
  return {
    games: rankList.length,
    totalRank: rankList.reduce((sum, rank) => sum + rank, 0),
    firstPlaceCount: rankList.filter(rank => rank === 1).length,
    lastPlaceCount: rankList.filter(rank => rank === totalPlayers).length,
    rankings: rankList.slice()
  };
}

function positiveCounts(honors) {
  const counts = {};
  for (const key of POSITIVE_HONOR_KEYS) {
    const id = honors[key]?.player?.id;
    if (id != null) counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

// Set of positive honor keys actually awarded. A honor has a qualifier iff the
// UNCAPPED computation awards it, so comparing capped-vs-uncapped awarded sets
// detects "false empty" — a qualified honor the cap wrongly starved to 「本场无人」.
function awardedPositiveKeys(honors) {
  return POSITIVE_HONOR_KEYS.filter(key => honors[key]?.player);
}

function buildStats(rankingsById, totalPlayers) {
  return Object.fromEntries(
    Object.entries(rankingsById).map(([id, ranks]) => [id, statsFromRankings(ranks, totalPlayers)])
  );
}

// ---------------------------------------------------------------------------
// 8-player, 14-round session with one clearly dominant player (id5 — best avg,
// never finishes last, leads teammates). Mirrors the live session that surfaced
// the bug (one apple-emoji player held 7 positive honors).
// ---------------------------------------------------------------------------
const players8 = [
  { id: 1, name: '豪', team: 1 }, { id: 2, name: '姐', team: 1 },
  { id: 3, name: '鱼', team: 1 }, { id: 4, name: '小', team: 1 },
  { id: 5, name: '塔', team: 2 }, { id: 6, name: '帆', team: 2 },
  { id: 7, name: '大', team: 2 }, { id: 8, name: '夫', team: 2 }
];
const rankings8 = {
  1: [1, 5, 4, 8, 1, 5, 4, 8, 1, 5, 4, 8, 1, 5],
  2: [5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4],
  3: [1, 2, 8, 1, 2, 8, 1, 2, 8, 1, 2, 8, 1, 2],
  4: [8, 7, 6, 5, 4, 3, 2, 1, 8, 7, 6, 5, 4, 3],
  5: [2, 3, 1, 2, 3, 4, 2, 1, 3, 2, 4, 3, 2, 1],
  6: [3, 4, 2, 3, 4, 2, 3, 4, 2, 3, 4, 2, 3, 4],
  7: [6, 8, 7, 6, 8, 7, 6, 8, 7, 6, 8, 7, 6, 8],
  8: [7, 6, 8, 7, 6, 8, 7, 6, 8, 7, 6, 8, 7, 6]
};
const stats8 = buildStats(rankings8, 8);

const uncapped = calculateHonorsFromData(players8, stats8, 8, { applyCap: false });
const capped = calculateHonorsFromData(players8, stats8, 8); // default = capped

const uncappedCounts = positiveCounts(uncapped);
const cappedCounts = positiveCounts(capped);

// Without the cap, id5 sweeps a pile of positive honors — the bug we are fixing.
assert.ok(
  (uncappedCounts[5] || 0) >= 4,
  `precondition: the dominant player should sweep ≥4 positive honors uncapped (got ${uncappedCounts[5] || 0}) — otherwise this dataset no longer exercises the cap`
);

// A healthy 8-player session has enough distinct qualifiers that the cap holds
// strictly — pass 2 never fires, so nobody exceeds the cap.
for (const [id, count] of Object.entries(cappedCounts)) {
  assert.ok(
    count <= MAX_POSITIVE_HONORS_PER_PLAYER,
    `player ${id} holds ${count} positive honors over the cap of ${MAX_POSITIVE_HONORS_PER_PLAYER}`
  );
}

// The dominant player is reined in to exactly the cap, not the full sweep.
assert.equal(
  cappedCounts[5],
  MAX_POSITIVE_HONORS_PER_PLAYER,
  'the dominant player should keep exactly the cap of positive honors, not sweep them all'
);

// No FALSE empties: the cap redistributes winners, it never starves a qualified
// honor to 「本场无人」. Every positive honor awarded uncapped is still awarded.
assert.deepEqual(
  awardedPositiveKeys(capped),
  awardedPositiveKeys(uncapped),
  'the cap must not leave any qualified positive honor unawarded (no false 本场无人)'
);

// Positive honors spread across more players than the uncapped collapse.
const cappedHolders = Object.keys(cappedCounts).length;
assert.ok(
  cappedHolders >= 3,
  `positive honors should spread across at least 3 players after the cap (got ${cappedHolders})`
);
assert.ok(
  cappedHolders > Object.keys(uncappedCounts).length,
  'the cap should spread positive honors across strictly more players than the uncapped result'
);

// Flagship awards stay truthful — the cap never moves 吕布 off the genuine best
// or 阿斗 off the genuine worst.
assert.equal(capped.mvp?.player.id, uncapped.mvp?.player.id, '吕布 (flagship) must be identical capped and uncapped');
assert.equal(capped.mvp?.player.id, 5, '吕布 should still be the dominant player');
assert.equal(capped.burden?.player.id, uncapped.burden?.player.id, '阿斗 (flagship, uncapped negative) must be unchanged');

// ---------------------------------------------------------------------------
// 4-player two-pair session (the most common 掼蛋 setup). All five "strength"
// honors resolve to the same two strong players, so 5 honors cannot fit two
// players within a cap of 2. The cap must DEGRADE GRACEFULLY here: spread what it
// can, then award the overflow to a real (already-decorated) winner rather than
// starve the honor to a false 「本场无人」. Over-cap is expected and acceptable;
// a false-empty card is the regression we are guarding against.
// ---------------------------------------------------------------------------
const players4 = [
  { id: 1, name: 'A', team: 1 }, { id: 2, name: 'B', team: 1 },
  { id: 3, name: 'C', team: 2 }, { id: 4, name: 'D', team: 2 }
];
const rankings4 = {
  1: [1, 2, 1, 2, 1, 2, 1, 2],
  2: [2, 1, 2, 1, 2, 1, 2, 1],
  3: [3, 4, 3, 4, 3, 4, 3, 4],
  4: [4, 3, 4, 3, 4, 3, 4, 3]
};
const stats4 = buildStats(rankings4, 4);
const uncapped4 = calculateHonorsFromData(players4, stats4, 4, { applyCap: false });
const capped4 = calculateHonorsFromData(players4, stats4, 4);

assert.ok(capped4.mvp?.player, '4-player session should still award 吕布');
assert.deepEqual(
  awardedPositiveKeys(capped4),
  awardedPositiveKeys(uncapped4),
  '4-player: the cap must not starve a qualified strength honor to a false 本场无人 even when only two players qualify for all of them'
);
assert.ok(
  awardedPositiveKeys(capped4).length >= 3,
  '4-player: the strength honors that have qualifiers should still be on the board'
);

console.log('honor anti-sweep spread checks passed');
