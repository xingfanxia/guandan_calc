import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const exportMobileSource = readFileSync(resolve(repoRoot, 'src/export/exportMobile.js'), 'utf8');

assert.ok(
  exportMobileSource.includes('normalizeTeamNumber'),
  'mobile export should normalize player team values before winner roster/stat color decisions'
);
assert.equal(
  /p\.team\s*===\s*winnerTeam|player\.team\s*===\s*[12]/.test(exportMobileSource),
  false,
  'mobile export should not use strict numeric team comparisons on raw player.team'
);

const localStore = new Map();
const imageSources = [];

globalThis.window = {
  location: {
    origin: 'http://localhost'
  },
  addEventListener() {},
  removeEventListener() {}
};

globalThis.localStorage = {
  getItem(key) {
    return localStore.has(key) ? localStore.get(key) : null;
  },
  setItem(key, value) {
    localStore.set(key, String(value));
  },
  removeItem(key) {
    localStore.delete(key);
  }
};

class FakeImage {
  set src(value) {
    this._src = value;
    imageSources.push(value);
    queueMicrotask(() => this.onload?.());
  }
  get src() {
    return this._src;
  }
}

globalThis.Image = FakeImage;

const contextCalls = [];
const createContext = () => ({
  fillStyle: '',
  strokeStyle: '',
  font: '',
  textAlign: 'left',
  lineWidth: 1,
  fillRect(...args) { contextCalls.push(['fillRect', ...args]); },
  fillText(...args) { contextCalls.push(['fillText', ...args]); },
  measureText(text) { return { width: String(text).length * 8 }; },
  beginPath() { contextCalls.push(['beginPath']); },
  arc(...args) { contextCalls.push(['arc', ...args]); },
  closePath() { contextCalls.push(['closePath']); },
  clip() { contextCalls.push(['clip']); },
  drawImage(...args) { contextCalls.push(['drawImage', ...args]); },
  save() { contextCalls.push(['save']); },
  restore() { contextCalls.push(['restore']); },
  stroke() { contextCalls.push(['stroke']); }
});

const makeCanvas = () => ({
  width: 0,
  height: 0,
  getContext() {
    return createContext();
  },
  toDataURL() {
    return 'data:image/png;base64,ZmFrZQ==';
  }
});

let clickedDownload = null;
const documentElements = new Map();

globalThis.HTMLAnchorElement = class {};
globalThis.document = {
  documentElement: {},
  body: {
    appendChild() {}
  },
  createElement(tagName) {
    if (tagName === 'canvas') return makeCanvas();
    if (tagName === 'a') {
      return {
        href: '',
        download: '',
        click() {
          clickedDownload = this.download;
        }
      };
    }
    return {
      className: '',
      textContent: '',
      appendChild() {},
      remove() {}
    };
  },
  getElementById(id) {
    if (id === 'exportTip') {
      if (!documentElements.has(id)) documentElements.set(id, { textContent: '' });
      return documentElements.get(id);
    }
    return documentElements.get(id) || null;
  },
  querySelectorAll() {
    return [];
  },
  addEventListener() {},
  removeEventListener() {},
  hidden: false
};

globalThis.getComputedStyle = () => ({
  getPropertyValue() {
    return '';
  }
});

const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => {
  warnings.push(args.map(String).join(' '));
};

