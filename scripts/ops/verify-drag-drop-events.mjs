import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

Object.defineProperty(globalThis, 'navigator', {
  value: {
    vibrate() {}
  },
  configurable: true
});

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
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.className = '';
    this.dataset = new Proxy({}, {
      set(target, key, value) {
        target[key] = String(value);
        return true;
      },
      deleteProperty(target, key) {
        delete target[key];
        return true;
      }
    });
    this.style = {};
    this.id = '';
    this.isConnected = true;
    this.parentNode = null;
    this.classList = new FakeClassList(this);
    this.listeners = {};
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter(item => item !== child);
    child.parentNode = null;
    return child;
  }

  cloneNode() {
    const clone = new FakeNode(this.tagName);
    clone.className = this.className;
    clone.dataset = { ...this.dataset };
    return clone;
  }

  getBoundingClientRect() {
    return { width: 120, height: 48 };
  }

  addEventListener(event, handler) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(item => item !== handler);
  }

  replaceChildren(...children) {
    this.children.forEach(child => {
      child.parentNode = null;
    });
    this.children = [];
    children.forEach(child => {
      if (child) this.appendChild(child);
    });
  }

  matches(selector) {
    if (selector.startsWith('#')) {
      return this.id === selector.slice(1);
    }
    if (selector.startsWith('.')) {
      return (this.className || '').split(/\s+/).includes(selector.slice(1));
    }
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
      node.children.forEach(child => {
        if (child.matches(selector)) matches.push(child);
        visit(child);
      });
    };
    visit(this);
    return matches;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches(selector)) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }
}

const body = new FakeNode('body');
const playerPool = new FakeNode('section');
playerPool.id = 'playerPool';
const poolChild = new FakeNode('article');
playerPool.appendChild(poolChild);
const rankingArea = new FakeNode('section');
rankingArea.id = 'rankingArea';
body.appendChild(playerPool);
body.appendChild(rankingArea);
const nodesById = new Map([
  ['playerPool', playerPool],
  ['rankingArea', rankingArea]
]);

globalThis.document = {
  body,
  getElementById(id) {
    return nodesById.get(id) || null;
  },
  createElement(tagName) {
    return new FakeNode(tagName);
  },
  createTextNode(text) {
    const node = new FakeNode('#text');
    node.textContent = String(text);
    return node;
  },
  elementFromPoint() {
    return poolChild;
  },
  addEventListener() {},
  removeEventListener() {},
  querySelectorAll(selector) {
    return body.querySelectorAll(selector);
  }
};

globalThis.alert = () => {};

const { clear, emit, on: onEvent } = await import('../../src/core/events.js');
const state = (await import('../../src/core/state.js')).default;
const { handleRankDrop } = await import('../../src/player/dragDrop.js');
const { setDraggedPlayer } = await import('../../src/player/playerRenderer.js');
const { handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel } = await import('../../src/player/touchHandler.js');
const { createPoolTile, renderRankingArea, renderRankingSlots } = await import('../../src/ranking/rankingRenderer.js');

clear();
localStorage.clear();
state.resetAll();
state.setPlayers([
  { id: 1, name: '甲', team: 1 },
  { id: 2, name: '乙', team: 1 },
  { id: 3, name: '丙', team: 2 },
  { id: 4, name: '丁', team: 2 }
]);
state.setCurrentRanking({ 1: 1, 2: 2, 3: 3, 4: 4 });

const rankingPoolTile = createPoolTile({ id: 1, name: '甲', team: 1 });
playerPool.appendChild(rankingPoolTile);
assert.equal(
  rankingPoolTile.listeners.touchstart?.length,
  1,
  'ranking pool tile should bind touchstart to the drag start handler'
);
assert.deepEqual(
  rankingPoolTile.listeners.touchmove,
  [handleTouchMove],
  'ranking pool tile should bind touchmove to the drag move handler'
);
assert.deepEqual(
  rankingPoolTile.listeners.touchend,
  [handleTouchEnd],
  'ranking pool tile should bind touchend to the drop handler'
);
assert.deepEqual(
  rankingPoolTile.listeners.touchcancel,
  [handleTouchCancel],
  'ranking pool tile should bind touchcancel to the cancellation cleanup handler'
);
assert.equal(
  rankingPoolTile.dataset.touchHandlersAttached,
  'true',
  'ranking pool tile should mark touch handlers as attached so global attach guards skip it'
);

const rankUpdates = [];
onEvent('ranking:updated', () => {
  rankUpdates.push(state.getCurrentRanking());
});

