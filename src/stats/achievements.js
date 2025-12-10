/**
 * Achievements System
 * 20 badge achievements across 5 categories
 */

// Achievement definitions (20 total)
export const ACHIEVEMENTS = {
  // Milestone Achievements (4)
  newbie: { name: '初来乍到', badge: '🐣', desc: '完成第一场游戏' },
  started: { name: '小试牛刀', badge: '⭐', desc: '完成10场游戏' },
  veteran: { name: '百战老兵', badge: '🎖️', desc: '完成100场游戏' },
  legend: { name: '千场传奇', badge: '👑', desc: '完成1000场游戏' },

  // Performance Achievements (4)
  first_win: { name: '首胜', badge: '🩸', desc: '赢得第一场游戏' },
  streak_5: { name: '连胜达人', badge: '🔥', desc: '连胜5场' },
  streak_10: { name: '十连胜', badge: '⚡', desc: '连胜10场' },
  champion: { name: '常胜将军', badge: '🏅', desc: '胜率70%以上（至少20场）' },

  // Honor Collection Achievements (4)
  honor_5: { name: '荣誉猎手', badge: '🎯', desc: '获得5种不同荣誉' },
  honor_10: { name: '荣誉收藏家', badge: '🏛️', desc: '获得10种不同荣誉' },
  honor_all: { name: '全荣誉大师', badge: '💎', desc: '获得全部14种荣誉' },
  lubu_10: { name: '吕布专业户', badge: '⚔️', desc: '获得吕布10次' },

  // Social/Team Achievements (3 - simplified without partner tracking)
  social_butterfly: { name: '社交蝴蝶', badge: '🦋', desc: '与20+不同玩家对局' },
  marathon: { name: '马拉松战士', badge: '🏃', desc: '单场游戏超过50轮' },
  quick_finish: { name: '闪电战', badge: '⚡', desc: '单场游戏少于15轮获胜' },

  // Fun/Special Achievements (5)
  comeback: { name: '大逆转', badge: '🔄', desc: '落后3级后逆转获胜' },
  sweep: { name: '零封对手', badge: '🧹', desc: '对手仍在2级时获胜' },
  perfect: { name: '完美表现', badge: '✨', desc: '单场游戏场均排名1.5以内' },
  unlucky: { name: '天选之子', badge: '🎲', desc: '单场5次以上垫底仍获胜' },
  iron_will: { name: '钢铁意志', badge: '💪', desc: '连败5场后获胜' }
};

/**
 * Check which achievements a player has earned
 * @param {Object} playerStats - Player stats object
 * @param {Object} lastSession - Last session data (optional, for session-specific achievements)
 * @returns {Array} Array of achievement IDs earned
 */
export function checkAchievements(playerStats, lastSession = null) {
  const earned = [];

  // Milestone achievements
  if (playerStats.sessionsPlayed >= 1) earned.push('newbie');
  if (playerStats.sessionsPlayed >= 10) earned.push('started');
  if (playerStats.sessionsPlayed >= 100) earned.push('veteran');
  if (playerStats.sessionsPlayed >= 1000) earned.push('legend');

  // Performance achievements
  if (playerStats.sessionsWon >= 1) earned.push('first_win');
  if (playerStats.longestWinStreak >= 5) earned.push('streak_5');
  if (playerStats.longestWinStreak >= 10) earned.push('streak_10');
  if (playerStats.sessionsPlayed >= 20 && playerStats.sessionWinRate >= 0.7) {
    earned.push('champion');
  }

  // Honor collection achievements
  const uniqueHonors = Object.values(playerStats.honors || {}).filter(count => count > 0).length;
  if (uniqueHonors >= 5) earned.push('honor_5');
  if (uniqueHonors >= 10) earned.push('honor_10');
  if (uniqueHonors >= 14) earned.push('honor_all');
  if ((playerStats.honors?.['吕布'] || 0) >= 10) earned.push('lubu_10');

  // Session-specific achievements (if lastSession provided)
  if (lastSession) {
    const rounds = lastSession.gamesInSession || 0;
    const avgRank = lastSession.ranking || 999;

    if (rounds > 50) earned.push('marathon');
    if (rounds < 15 && lastSession.teamWon) earned.push('quick_finish');
    if (avgRank <= 1.5) earned.push('perfect');
    if (lastSession.lastPlaces >= 5 && lastSession.teamWon) earned.push('unlucky');
  }

  return earned;
}

/**
 * Get newly unlocked achievements
 * @param {Array} oldAchievements - Previously earned achievement IDs
 * @param {Array} newAchievements - Currently earned achievement IDs
 * @returns {Array} Newly unlocked achievement IDs
 */
export function getNewAchievements(oldAchievements = [], newAchievements = []) {
  return newAchievements.filter(id => !oldAchievements.includes(id));
}
