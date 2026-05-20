# Attack on Ball

A doodle-style recreation of the classic **Attack on Ball** arcade game (originally
by *eggbones*, last updated 2017 and effectively gone from modern stores). Built
with **Phaser 4**, rendered in a hand-drawn "crayon" look with **rough.js**, and
shipped as an installable **PWA** deployable to GitHub Pages.

![hero](public/icons/icon-192.png)

## Gameplay

Move the green hero left/right along the water line. Balls of various sizes fly in
from both sides and bounce around the arena — get hit and it's game over. Survive
as long as you can: your score climbs with time, and walking over the falling
numbers adds them straight to your score. Every 10 points the arena recolors.
Difficulty ramps up as balls spawn faster the longer you last.

**Controls**

- Desktop: `←` / `→` or `A` / `D`
- Touch: tap or hold anywhere — the hero walks toward your finger
- `Space` / tap to start and to restart

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

- `src/config.js` — all tunables (physics, spawn rates, palettes, scoring).
- `src/doodle.js` — rough.js texture generators (hero expressions, balls, numbers,
  fragments, grid). All art is generated procedurally at boot — no image assets.
- `src/scenes/` — `BootScene` (generates textures) → `MenuScene` → `GameScene`
  (core loop) → `GameOverScene`.
- `src/objects/` — `Player`, `Ball`, `NumberPickup`.
- `src/systems/` — `spawner` (difficulty) and `arena` (background, timer bar,
  palette shuffle).

The original vanilla-Canvas prototype lives in `deprecated/attack_on_ball_canvas.html`
for reference; the tuned physics constants were ported from it.

## Deploy to GitHub Pages

`.github/workflows/deploy.yml` builds with the `/AttackOnBall/` base path and
publishes `dist/` on every push to `main`. To enable it:

1. Push this repo to GitHub (repo name **AttackOnBall** so the base path matches;
   change `base` in `vite.config.js` if you rename it).
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. The game goes live at `https://<your-user>.github.io/AttackOnBall/`.
