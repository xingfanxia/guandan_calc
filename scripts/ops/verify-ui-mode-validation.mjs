import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const localStore = new Map();

globalThis.localStorage = {
  getItem(key) {
    return localStore.has(key) ? localStore.get(key) : null;
  },
  setItem(key, value) {
    localStore.set(key, String(value));
  },
  removeItem(key) {
    localStore.delete(key);
  },
  clear() {
    localStore.clear();
  }
};

globalThis.window = {
  location: {
    origin: 'http://localhost'
  },
  addEventListener() {},
  removeEventListener() {},
  localStorage: globalThis.localStorage
};

class FakeClassList {
  constructor(node) {
    this.node = node;
  }

  add(...names) {
    const classes = new Set((this.node.className || '').split(/\s+/).filter(Boolean));
    names.forEach(name => classes.add(name));
    this.node.className = Array.from(classes).join(' ');
  }

  remove(...names) {
    const removeSet = new Set(names);
    this.node.className = (this.node.className || '')
      .split(/\s+/)
      .filter(name => name && !removeSet.has(name))
      .join(' ');
  }

  contains(name) {
    return (this.node.className || '').split(/\s+/).includes(name);
  }
}

class FakeNode {
  constructor(tagName = '#text') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.className = '';
    this.dataset = {};
    this.style = {};
    this.value = '';
    this.textContent = '';
    this.classList = new FakeClassList(this);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  insertBefore(child, referenceNode) {
    const index = this.children.indexOf(referenceNode);
    if (index === -1) {
      this.children.push(child);
    } else {
      this.children.splice(index, 0, child);
    }
    return child;
  }

  replaceChildren(...children) {
    this.children = [];
    children.forEach(child => this.appendChild(child));
  }

  addEventListener() {}

  querySelectorAll(selector) {
    if (!selector.startsWith('.')) return [];
    const className = selector.slice(1);
    const matches = [];
    const visit = (node) => {
      if ((node.className || '').split(/\s+/).includes(className)) {
        matches.push(node);
      }
      (node.children || []).forEach(visit);
    };
    this.children.forEach(visit);
    return matches;
  }
}

function fakeTextNode(text) {
  const node = new FakeNode('#text');
  node.textContent = String(text);
  return node;
}

function collectText(node) {
  return `${node.textContent || ''}${(node.children || []).map(collectText).join('')}`;
}

const elements = new Map();
function element(id, value = '') {
  const node = new FakeNode('div');
  node.id = id;
  node.value = value;
  elements.set(id, node);
  return node;
}

element('playerPool');
element('rankingArea');
element('calcpreviewContent');
element('calcpreviewHint');
element('rulesDrawerChips');
element('ruleHint');
element('bulkNames');
element('tickerMode');
element('team1Zone');
element('team2Zone');
element('unassignedPlayers');
element('mode', '4abc');

globalThis.document = {
  createElement(tagName) {
    return new FakeNode(tagName);
  },
  createTextNode(text) {
    return fakeTextNode(text);
  },
  getElementById(id) {
    return elements.get(id) || null;
  },
  addEventListener() {},
  removeEventListener() {}
};

globalThis.alert = () => {};
globalThis.setInterval = () => 1;
globalThis.clearInterval = () => {};

const state = (await import('../../src/core/state.js')).default;
const { renderRankingArea } = await import('../../src/ranking/rankingRenderer.js');
const { initCalcPreviewSync, renderCalcPreview } = await import('../../src/ui/calcPreviewSync.js');
const { renderRulesDrawerChips } = await import('../../src/ui/rulesDrawerSync.js');
const { updateRuleHint } = await import('../../src/ui/teamDisplay.js');
const { initTickerSync } = await import('../../src/ui/tickerSync.js');
const { updateBulkNamesPlaceholder } = await import('../../src/controllers/settingsControls.js');
const { createRosterRow } = await import('../../src/player/playerRenderer.js');

function resetFixture() {
  localStorage.clear();
  state.resetAll();
  state.setPlayers([
    { id: 1, name: 'A', emoji: 'A', team: 1 },
    { id: 2, name: 'B', emoji: 'B', team: 1 },
    { id: 3, name: 'C', emoji: 'C', team: 2 },
    { id: 4, name: 'D', emoji: 'D', team: 2 }
  ]);
  state.setCurrentRanking({});
  for (const id of ['playerPool', 'rankingArea', 'calcpreviewContent', 'calcpreviewHint', 'rulesDrawerChips', 'ruleHint', 'bulkNames', 'tickerMode', 'team1Zone', 'team2Zone', 'unassignedPlayers']) {
    elements.get(id).replaceChildren();
    elements.get(id).textContent = '';
  }
  elements.get('bulkNames').placeholder = '';
  elements.get('mode').value = '4abc';
}

