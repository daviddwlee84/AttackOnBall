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

A mark on the ground shows where each ball will next land, so you can read the
arena instead of guessing — by default it's the ball's own shadow sliding into
place early, with a louder coloured ring available instead (**🎯 Landing spot**
cycles Off / Shadow / Ring). Most balls trace a similar arc, but every so often
one is lobbed high enough to leave the top of the screen before coming back down.
And the spawner won't deal you an unwinnable hand: every launch is simulated
against the balls already in play, and any launch that would leave you with
nowhere to run is re-rolled (see **Always dodgeable** below).

**Controls**

- Desktop: `←` / `→` or `A` / `D`. Pressing the opposite direction takes effect
  immediately even if you haven't released the first one yet, and letting it go
  hands control straight back — so a fast left-right-left shuffle never drops an
  input (last-press-wins, the rule Razer ships as Snap Tap)
- Touch: tap or hold anywhere — the hero walks toward your finger
- `Esc` / `P` pause · `F3` FPS overlay · `F4` dodgeability corridor
- **🔧 Debug play** (bottom of Advanced settings) starts an unranked run zoomed
  out past the arena edge, with a red frame marking the normally-visible area,
  Arcade Physics hitboxes drawn, and a live readout of input state, hero bounds,
  spawn timing and every ball's launch parameters. Useful for debugging a
  reported control problem — you can see directly whether the hero is being told
  to go left or right, and by which input path — and for showing how the thing
  actually works.

**Settings (start screen)** — pick a difficulty preset (Easy / Medium / Hard / Crazy),
browse the **🏆 Top 10** board for that exact difficulty and mode, or open
**Advanced settings** to tune move speed, gravity, bounce height, arena crossing
time, spawn rates and the difficulty ramp. Settings persist in the browser.

**Screens and orientation** — the arena is sized to your viewport's aspect ratio, so
it fills the screen edge to edge on anything from a 4:3 tablet to a 21:9 phone in
landscape, and follows a window resize live. On a phone held in portrait, pressing
Play requests fullscreen + a landscape orientation lock; where the browser won't
allow that (iOS Safari), the game surface rotates itself instead — full-bleed
landscape, no black bars, no "please rotate your device" dead end. The settings
panel stays upright either way, so you can set a run up in portrait and still play
it in landscape. If it rotates the wrong way for how you hold the phone, flip
**📱 Turn phone** in Advanced settings.

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
build up the next time they focus the tab — see `src/pwa-update.js`.

**If a deploy fails with the build job green:** `actions/deploy-pages` sometimes
sits at `deployment_queued` until it times out and cancels — a Pages-side
hiccup, not a code problem. Re-running the failed job *usually* fixes it, but
not always: the Pages deployment ID **is** the commit SHA, so once a SHA's
deployment has been cancelled, re-running just re-creates the same already-
cancelled deployment and fails immediately with `Deployment cancelled.` at that
point the only way through is a new commit (an empty one is enough). Pages is configured with **Source: GitHub Actions**.
If you fork/rename, update `base` in `vite.config.js` to match the new repo name.
