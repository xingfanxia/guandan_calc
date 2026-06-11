const MODE_PLAYER_COUNTS = Object.freeze({
  '4P': 4,
  '6P': 6,
  '8P': 8
});
const MAX_SESSION_ROUNDS = 10000;
const MAX_SESSION_SECONDS = 30 * 24 * 60 * 60;

function parseFiniteNumber(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseInteger(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function normalizeOptionalLegacyInteger(value, maxValue) {
  if (value === undefined || value === null) return 0;
  const number = parseInteger(value);
  if (number === null || number < 0 || number > maxValue) return 0;
  return number;
}

function normalizeOptionalLegacyNumber(value, maxValue) {
  if (value === undefined || value === null) return 0;
  const number = parseFiniteNumber(value);
  if (number === null || number < 0 || number > maxValue) return 0;
  return number;
}

export function normalizeLegacyRecentRanking(value, maxRank) {
  const rank = parseInteger(value);
  return rank !== null && rank >= 1 && rank <= maxRank ? rank : undefined;
}

export function normalizeLegacyRecentGameForModeStats(game) {
  if (!game || typeof game !== 'object' || Array.isArray(game)) return null;

  const mode = typeof game.mode === 'string' ? game.mode.trim() : '';
  const maxRank = MODE_PLAYER_COUNTS[mode];
  if (!maxRank) return null;

  const ranking = parseFiniteNumber(game.ranking);
  if (ranking === null || ranking <= 0 || ranking > maxRank) return null;

  return {
    ...game,
    mode,
    ranking,
    teamWon: game.teamWon === true,
    rounds: normalizeOptionalLegacyInteger(game.rounds, MAX_SESSION_ROUNDS),
    duration: normalizeOptionalLegacyNumber(game.duration, MAX_SESSION_SECONDS),
    relativeRank: normalizeLegacyRecentRanking(game.relativeRank, maxRank)
  };
}

export function applyLegacyRecentGamesToModeStats(player, { preferOverallRecentRankings = false, log = false } = {}) {
  if (!Array.isArray(player?.recentGames) || !player?.stats) return 0;

  const gamesOldestFirst = [...player.recentGames].reverse();
  const rankingsByMode = { '4P': [], '6P': [], '8P': [] };
  const overallRecentRankings = Array.isArray(player.stats.recentRankings)
    ? player.stats.recentRankings
    : [];
  let migratedGames = 0;

  gamesOldestFirst.forEach((game, gameIndex) => {
    const normalizedGame = normalizeLegacyRecentGameForModeStats(game);
    if (!normalizedGame) {
      if (log) console.log(`Skipping legacy game ${gameIndex}: malformed recentGames record`);
      return;
    }

    const mode = normalizedGame.mode;
    const modeStats = player.stats[`stats${mode}`];
    if (!modeStats) return;

    if (log) {
      console.log(`Processing game ${gameIndex}: ${mode}, room=${normalizedGame.roomCode}, duration=${normalizedGame.duration}`);
    }

    migratedGames++;
    modeStats.sessionsPlayed = (modeStats.sessionsPlayed || 0) + 1;
    if (normalizedGame.teamWon) {
      modeStats.sessionsWon = (modeStats.sessionsWon || 0) + 1;
    }
    modeStats.sessionWinRate = modeStats.sessionsPlayed > 0
      ? (modeStats.sessionsWon || 0) / modeStats.sessionsPlayed
      : 0;

    const prevSessionTotal = (modeStats.avgRankingPerSession || 0) * (modeStats.sessionsPlayed - 1);
    modeStats.avgRankingPerSession = (prevSessionTotal + normalizedGame.ranking) / modeStats.sessionsPlayed;

    if (normalizedGame.rounds > 0) {
      modeStats.roundsPlayed = (modeStats.roundsPlayed || 0) + normalizedGame.rounds;
      const prevRoundsTotal = (modeStats.avgRoundsPerSession || 0) * (modeStats.sessionsPlayed - 1);
      modeStats.avgRoundsPerSession = (prevRoundsTotal + normalizedGame.rounds) / modeStats.sessionsPlayed;

      const prevRoundRankTotal = (modeStats.avgRankingPerRound || 0) * (modeStats.roundsPlayed - normalizedGame.rounds);
      modeStats.avgRankingPerRound = (prevRoundRankTotal + (normalizedGame.ranking * normalizedGame.rounds)) / modeStats.roundsPlayed;

      if (normalizedGame.rounds > (modeStats.longestSessionRounds || 0)) {
        modeStats.longestSessionRounds = normalizedGame.rounds;
      }
    }

    if (normalizedGame.duration > 0) {
      const before = modeStats.totalPlayTimeSeconds || 0;
      modeStats.totalPlayTimeSeconds = before + normalizedGame.duration;
      if (log) {
        console.log(`[${mode}] Time: ${before} + ${normalizedGame.duration} = ${modeStats.totalPlayTimeSeconds}`);
      }

      if (normalizedGame.duration > (modeStats.longestSessionSeconds || 0)) {
        modeStats.longestSessionSeconds = normalizedGame.duration;
      }
      modeStats.avgSessionSeconds = modeStats.totalPlayTimeSeconds / modeStats.sessionsPlayed;
    } else if (log) {
      console.log(`[${mode}] No duration for game`);
    }

    const rankingIndex = player.recentGames.length - 1 - gameIndex;
    const relativeRank = (
      preferOverallRecentRankings
        ? normalizeLegacyRecentRanking(overallRecentRankings[rankingIndex], MODE_PLAYER_COUNTS[mode])
        : undefined
    ) ?? normalizedGame.relativeRank ?? Math.round(normalizedGame.ranking);
    rankingsByMode[mode].push(relativeRank);

    player.stats.modeBreakdown[mode] = (player.stats.modeBreakdown[mode] || 0) + 1;

    if (normalizedGame.teamWon) {
      modeStats.currentWinStreak = (modeStats.currentWinStreak || 0) + 1;
      modeStats.currentLossStreak = 0;
      if (modeStats.currentWinStreak > (modeStats.longestWinStreak || 0)) {
        modeStats.longestWinStreak = modeStats.currentWinStreak;
      }
    } else {
      modeStats.currentLossStreak = (modeStats.currentLossStreak || 0) + 1;
      modeStats.currentWinStreak = 0;
      if (modeStats.currentLossStreak > (modeStats.longestLossStreak || 0)) {
        modeStats.longestLossStreak = modeStats.currentLossStreak;
      }
    }
  });

  player.stats.stats4P.recentRankings = rankingsByMode['4P'].slice(-10).reverse();
  player.stats.stats6P.recentRankings = rankingsByMode['6P'].slice(-10).reverse();
  player.stats.stats8P.recentRankings = rankingsByMode['8P'].slice(-10).reverse();

  return migratedGames;
}
