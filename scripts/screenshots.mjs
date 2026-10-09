#!/usr/bin/env node
// Captures the README screenshots from the exported web build.
//
//   npm run build:web && npm run serve:web   # in one terminal
//   node scripts/screenshots.mjs [outDir=docs/screenshots] [--url http://localhost:8080] [--hero-only]
//
// It onboards a fresh browser profile, races TEMPEST twice with a fake clock
// so the history, PBs and splits are real, photographs every main screen on a
// phone and a desktop viewport, then composes the README hero from them.
// Set CHROMIUM_PATH to use an existing Chromium instead of Playwright's own.
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const urlFlag = args.indexOf('--url');
const base = urlFlag >= 0 ? args[urlFlag + 1] : 'http://localhost:8080';
const out = resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--url') ?? 'docs/screenshots');
mkdirSync(out, { recursive: true });

const DAY = 24 * 60 * 60 * 1000;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function settle(page, ms = 900) {
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await wait(ms);
}

async function shot(page, name) {
  await settle(page);
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log('  ✓', name);
}

async function go(page, path) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await settle(page);
}

async function tap(page, name) {
  try {
    await page.getByRole('button', { name }).first().click({ timeout: 15000 });
  } catch (error) {
    await page.screenshot({ path: join(out, '_failed.png') });
    throw error;
  }
  await settle(page, 500);
}

/** One full TEMPEST attempt, driven by the keyboard. `pace(i)` is seconds per movement. */
async function race(page, pace, { snapshotAt, snapshotName } = {}) {
  await page.clock.fastForward(5000);
  await settle(page, 600);
  for (let i = 0; i < 15; i++) {
    await page.clock.fastForward(Math.round(pace(i) * 1000));
    await wait(250);
    if (snapshotAt === i) await shot(page, snapshotName);
    await page.keyboard.press('Space');
    await wait(400);
  }
  // A press can land while the previous step is still being written; finish any stragglers.
  for (let i = 0; i < 5 && !page.url().includes('/workout/result'); i++) {
    await page.clock.fastForward(3000);
    await page.keyboard.press('Space');
    await wait(900);
  }
  await settle(page, 1500);
}

async function capture(kind, viewport, scale) {
  console.log(`${kind} ${viewport.width}×${viewport.height}`);
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, colorScheme: 'dark', reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.clock.install({ time: Date.now() - 6 * DAY });
  await page.goto(base);
  await settle(page, 2500);

  await shot(page, `${kind}-onboarding`);
  await tap(page, /first challenge/i);

  // Attempt one, a few days ago: steady and a little slow.
  await go(page, '/workout/w-tempest');
  await tap(page, /start first attempt/i);
  await race(page, (i) => [34, 31, 29][i % 3] + Math.floor(i / 3) * 2);
  await tap(page, /^done$/i);

  // Attempt two, today: faster early, fading late. Photograph the live race.
  await page.clock.fastForward(5 * DAY);
  await go(page, '/workout/w-tempest');
  await shot(page, `${kind}-workout`);
  await tap(page, /rematch your best/i);
  await page.clock.fastForward(1200);
  await shot(page, `${kind}-countdown`);
  await race(page, (i) => [30, 28, 27][i % 3] + Math.floor(i / 3) * 2.6, { snapshotAt: 7, snapshotName: `${kind}-active` });
  await shot(page, `${kind}-result`);
  await tap(page, /^done$/i);

  await go(page, '/today');
  await shot(page, `${kind}-today`);
  await go(page, '/library');
  await shot(page, `${kind}-library`);
  await go(page, '/exercises');
  await shot(page, `${kind}-exercises`);
  await go(page, '/exercise/burpee');
  await shot(page, `${kind}-exercise`);
  await go(page, '/progress');
  await shot(page, `${kind}-progress`);
  await go(page, '/program/p-first-rematch');
  await shot(page, `${kind}-program`);
  await go(page, '/profile');
  await shot(page, `${kind}-profile`);
  await context.close();
}

/** Three phones on the brand canvas, for the top of the README. */
async function hero() {
  const img = (name) => `data:image/png;base64,${readFileSync(join(out, `phone-${name}.png`)).toString('base64')}`;
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html><head><style>
    @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600;700&family=Inter:wght@400;500&display=block');
    body { margin: 0; width: 1600px; height: 900px; background: #09090B; font-family: Inter, sans-serif; color: #F4F4F1; overflow: hidden; display: flex; align-items: center; }
    .copy { width: 540px; box-sizing: border-box; padding-left: 96px; flex-shrink: 0; }
    .mark { position: relative; width: 22px; height: 22px; display: inline-block; vertical-align: -3px; margin-right: 12px; }
    .mark i { position: absolute; width: 14px; height: 14px; border-radius: 50%; }
    .mark i:first-child { right: 0; bottom: 0; border: 1.5px solid #6A6A72; box-sizing: border-box; }
    .mark i:last-child { left: 0; top: 0; background: #D6F45B; }
    .brand { font: 700 20px 'Inter Tight'; letter-spacing: 1.5px; }
    h1 { font: 700 84px/0.98 'Inter Tight'; letter-spacing: -3.5px; margin: 56px 0 24px; }
    p { font-size: 21px; line-height: 1.5; color: #A1A1A8; margin: 0; max-width: 420px; }
    .phones { position: relative; flex: 1; height: 900px; }
    .phone { position: absolute; width: 300px; border-radius: 44px; padding: 9px; background: #1A1A1D; box-shadow: 0 0 0 1px #2E2E33, 0 40px 80px rgba(0,0,0,.6); }
    .phone img { display: block; width: 100%; border-radius: 36px; }
    .a { left: 20px; top: 150px; } .b { left: 340px; top: 70px; } .c { left: 660px; top: 190px; }
  </style></head><body>
    <div class="copy"><span class="mark"><i></i><i></i></span><span class="brand">REMATCH</span>
      <h1>You vs.<br/>you.</h1>
      <p>Every finished workout becomes a live opponent. Race your own splits and see exactly where you won or lost it.</p></div>
    <div class="phones">
      <div class="phone a"><img src="${img('today')}"/></div>
      <div class="phone b"><img src="${img('active')}"/></div>
      <div class="phone c"><img src="${img('result')}"/></div>
    </div>
  </body></html>`);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(out, 'hero.png') });
  console.log('  ✓ hero');
  await page.close();
}

try {
  if (!args.includes('--hero-only')) {
    await capture('phone', { width: 393, height: 852 }, 2);
    await capture('desktop', { width: 1280, height: 800 }, 2);
  }
  await hero();
} finally {
  await browser.close();
}
