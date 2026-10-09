#!/usr/bin/env node
// Renders the REMATCH mark into every app and web icon.
//
//   node scripts/generate-icons.mjs
//
// The mark is two offset discs: a solid one (you) ahead of an outlined one
// (past you). It is drawn here as SVG and rasterised with Playwright, so the
// icons can be regenerated after any brand change without design tools.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';

const BG = '#09090B';
const ACCENT = '#D6F45B';
const GHOST = '#5A5A62';

/** The mark on a 1024 canvas. `scale` shrinks it for adaptive-icon safe zones. */
function mark({ background = BG, scale = 1, mono = false } = {}) {
  const r = 196 * scale;
  const offset = 92 * scale;
  const c = 512;
  const fill = mono ? '#FFFFFF' : ACCENT;
  const ghost = mono ? '#FFFFFF' : GHOST;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${background ? `<rect width="1024" height="1024" fill="${background}"/>` : ''}
  <circle cx="${c + offset}" cy="${c + offset}" r="${r - 14 * scale}" fill="none" stroke="${ghost}" stroke-width="${28 * scale}"/>
  <circle cx="${c - offset}" cy="${c - offset}" r="${r}" fill="${fill}"/>
</svg>`;
}

const outputs = [
  { file: 'assets/icon.png', size: 1024, svg: mark() },
  { file: 'assets/splash-icon.png', size: 1024, svg: mark({ background: null, scale: 0.6 }) },
  { file: 'assets/favicon.png', size: 48, svg: mark({ scale: 1.15 }) },
  { file: 'assets/android-icon-foreground.png', size: 1024, svg: mark({ background: null, scale: 0.62 }) },
  { file: 'assets/android-icon-background.png', size: 1024, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${BG}"/></svg>` },
  { file: 'assets/android-icon-monochrome.png', size: 1024, svg: mark({ background: null, scale: 0.62, mono: true }) },
  { file: 'public/icon-512.png', size: 512, svg: mark() },
  { file: 'public/icon-192.png', size: 192, svg: mark() },
  { file: 'public/apple-touch-icon.png', size: 180, svg: mark() },
  { file: 'docs/readme/mark.svg', svg: mark({ background: null }) },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage();
  for (const out of outputs) {
    const path = resolve(out.file);
    mkdirSync(dirname(path), { recursive: true });
    if (out.file.endsWith('.svg')) {
      writeFileSync(path, out.svg);
    } else {
      await page.setViewportSize({ width: out.size, height: out.size });
      await page.setContent(`<html><body style="margin:0;background:transparent">${out.svg.replace('width="1024" height="1024"', `width="${out.size}" height="${out.size}"`)}</body></html>`);
      await page.screenshot({ path, omitBackground: true, clip: { x: 0, y: 0, width: out.size, height: out.size } });
    }
    console.log('✓', out.file);
  }
} finally {
  await browser.close();
}
