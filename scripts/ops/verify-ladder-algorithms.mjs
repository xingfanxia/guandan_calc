/**
 * 天梯分纯函数测试 —— 镜像 guandan-scorer-wxapp test/ladder.test.mjs（WXAPP-9 spec）。
 * 算法在 shared/ladderLogic.js，与 wxapp core/ladder.js 同源；改一边两边都要过。
 */
import assert from 'node:assert/strict';
import {
  computeLadderDeltas,
  applyLadderDelta,
  seedLadderRating,
  LADDER_BASE,
  LADDER_TEAM_K
} from '../../shared/ladderLogic.js';

const P = (id, team, rating, avgRanking) => ({ id, team, rating, avgRanking });

// --- computeLadderDeltas（简化 ELO） ---

// 同分队伍：胜队约 +12、负队约 −12（E=0.5）；零和
{
  const d = computeLadderDeltas({
    mode: 4, winnerTeam: 1,
    players: [P(1, 1, 1000, 2.5), P(2, 1, 1000, 2.5), P(3, 2, 1000, 2.5), P(4, 2, 1000, 2.5)]
  });
  assert.equal(d.get('1'), 12);
  assert.equal(d.get('2'), 12);
  assert.equal(d.get('3'), -12);
  assert.equal(d.get('4'), -12);
  assert.equal([...d.values()].reduce((a, b) => a + b, 0), 0, '同表现下两队增量应零和');
}

// 强队赢弱队加分少；弱队爆冷多得
{
  const strongWin = computeLadderDeltas({
    mode: 4, winnerTeam: 1,
    players: [P(1, 1, 1400, 2.5), P(2, 1, 1400, 2.5), P(3, 2, 1000, 2.5), P(4, 2, 1000, 2.5)]
  });
  const upset = computeLadderDeltas({
    mode: 4, winnerTeam: 2,
    players: [P(1, 1, 1400, 2.5), P(2, 1, 1400, 2.5), P(3, 2, 1000, 2.5), P(4, 2, 1000, 2.5)]
  });
  assert.ok(strongWin.get('1') < 12, `强胜弱应少于均势的12，got ${strongWin.get('1')}`);
  assert.ok(strongWin.get('1') >= 1);
  assert.ok(upset.get('3') > 12, `爆冷应多于均势的12，got ${upset.get('3')}`);
  assert.ok(upset.get('3') <= LADDER_TEAM_K + 14);
}

// 输了但个人名次好 → 小加分（≤+6 封顶）；输了打差才大扣
{
  const even = computeLadderDeltas({
    mode: 4, winnerTeam: 1,
    players: [P(1, 1, 1000, 2.0), P(2, 1, 1000, 3.0), P(3, 2, 1000, 1.0), P(4, 2, 1000, 4.0)]
  });
  assert.ok(even.get('3') > 0, `输局头游手应小加分，got ${even.get('3')}`);
  assert.ok(even.get('3') <= 6, `负方加分封顶 +6，got ${even.get('3')}`);
  assert.ok(even.get('4') < -12, `输局垫底手该大扣，got ${even.get('4')}`);
  const underdogLoss = computeLadderDeltas({
    mode: 4, winnerTeam: 1,
    players: [P(1, 1, 1400, 2.5), P(2, 1, 1400, 2.5), P(3, 2, 1000, 1.0), P(4, 2, 1000, 4.0)]
  });
  assert.equal(underdogLoss.get('3'), 6, `弱队高光手封顶 +6，got ${underdogLoss.get('3')}`);
}

// 胜方保底 +1：躺赢混子不倒扣
{
  const d = computeLadderDeltas({
    mode: 4, winnerTeam: 1,
    players: [P(1, 1, 1000, 1.0), P(2, 1, 1000, 4.0), P(3, 2, 1000, 2.0), P(4, 2, 1000, 3.0)]
  });
  assert.equal(d.get('2'), 1, 'P2 躺赢垫底 12−14=−2 → 保底 +1');
  assert.ok(d.get('1') > d.get('2'));
}