const rankSlot = new FakeNode('article');
rankSlot.dataset.rank = '1';

const rankDropResult = handleRankDrop(
  rankSlot,
  { id: 1, name: '甲', team: 1 },
  {}
);

assert.deepEqual(
  rankDropResult,
  { 1: 1 },
  'dropping a player onto a rank slot should return the updated ranking'
);
assert.equal(
  rankUpdates.length,
  0,
  'rank drop helper should not emit ranking:updated before the caller commits ranking state'
);

const malformedRankSlot = new FakeNode('article');
malformedRankSlot.dataset.rank = '1bad';
const existingRanking = { 1: 1, 2: 2 };
assert.deepEqual(
  handleRankDrop(
    malformedRankSlot,
    { id: 3, name: '丙', team: 2 },
    existingRanking
  ),
  existingRanking,
  'rank drop should reject malformed rank datasets instead of parseInt-coercing them'
);

const outOfRangeRankSlot = new FakeNode('article');
outOfRangeRankSlot.dataset.rank = '9';
assert.deepEqual(
  handleRankDrop(
    outOfRangeRankSlot,
    { id: 3, name: '丙', team: 2 },
    existingRanking
  ),
  existingRanking,
  'rank drop should reject out-of-range rank datasets'
);

state.setCurrentRanking(rankDropResult);
emit('ranking:updated');

assert.deepEqual(
  rankUpdates,
  [{ 1: 1 }],
  'rank drop caller should emit ranking:updated after state contains the updated ranking'
);

state.setCurrentRanking({ 1: 1, 2: 2, 3: 3, 4: 4 });
renderRankingArea('4');
const firstFilledSlot = rankingArea.querySelectorAll('.rank-slot')[0];
assert.equal(
  firstFilledSlot.listeners.touchstart?.length,
  1,
  'filled ranking slot should bind one touchstart handler on initial render'
);
renderRankingSlots();
assert.equal(
  firstFilledSlot.listeners.touchstart?.length,
  1,
  'rerendering a filled ranking slot should replace, not stack, touchstart handlers'
);

const sameSlotUpdates = [];
clear('ranking:updated');
onEvent('ranking:updated', () => {
  sameSlotUpdates.push(state.getCurrentRanking());
});
setDraggedPlayer({ id: 1, name: '甲', team: 1 });
firstFilledSlot.ondrop({
  preventDefault() {}
});
setDraggedPlayer(null);
assert.deepEqual(
  state.getCurrentRanking(),
  { 1: 1, 2: 2, 3: 3, 4: 4 },
  'dropping a ranked player onto their current slot should leave ranking unchanged'
);
assert.equal(
  sameSlotUpdates.length,
  0,
  'dropping a ranked player onto their current slot should not emit ranking:updated'
);

clear('ranking:updated');
const touchSameSlotUpdates = [];
onEvent('ranking:updated', () => {
  touchSameSlotUpdates.push(state.getCurrentRanking());
});
globalThis.document.elementFromPoint = () => firstFilledSlot;
handleTouchStart(
  {
    target: firstFilledSlot,
    currentTarget: firstFilledSlot,
    touches: [{ clientX: 20, clientY: 20 }],
    preventDefault() {}
  },
  { id: 1, name: '甲', team: 1 }
);
await new Promise(resolve => setTimeout(resolve, 230));
const sameSlotTouchDropTarget = handleTouchEnd({
  changedTouches: [{ clientX: 20, clientY: 20 }],
  preventDefault() {},
  stopPropagation() {}
});
assert.equal(
  sameSlotTouchDropTarget?.type,
  'rank',
  'touch-dropping a ranked player onto their current slot should still recognize the rank target'
);
assert.equal(
  touchSameSlotUpdates.length,
  0,
  'touch-dropping a ranked player onto their current slot should not emit ranking:updated'
);

state.setCurrentRanking({ 2: 2, 3: 3, 4: 4 });
renderRankingSlots();
setDraggedPlayer({ id: 1, name: '甲', team: 1 });
firstFilledSlot.ondrop({
  preventDefault() {}
});
setDraggedPlayer(null);
assert.deepEqual(
  state.getCurrentRanking(),
  { 1: 1, 2: 2, 3: 3, 4: 4 },
  'a repainted empty rank slot should not keep a stale filled-slot drop closure'
);

