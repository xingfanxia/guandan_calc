import { HONOR_CATEGORY_BY_KEY, HONOR_TITLES_BY_KEY } from './honorCatalog.js';
import { resolvePlayerCountMode } from './playerCountMode.js';

/** 事件荣誉没有统一场数门槛；保留导出名供旧 web adapter 编译。 */
export const MIN_HONOR_GAMES = 0;

/** 轻量趣味荣誉从第 5 局开始：先让玩家有内容可看，稀有事件仍保留更高门槛。 */
export const EARLY_HONOR_HANDS = 5;

export const HONOR_THRESHOLDS = Object.freeze({
  4: Object.freeze({ ddNight: 3, streak: 3, first: 4, almost: 2, clean: EARLY_HONOR_HANDS, blitz: 8, marathon: 18 }),
  6: Object.freeze({ ddNight: 2, streak: 3, first: 4, almost: 2, clean: EARLY_HONOR_HANDS, blitz: 10, marathon: 24 }),
  8: Object.freeze({ ddNight: 2, streak: 3, first: 3, almost: 2, clean: EARLY_HONOR_HANDS, blitz: 10, marathon: 24 })
});

/**
 * 旧适配器仍会导入这三个名字；Infinity 明确表示 v3 不再做全场/单人/团队数量裁剪。
 * 个人荣誉只在同 key 内竞争唯一最强者，团队荣誉则让每个满足条件的队伍都获得。
 */
export const MAX_PERSONAL_HONORS_BY_MODE = Object.freeze({ 4: Infinity, 6: Infinity, 8: Infinity });
export const MAX_PERSONAL_HONORS_PER_PLAYER = Infinity;
export const MAX_TEAM_HONORS_PER_SESSION = Infinity;

/** 同人时只留最稀有的一项；顺序就是稀有度优先级，不向其他玩家顺延。 */
export const F1_FAMILY = Object.freeze(['streak_king', 'first_king']);

const TEAM_KEYS = Object.freeze(['t1', 't2']);
const OTHER_TEAM = Object.freeze({ t1: 't2', t2: 't1' });

function teamKeyOf(team) {
  const value = Number(team);
  return value === 1 ? 't1' : value === 2 ? 't2' : null;
}

function normalizedPlayers(players, mode) {
  const seen = new Set();
  const result = [];
  for (const player of Array.isArray(players) ? players : []) {
    if (!player || typeof player !== 'object') continue;
    const id = player.id;
    const idKey = String(id ?? '');
    const teamKey = teamKeyOf(player.team);
    if (!idKey || seen.has(idKey) || !teamKey) continue;
    seen.add(idKey);
    result.push({ ...player, id, team: Number(player.team), _idKey: idKey, _teamKey: teamKey });
  }
  return result;
}

function normalizeLevel(value) {
  return value === undefined || value === null ? '' : String(value).trim().toUpperCase();
}

function atOrBelowNine(value) {
  const level = Number(normalizeLevel(value));
  return Number.isSafeInteger(level) && level >= 2 && level <= 9;
}

function rankedHand(entry, roster, mode) {
  const rankings = entry && entry.playerRankings;
  if (!rankings || typeof rankings !== 'object' || Array.isArray(rankings)) return null;
  const rosterById = new Map(roster.map(player => [player._idKey, player]));
  const ranked = [];
  const ids = new Set();
  for (let rank = 1; rank <= mode; rank++) {
    const rawPlayer = rankings[rank] || rankings[String(rank)];
    const player = rawPlayer && rosterById.get(String(rawPlayer.id ?? ''));
    if (!player || ids.has(player._idKey)) return null;
    ids.add(player._idKey);
    ranked.push(player);
  }
  if (ranked.length !== mode || ids.size !== mode) return null;
  const winKey = entry.winKey === 't1' || entry.winKey === 't2' ? entry.winKey : null;
  const teamSize = mode / 2;
  const rawRanks = Array.isArray(entry.ranks) ? entry.ranks.map(Number) : [];
  const ranks = rawRanks.length === teamSize &&
    rawRanks.every(rank => Number.isSafeInteger(rank) && rank >= 1 && rank <= mode) &&
    new Set(rawRanks).size === teamSize
    ? [...rawRanks].sort((a, b) => a - b)
    : null;
  return {
    entry,
    ranked,
    ranks,
    winKey,
    round: normalizeLevel(entry.round),
    prevRoundOwner: entry.prevRoundOwner === 't1' || entry.prevRoundOwner === 't2'
      ? entry.prevRoundOwner
      : null
  };
}