// 个人表现拉开同队差距；不破坏胜负方向
{
  const d = computeLadderDeltas({
    mode: 4, winnerTeam: 1,
    players: [P(1, 1, 1000, 1.0), P(2, 1, 1000, 3.6), P(3, 2, 1000, 2.0), P(4, 2, 1000, 3.4)]
  });
  assert.ok(d.get('1') > d.get('2'), '同队内场均更好的人增量应更大');
  assert.ok(d.get('1') > 0 && d.get('2') > 0, '胜队都为正');
  assert.ok(d.get('3') > d.get('4'), '负队内表现好的人扣更少');
  assert.ok(d.get('3') < 0 && d.get('4') < 0, '负队都为负');
}

// 未评分玩家按 1000 计入；无 avgRanking 表现项为 0
{
  const d = computeLadderDeltas({
    mode: 4, winnerTeam: 1,
    players: [P(1, 1, undefined, undefined), P(2, 1, 1000, 2.5), P(3, 2, 1000, 2.5), P(4, 2, 1000, 2.5)]
  });
  assert.equal(d.get('1'), 12);
}

// 8 人局表现归一：场均第 1 → +14；垫底 → −14
{
  const players = [];
  for (let i = 1; i <= 4; i++) players.push(P(i, 1, 1000, i === 1 ? 1 : 4.5));
  for (let i = 5; i <= 8; i++) players.push(P(i, 2, 1000, i === 8 ? 8 : 4.5));
  const d = computeLadderDeltas({ mode: 8, winnerTeam: 1, players });
  assert.equal(d.get('1'), 12 + 14);
  assert.equal(d.get('8'), -12 - 14);
}

// 退化输入全 0：单边空队 / winnerTeam 非法
{
  const oneSide = computeLadderDeltas({ mode: 4, winnerTeam: 1, players: [P(1, 1, 1000, 1)] });
  assert.equal(oneSide.get('1'), 0);
  const badWinner = computeLadderDeltas({ mode: 4, winnerTeam: 0, players: [P(1, 1), P(2, 2)] });
  assert.equal(badWinner.get('1'), 0);
}

// --- applyLadderDelta（累计 {rating, sessions, peak}） ---
{
  const first = applyLadderDelta(undefined, 20);
  assert.deepEqual(first, { rating: 1020, sessions: 1, peak: 1020 });
  const second = applyLadderDelta(first, -45);
  assert.deepEqual(second, { rating: 975, sessions: 2, peak: 1020 }, 'peak 跟涨不跟跌');
  const floor = applyLadderDelta({ rating: 10, sessions: 5, peak: 1100 }, -50);
  assert.deepEqual(floor, { rating: 0, sessions: 6, peak: 1100 }, 'rating 下限 0');
}

// --- seedLadderRating（web 历史折算起评分） ---
{
  assert.equal(seedLadderRating(undefined), LADDER_BASE);
  assert.equal(seedLadderRating({}), LADDER_BASE);
  assert.equal(seedLadderRating({ sessionsPlayed: 0, sessionsWon: 0 }), LADDER_BASE);
  assert.equal(seedLadderRating({ sessionsPlayed: 5 }), Math.round(1000 + (5 / 20) * 300 * -0.5));

  const strong = seedLadderRating({ sessionsPlayed: 18, sessionsWon: 13, avgRankingPerSession: 3.2 });
  const weak = seedLadderRating({ sessionsPlayed: 18, sessionsWon: 5, avgRankingPerSession: 5.8 });
  assert.ok(strong > 1050, `强历史应明显高于 1000，got ${strong}`);
  assert.ok(weak < 950, `弱历史应明显低于 1000，got ${weak}`);
  assert.ok(strong - weak > 150, `强弱差距应有区分度，got ${strong - weak}`);

  const few = seedLadderRating({ sessionsPlayed: 2, sessionsWon: 2, avgRankingPerSession: 1.5 });
  const many = seedLadderRating({ sessionsPlayed: 20, sessionsWon: 20, avgRankingPerSession: 1.5 });
  assert.ok(Math.abs(few - 1000) < Math.abs(many - 1000), '少场次应比多场次更贴 1000');
  assert.equal(seedLadderRating({ sessionsPlayed: 100, sessionsWon: 100, avgRankingPerSession: 1 }), 1300, '上钳 1300');
  assert.equal(seedLadderRating({ sessionsPlayed: 100, sessionsWon: 0, avgRankingPerSession: 8 }), 700, '下钳 700');
}

console.log('ladder algorithm checks passed');
