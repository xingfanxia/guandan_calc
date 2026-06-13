import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('dialog', (d) => d.accept());
await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.click('#quickStart');
await page.waitForTimeout(300);
// Show victory modal directly (same path as capture script)
await page.evaluate(async () => {
  const modal = await import('/src/ui/victoryModal.js');
  modal.showVictoryModal('t1');
});
await page.waitForTimeout(600);
const v = await page.evaluate(() => {
  const m = document.getElementById('victoryModal');
  const btns = [...m.querySelectorAll('.victory-modal__actions button')].map(b => [b.textContent.trim(), getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().height > 0]);
  return { display: m.style.display, teamName: document.getElementById('victoryTeamName')?.textContent, btns };
});
console.log('victory modal:', JSON.stringify(v));
// close button (global closeVictoryModal via inline onclick)
await page.click('#victoryModal .victory-modal__actions button:last-child');
await page.waitForTimeout(300);
const closed = await page.evaluate(() => document.getElementById('victoryModal').style.display);
console.log('after close:', closed);
console.log('errors:', errs.length ? errs.slice(0, 3) : 'none');
await browser.close();
