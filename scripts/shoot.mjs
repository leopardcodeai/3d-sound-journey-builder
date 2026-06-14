import { chromium } from 'playwright';

const URL = process.env.SHOOT_URL || 'http://localhost:5199';
const OUT = process.env.SHOOT_OUT || 'docs/screenshot_builder.png';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await page.goto(URL, { waitUntil: 'networkidle' });

// Enter the soundscape
await page.click('#start-btn');
await page.waitForTimeout(3500);

// Load a rich journey and select a keyframed source so the motion path shows
await page.evaluate(() => {
  document.querySelector('.activity-btn[data-preset="underwater"]')?.click();
});
await page.waitForTimeout(3500);

// Clean stage: close flyouts, dismiss the properties panel
await page.evaluate(() => {
  document.querySelectorAll('.flyout').forEach(f => { f.classList.remove('open'); f.style.display = 'none'; });
  document.getElementById('panel-right')?.classList.add('panel-hidden');
  // Select a source with a nice arc so the keyframe path renders on the map
  const cg = window.__app?.canvasGrid;
  if (cg) {
    const ids = [...(window.__app.audioEngine.sources.keys())];
    cg.selectedNodeId = ids.find(i => i.includes('whales')) || ids[0];
  }
});
await page.waitForTimeout(2500);

await page.screenshot({ path: OUT });
await browser.close();
console.log('saved', OUT);
