import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.window = {
  location: {
    origin: 'http://localhost'
  }
};

globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};

const {
  CURRENT_HONOR_COUNT,
  CURRENT_HONOR_TITLES,
  HONOR_TITLES_BY_KEY,
  canonicalizeHonorTitle,
  countCurrentHonors,
  createHonorCounter,
  normalizeHonorCounter
} = await import('../../shared/honorCatalog.js');
const {
  ACHIEVEMENTS,
  checkAchievements,
  countDistinctProfileRelations
} = await import('../../src/stats/achievements.js');
const { initializePlayerStats } = await import('../../api/players/_utils.js');
const { mapSessionHonorsToPlayerHonors } = await import('../../src/api/playerApi.js');

function readProjectFile(relativePath) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

function relationMap(prefix, count) {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => [
    `${prefix}_${index + 1}`,
    { games: 1, wins: 0, winRate: 0 }
  ]));
}

const profilePageSource = readFileSync(new URL('../../player-profile.html', import.meta.url), 'utf8');
const achievementSource = [
  readProjectFile('src/stats/achievements.js'),
  readProjectFile('shared/achievementLogic.js')
].join('\n');
const playerApiSource = readProjectFile('api/players/[handle].js');
const currentAchievementCount = Object.keys(ACHIEVEMENTS).length;

assert.ok(
  profilePageSource.includes('normalizeHonorCounter'),
  'profile page should normalize honors before rendering them'
);
assert.equal(
  profilePageSource.includes('Object.entries(player.stats.honors)'),
  false,
  'profile page should not render raw honor maps because legacy honors can leak into the UI'
);
assert.equal(currentAchievementCount, 17, 'achievement catalog should expose the current active badge count');
assert.equal(
  profilePageSource.includes('/ 20 UNLOCKED'),
  false,
  'profile page should not hard-code the removed 20-achievement total'
);
assert.equal(
  achievementSource.includes('20 badge achievements') || achievementSource.includes('(20 total)'),
  false,
  'achievement source comments should not document a stale 20-achievement catalog'
);
assert.ok(
  playerApiSource.includes('../../shared/achievementLogic.js'),
  'player stats API should import achievement unlock logic from the shared catalog'
);
assert.equal(
  /function checkAchievements/.test(playerApiSource),
  false,
  'player stats API should not keep a duplicate inline achievement checker'
);

