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
last, along curves that keep rising but taper rather than slamming into a ceiling.

A ring on the ground marks where each ball will next land, so you can read the
arena instead of guessing. And the spawner won't deal you an unwinnable hand: every
launch is simulated against the balls already in play, and any launch that would
leave you with nowhere to run is re-rolled (see **Always dodgeable** below).

**Controls**

- Desktop: `←` / `→` or `A` / `D`
- Touch: tap or hold anywhere — the hero walks toward your finger
- `Esc` / `P` pause · `F3` FPS overlay · `F4` dodgeability corridor

**Settings (start screen)** — pick a difficulty preset (Easy / Medium / Hard / Crazy),
browse the **🏆 Top 10** board for that exact difficulty and mode, or open
**Advanced settings** to tune move speed, gravity, bounce height, arena crossing
time, spawn rates and the difficulty ramp. Settings persist in the browser.

**Screens and orientation** — the arena is sized to your viewport's aspect ratio, so
it fills the screen edge to edge on anything from a 4:3 tablet to a 21:9 phone in
landscape, and follows a window resize live. On a phone held in portrait, pressing
Play requests fullscreen + a landscape orientation lock; where the browser won't
allow that (iOS Safari), the page rotates itself instead, so you never get sent to a
"please rotate your device" dead end. If it rotates the wrong way for how you hold
the phone, flip **📱 Turn phone** in Advanced settings.

## Develop

```bash
npm install
npm run dev       # local dev server with hot reload
npm run build     # production build to dist/
npm run preview   # serve the production build locally
npm run logic     # headless checks of the Phaser-free game logic
npm run smoke     # headless boot/play check against the preview server
```

> `npm run logic` is plain Node and needs nothing running. `npm run smoke` requires
> the preview server (`npm run preview`) and a Chrome via
> `PUPPETEER_EXECUTABLE_PATH`; it is optional and CI-style only.

## Architecture

- `src/config.js` — fixed constants (render `SCALE`, palettes, ball sizes, pickup
  values) plus the arena size. The game is authored at a fixed 540-unit *height*
  and a *dynamic* width derived from the viewport aspect, all multiplied by `SCALE`
  for a crisp hi-DPI buffer. `GAME_W` is an `export let`: ES live bindings mean
  every importer sees `recomputeArenaSize()`'s result, so read it at use time and
  never copy it into a module-level constant.
- `src/settings.js` — runtime-configurable, persisted settings: difficulty presets
  + advanced physics/difficulty params. `gameParams()` returns SCALE-applied values
  the gameplay reads (via `scene.params`). Stored under `aob-settings-v2`; v1 blobs
  are migrated for preferences only (the old physics keys describe a launch model
  that no longer exists).
- `src/orientation.js` — landscape by default: fullscreen + orientation lock, and a
  CSS page-rotation fallback with matching patches to Phaser's pointer mapping and
  parent measurement.
- `src/pwa-update.js` — service-worker update lifecycle. The plugin default
  (`registerType: 'autoUpdate'` with no `virtual:pwa-register` import) never
  re-checks for a deploy once the page is loaded, and swaps the worker without
  reloading — so an open tab or a resumed PWA serves a stale build indefinitely
  and the player is never told. Instead this registers in `prompt` mode, calls
  `registration.update()` on every `focus` / `visibilitychange`, and surfaces a
  "new version" toast **only on the menu and game-over screens** — `GameScene`
  suppresses it, because the score is the elapsed time and a reload mid-run would
  destroy it. Nothing activates until the player taps Update.
- `src/ui/settingsPanel.js` — the HTML settings overlay on the menu screen;
  `src/ui/nameEntry.js` — the leaderboard name prompt.
- `src/doodle.js` — rough.js texture generators (hero expressions, balls, numbers,
  fragments, grid). All art is generated procedurally at boot — no image assets.
- `src/scenes/` — `BootScene` (generates textures) → `MenuScene` (backdrop +
  settings panel) → `GameScene` (core loop) → `GameOverScene`.
- `src/objects/` — `Player`, `Ball`, `NumberPickup`, `HeartPickup`.
- `src/systems/` — `viewport` (arena sizing / resize broadcast), `arena`
  (background, timer bar, palette shuffle), `spawner` (difficulty/density), plus
  three deliberately **Phaser-free** modules covered by `npm run logic`:
  - `ballistics` — launch planning. Balls are parameterised by *apex* (how far
    their underside clears the water line) and *crossing time*, not speed+angle:
    the old coupling meant Easy's slow balls arced the *lowest* and Crazy's fast
    ones sailed over the arena without ever bouncing in it.
  - `safety` — the **Always dodgeable** guarantee. Reachable-interval propagation
    over a time×position grid: start from the hero's cell, widen it by how far they
    could run each step, subtract everything a ball sweeps through, repeat. If the
    set ever empties, the state is a forced death and the spawner re-rolls that
    launch. ~0.1 ms per check. See the header comment for what it does and does not
    promise. `F4` draws the corridor live.
  - `leaderboard` — local top-10 per `mode:difficulty` bucket.

The original vanilla-Canvas prototype lives in `deprecated/attack_on_ball_canvas.html`
for reference; the tuned physics constants were ported from it.

## Deploy to GitHub Pages

Already live (see link above). `.github/workflows/deploy.yml` builds with the
`/AttackOnBall/` base path (`GITHUB_PAGES=true`) and deploys `dist/` via GitHub
Actions on every push to `main`. Players already running the app pick the new
build up the next time they focus the tab — see `src/pwa-update.js`. Pages is configured with **Source: GitHub Actions**.
If you fork/rename, update `base` in `vite.config.js` to match the new repo name.
