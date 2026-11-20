// Renders public/og/image.png and public/og/preview.mp4 from the built app using the committed fixture.
// Usage: npm run build && node scripts/make-og.mjs   (needs ffmpeg). Output is committed.
import { readFileSync, mkdtempSync, copyFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { serve } from './lib/static-server.mjs';

const sample = readFileSync('tests/fixtures/usgs-sample.json', 'utf8');
const { server, url } = await serve(resolve('dist'));
const tmp = mkdtempSync(join(tmpdir(), 'lindol-og-'));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, recordVideo: { dir: tmp, size: { width: 1200, height: 630 } } });
await context.clock.setFixedTime(new Date('2026-11-18T05:00:00Z'));
await context.route('https://earthquake.usgs.gov/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: sample }));
const page = await context.newPage();
await page.goto(url);
await page.addStyleTag({ content: '.official{position:static}' });
await page.evaluate(() => {
  const b = document.createElement('div');
  b.textContent = 'Preview uses sample (fixture) data, not live earthquakes';
  b.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99;background:#14213d;color:#fff;padding:6px 12px;border-radius:6px;font:600 14px system-ui';
  document.body.append(b);
});
await page.waitForSelector('.quake');
await page.waitForTimeout(1500);
await page.evaluate(() => window.scrollTo(0, 560));
await page.waitForTimeout(300);
await page.screenshot({ path: 'public/og/image.png' });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.locator('#city-input').click();
await page.keyboard.press('Control+A');
await page.keyboard.type('quez', { delay: 250 });
await page.waitForTimeout(700);
await page.locator('#city-list button').first().click();
await page.waitForTimeout(1200);
await page.evaluate(() => window.scrollTo({ top: 420, behavior: 'smooth' }));
await page.waitForTimeout(2200);
await context.close();
await browser.close();
server.close();
const webm = join(tmp, readdirSync(tmp).find((f) => f.endsWith('.webm')));
copyFileSync(webm, join(tmp, 'in.webm'));
const ff = spawnSync('ffmpeg', ['-y', '-ss', '0.6', '-i', webm, '-t', '7', '-vf', 'scale=1200:630,fps=25', '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', '30', '-an', '-movflags', '+faststart', 'public/og/preview.mp4'], { stdio: 'inherit' });
if (ff.status !== 0) process.exit(1);