function titleOf(key) {
  return HONOR_TITLES_BY_KEY[key] || key;
}

function fullSweepTerm(mode) {
  return mode === 4 ? '双下' : mode === 6 ? '三下' : mode === 8 ? '四下' : '全贡';
}

function playerRef(player) {
  const { _idKey, _teamKey, ...publicPlayer } = player;
  return publicPlayer;
}

/** 最高者称号不使用座位顺序裁决：达到门槛的最高值完全并列时全部返回。 */
function bestTies(cards, field, threshold) {
  const eligible = cards.filter(card => card[field] >= threshold);
  if (eligible.length === 0) return [];
  const best = Math.max(...eligible.map(card => card[field]));
  return eligible.filter(card => card[field] === best);
}

function personalHonor(key, card, score, caption) {
  return {
    category: 'personal',
    subtype: HONOR_CATEGORY_BY_KEY[key] || 'personal_fun',
    key,
    title: titleOf(key),
    playerId: card.playerId,
    team: card.team,
    score,
    caption
  };
}

function teamHonor(key, teamKey, playerIds, score, caption) {
  return {
    category: 'team',
    subtype: HONOR_CATEGORY_BY_KEY[key] || 'team',
    key,
    title: titleOf(key),
    team: Number(teamKey.slice(1)),
    playerIds,
    score,
    caption
  };
}

const PERSONAL_HONOR_PRIORITY = Object.freeze([
  'a_blocker', 'dd_opener', 'dd_closer', 'clutch_first', 'late_engine',
  'streak_king', 'solo_carry', 'bounce_back', 'first_king', 'clean_sheet',
  'rocket_jump', 'boom_bust', 'front_row_streak', 'copy_paste', 'rank_rainbow',
  'cut_line_master', 'opening_flash', 'almost', 'back_row_streak', 'no_first', 'last_king'
]);

const PERSONAL_PRIMARY_FIELD = Object.freeze({
  dd_opener: 'ddOpens', dd_closer: 'ddCloses', a_blocker: 'aBlocks',
  streak_king: 'bestStreak', opening_flash: 'openingFirsts', bounce_back: 'bounceBacks',
  rank_rainbow: 'distinctRanks', clean_sheet: 'hands', almost: 'seconds', no_first: 'hands',
  boom_bust: 'firsts', copy_paste: 'copyPasteStreak', rocket_jump: 'rocketJumps',
  clutch_first: 'finalPreviousRank', solo_carry: 'soloCarries', front_row_streak: 'frontRowStreak',
  cut_line_master: 'cutLineCount', late_engine: 'lateLift', back_row_streak: 'backRowStreak',
  last_king: 'lasts', first_king: 'firsts'
});

function compareVector(left, right) {
  const width = Math.max(left.length, right.length);
  for (let index = 0; index < width; index += 1) {
    const delta = Number(right[index] || 0) - Number(left[index] || 0);
    if (Math.abs(delta) > 1e-9) return delta;
  }
  return 0;
}

function personalEvidenceVector(honor, card) {
  const primary = Number(card?.[PERSONAL_PRIMARY_FIELD[honor.key]] || 0);
  const beatRate = Number(card?._beatRate || 0);
  const volatility = Number(card?._rankVariance || 0);
  if (honor.subtype === 'personal_roast') return [primary, 1 - beatRate, volatility];
  if (honor.subtype === 'personal_fun') return [primary, volatility, beatRate];
  return [primary, beatRate, volatility];
}

/**
 * 每个称号只挑唯一、证据最强的候选；不同称号互不挤占名额。
 * 完全并列时不使用数组顺序、名字或 id 破局：该称号本场不发。
 */
