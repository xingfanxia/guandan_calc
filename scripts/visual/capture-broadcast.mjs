/**
 * Visual smoke-capture for Phase 0 + Phase 1.
 *
 * Captures 4 routes × 2 viewports (8 PNGs) of the running dev server and saves
 * them to docs/reports/phase0-1-visual/. Used by the agent for visual diff
 * against the locked Broadcast demo (docs/design/demos/demo-broadcast-v3.html).
 *
 * Usage: with the Vite dev server running on :3000,
 *   node scripts/visual/capture-broadcast.mjs
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT_DIR = resolve('docs/reports/phase0-1-visual');
const BASE = process.env.BASE_URL || 'http://localhost:3000';

const ROUTES = [
  { name: 'index',          path: '/' },
  { name: 'players',        path: '/players.html' },
  { name: 'rooms',          path: '/rooms.html' },
  { name: 'player-profile', path: '/player-profile.html?handle=test_hao' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800,  deviceScaleFactor: 1 },
  { name: 'mobile',  width: 390,  height: 844,  deviceScaleFactor: 2 },
];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: vp.name === 'mobile',
  });
  const page = await ctx.newPage();

  // Surface console errors so we catch theme-mount issues even if visuals look fine.
  const errors = [];
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });

  for (const route of ROUTES) {
    const url = `${BASE}${route.path}`;
    process.stdout.write(`▸ ${vp.name} · ${route.name} `);

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      // Wait for Google Fonts to render so Fraunces actually applies.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300); // tiny settle for late JS renders
    } catch (err) {
      console.log(`✗ navigation: ${err.message}`);
      continue;
    }

    const out = `${OUT_DIR}/${route.name}-${vp.name}.png`;
    await page.screenshot({ path: out, fullPage: true });
    console.log(`✓ ${out.replace(process.cwd() + '/', '')}`);
  }

  if (errors.length) {
    console.log(`\n[${vp.name}] console/page errors:`);
    for (const e of errors) console.log('   ' + e);
  }
  await ctx.close();
}

await browser.close();
console.log('\n✓ capture complete');
