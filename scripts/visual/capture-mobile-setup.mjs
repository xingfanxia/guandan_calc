// Quick mobile-setup capture — verifies the team-drop-zone (拖拽玩家到这里分配队伍)
// and player pool now fit on one mobile viewport for all three themes. No
// game state is seeded; this is the empty-setup view the user lands on.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const OUT = path.join(ROOT, 'docs/reports/mobile-setup-2026-05-04');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());

for (const theme of ['broadcast', 'linear', 'trading']) {
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => { localStorage.setItem('gd_v9_theme', t); localStorage.removeItem('gd_v9_state'); }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#mode', { timeout: 5000 });
  await page.selectOption('#mode', '6');
  await page.waitForTimeout(200);
  await page.click('#generatePlayers');
  await page.waitForTimeout(400);
  // Clear any auto-team-assignment so team drop-zones show their empty placeholder
  await page.evaluate(async () => {
    const stateMod = await import('/src/core/state.js');
    const playerMgrMod = await import('/src/player/playerManager.js');
    const renderMod = await import('/src/player/playerRenderer.js');
    const players = playerMgrMod.getPlayers();
    players.forEach(p => { p.team = null; });
    renderMod.renderPlayers();
    renderMod.renderTeamRosters();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${theme}-setup-mobile.png`), fullPage: true });
  // Scroll to scoreboard — that's what the user actually looks at when
  // dragging players to team drop-zones. Capture ONLY this viewport.
  await page.evaluate(() => {
    const sb = document.querySelector('.scorer');
    if (sb) sb.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -10); // tiny offset so the section header peeks in
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `${theme}-scoreboard-viewport.png`), fullPage: false });
  console.log(`captured ${theme}`);
}
console.log('SAVED:', OUT);
await browser.close();