try {
  const state = (await import('../../src/core/state.js')).default;
  const { exportMobilePNG } = await import('../../src/export/exportMobile.js');

  state.setPlayers([
    {
      id: 1,
      name: 'Photo MVP',
      emoji: 'P',
      team: 1,
      tagline: 'photo path',
      photoBase64: 'data:image/png;base64,ZmFrZQ=='
    },
    { id: 2, name: 'Blue Two', emoji: 'B', team: 1 },
    { id: 3, name: 'Red One', emoji: 'R', team: 2 },
    { id: 4, name: 'Red Two', emoji: 'D', team: 2 }
  ]);
  state.setPlayerStats({
    1: { games: 2, totalRank: 2, firstPlaceCount: 2, lastPlaceCount: 0, rankings: [1, 1] },
    2: { games: 2, totalRank: 6, firstPlaceCount: 0, lastPlaceCount: 0, rankings: [3, 3] },
    3: { games: 2, totalRank: 7, firstPlaceCount: 0, lastPlaceCount: 1, rankings: [4, 3] },
    4: { games: 2, totalRank: 8, firstPlaceCount: 0, lastPlaceCount: 2, rankings: [4, 4] }
  });
  state.setHistory([
    {
      ts: '12:00',
      mode: '4',
      win: '蓝队',
      winKey: 't1',
      combo: '1,2',
      up: 0,
      t1: 'A',
      t2: '7',
      round: 'A',
      aNote: 'A级通关',
      gameStatus: { ended: true, winnerKey: 't1', winnerName: '蓝队', reason: 'strict-a-clear' }
    }
  ]);
  state.setRoundLevel('A');

  await exportMobilePNG();

  assert.equal(clickedDownload, '掼蛋战绩_手机版_v10.png');
  assert.equal(
    warnings.some(message => message.includes('Failed to draw photo')),
    false,
    'mobile PNG export should draw profile photos without falling back to emoji'
  );
  assert.ok(
    contextCalls.some(([name]) => name === 'drawImage'),
    'mobile PNG export should draw the MVP image'
  );

  contextCalls.length = 0;
  imageSources.length = 0;
  documentElements.clear();
  state.resetAll();

  state.setPlayers([
    {
      id: 1,
      name: 'Unsafe Photo MVP',
      emoji: 'U',
      team: 1,
      handle: 'unsafe_mvp',
      tagline: 'unsafe path',
    },
    { id: 2, name: 'Blue Two', emoji: 'B', team: 1 },
    { id: 3, name: 'Red One', emoji: 'R', team: 2 },
    { id: 4, name: 'Red Two', emoji: 'D', team: 2 }
  ]);
  state.setPlayerStats({
    1: { games: 2, totalRank: 2, firstPlaceCount: 2, lastPlaceCount: 0, rankings: [1, 1] },
    2: { games: 2, totalRank: 6, firstPlaceCount: 0, lastPlaceCount: 0, rankings: [3, 3] },
    3: { games: 2, totalRank: 7, firstPlaceCount: 0, lastPlaceCount: 1, rankings: [4, 3] },
    4: { games: 2, totalRank: 8, firstPlaceCount: 0, lastPlaceCount: 2, rankings: [4, 4] }
  });
  state.setHistory([
    {
      ts: '12:10',
      mode: '4',
      win: '蓝队',
      winKey: 't1',
      combo: '1,2',
      up: 0,
      t1: 'A',
      t2: '7',
      round: 'A',
      aNote: 'A级通关',
      gameStatus: { ended: true, winnerKey: 't1', winnerName: '蓝队', reason: 'strict-a-clear' }
    }
  ]);
  state.setRoundLevel('A');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.ok(
      String(url).includes('/api/players/unsafe_mvp'),
      `unsafe photo export scenario should only fetch unsafe_mvp profile, got ${url}`
    );
    return new Response(JSON.stringify({
      success: true,
      player: {
        handle: 'unsafe_mvp',
        displayName: 'Unsafe Photo MVP',
        emoji: 'U',
        tagline: 'unsafe path',
        playStyle: 'steady',
        photoBase64: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    await exportMobilePNG();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(
    imageSources.some(src => String(src).startsWith('data:image/svg+xml')),
    false,
    'mobile PNG export should not load unsafe legacy SVG photo data'
  );
  assert.ok(
    contextCalls.some(([name, text]) => name === 'fillText' && text === 'MVP U Unsafe Photo MVP'),
    'mobile PNG export should fall back to emoji when profile photo data is unsafe'
  );

  contextCalls.length = 0;
  documentElements.clear();
  state.resetAll();

  const honorPlayers = [
    { id: 1, name: '统治者', emoji: 'A', team: 1 },
    { id: 2, name: '低迷者', emoji: 'B', team: 2 },
    { id: 3, name: '逆转者', emoji: 'C', team: 1 },
    { id: 4, name: '大波动', emoji: 'D', team: 2 },
    { id: 5, name: '中游锚', emoji: 'E', team: 1 },
    { id: 6, name: '万年二', emoji: 'F', team: 2 }
  ];
  state.setPlayers(honorPlayers);
  state.setPlayerStats({
    1: { games: 6, totalRank: 9, firstPlaceCount: 3, lastPlaceCount: 0, rankings: [1, 2, 1, 2, 1, 2] },
    2: { games: 6, totalRank: 33, firstPlaceCount: 0, lastPlaceCount: 3, rankings: [6, 5, 6, 5, 6, 5] },
    3: { games: 6, totalRank: 21, firstPlaceCount: 1, lastPlaceCount: 1, rankings: [6, 5, 4, 3, 2, 1] },
    4: { games: 6, totalRank: 21, firstPlaceCount: 3, lastPlaceCount: 3, rankings: [1, 6, 1, 6, 1, 6] },
    5: { games: 6, totalRank: 21, firstPlaceCount: 0, lastPlaceCount: 0, rankings: [3, 4, 3, 4, 3, 4] },
    6: { games: 6, totalRank: 12, firstPlaceCount: 0, lastPlaceCount: 0, rankings: [2, 2, 2, 2, 2, 2] }
  });
  state.setHistory([
    {
      ts: '12:30',
      mode: '6',
      win: '蓝队',
      winKey: 't1',
      combo: '1,2',
      up: 2,
      t1: '4',
      t2: '2',
      round: '2'
    }
  ]);

  await exportMobilePNG();

  assert.ok(
    contextCalls.some(([name, text, x]) => name === 'fillText' && text === 'A统治者' && x === 200),
    'mobile PNG export should calculate global session honors from playerStats instead of reading stale DOM text'
  );
} finally {
  console.warn = originalWarn;
}

console.log('mobile photo export checks passed');
