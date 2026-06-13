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

const { default: config } = await import('../../src/core/config.js');
const { KEYS } = await import('../../src/core/storage.js');

function reset() {
  localStorage.clear();
  config.resetToDefaults();
}

reset();
assert.deepEqual(
  config.get8PlayerRules().thresholds,
  { g3: 11, g2: 5, g1: 0 },
  'resetToDefaults should restore the adjusted 8-player thresholds used at startup'
);

config.set8PlayerRules({ thresholds: { g2: 99, g1: 99 } });
config.resetModeToDefaults(8);
assert.deepEqual(
  config.get8PlayerRules().thresholds,
  { g3: 11, g2: 5, g1: 0 },
  'resetModeToDefaults(8) should match startup 8-player thresholds'
);

const originalDocument = globalThis.document;
const inputs = new Map([
  ['t8_3', { value: '11' }],
  ['t8_2', { value: '' }],
  ['t8_1', { value: '0' }],
  ['p8_1', { value: '7' }],
  ['p8_2', { value: '6' }],
  ['p8_3', { value: '5' }],
  ['p8_4', { value: '4' }],
  ['p8_5', { value: '3' }],
  ['p8_6', { value: '2' }],
  ['p8_7', { value: '1' }],
  ['p8_8', { value: '0' }]
]);

globalThis.document = {
  getElementById(id) {
    return inputs.get(id) || null;
  }
};

try {
  config.collectAndSaveRulesFromDOM(8);
  assert.deepEqual(
    config.get8PlayerRules().thresholds,
    { g3: 11, g2: 5, g1: 0 },
    'collectAndSaveRulesFromDOM(8) should preserve zero thresholds and use adjusted defaults'
  );

  inputs.get('t8_3').value = '12abc';
  inputs.get('t8_2').value = '5';
  inputs.get('t8_1').value = '0';
  inputs.get('p8_1').value = '8abc';
  config.collectAndSaveRulesFromDOM(8);
  assert.deepEqual(
    config.get8PlayerRules().thresholds,
    { g3: 11, g2: 5, g1: 0 },
    'collectAndSaveRulesFromDOM(8) should reject partially numeric threshold input'
  );
  assert.equal(
    config.get8PlayerRules().points[1],
    7,
    'collectAndSaveRulesFromDOM(8) should fall back for partially numeric point input'
  );
} finally {
  if (originalDocument) {
    globalThis.document = originalDocument;
  } else {
    delete globalThis.document;
  }
}

config.setPreference('strictA', false);
assert.equal(config.getPreference('strictA'), false);
config.setPreference('strictA', 'true');
assert.equal(
  config.getPreference('strictA'),
  false,
  'setPreference should ignore non-boolean preference values'
);

config.setPreferences({ autoApply: false, autoNext: 'false', must1: 0 });
assert.equal(config.getPreference('autoApply'), false);
assert.equal(config.getPreference('autoNext'), true);
assert.equal(config.getPreference('must1'), true);

config.setTeam('t1', { name: '  北队  ' });
assert.equal(config.getTeamName('t1'), '北队');
assert.equal(config.getTeam('t1').name, '北队');

config.setTeam('t1', { name: { toString: () => '污染队' } });
assert.equal(config.getTeamName('t1'), '北队');

config.setTeam('t1', { name: '   ' });
assert.equal(config.getTeamName('t1'), '北队');

assert.doesNotThrow(() => config.setTeam('t1', null));
assert.equal(config.getTeamName('t1'), '北队');

config.setTeam('t1', { color: '#123abc' });
assert.equal(config.getTeamColor('t1'), '#123abc');

config.setTeam('t1', { color: 'red" onmouseover="alert(1)' });
assert.equal(config.getTeamColor('t1'), '#123abc');

config.set4PlayerRules({ '1,2': 6, '1,3': { bad: true }, '1,4': -1 });
assert.deepEqual(
  config.get4PlayerRules(),
  { '1,2': 6, '1,3': 2, '1,4': 1 },
  'set4PlayerRules should keep valid custom values and default malformed values'
);

config.set6PlayerRules({
  thresholds: { g3: 8, g2: 'bad', g1: -1 },
  points: { 1: 6, 2: { bad: true }, 6: -1 }
});
assert.deepEqual(
  config.get6PlayerRules(),
  {
    thresholds: { g3: 8, g2: 4, g1: 1 },
    points: { 1: 6, 2: 4, 3: 3, 4: 3, 5: 1, 6: 0 }
  },
  'set6PlayerRules should sanitize threshold and point tables'
);

config.set8PlayerRules({
  thresholds: { g3: 12, g2: null, g1: 0 },
  points: { 1: 8, 4: 'bad', 8: -1 }
});
assert.deepEqual(
  config.get8PlayerRules(),
  {
    thresholds: { g3: 12, g2: 5, g1: 0 },
    points: { 1: 8, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 0 }
  },
  'set8PlayerRules should sanitize threshold and point tables'
);

reset();
localStorage.setItem(KEYS.CONFIG, JSON.stringify({
  strictA: 'false',
  autoNext: false,
  autoApply: 'true',
  c4: { '1,2': 7, '1,3': { bad: true }, '1,4': -1 },
  t6: { g3: 9, g2: 'bad', g1: -1 },
  p6: { 1: 6, 2: { bad: true }, 6: -1 },
  t8: { g3: 13, g2: null, g1: 0 },
  p8: { 1: 8, 4: 'bad', 8: -1 },
  t1: { name: { nested: true }, color: 'red" onmouseover="alert(1)' },
  t2: { name: 'Red', color: '#abc' }
}));

config.hydrate();
assert.equal(config.getPreference('strictA'), true);
assert.equal(config.getPreference('autoNext'), false);
assert.equal(config.getPreference('autoApply'), true);
assert.equal(config.getTeamName('t1'), '蓝队');
assert.equal(config.getTeamName('t2'), 'Red');
// Default team colors are the DESIGN.md palette (DEFAULT_TEAM_COLORS, 2026-06-12).
assert.equal(config.getTeamColor('t1'), '#2a5db0');
assert.equal(config.getTeamColor('t2'), '#aabbcc');
assert.equal(config.getAll().t1.name, '蓝队');
assert.equal(config.getAll().t2.name, 'Red');
assert.equal(config.getAll().t1.color, '#2a5db0');
assert.equal(config.getAll().t2.color, '#aabbcc');
assert.deepEqual(config.get4PlayerRules(), { '1,2': 7, '1,3': 2, '1,4': 1 });
assert.deepEqual(config.get6PlayerRules(), {
  thresholds: { g3: 9, g2: 4, g1: 1 },
  points: { 1: 6, 2: 4, 3: 3, 4: 3, 5: 1, 6: 0 }
});
assert.deepEqual(config.get8PlayerRules(), {
  thresholds: { g3: 13, g2: 5, g1: 0 },
  points: { 1: 8, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 0 }
});

console.log('config sanitization checks passed');
