import assert from 'node:assert/strict';

const localStore = new Map();

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
  },
  clear() {
    localStore.clear();
  }
};

globalThis.Image = class {
  set src(value) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
  get src() {
    return this._src;
  }
};

const contextCalls = [];
const makeContext = () => ({
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
    return makeContext();
  },
  toDataURL() {
    return 'data:image/png;base64,ZmFrZQ==';
  }
});

const longCanvas = makeCanvas();
const documentElements = new Map([
  ['longCnv', longCanvas],
  ['exportTip', { textContent: '' }],
  ['mode', { value: '4' }]
]);
let clickedDownload = null;
const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = callback => {
  if (typeof callback === 'function') callback();
  return 0;
};

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
    return documentElements.get(id) || null;
  },
  querySelectorAll() {
    return [];
  },
  addEventListener() {},
  removeEventListener() {}
};

globalThis.getComputedStyle = () => ({
  getPropertyValue() {
    return '';
  }
});

const originalCreateObjectURL = URL.createObjectURL;
const exportedBlobs = [];
URL.createObjectURL = blob => {
  exportedBlobs.push(blob);
  return `blob:export-${exportedBlobs.length}`;
};

try {
  const state = (await import('../../src/core/state.js')).default;
  const {
    exportCSV,
    exportLongPNG,
    exportTXT
  } = await import('../../src/export/exportHandlers.js');
  const { exportMobilePNG } = await import('../../src/export/exportMobile.js');

  state.resetAll();
  state.history = [
    {
      ts: '2026-06-10 20:15:00',
      mode: '4',
      combo: '(1,2)',
      ranks: [1, 2],
      up: 0,
      winKey: 't1',
      t1: 'A',
      t2: 'K',
      round: 'A',
      aNote: '',
      playerRankings: {
        1: { id: 1, name: '蓝一', emoji: 'A', team: 1 },
        2: { id: 2, name: '蓝二', emoji: 'B', team: 1 },
        3: { id: 3, name: '红三', emoji: 'C', team: 2 },
        4: { id: 4, name: '红四', emoji: 'D', team: 2 },
        5: { id: 5, name: '越界', emoji: 'X', team: 1 }
      },
      gameStatus: {
        ended: true,
        winnerKey: 't1',
        winnerName: '蓝队',
        reason: 'A_LEVEL_CLEARED'
      }
    }
  ];
  state.setGameStatus({
    ended: true,
    winnerKey: 't1',
    winnerName: '蓝队',
    reason: 'A_LEVEL_CLEARED'
  });

  exportTXT();
  const txt = await exportedBlobs.at(-1).text();
  assert.match(txt, /蓝队获胜/, 'TXT export should display status-derived winner names');
  assert.equal(txt.includes('undefined获胜'), false, 'TXT export should not print undefined获胜');
  assert.equal(txt.includes('越界'), false, 'TXT export should ignore playerRankings beyond the entry mode');

  exportCSV();
  const csv = await exportedBlobs.at(-1).text();
  assert.match(csv, /蓝队获胜/, 'CSV export should display status-derived winner names');
  assert.equal(csv.includes('undefined获胜'), false, 'CSV export should not print undefined获胜');
  assert.equal(csv.includes('越界'), false, 'CSV export should ignore playerRankings beyond the entry mode');

  contextCalls.length = 0;
  exportLongPNG();
  assert.ok(
    contextCalls.some(([name, text]) => name === 'fillText' && text === '蓝队获胜'),
    'desktop PNG export should display completed status as a win, not as a zero-upgrade round'
  );
  assert.equal(
    contextCalls.some(([, text]) => String(text).includes('undefined')),
    false,
    'desktop PNG export should not draw undefined winner text'
  );
  assert.equal(
    contextCalls.some(([, text]) => String(text).includes('越界')),
    false,
    'desktop PNG export should ignore playerRankings beyond the entry mode'
  );

  contextCalls.length = 0;
  await exportMobilePNG();
  assert.ok(
    contextCalls.some(([name, text]) => name === 'fillText' && text === '🏆 蓝队 A级通关！'),
    'mobile PNG export should display status-derived winner names in the victory header'
  );
  assert.equal(
    contextCalls.some(([, text]) => String(text).includes('undefined')),
    false,
    'mobile PNG export should not draw undefined winner text'
  );
  assert.equal(
    contextCalls.some(([, text]) => String(text).includes('越界')),
    false,
    'mobile PNG export should ignore playerRankings beyond the entry mode'
  );

  assert.equal(clickedDownload, '掼蛋战绩_手机版_v10.png');
} finally {
  globalThis.setTimeout = originalSetTimeout;
  URL.createObjectURL = originalCreateObjectURL;
}

console.log('export winner display checks passed');
