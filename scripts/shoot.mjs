/**
 * Screenshot the app for the README.
 *   npm run dev   (port 5199)
 *   node scripts/shoot.mjs
 * Environment: SHOOT_URL, SHOOT_OUT, SHOOT_JOURNEY, SHOOT_VIEW (field|focus|3d)
 */
import { chromium } from 'playwright';

const URL = process.env.SHOOT_URL || 'http://localhost:5199/app.html';
const OUT = process.env.SHOOT_OUT || 'docs/screenshot_app.png';
const JOURNEY = process.env.SHOOT_JOURNEY || 'ocean';
const VIEW = process.env.SHOOT_VIEW || '3d';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 2 });
await page.goto(URL, { waitUntil: 'networkidle' });

await page.click('#start-journey');
await page.waitForTimeout(3000);

await page.evaluate(async ({ journey, view }) => {
  await window.__app.loadJourney(journey);
  const grid = window.__app.canvasGrid;
  if (view === '3d') {
    document.getElementById('view-3d-btn').click();
    grid._targetYaw = -22;
  }
}, { journey: JOURNEY, view: VIEW });
await page.waitForTimeout(2500);

// Park the playhead where the journey is busiest and select a moving source
// so its keyframe path is on screen.
await page.evaluate(() => {
  const app = window.__app;
  app.timeline.pause();
  app.timeline.playheadTime = app.timeline.totalDuration * 0.5;
  app.timeline._applyKeyframes();
  app.timeline._updatePlayhead();
  const ids = [...app.audioEngine.sources.keys()];
  const pick = ids.find(id => /whale|monkey|bowl|chime/.test(id)) || ids[0];
  app.canvasGrid.selectedNodeId = pick;
  app.inspector.show(app.audioEngine.sources.get(pick));
  app.timeline._render();
  app.canvasGrid.draw();
});
await page.waitForTimeout(1200);

await page.screenshot({ path: OUT });
await browser.close();
console.log('saved', OUT);