const docsByPath = {
  'CLAUDE.md': readProjectFile('CLAUDE.md'),
  'README.md': readProjectFile('README.md'),
  'docs/FEATURE_STATUS.md': readProjectFile('docs/FEATURE_STATUS.md'),
  'docs/features/PLAYER_PROFILE_SPEC.md': readProjectFile('docs/features/PLAYER_PROFILE_SPEC.md'),
  'docs/architecture/CODEBASE_STRUCTURE.md': readProjectFile('docs/architecture/CODEBASE_STRUCTURE.md'),
  'docs/architecture/PLAYER_PROFILE_ARCHITECTURE.md': readProjectFile('docs/architecture/PLAYER_PROFILE_ARCHITECTURE.md'),
  'docs/architecture/DESIGN_DECISIONS.md': readProjectFile('docs/architecture/DESIGN_DECISIONS.md'),
  'docs/architecture/TECHNICAL_IMPLEMENTATION.md': readProjectFile('docs/architecture/TECHNICAL_IMPLEMENTATION.md'),
  'docs/design/demos/demo-broadcast-v3.html': readProjectFile('docs/design/demos/demo-broadcast-v3.html'),
  'docs/design/demos/demo-broadcast-mobile-v2.html': readProjectFile('docs/design/demos/demo-broadcast-mobile-v2.html'),
  'docs/design/demos/demo-teatable-v3.html': readProjectFile('docs/design/demos/demo-teatable-v3.html'),
  'docs/design/demos/demo-teatable-mobile-v2.html': readProjectFile('docs/design/demos/demo-teatable-mobile-v2.html')
};
assert.equal(
  docsByPath['README.md'].includes('14项荣誉'),
  false,
  'README should describe the current 16-honor system, not the old 14-honor profile sync'
);
assert.ok(
  docsByPath['README.md'].includes('16项荣誉自动同步到档案'),
  'README should state that all 16 honors sync to profiles'
);
assert.equal(
  docsByPath['README.md'].includes('波动王 / 节奏核心') && docsByPath['README.md'].includes('rank movement magnitude, range, and volatility'),
  false,
  'README should not group 节奏核心 with volatility-only rank movement after the team-context redesign'
);
assert.match(
  docsByPath['README.md'],
  /节奏核心.*(?:team-leading|队伍领先|节奏)/,
  'README should describe 节奏核心 as team-context tempo pressure'
);
for (const [docPath, source] of Object.entries(docsByPath)) {
  assert.equal(
    /20 (?:achievements|achievement badges|badges|badge definitions)|20\s*个成就|20\s*项成就/i.test(source),
    false,
    `${docPath} should not document the removed 20-achievement catalog`
  );
}
assert.equal(
  docsByPath['docs/features/PLAYER_PROFILE_SPEC.md'].includes('8/14'),
  false,
  'profile spec honor collection mock should use the current 16-honor total'
);
assert.equal(
  docsByPath['docs/architecture/DESIGN_DECISIONS.md'].includes('辅助王'),
  false,
  'design decisions should not document the removed 辅助王 honor'
);
assert.equal(
  docsByPath['docs/architecture/DESIGN_DECISIONS.md'].includes('3+ games minimum'),
  false,
  'design decisions should describe the current 5-game minimum for session honors'
);
assert.equal(
  docsByPath['docs/architecture/TECHNICAL_IMPLEMENTATION.md'].includes('辅助王'),
  false,
  'technical implementation notes should not document the removed 辅助王 algorithm'
);
assert.equal(
  docsByPath['CLAUDE.md'].includes('小丑'),
  false,
  'CLAUDE.md should document the current 抗压王 honor, not the legacy 小丑 title'
);
assert.equal(
  /<div class="honor__name">🤡<\/div>|The Clown|无冠最菜/.test(docsByPath['docs/design/demos/demo-broadcast-v3.html']),
  false,
  'current broadcast demo should not render the removed clown honor'
);
for (const demoPath of [
  'docs/design/demos/demo-broadcast-v3.html',
  'docs/design/demos/demo-broadcast-mobile-v2.html',
  'docs/design/demos/demo-teatable-v3.html',
  'docs/design/demos/demo-teatable-mobile-v2.html'
]) {
  const source = docsByPath[demoPath];
  assert.equal(
    /变化频繁|变名次|名变最勤/.test(source),
    false,
    `${demoPath} should not describe tempo honors as legacy rank-change frequency`
  );
  assert.equal(
    /<div class="honor__name">🤡<\/div>|The Clown|无冠最菜/.test(source),
    false,
    `${demoPath} should not render the removed clown honor`
  );
  assert.equal(
    source.includes('守门员'),
    false,
    `${demoPath} should use the current 保底核心 honor instead of the removed 守门员 demo label`
  );
}

assert.equal(CURRENT_HONOR_COUNT, 16);
assert.deepEqual(
  ['streak', 'carp', 'nonstick', 'burnout', 'almost', 'resilient'].map(key => HONOR_TITLES_BY_KEY[key]),
  ['连段王', '逆转核心', '保底核心', '燃尽王', '棋差一着', '抗压王']
);

