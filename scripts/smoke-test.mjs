// Headless smoke test: loads the running preview server, lets the game boot and
// auto-plays a few seconds, and fails if the browser logged any error.
// Uses puppeteer-core + a system Chrome (set PUPPETEER_EXECUTABLE_PATH) to avoid
// downloading a bundled browser. Falls back to plain "puppeteer" if installed.
import puppeteer from 'puppeteer-core';

const URL = process.env.SMOKE_URL || 'http://localhost:4173/';

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();

const errors = [];
page.on('console', (m) => {
  // Resource-load failures are reported (with their URL) by the response/
  // requestfailed handlers below; here we only care about real JS errors.
  if (m.type() === 'error' && !m.text().includes('Failed to load resource')) {
    errors.push('console.error: ' + m.text());
  }
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => {
  if (!r.url().includes('favicon')) errors.push('requestfailed: ' + r.url());
});
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon')) {
    errors.push(`http ${r.status()}: ${r.url()}`);
  }
});

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 20000 });

// Wait for Phaser to create its canvas, then verify it actually rendered.
await page.waitForSelector('canvas', { timeout: 10000 });
await new Promise((r) => setTimeout(r, 1500)); // BootScene -> MenuScene

// Start a game (Space), drive movement + a pointer hold, run a few seconds.
await page.keyboard.press('Space');
await new Promise((r) => setTimeout(r, 500));
await page.keyboard.down('ArrowRight');
await new Promise((r) => setTimeout(r, 1500));
await page.keyboard.up('ArrowRight');
await page.keyboard.down('ArrowLeft');
await new Promise((r) => setTimeout(r, 1500));
await page.keyboard.up('ArrowLeft');
await new Promise((r) => setTimeout(r, 3000));

// Confirm a non-blank canvas (some non-background pixels were drawn).
const drew = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c) return false;
  const off = document.createElement('canvas');
  off.width = c.width;
  off.height = c.height;
  const ctx = off.getContext('2d');
  ctx.drawImage(c, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const colors = new Set();
  for (let i = 0; i < data.length; i += 4 * 997) {
    colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
  }
  return colors.size > 5; // more than a flat fill
});

// Verify balls actually spawned AND flew into the play field (not stuck at the
// edges) — guards against the physics-group velocity-reset regression.
const ballStats = await page.evaluate(() => {
  const s = window.__aob;
  if (!s || !s.balls) return null;
  const balls = s.balls.getChildren();
  const inField = balls.filter((b) => b.x > 80 && b.x < s.scale.width - 80).length;
  return { total: balls.length, inField };
});

await browser.close();

if (!ballStats || ballStats.total === 0) {
  console.error('SMOKE FAIL — no balls spawned');
  process.exit(1);
}
if (ballStats.inField === 0) {
  console.error(
    `SMOKE FAIL — ${ballStats.total} ball(s) spawned but none entered the field (stuck at edges)`
  );
  process.exit(1);
}

if (errors.length) {
  console.error('SMOKE FAIL — browser errors:\n' + errors.join('\n'));
  process.exit(1);
}
if (!drew) {
  console.error('SMOKE FAIL — canvas appears blank (nothing rendered)');
  process.exit(1);
}
console.log(
  `SMOKE PASS — booted, played ~6s, canvas rendered, no errors. ` +
    `Balls: ${ballStats.total} active, ${ballStats.inField} in field.`
);
