// Generates the 1200x675 social share card (public/og-image.png) by screenshotting
// the real start screen. Spawns a Vite dev server, captures the menu with headless
// Chrome (same puppeteer-core + system-Chrome setup as scripts/smoke-test.mjs), then
// tears everything down. Run occasionally via `npm run og`; the committed PNG ships.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.OG_PORT || 5199);
const URL = `http://localhost:${PORT}/`;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og-image.png');
const W = 1200;
const H = 675; // 16:9, matches og:image:width/height in index.html

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await wait(300);
  }
  throw new Error(`Dev server did not become reachable at ${url}`);
}

// Launch a dev server (no build required — it serves index.html from the project root).
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--clearScreen', 'false'], {
  cwd: join(dirname(fileURLToPath(import.meta.url)), '..'),
  stdio: 'ignore',
});

let browser;
try {
  await waitForServer(URL);

  browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });

  // Wait for the menu to be ready (canvas + the settings panel's Play button),
  // then let the loading overlay finish fading out.
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForSelector('.aob-play', { timeout: 10000 }).catch(() => {});
  await wait(1800);

  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
  writeFileSync(OUT, buf);
  console.log(`wrote og-image.png (${W}x${H}, ${buf.length} bytes)`);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
