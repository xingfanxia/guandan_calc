/**
 * Team MVP / Burden selection.
 *
 * Identical 60-line logic was duplicated in `statistics.js` (live UI) and
 * `exportMobile.js` (PNG share image). Extracted here so the tie-breaker
 * rules can be changed in one place — drift between display and export
 * was a real risk before this consolidation.
 *
 * Selection rules:
 *   - MVP: lowest avg ranking (lower is better — 1st place = rank 1)
 *     - Tie-breaker 1: more first-place finishes
 *     - Tie-breaker 2: fewer last-place finishes
 *   - Burden: highest avg ranking (worse is "more burdensome")
 *     - Tie-breaker 1: more last-place finishes
 *     - Tie-breaker 2: fewer first-place finishes
 *
 * Players with zero games played are skipped.
 */

/**
 * Find the team's MVP and burden given session stats.
 * @param {Array} teamPlayers - Players to search (e.g., one team's roster)
 * @param {Object} playerStats - Map of playerId → { games, totalRank, firstPlaceCount, lastPlaceCount }
 * @returns {{ mvp: Object|null, burden: Object|null }}
 */
export function findMVPAndBurden(teamPlayers, playerStats) {
  let mvp = null, burden = null;
  let mvpStats = null, burdenStats = null;

  teamPlayers.forEach(player => {
    const stats = playerStats[player.id];
    if (!stats || stats.games <= 0) return;

    const avg = stats.totalRank / stats.games;

    // MVP: lowest avg ranking
    if (!mvp) {
      mvp = player;
      mvpStats = { avg, stats };
    } else if (avg < mvpStats.avg) {
      mvp = player;
      mvpStats = { avg, stats };
    } else if (avg === mvpStats.avg) {
      if (stats.firstPlaceCount > mvpStats.stats.firstPlaceCount) {
        mvp = player;
        mvpStats = { avg, stats };
      } else if (
        stats.firstPlaceCount === mvpStats.stats.firstPlaceCount &&
        stats.lastPlaceCount < mvpStats.stats.lastPlaceCount
      ) {
        mvp = player;
        mvpStats = { avg, stats };
      }
    }

    // Burden: highest avg ranking
    if (!burden) {
      burden = player;
      burdenStats = { avg, stats };
    } else if (avg > burdenStats.avg) {
      burden = player;
      burdenStats = { avg, stats };
    } else if (avg === burdenStats.avg) {
      if (stats.lastPlaceCount > burdenStats.stats.lastPlaceCount) {
        burden = player;
        burdenStats = { avg, stats };
      } else if (
        stats.lastPlaceCount === burdenStats.stats.lastPlaceCount &&
        stats.firstPlaceCount < burdenStats.stats.firstPlaceCount
      ) {
        burden = player;
        burdenStats = { avg, stats };
      }
    }
  });

  return { mvp, burden };
}
