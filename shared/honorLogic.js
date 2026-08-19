import { HONOR_CATEGORY_BY_KEY, HONOR_TITLES_BY_KEY } from './honorCatalog.js';
import { resolvePlayerCountMode } from './playerCountMode.js';

/** 事件荣誉没有统一场数门槛；保留导出名供旧 web adapter 编译。 */
export const MIN_HONOR_GAMES = 0;

/** 轻量趣味荣誉从第 5 局开始：先让玩家有内容可看，稀有事件仍保留更高门槛。 */
export const EARLY_HONOR_HANDS = 5;

export const HONOR_THRESHOLDS = Object.freeze({
  4: Object.freeze({ ddNight: 3, streak: 3, first: 4, almost: 2, clean: EARLY_HONOR_HANDS, blitz: 8, marathon: 18 }),
  6: Object.freeze({ ddNight: 2, streak: 3, first: 4, almost: 2, clean: EARLY_HONOR_HANDS, blitz: 10, marathon: 24 }),
  8: Object.freeze({ ddNight: 1, streak: 2, first: 3, almost: 2, clean: EARLY_HONOR_HANDS, blitz: 10, marathon: 24 })
});

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
  return result.slice(0, mode);
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

function stableBest(cards, field, threshold) {
  let best = null;
  for (const card of cards) {
    if (card[field] < threshold) continue;
    if (!best || card[field] > best[field]) best = card;
  }
  return best;
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
  const observationComplete = roster.length === playerCount && historyEntries.length > 0 && parsedHands.every(Boolean);
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
      reportCards,
      applicability: { foe_reset: prefs && prefs.strictA === true ? 'eligible' : 'not_applicable' }
    };
  }
  const personalHonors = [];
  for (const teamKey of TEAM_KEYS) {
    const teamCards = cardList.filter(card => teamKeyOf(card.team) === teamKey);
    // 8 人局单次双下已经很罕见；该模式允许一次即记开门/关门，4/6 人仍要求多次主导。
    const majority = Math.max(playerCount === 8 ? 1 : 2, Math.ceil(0.6 * teamDd[teamKey]));
    const opener = stableBest(teamCards, 'ddOpens', majority);
    if (opener) {
      personalHonors.push(personalHonor(
        'dd_opener', opener,
        { teamDD: teamDd[teamKey], ddOpens: opener.ddOpens },
        `本队 ${teamDd[teamKey]} 次${sweepTerm}，你开门 ${opener.ddOpens} 次`
      ));
    }
    const closer = stableBest(teamCards, 'ddCloses', majority);
    if (closer) {
      personalHonors.push(personalHonor(
        'dd_closer', closer,
        { teamDD: teamDd[teamKey], ddCloses: closer.ddCloses },
        `本队 ${teamDd[teamKey]} 次${sweepTerm}，你关门 ${closer.ddCloses} 次`
      ));
    }
  }

  for (const card of cardList) {
    if (card.aBlocks >= 1) {
      personalHonors.push(personalHonor('a_blocker', card, { aBlocks: card.aBlocks }, `对手打 A，被你拦下 ${card.aBlocks} 次`));
    }
    if (card.bestStreak >= thresholds.streak) {
      personalHonors.push(personalHonor('streak_king', card, { bestStreak: card.bestStreak }, `连续 ${card.bestStreak} 局头游`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && card.openingFirsts > 0) {
      personalHonors.push(personalHonor('opening_flash', card, { openingFirsts: card.openingFirsts }, '开局头游，今晚先声夺人'));
    }
    if (card.bounceBacks > 0) {
      personalHonors.push(personalHonor('bounce_back', card, { bounceBacks: card.bounceBacks }, `低位后下一局立刻头游 ${card.bounceBacks} 次`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && card.distinctRanks >= Math.min(4, playerCount)) {
      personalHonors.push(personalHonor('rank_rainbow', card, { distinctRanks: card.distinctRanks }, `走过 ${card.distinctRanks} 种名次`));
    }
    if (card.lasts === 0 && hands.length >= thresholds.clean) {
      personalHonors.push(personalHonor('clean_sheet', card, { hands: card.hands, lasts: card.lasts }, `${card.hands} 局，全程站稳`));
    }
    const almostTriggered = card.firsts === 0 && card.seconds >= thresholds.almost;
    if (almostTriggered) {
      personalHonors.push(personalHonor('almost', card, { seconds: card.seconds, firsts: card.firsts }, `${card.seconds} 次二游`));
    } else if (hands.length >= EARLY_HONOR_HANDS && card.firsts === 0) {
      personalHonors.push(personalHonor('no_first', card, { hands: card.hands, firsts: 0 }, `今晚 ${card.hands} 局，头游 0 次`));
    }
    const swingThreshold = Math.max(2, Math.ceil(hands.length / playerCount));
    if (card.firsts >= swingThreshold && card.lasts >= swingThreshold) {
      personalHonors.push(personalHonor('boom_bust', card, { firsts: card.firsts, lasts: card.lasts }, `高低位来回切换 ${card.firsts + card.lasts} 次`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && card.copyPasteStreak >= 3) {
      personalHonors.push(personalHonor('copy_paste', card, { copyPasteStreak: card.copyPasteStreak }, `连续 ${card.copyPasteStreak} 局都是同一名次`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && card.rocketJumps > 0) {
      personalHonors.push(personalHonor('rocket_jump', card, { rocketJumps: card.rocketJumps }, `单局跨越半桌名次 ${card.rocketJumps} 次`));
    }
    const ranks = card._ranks;
    if (hands.length >= EARLY_HONOR_HANDS && ranks.length >= 2 && ranks[ranks.length - 1] === 1 && ranks[ranks.length - 2] !== 1) {
      personalHonors.push(personalHonor('clutch_first', card, { finalPreviousRank: card.finalPreviousRank }, `最后一局从第 ${card.finalPreviousRank} 名冲到头游`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && card.soloCarries > 0) {
      personalHonors.push(personalHonor('solo_carry', card, { soloCarries: card.soloCarries }, `你头游、队友全在后半区 ${card.soloCarries} 次`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && card.frontRowStreak >= 4) {
      personalHonors.push(personalHonor('front_row_streak', card, { frontRowStreak: card.frontRowStreak }, `连续 ${card.frontRowStreak} 局站在前半区`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && card.cutLineCount >= 2) {
      personalHonors.push(personalHonor('cut_line_master', card, { cutLineCount: card.cutLineCount }, `${card.cutLineCount} 次刚好排在前半区末位`));
    }
    if (card.lateLift >= 0.3) {
      personalHonors.push(personalHonor('late_engine', card, { lateLift: Number(card.lateLift.toFixed(3)) }, `后段领先比例提升 ${Math.round(card.lateLift * 100)} 个百分点`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && card.backRowStreak >= 3) {
      personalHonors.push(personalHonor('back_row_streak', card, { backRowStreak: card.backRowStreak }, `连续 ${card.backRowStreak} 局都在后半区`));
    }
  }

  const mostLasts = Math.max(0, ...cardList.map((card) => card.lasts));
  if (hands.length >= EARLY_HONOR_HANDS && mostLasts >= 2) {
    for (const card of cardList.filter((candidate) => candidate.lasts === mostLasts)) {
      personalHonors.push(personalHonor(
        'last_king', card,
        { lasts: mostLasts },
        `末游 ${mostLasts} 次，${cardList.filter((candidate) => candidate.lasts === mostLasts).length > 1 ? '并列' : ''}全场最多`
      ));
    }
  }

  const firstKing = stableBest(cardList, 'firsts', thresholds.first);
  if (firstKing) {
    personalHonors.push(personalHonor('first_king', firstKing, { firsts: firstKing.firsts }, `${firstKing.firsts} 次头游，全场最多`));
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
      teamResults.push(teamHonor('dd_night', teamKey, playerIds, { teamDD: teamDd[teamKey] }, `本队 ${teamDd[teamKey]} 次${sweepTerm}`));
    }
    if (hands.length >= EARLY_HONOR_HANDS && teamCards.every(card => card.firsts > 0)) {
      teamResults.push(teamHonor('all_firsts', teamKey, playerIds, { firstScorers: teamCards.length }, `本队 ${teamCards.length} 人都拿过头游`));
    }
    if (prefs && prefs.strictA === true && foeResets[teamKey] > 0) {
      teamResults.push(teamHonor('foe_reset', teamKey, playerIds, { foeResets: foeResets[teamKey] }, `把对手打回原形 ${foeResets[teamKey]} 次`));
    }
  }
  if (completionConsistent && comebackEvidence) {
    const playerIds = roster.filter(player => player._teamKey === validWinnerKey).map(player => player.id);
    teamResults.push(teamHonor('comeback_a', validWinnerKey, playerIds, comebackEvidence, `对手到 A 时从 ${comebackEvidence.ownLevel} 级翻盘`));
  }

  const memorials = [];
  if (completionConsistent) {
    const finisherPlayer = hands[hands.length - 1].ranked[0];
    memorials.push({
      category: 'memorial', subtype: HONOR_CATEGORY_BY_KEY.finisher, key: 'finisher', title: titleOf('finisher'),
      playerId: finisherPlayer.id, score: { finalRank: 1 }, caption: '通关局头游'
    });
    if (hands.length <= thresholds.blitz) {
      memorials.push({ category: 'memorial', subtype: HONOR_CATEGORY_BY_KEY.speed_run, key: 'speed_run', title: titleOf('speed_run'), score: { hands: hands.length }, caption: `${hands.length} 局通关` });
    }
  }
  if (hands.length >= thresholds.marathon) {
    memorials.push({ category: 'memorial', subtype: HONOR_CATEGORY_BY_KEY.long_night, key: 'long_night', title: titleOf('long_night'), score: { hands: hands.length }, caption: `鏖战 ${hands.length} 局` });
  }

  const reportCards = Object.fromEntries(reportCardEntries);

  return {
    mode: playerCount,
    hands: hands.length,
    ended: Boolean(ended),
    winnerKey: validWinnerKey,
    observationComplete: true,
    personalHonors: foldedPersonalHonors,
    teamResults,
    memorials,
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