const freshCounter = createHonorCounter();
assert.equal(Object.keys(freshCounter).length, 16);
assert.equal(freshCounter['逆转核心'], 0);
assert.equal(freshCounter['辅助王'], undefined);
assert.deepEqual(
  normalizeHonorCounter({ 吕布: 2, 辅助王: 9, 连胜王: 2, 鲤鱼王: '3', 小丑: 4, 抗压王: -2, 闪电侠: 1 }),
  {
    ...freshCounter,
    吕布: 2,
    连段王: 2,
    逆转核心: 3,
    节奏核心: 1,
    抗压王: 4
  }
);
assert.equal(canonicalizeHonorTitle('连胜王'), '连段王');
assert.equal(canonicalizeHonorTitle('鲤鱼王'), '逆转核心');
assert.equal(canonicalizeHonorTitle('不粘锅'), '保底核心');
assert.equal(canonicalizeHonorTitle('闪电侠'), '节奏核心');
assert.equal(canonicalizeHonorTitle('__proto__'), null);
assert.equal(canonicalizeHonorTitle('constructor'), null);
assert.ok(
  checkAchievements({
    sessionsPlayed: 1,
    sessionsWon: 0,
    honors: { 吕布: 1, 阿斗: 1, 石佛: 1, 连胜王: 1, 小丑: 1 }
  }).includes('honor_5'),
  'achievement checks should normalize legacy honor aliases before counting unique honors'
);
assert.ok(
  checkAchievements({
    sessionsPlayed: 1,
    sessionsWon: 0,
    honors: { 吕布: 10 }
  }).includes('lubu_10'),
  '吕布专业户 should read the canonical MVP honor title instead of a separate hard-coded counter path'
);

const initialized = initializePlayerStats();
assert.deepEqual(initialized.honors, freshCounter);

const sessionHonors = {
  mvp: { player: { id: 1 } },
  streak: { player: { id: 1 } },
  carp: { player: { id: 1 } },
  nonstick: { player: { id: 1 } },
  burnout: { player: { id: 2 } },
  almost: { player: { id: 1 } },
  resilient: { player: { id: 1 } }
};
assert.deepEqual(mapSessionHonorsToPlayerHonors(sessionHonors), {
  1: ['吕布', '连段王', '逆转核心', '保底核心', '棋差一着', '抗压王'],
  2: ['燃尽王']
});

assert.deepEqual(
  mapSessionHonorsToPlayerHonors({
    mvp: { player: { id: '__proto__' } },
    burden: { player: { id: 'constructor' } },
    carp: { player: { id: undefined } },
    nonstick: { player: { id: 1 } }
  }),
  {
    1: ['保底核心']
  },
  'honor profile mapping should ignore unsafe recipient ids instead of throwing or polluting object prototypes'
);

const allCurrentHonors = Object.fromEntries(CURRENT_HONOR_TITLES.map(title => [title, 1]));
assert.equal(countCurrentHonors(allCurrentHonors), 16);
assert.ok(checkAchievements({
  sessionsPlayed: 1,
  sessionsWon: 0,
  honors: allCurrentHonors
}).includes('honor_all'));

const oneMissing = { ...allCurrentHonors, 抗压王: 0 };
assert.equal(countCurrentHonors(oneMissing), 15);
assert.equal(checkAchievements({
  sessionsPlayed: 1,
  sessionsWon: 0,
  honors: oneMissing
}).includes('honor_all'), false);

assert.equal(checkAchievements({
  sessionsPlayed: 1,
  sessionsWon: 0,
  honors: {},
  partners: relationMap('partner', 10),
  opponents: relationMap('opponent', 9)
}).includes('social_butterfly'), false);
assert.ok(checkAchievements({
  sessionsPlayed: 1,
  sessionsWon: 0,
  honors: {},
  partners: relationMap('partner', 10),
  opponents: relationMap('opponent', 10)
}).includes('social_butterfly'));
assert.equal(
  countDistinctProfileRelations({
    partners: {
      inactive: { games: 0, wins: 0, winRate: 0 },
      missing_games: { wins: 1, winRate: 1 },
      primitive: true
    },
    opponents: {
      negative: { games: -1 },
      nan: { games: 'bad' }
    }
  }),
  0,
  'social achievements should count only relations with positive recorded games'
);

console.log('honor profile sync checks passed');