state.setCurrentRanking({});
clear('ranking:updated');
const poolNoopUpdates = [];
onEvent('ranking:updated', () => {
  poolNoopUpdates.push(state.getCurrentRanking());
});
setDraggedPlayer({ id: 1, name: '甲', team: 1 });
playerPool.ondrop({
  preventDefault() {}
});
setDraggedPlayer(null);
assert.deepEqual(
  state.getCurrentRanking(),
  {},
  'dropping an unranked player back into the pool should leave ranking unchanged'
);
assert.equal(
  poolNoopUpdates.length,
  0,
  'dropping an unranked player back into the pool should not emit ranking:updated'
);

playerPool.appendChild(poolChild);
globalThis.document.elementFromPoint = () => poolChild;

const updatedRankings = [];
state.setCurrentRanking({ 1: 1, 2: 2, 3: 3, 4: 4 });
clear('ranking:updated');
onEvent('ranking:updated', () => {
  updatedRankings.push(state.getCurrentRanking());
});

const draggedTile = new FakeNode('article');
draggedTile.dataset.playerId = '2';

handleTouchStart(
  {
    target: draggedTile,
    currentTarget: draggedTile,
    touches: [{ clientX: 20, clientY: 20 }],
    preventDefault() {}
  },
  { id: 2, name: '乙', team: 1 }
);

await new Promise(resolve => setTimeout(resolve, 230));

const dropTarget = handleTouchEnd({
  changedTouches: [{ clientX: 20, clientY: 20 }],
  preventDefault() {},
  stopPropagation() {}
});

assert.equal(dropTarget?.type, 'pool', 'touch drop should recognize the player pool as the drop target');
assert.deepEqual(
  state.getCurrentRanking(),
  { 1: 1, 3: 3, 4: 4 },
  'touch-dropping a ranked player back to the pool should remove that player from ranking'
);
assert.equal(
  updatedRankings.length,
  1,
  'touch-dropping a ranked player back to the pool should emit ranking:updated for UI rerender'
);
assert.deepEqual(
  updatedRankings[0],
  { 1: 1, 3: 3, 4: 4 },
  'ranking:updated should fire after state contains the updated ranking'
);

state.setPlayers([
  { id: 1, name: '甲', team: 1 },
  { id: 2, name: '乙', team: 1 },
  { id: 3, name: '丙', team: null },
  { id: 4, name: '丁', team: 2 }
]);
const malformedTeamZone = new FakeNode('section');
malformedTeamZone.className = 'team-drop-zone';
malformedTeamZone.dataset.team = '1bad';
const malformedTeamChild = new FakeNode('article');
malformedTeamZone.appendChild(malformedTeamChild);
globalThis.document.elementFromPoint = () => malformedTeamChild;

const unassignedTile = new FakeNode('article');
handleTouchStart(
  {
    target: unassignedTile,
    currentTarget: unassignedTile,
    touches: [{ clientX: 20, clientY: 20 }],
    preventDefault() {}
  },
  { id: 3, name: '丙', team: null }
);

await new Promise(resolve => setTimeout(resolve, 230));

const malformedTeamDropTarget = handleTouchEnd({
  changedTouches: [{ clientX: 20, clientY: 20 }],
  preventDefault() {},
  stopPropagation() {}
});

assert.equal(
  malformedTeamDropTarget,
  null,
  'touch drop should ignore malformed team zone datasets'
);
assert.equal(
  state.getPlayers().find(player => player.id === 3)?.team,
  null,
  'touch drop should not parseInt-coerce malformed team datasets into team assignments'
);

const gameControlsSource = readFileSync(
  new URL('../../src/controllers/gameControls.js', import.meta.url),
  'utf8'
);
const rankingRendererSource = readFileSync(
  new URL('../../src/ranking/rankingRenderer.js', import.meta.url),
  'utf8'
);
assert.equal(
  gameControlsSource.includes("JSON.parse(tile.dataset.playerData || '{}')"),
  false,
  'touch handler attachment should not directly parse playerData without a malformed-DOM guard'
);
assert.equal(
  gameControlsSource.includes('parseInt(tile.dataset.playerId)'),
  false,
  'touch handler attachment should not parseInt-coerce malformed ranking player ids'
);
assert.equal(
  rankingRendererSource.includes('parseInt(slot.dataset.rank'),
  false,
  'ranking renderer should not parseInt-coerce malformed rank slot datasets'
);
assert.equal(
  rankingRendererSource.includes("parseInt(slot.dataset.rankMode || '8')"),
  false,
  'ranking renderer should not parseInt-coerce malformed rank mode datasets'
);

console.log('drag/drop event checks passed');