resetFixture();
renderRankingArea('4abc');
assert.equal(
  elements.get('rankingArea').querySelectorAll('.rank-slot').length,
  0,
  'ranking area should not partially parse invalid mode into rank slots'
);
assert.match(
  collectText(elements.get('playerPool')),
  /模式无效/,
  'ranking area should tell the user the mode is invalid'
);

resetFixture();
elements.get('mode').value = '4';
state.setPlayers([]);
renderRankingArea('4');
assert.equal(
  elements.get('rankingArea').querySelectorAll('.rank-slot').length,
  0,
  'ranking area should not render slots before any players exist'
);
assert.match(
  collectText(elements.get('playerPool')),
  /添加或生成玩家/,
  'ranking area should tell the user to add or generate players before ranking'
);

resetFixture();
state.setCurrentRanking({ 1: 1 });
renderCalcPreview();
assert.match(
  collectText(elements.get('calcpreviewContent')),
  /模式无效/,
  'calc preview should not calculate with a partially parsed invalid mode'
);
assert.match(
  collectText(elements.get('calcpreviewHint')),
  /重新选择模式/,
  'calc preview hint should ask for a valid mode'
);

resetFixture();
elements.get('mode').value = '4';
state.setCurrentRanking({ 1: 1, 2: 2, 3: 3, 4: 4 });
initCalcPreviewSync();
assert.match(
  elements.get('calcpreviewHint').textContent,
  /已就绪 · 4\/4/,
  'calc preview fixture should start from a complete 4-player ranking'
);
state.setPlayers([
  { id: 1, name: 'A', emoji: 'A', team: 1 },
  { id: 2, name: 'B', emoji: 'B', team: 2 }
]);
assert.match(
  elements.get('calcpreviewHint').textContent,
  /等待最后 2 位/,
  'calc preview should rerender when setPlayers prunes current ranking'
);

resetFixture();
renderRulesDrawerChips();
assert.doesNotMatch(
  collectText(elements.get('rulesDrawerChips')),
  /mode:4人|c4:/,
  'rules drawer should not render 4-player rules for a partially parsed invalid mode'
);
assert.match(
  collectText(elements.get('rulesDrawerChips')),
  /无效/,
  'rules drawer should tell the user the mode is invalid'
);

resetFixture();
updateRuleHint('4abc');
assert.match(
  elements.get('ruleHint').textContent,
  /模式无效/,
  'rule hint should not fall back to 8-player rules for an invalid mode'
);
updateBulkNamesPlaceholder('4abc');
assert.match(
  elements.get('bulkNames').placeholder,
  /选择.*模式/,
  'bulk name placeholder should not fall back to an 8-player example for an invalid mode'
);

resetFixture();
initTickerSync();
assert.match(
  elements.get('tickerMode').textContent,
  /模式无效/,
  'ticker mode label should not fall back to 8-player text for an invalid mode'
);

resetFixture();
state.setCurrentRanking({ 4: 1 });
const row = createRosterRow(state.getPlayers()[0]);
// Unranked players carry NO tag (the decorative 'POOL' label was removed
// 2026-06-12); a tag only appears once a rank is recorded. An invalid mode
// must not partial-parse into a bogus rank tag either → empty.
assert.equal(
  collectText(row.children[2]),
  '',
  'team roster tags should not label ranks using a partially parsed invalid mode'
);

const stringTeamRow = createRosterRow({ id: 9, name: 'String Blue', emoji: 'S', team: '1' });
assert.match(
  stringTeamRow.children[0].className,
  /roster-row__avatar--blue/,
  'team roster rows should color normalized string team 1 as blue'
);

const historySource = readFileSync(resolve(repoRoot, 'src/game/history.js'), 'utf8');
const exportSource = readFileSync(resolve(repoRoot, 'src/export/exportHandlers.js'), 'utf8');
const playerRendererSource = readFileSync(resolve(repoRoot, 'src/player/playerRenderer.js'), 'utf8');
const rankingRendererSource = readFileSync(resolve(repoRoot, 'src/ranking/rankingRenderer.js'), 'utf8');

assert.equal(
  historySource.includes('parseInt(entry.mode)'),
  false,
  'history renderer should not partially parse stored history mode values'
);
assert.equal(
  exportSource.includes('parseInt(h.mode)'),
  false,
  'export handlers should not partially parse stored history mode values'
);
assert.ok(
  playerRendererSource.includes('normalizeTeamNumber(player.team)'),
  'player renderer should normalize team values before routing players to team zones'
);
assert.ok(
  rankingRendererSource.includes('normalizeTeamNumber(player?.team)'),
  'ranking renderer should normalize team values before choosing slot color classes'
);

console.log('ui mode validation checks passed');
