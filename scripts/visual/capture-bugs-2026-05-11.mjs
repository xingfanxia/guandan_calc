// Reproduce + verify the 3 visual bugs reported 2026-05-11.
//   Bug 1 — broken roster-row tile in scoreboard team zone (Trading mobile)
//   Bug 2 — pool/slots panel heights don't align (all themes, desktop + mobile)
//   Bug 3 — history rows show only number ranks (all themes)
//
// Captures BOTH desktop (1280) and mobile (390) for every theme + every surface.
// Outputs to docs/reports/bug-fix-2026-05-11/<theme>/{desktop,mobile}/.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';
import { setDeterministicPlayers, freezeTime } from './_fixtures.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const REPORT_DIR = path.join(ROOT, 'docs/reports/bug-fix-2026-05-11');

const THEMES = ['broadcast', 'linear', 'trading', 'atelier', 'teatable'];
const TAG = process.env.BUG_TAG || 'before';

const URL = 'http://localhost:3000/';

await mkdir(REPORT_DIR, { recursive: true });

const browser = await chromium.launch();

for (const theme of THEMES) {
  for (const view of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile',  width: 390,  height: 844 }
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      deviceScaleFactor: 2
    });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept());

    await freezeTime(page);
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => localStorage.setItem('gd_v9_theme', t), theme);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#mode', { state: 'attached', timeout: 5000 });

    // 8-player mode (force=true since the native select is hidden by the
    // theme-skinned modeselect; the underlying select still drives change
    // events so this works fine in capture context).
    await page.selectOption('#mode', '8', { force: true });
    await page.waitForTimeout(200);
    await page.click('#generatePlayers');
    await page.waitForTimeout(300);
    const shuffleBtn = await page.$('#shuffleTeams');
    if (shuffleBtn) await shuffleBtn.click();
    await page.waitForTimeout(200);
    await setDeterministicPlayers(page, 8);

    // Inject 8 profile players (team-assigned) — replicates the user's
    // real screenshot which had handle-bearing players in the team zone.
    await page.evaluate(async () => {
      const stateMod = await import('/src/core/state.js');
      const playerMgrMod = await import('/src/player/playerManager.js');
      const evtMod = await import('/src/core/events.js');
      const players = playerMgrMod.getPlayers();
      const handles = ['xiaoxiao', 'olivia', 'znf', 'axax', 'jiaqicao', 'yichao', 'xufeng', 'fzy'];
      const names = ['小小', '奥利薇', '志楠', 'AX', '佳奇', '宜超', '徐枫', '夫子'];
      players.forEach((p, i) => {
        p.handle = handles[i];
        p.name = names[i];
      });
      stateMod.default.setPlayers(players);
      evtMod.emit('player:teamsShuffled', { players });
    });

    // Seed history so Bug 3 shows
    await page.evaluate(async () => {
      const stateMod = await import('/src/core/state.js');
      const histMod = await import('/src/game/history.js');
      const playerMgrMod = await import('/src/player/playerManager.js');
      const players = playerMgrMod.getPlayers();
      const team1Ids = players.filter(p => p.team === 1).map(p => p.id);
      const team2Ids = players.filter(p => p.team === 2).map(p => p.id);

      // 2 rounds with playerRankings carrying team membership per rank
      const buildRanking = (winnerSide) => {
        const winners = winnerSide === 1 ? team1Ids : team2Ids;
        const losers = winnerSide === 1 ? team2Ids : team1Ids;
        const order = [winners[0], winners[1], losers[0], winners[2], losers[1], losers[2], winners[3], losers[3]];
        const out = {};
        order.forEach((pid, idx) => {
          const p = players.find(x => x.id === pid);
          out[idx + 1] = { id: pid, name: p.name, emoji: p.emoji, team: p.team, handle: p.handle };
        });
        return out;
      };

      const fakeHistory = [
        { ts: '12:00', mode: '8', win: '红', winKey: 't2', combo: '1, 2, 4, 7', up: 2, t1: '2', t2: '4', round: '2', aNote: '', prevT1Lvl: '2', prevT2Lvl: '2', prevT1A: 0, prevT2A: 0, prevRound: '2', prevRoundOwner: null, playerRankings: buildRanking(2) },
        { ts: '12:14', mode: '8', win: '蓝', winKey: 't1', combo: '1, 3, 6, 8', up: 0, t1: '2', t2: '4', round: '4', aNote: '', prevT1Lvl: '2', prevT2Lvl: '4', prevT1A: 0, prevT2A: 0, prevRound: '4', prevRoundOwner: 't2', playerRankings: buildRanking(1) },
      ];
      stateMod.default.setHistory(fakeHistory);
      stateMod.default.setTeamLevel('t1', '2');
      stateMod.default.setTeamLevel('t2', '4');
      stateMod.default.setRoundLevel('4');
      stateMod.default.setRoundOwner('t1');
      histMod.renderHistory();
    });

    // Switch to manual ranking mode so pool + slots show
    await page.evaluate(async () => {
      const renderer = await import('/src/ranking/rankingRenderer.js');
      const modeEl = document.getElementById('mode');
      const mode = parseInt(modeEl?.value || '8', 10);
      const manual = document.getElementById('rankingModeManual');
      if (manual) manual.checked = true;
      renderer.renderRankingArea(mode);
    });
    await page.waitForTimeout(300);

    const themeDir = path.join(REPORT_DIR, theme, view.name);
    await mkdir(themeDir, { recursive: true });

    // Full page (proves what the user sees end-to-end)
    await page.screenshot({
      path: path.join(themeDir, `${TAG}-fullpage.png`),
      fullPage: true
    });

    // Targeted: scoreboard (Bug 1) — capture #mainScoreboard which contains
    // the team panels with .team__roster (this is where the broken roster
    // tiles live). Don't fall back to .activegame — that's the pool/slots panel.
    const sb = await page.$('section.scorer');
    if (sb) {
      await sb.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      await sb.screenshot({ path: path.join(themeDir, `${TAG}-scoreboard.png`) });
    }

    // Targeted: pool + slots (Bug 2)
    const pool = await page.$('.pool, #playerListWrap');
    const slots = await page.$('.slots, #rankingSlots');
    if (pool && slots) {
      const elem = await page.evaluateHandle(() => {
        const p = document.querySelector('.pool, #playerListWrap');
        return p ? p.parentElement : null;
      });
      if (elem) {
        const eh = elem.asElement();
        if (eh) {
          await eh.scrollIntoViewIfNeeded();
          await page.waitForTimeout(150);
          await eh.screenshot({ path: path.join(themeDir, `${TAG}-pool-slots.png`) });
        }
      }
    }

    // Targeted: history (Bug 3)
    const hist = await page.$('#histBody, .history');
    if (hist) {
      await hist.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      const histContainer = await page.evaluateHandle(() => {
        return document.querySelector('#histBody')?.closest('.card, .panel, section, .history');
      });
      const hc = histContainer?.asElement?.();
      const target = hc || hist;
      await target.screenshot({ path: path.join(themeDir, `${TAG}-history.png`) });
    }

    await ctx.close();
    console.log(`✓ ${theme} ${view.name}`);
  }
}

await browser.close();
console.log(`\nWrote screenshots to ${REPORT_DIR}/`);
