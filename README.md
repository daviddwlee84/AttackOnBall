# Attack on Ball

A doodle-style recreation of the classic **Attack on Ball** arcade game (originally
by *eggbones*, last updated 2017 and effectively gone from modern stores). Built
with **Phaser 4**, rendered in a hand-drawn "crayon" look with **rough.js**, and
shipped as an installable **PWA**.

**▶ Play: https://daviddwlee84.github.io/AttackOnBall/**

![hero](public/icons/icon-192.png)

## Gameplay

Move the green hero left/right along the water line. Balls of various sizes fly in
from both sides and bounce around the arena — get hit and it's game over. Survive
as long as you can: the timer (your score) counts up continuously, and walking over
the falling numbers adds those seconds straight to it. Every 10 seconds the arena
recolors. Difficulty ramps up: balls spawn faster and more pile on the longer you
last. Every ball is guaranteed to bounce above the hero's head, so it's always
dodgeable.

**Controls**

- Desktop: `←` / `→` or `A` / `D`
- Touch: tap or hold anywhere — the hero walks toward your finger

**Settings (start screen)** — pick a difficulty preset (Easy / Medium / Hard / Crazy)
or open **Advanced settings** to tune move speed, gravity, ball speed/angle, spawn
rates and the difficulty ramp. Settings persist in the browser.

## Develop

```bash
npm install
npm run dev       # local dev server with hot reload
npm run build     # production build to dist/
npm run preview   # serve the production build locally
npm run smoke      # headless boot/play check against the preview server
```

> `npm run smoke` requires the preview server running (`npm run preview`) and
> installs Puppeteer on demand; it is optional and CI-style only.

## Architecture

- `src/config.js` — fixed constants (render `SCALE`, arena size, palettes, ball
  sizes, pickup values). The whole game is authored at 960×540 and multiplied by
  `SCALE` for a crisp hi-DPI buffer.
- `src/settings.js` — runtime-configurable, persisted settings: difficulty presets
  + advanced physics/difficulty params. `gameParams()` returns SCALE-applied values
  the gameplay reads (via `scene.params`).
- `src/ui/settingsPanel.js` — the HTML settings overlay on the menu screen.
- `src/doodle.js` — rough.js texture generators (hero expressions, balls, numbers,
  fragments, grid). All art is generated procedurally at boot — no image assets.
- `src/scenes/` — `BootScene` (generates textures) → `MenuScene` (backdrop +
  settings panel) → `GameScene` (core loop) → `GameOverScene`.
- `src/objects/` — `Player`, `Ball`, `NumberPickup`.
- `src/systems/` — `spawner` (difficulty/density) and `arena` (background, timer
  bar, palette shuffle).

The original vanilla-Canvas prototype lives in `deprecated/attack_on_ball_canvas.html`
for reference; the tuned physics constants were ported from it.

## Deploy to GitHub Pages

Already live (see link above). `.github/workflows/deploy.yml` builds with the
`/AttackOnBall/` base path (`GITHUB_PAGES=true`) and deploys `dist/` via GitHub
Actions on every push to `main`. Pages is configured with **Source: GitHub Actions**.
If you fork/rename, update `base` in `vite.config.js` to match the new repo name.