function selectPersonalHonors(candidates, cards) {
  const cardByPlayer = new Map(cards.map(card => [String(card.playerId), card]));
  const byKey = new Map();
  for (const honor of candidates) {
    if (!byKey.has(honor.key)) byKey.set(honor.key, []);
    byKey.get(honor.key).push(honor);
  }
  const unique = [];
  for (const [key, honors] of byKey) {
    const ranked = honors.slice().sort((left, right) => compareVector(
      personalEvidenceVector(left, cardByPlayer.get(String(left.playerId))),
      personalEvidenceVector(right, cardByPlayer.get(String(right.playerId)))
    ));
    if (ranked.length > 1 && compareVector(
      personalEvidenceVector(ranked[0], cardByPlayer.get(String(ranked[0].playerId))),
      personalEvidenceVector(ranked[1], cardByPlayer.get(String(ranked[1].playerId)))
    ) === 0) continue;
    unique.push(ranked[0]);
  }
  unique.sort((left, right) => PERSONAL_HONOR_PRIORITY.indexOf(left.key) - PERSONAL_HONOR_PRIORITY.indexOf(right.key));
  return unique;
}

const TEAM_HONOR_PRIORITY = Object.freeze(['comeback_a', 'foe_reset', 'dd_night', 'all_firsts']);

function selectTeamHonors(candidates) {
  const exact = new Map();
  for (const honor of candidates) {
    const identity = `${honor.key}:${honor.team}`;
    if (!exact.has(identity)) exact.set(identity, honor);
  }
  return [...exact.values()].sort((left, right) =>
    TEAM_HONOR_PRIORITY.indexOf(left.key) - TEAM_HONOR_PRIORITY.indexOf(right.key) ||
    Number(left.team) - Number(right.team)
  );
}

/**
 * 荣誉 v2 的唯一计算入口。输入只读，返回个人徽章、队伍战果、
 * 3 个场纪念的实际触发项，以及每位玩家 100% 覆盖的客观战报卡。
 */
export function calculateSessionHonors(input = {}) {
  const safeInput = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const {
    history = [],
    players = [],
    mode,
    ended = false,
    winnerKey = null,
    prefs = {}
  } = safeInput;
  const playerCount = resolvePlayerCountMode(mode, Array.isArray(players) ? players.length : 8);
  const roster = normalizedPlayers(players, playerCount);
  const thresholds = HONOR_THRESHOLDS[playerCount];
  const validWinnerKey = winnerKey === 't1' || winnerKey === 't2' ? winnerKey : null;
  const cards = new Map(roster.map(player => [player._idKey, {
    playerId: player.id,
    team: player.team,
    hands: 0,
    firsts: 0,
    seconds: 0,
    lasts: 0,
    ddOpens: 0,
    ddCloses: 0,
    teamDD: 0,
    aBlocks: 0,
    bestStreak: 0,
    openingFirsts: 0,
    bounceBacks: 0,
    distinctRanks: 0,
    copyPasteStreak: 0,
    rocketJumps: 0,
    soloCarries: 0,
    frontRowStreak: 0,
    backRowStreak: 0,
    cutLineCount: 0,
    lateLift: 0,
    finalPreviousRank: 0,
    _streak: 0,
    _sameRankStreak: 0,
    _frontRowStreak: 0,
    _backRowStreak: 0,
    _previousRank: 0,
    _seenRanks: new Set(),
    _ranks: [],
    _player: player
  }]));
  const historyEntries = Array.isArray(history) ? history : [];
  const parsedHands = historyEntries.map(entry => rankedHand(entry, roster, playerCount));
  const observationComplete = roster.length === playerCount &&
    roster.filter(player => player._teamKey === 't1').length === playerCount / 2 &&
    roster.filter(player => player._teamKey === 't2').length === playerCount / 2 &&
    historyEntries.length > 0 && parsedHands.every(Boolean);
  const hands = parsedHands.filter(Boolean);
  const finalHand = hands[hands.length - 1];
  const completionConsistent = Boolean(ended) && Boolean(validWinnerKey) &&
    Boolean(finalHand) && finalHand.winKey === validWinnerKey;
  const teamSize = playerCount / 2;
  const sweepTerm = fullSweepTerm(playerCount);
  const teamDd = { t1: 0, t2: 0 };
  const foeResets = { t1: 0, t2: 0 };
  let comebackEvidence = null;

  for (let handIndex = 0; handIndex < hands.length; handIndex += 1) {
    const hand = hands[handIndex];
    for (let i = 0; i < hand.ranked.length; i++) {
      const player = hand.ranked[i];
      const card = cards.get(player._idKey);
      const rank = i + 1;
      card.hands += 1;
      const previousRank = card._previousRank;
      if (rank === 1) card.firsts += 1;
      if (handIndex === 0 && rank === 1) card.openingFirsts = 1;
      if (rank === 2) card.seconds += 1;
      if (rank === playerCount) card.lasts += 1;
      if (previousRank === playerCount && rank === 1) card.bounceBacks += 1;
      if (previousRank > 0 && previousRank - rank >= teamSize) card.rocketJumps += 1;
      card._sameRankStreak = previousRank === rank ? card._sameRankStreak + 1 : 1;
      card.copyPasteStreak = Math.max(card.copyPasteStreak, card._sameRankStreak);
      card._frontRowStreak = rank <= teamSize ? card._frontRowStreak + 1 : 0;
      card.frontRowStreak = Math.max(card.frontRowStreak, card._frontRowStreak);
      card._backRowStreak = rank > teamSize ? card._backRowStreak + 1 : 0;
      card.backRowStreak = Math.max(card.backRowStreak, card._backRowStreak);
      if (rank === teamSize) card.cutLineCount += 1;
      card._previousRank = rank;
      card._ranks.push(rank);
      card._seenRanks.add(rank);
      card.distinctRanks = card._seenRanks.size;
      card._streak = rank === 1 ? card._streak + 1 : 0;
      card.bestStreak = Math.max(card.bestStreak, card._streak);
    }

    const topTeam = hand.ranked[0]._teamKey;
    const isDoubleDown = Boolean(hand.winKey) && hand.winKey === topTeam && Array.isArray(hand.ranks) &&
      hand.ranks.every((rank, index) => rank === index + 1) &&
      hand.ranked.slice(0, teamSize).every(player => player._teamKey === topTeam) &&
      hand.ranked.slice(teamSize).every(player => player._teamKey === OTHER_TEAM[topTeam]);
    if (isDoubleDown) {
      teamDd[topTeam] += 1;
      cards.get(hand.ranked[0]._idKey).ddOpens += 1;
      cards.get(hand.ranked[teamSize - 1]._idKey).ddCloses += 1;
    }

    const firstPlayer = hand.ranked[0];
    const firstCard = cards.get(firstPlayer._idKey);
    const firstTeam = firstPlayer._teamKey;
    const teammateRanks = hand.ranked.flatMap((player, index) =>
      player._teamKey === firstTeam && player._idKey !== firstPlayer._idKey ? [index + 1] : []
    );
    if (teammateRanks.length === teamSize - 1 && teammateRanks.every((rank) => rank > teamSize)) {
      firstCard.soloCarries += 1;
    }
    if (hand.round === 'A' && hand.winKey === firstPlayer._teamKey &&
        hand.prevRoundOwner === OTHER_TEAM[firstPlayer._teamKey]) {
      cards.get(firstPlayer._idKey).aBlocks += 1;
    }

    if (prefs && prefs.strictA === true && hand.round === 'A') {
      for (const teamKey of TEAM_KEYS) {
        const opponentKey = OTHER_TEAM[teamKey];
        const before = normalizeLevel(hand.entry[`prevT${opponentKey.slice(1)}Lvl`]);
        const after = normalizeLevel(hand.entry[opponentKey]);
        if (hand.prevRoundOwner === opponentKey && hand.winKey === teamKey && before === 'A' && after === '2') {
          foeResets[teamKey] += 1;
        }
      }
    }

    if (completionConsistent) {
      const opponentKey = OTHER_TEAM[validWinnerKey];
      const ownBefore = hand.entry[`prevT${validWinnerKey.slice(1)}Lvl`];
      const opponentBefore = hand.entry[`prevT${opponentKey.slice(1)}Lvl`];
      if (normalizeLevel(opponentBefore) === 'A' && atOrBelowNine(ownBefore)) {
        comebackEvidence = { ownLevel: normalizeLevel(ownBefore), opponentLevel: 'A' };
      }
    }
  }

  const cardList = [...cards.values()];
  for (const card of cardList) {
    card.teamDD = teamDd[teamKeyOf(card.team)];
    card.finalPreviousRank = card._ranks.length >= 2 ? card._ranks[card._ranks.length - 2] : 0;
    card._beatRate = card._ranks.length > 0
      ? card._ranks.reduce((sum, rank) => sum + (playerCount - rank) / (playerCount - 1), 0) / card._ranks.length
      : 0;
    const averageRank = card._ranks.length > 0
      ? card._ranks.reduce((sum, rank) => sum + rank, 0) / card._ranks.length
      : 0;
    card._rankVariance = card._ranks.length > 0
      ? card._ranks.reduce((sum, rank) => sum + (rank - averageRank) ** 2, 0) / card._ranks.length
      : 0;
    if (card._ranks.length >= 6) {
      const segment = Math.max(2, Math.floor(card._ranks.length / 3));
      const first = card._ranks.slice(0, segment);
      const last = card._ranks.slice(-segment);
      const beat = (ranks) => ranks.reduce((sum, rank) => sum + (playerCount - rank) / (playerCount - 1), 0) / ranks.length;
      card.lateLift = Math.max(0, beat(last) - beat(first));
    }
  }
  const reportCardEntries = cardList.map(card => {
    const publicCard = Object.fromEntries(Object.entries(card).filter(([key]) => !key.startsWith('_')));
    return [String(card.playerId), publicCard];
  });
  if (!observationComplete) {
    const reportCards = Object.fromEntries(reportCardEntries);
    return {
      mode: playerCount,
      hands: hands.length,
      ended: Boolean(ended),
      winnerKey: validWinnerKey,
      observationComplete: false,
      personalHonors: [],
      teamResults: [],
      memorials: [],
      awardCandidates: { personal: [], team: [] },
      reportCards,
      applicability: { foe_reset: prefs && prefs.strictA === true ? 'eligible' : 'not_applicable' }
    };
  }
  const personalHonors = [];
  for (const teamKey of TEAM_KEYS) {
    const teamCards = cardList.filter(card => teamKeyOf(card.team) === teamKey);
    // 全贡是客观战报；个人/团队荣誉必须由至少两次同类事件证明，避免首局偶发包揽直接发奖。
    const majority = Math.max(2, Math.ceil(0.6 * teamDd[teamKey]));
    for (const opener of bestTies(teamCards, 'ddOpens', majority)) {
      personalHonors.push(personalHonor(
        'dd_opener', opener,
        { teamDD: teamDd[teamKey], ddOpens: opener.ddOpens },
        `本队 ${teamDd[teamKey]} 次${sweepTerm}，你带头拿下头游 ${opener.ddOpens} 次。开团全靠你撞碎对面的防线。`
      ));
    }
    for (const closer of bestTies(teamCards, 'ddCloses', majority)) {
      personalHonors.push(personalHonor(
        'dd_closer', closer,
        { teamDD: teamDd[teamKey], ddCloses: closer.ddCloses },
        `本队 ${teamDd[teamKey]} 次${sweepTerm}，你守住前半区最后一个位置 ${closer.ddCloses} 次。金牌安保建议直接涨薪。`
      ));
    }
  }

  for (const card of cardList) {
    if (card.aBlocks >= 1) {
      personalHonors.push(personalHonor('a_blocker', card, { aBlocks: card.aBlocks }, `对手打 A 时，你拿到头游并阻止对手通关 ${card.aBlocks} 次。对面的香槟当场被你一脚踢翻。`));
    }
    if (card.bestStreak >= thresholds.streak) {
      personalHonors.push(personalHonor('streak_king', card, { bestStreak: card.bestStreak }, `连续 ${card.bestStreak} 个小局拿到头游。发牌员是你家亲戚吧？`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && card.openingFirsts > 0) {
      personalHonors.push(personalHonor('opening_flash', card, { openingFirsts: card.openingFirsts }, '第一局就拿到头游，屁股还没坐热便先给全桌一点小震撼。'));
    }
    if (card.bounceBacks > 0) {
      personalHonors.push(personalHonor('bounce_back', card, { bounceBacks: card.bounceBacks }, `垫底后下一局立刻拿到头游 ${card.bounceBacks} 次。棺材板都快压不住这波反弹了。`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && card.distinctRanks >= Math.min(4, playerCount)) {
      personalHonors.push(personalHonor('rank_rainbow', card, { distinctRanks: card.distinctRanks }, `一晚走过 ${card.distinctRanks} 种名次。你不是来打牌的，你是来体验百态人生的。`));
    }
    if (card.lasts === 0 && hands.length >= thresholds.clean) {
      personalHonors.push(personalHonor('clean_sheet', card, { hands: card.hands, lasts: card.lasts }, `${card.hands} 个小局，0 次垫底。只要你不崩，赛后清算就永远找不到你。`));
    }
    const almostTriggered = card.firsts === 0 && card.seconds >= thresholds.almost;
    if (almostTriggered) {
      personalHonors.push(personalHonor('almost', card, { seconds: card.seconds, firsts: card.firsts }, `${card.seconds} 次第二名，头游仍是 0。一顿操作猛如虎，一看战绩全是苦。`));
    } else if (hands.length >= EARLY_HONOR_HANDS && card.firsts === 0) {
      personalHonors.push(personalHonor('no_first', card, { hands: card.hands, firsts: 0 }, `本场 ${card.hands} 个小局，头游 0 次。被全桌轮流上嘴脸，小丑竟是我自己。`));
    }
    const swingThreshold = Math.max(2, Math.ceil(hands.length / playerCount));
    if (card.firsts >= swingThreshold && card.lasts >= swingThreshold) {
      personalHonors.push(personalHonor('boom_bust', card, { firsts: card.firsts, lasts: card.lasts }, `头游 ${card.firsts} 次，末游 ${card.lasts} 次。一会儿天上飞，一会儿地下趴。`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && card.copyPasteStreak >= 3) {
      personalHonors.push(personalHonor('copy_paste', card, { copyPasteStreak: card.copyPasteStreak }, `连续 ${card.copyPasteStreak} 个小局名次完全相同。命运的齿轮卡得死死的。`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && card.rocketJumps > 0) {
      personalHonors.push(personalHonor('rocket_jump', card, { rocketJumps: card.rocketJumps }, `相邻小局间一脚油门跨过半张桌子 ${card.rocketJumps} 次，底牌里像是藏了推进器。`));
    }
    const ranks = card._ranks;
    if (hands.length >= EARLY_HONOR_HANDS && ranks.length >= 2 && ranks[ranks.length - 1] === 1 && ranks[ranks.length - 2] > teamSize) {
      personalHonors.push(personalHonor('clutch_first', card, { finalPreviousRank: card.finalPreviousRank }, `最后一局从第 ${card.finalPreviousRank} 名冲到头游。主角光环一开，剧本都不敢这么写。`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && card.soloCarries > 0) {
      personalHonors.push(personalHonor('solo_carry', card, { soloCarries: card.soloCarries }, `你拿到头游、队友却全在后半区 ${card.soloCarries} 次。带不动，真的带不动。`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && card.frontRowStreak >= 4) {
      personalHonors.push(personalHonor('front_row_streak', card, { frontRowStreak: card.frontRowStreak }, `连续 ${card.frontRowStreak} 个小局都在前半区。后面的朋友，听得到我说话吗？`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && card.cutLineCount >= 2) {
      personalHonors.push(personalHonor('cut_line_master', card, { cutLineCount: card.cutLineCount }, `${card.cutLineCount} 次正好卡在前半区最后一名。多打一张嫌累，少打一张掉队，60 分万岁。`));
    }
    if (card.lateLift >= 0.3) {
      personalHonors.push(personalHonor('late_engine', card, { lateLift: Number(card.lateLift.toFixed(3)) }, `后半段平均胜过同桌玩家的比例比开局高 ${Math.round(card.lateLift * 100)} 个百分点。前面疯狂加载，后面终于接管比赛。`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && card.backRowStreak >= 3) {
      personalHonors.push(personalHonor('back_row_streak', card, { backRowStreak: card.backRowStreak }, `连续 ${card.backRowStreak} 个小局都在后半区。外面的世界很精彩，你却在地下室坐牢。`));
    }
  }

  const mostLasts = Math.max(0, ...cardList.map((card) => card.lasts));
  if (hands.length >= EARLY_HONOR_HANDS && mostLasts >= 2) {
    for (const card of cardList.filter((candidate) => candidate.lasts === mostLasts)) {
      personalHonors.push(personalHonor(
        'last_king', card,
        { lasts: mostLasts },
        `末游 ${mostLasts} 次，${cardList.filter((candidate) => candidate.lasts === mostLasts).length > 1 ? '并列' : ''}全场最多。椅子是不是已经开始发烫了？`
      ));
    }
  }

  for (const firstKing of bestTies(cardList, 'firsts', thresholds.first)) {
    personalHonors.push(personalHonor('first_king', firstKing, { firsts: firstKing.firsts }, `${firstKing.firsts} 次头游，全场最多。纯纯的降维打击，这就是满级人类的含金量。`));
  }

  const f1ChoiceByPlayer = new Map();
  for (const key of F1_FAMILY) {
    for (const honor of personalHonors) {
      if (honor.key === key && !f1ChoiceByPlayer.has(String(honor.playerId))) {
        f1ChoiceByPlayer.set(String(honor.playerId), key);
      }
    }
  }
  const foldedPersonalHonors = personalHonors.filter(honor =>
    !F1_FAMILY.includes(honor.key) || f1ChoiceByPlayer.get(String(honor.playerId)) === honor.key
  );

  const teamResults = [];
  for (const teamKey of TEAM_KEYS) {
    const teamCards = cardList.filter(card => teamKeyOf(card.team) === teamKey);
    const playerIds = roster.filter(player => player._teamKey === teamKey).map(player => player.id);
    if (teamDd[teamKey] >= thresholds.ddNight) {
      teamResults.push(teamHonor('dd_night', teamKey, playerIds, { teamDD: teamDd[teamKey] }, `本队完成 ${teamDd[teamKey]} 次${sweepTerm}，把对面安排得明明白白。`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && teamCards.every(card => card.firsts > 0)) {
      teamResults.push(teamHonor('all_firsts', teamKey, playerIds, {
        firstScorers: teamCards.length,
        totalFirsts: teamCards.reduce((sum, card) => sum + card.firsts, 0)
      }, `本队 ${teamCards.length} 人都拿过头游。全员都能上嘴脸，对面根本不知道该防谁。`));
    }
    if (prefs && prefs.strictA === true && foeResets[teamKey] > 0) {
      teamResults.push(teamHonor('foe_reset', teamKey, playerIds, { foeResets: foeResets[teamKey] }, `对手打 A 时，本队把对方打回 2 共 ${foeResets[teamKey]} 次。一夜回到解放前，杀人还要诛心。`));
    }
  }
  if (completionConsistent && comebackEvidence) {
    const playerIds = roster.filter(player => player._teamKey === validWinnerKey).map(player => player.id);
    teamResults.push(teamHonor('comeback_a', validWinnerKey, playerIds, comebackEvidence, `对手已到 A 时，本队从 ${comebackEvidence.ownLevel} 级完成翻盘。香槟先别开，这把我们接管比赛。`));
  }

  const memorials = [];
  if (completionConsistent) {
    const finisherPlayer = hands[hands.length - 1].ranked[0];
    memorials.push({
      category: 'memorial', subtype: HONOR_CATEGORY_BY_KEY.finisher, key: 'finisher', title: titleOf('finisher'),
      playerId: finisherPlayer.id, score: { finalRank: 1 }, caption: '通关的最后一个小局拿到头游。重拳出击完成绝杀，今晚的聚光灯全打在你身上。'
    });
    if (hands.length <= thresholds.blitz) {
      memorials.push({ category: 'memorial', subtype: HONOR_CATEGORY_BY_KEY.speed_run, key: 'speed_run', title: titleOf('speed_run'), score: { hands: hands.length }, caption: `${hands.length} 个小局完成通关。今晚的牌局比德芙还丝滑，可以提前打卡下班了。` });
    }
  }
  if (hands.length >= thresholds.marathon) {
    memorials.push({ category: 'memorial', subtype: HONOR_CATEGORY_BY_KEY.long_night, key: 'long_night', title: titleOf('long_night'), score: { hands: hands.length }, caption: `一共打了 ${hands.length} 个小局。超长膀胱局，打得手机都快包浆了。` });
  }

  const reportCards = Object.fromEntries(reportCardEntries);
  const selectedPersonalHonors = selectPersonalHonors(foldedPersonalHonors, cardList);
  const selectedTeamResults = selectTeamHonors(teamResults);

  return {
    mode: playerCount,
    hands: hands.length,
    ended: Boolean(ended),
    winnerKey: validWinnerKey,
    observationComplete: true,
    personalHonors: selectedPersonalHonors,
    teamResults: selectedTeamResults,
    memorials,
    // 供标定和规则回归审计；产品展示只读取上面的最终颁奖结果。
    awardCandidates: { personal: foldedPersonalHonors, team: teamResults },
    reportCards,
    applicability: { foe_reset: prefs && prefs.strictA === true ? 'eligible' : 'not_applicable' }
  };
}

export function resolveHonorPlayerCount(modeValue, fallbackCount = 8) {
  return resolvePlayerCountMode(modeValue, fallbackCount);
}

/**
 * 旧 web 调用点的编译期适配。它只能提供名次序列，因此只会得到可由名次重建的 v2 事件；
 * HONOR-1 接线时应改为直接传服务端逐局快照并删除这个 adapter。
 */
export function calculateHonorsFromData(players = [], allStats = {}, totalPlayers = 8) {
  const mode = resolveHonorPlayerCount(totalPlayers, Array.isArray(players) ? players.length : 8);
  const playerList = Array.isArray(players) ? players : [];
  const maxHands = playerList.reduce((max, player) => {
    const rankings = allStats && allStats[player && player.id] && allStats[player.id].rankings;
    return Math.max(max, Array.isArray(rankings) ? rankings.length : 0);
  }, 0);
  const history = [];
  for (let handIndex = 0; handIndex < maxHands; handIndex++) {
    const playerRankings = {};
    for (const player of playerList) {
      const rank = Number(allStats && allStats[player.id] && allStats[player.id].rankings?.[handIndex]);
      if (Number.isSafeInteger(rank) && rank >= 1 && rank <= mode && !playerRankings[rank]) {
        playerRankings[rank] = player;
      }
    }
    if (Object.keys(playerRankings).length !== mode) continue;
    const first = playerRankings[1];
    history.push({ playerRankings, winKey: teamKeyOf(first && first.team), mode: String(mode) });
  }
  const result = calculateSessionHonors({ history, players: playerList, mode });
  const honors = {};
  for (const honor of result.personalHonors) {
    if (honors[honor.key]) continue;
    const player = playerList.find(candidate => String(candidate.id) === String(honor.playerId));
    honors[honor.key] = {
      player: playerRef(normalizedPlayers([player], mode)[0] || { ...player, _idKey: '', _teamKey: '' }),
      score: honor.caption,
      stats: allStats && allStats[honor.playerId] ? allStats[honor.playerId] : {}
    };
  }
  return honors;
}
