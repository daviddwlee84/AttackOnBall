# Backlog

Ideas captured for later, with enough notes to pick up cold.

## Priority

Assessed after the responsive-arena / flight-model / dodgeability work landed,
which changed what several of these cost. Effort is rough working days.

| | Item | Effort | Why here |
|---|---|---|---|
| **P0** | [Fairness margin](#fairness-margin-not-just-survivability) | ~0.5 | One-line change to the reject condition (`alive === 0` → `alive < minAlive`) plus a setting and a tuning pass. Right now the guarantee barely engages below Crazy — measured 0 re-rolls on Easy/Medium vs 12–30 on Crazy — so "always dodgeable" is currently doing almost nothing on the difficulties most people play. Best value-per-line left. |
| **P0** | [Drag / relative control](#alternative-control-schemes) | ~1 | The deepest remaining mobile UX flaw. "Walk toward your finger" means reaching the far edge requires *touching* the far edge — the invisible-wall fix removed the dead zone but not the ergonomics. Drag mode removes it structurally. `readDirection()` is a single choke point. Do drag first; the joystick is the bigger build and mainly matters for bullet-hell. |
| **P1** | [搞笑模式 — catch the balls](#搞笑模式--catch-the-balls) | ~1 | Best fun-per-effort on the list. Invert `onHit()`, reuse the arena bar as a countdown, force `guaranteeDodgeable` off. Self-contained as a mode, so it can't regress normal play. |
| **P2** | [Double-tap dash](#double-tap-dash) | ~1 | Cheaper than previously recorded — see the corrected note there. Partly pre-empted by the wider speed slider, so it's polish, not a fix. |
| **P2** | [Power-ups](#power-ups--多種道具) | ~2 | Needs a timed-effects system that doesn't exist yet; that scaffolding is most of the cost. Good replayability once the modes above exist to use it. |
| **P3** | [Super Crazy / bullet-hell](#super-crazy--bullet-hell-mode) | ~4–5 | The big one, and the only item with hard prerequisites: it wants a control scheme (P0) and a hazard abstraction in `safety.js`. Don't start it before those. |
| **P4** | [Rewind mode](#rewind-mode-time-rollback-continue) | ~2 | **Value dropped since it was written.** Its motivation was "that death was unfair"; Lives mode shipped with a heart economy and the dodgeability guarantee now removes forced deaths outright. Well-specced (`docs/rewind-mode-plan.md`) but solving a problem that largely got solved another way. |

Two items outside the feature list, worth tracking:

| | Item | Effort | Why |
|---|---|---|---|
| **P1** | [First-load bundle size](#first-load-bundle-size) | ~0.5–1 | 1.75 MB / 405 KB gzip in one chunk, warned on every build. This is time-to-first-play on mobile data. |
| **P3** | [Custom-difficulty leaderboard bucket](#custom-difficulty-leaderboard-bucket) | ~0.5 | All custom setups share one board, so the ranking is meaningless. |

**Suggested order:** fairness margin → drag control → 搞笑模式 → bundle size →
dash / power-ups → bullet-hell. The first two are under two days combined and
address the things a player actually feels.

### A rule for anything that touches the hero

`safety.js` models the hero as a constant-top-speed box. Divergence is only
dangerous in one direction:

- Making the hero **more** capable than modelled (dash, shrink, shield,
  slow-motion on the balls) leaves the model's reachable set a *subset* of
  reality — it over-rejects spawns. Wasteful, never unfair. **Safe to ship
  unmodelled.**
- Making the hero **less** capable than modelled (a slow/stun effect, a bigger
  hitbox, hazards the model doesn't know about) makes it optimistic, which is
  exactly the class of bug that produced deaths the analysis called "safe".
  **Must be modelled before shipping.**

## Super Crazy / bullet-hell mode

**Idea:** A fifth difficulty (or a separate mode) that stops being "bouncing balls"
and becomes a danmaku: triangles raining straight down, dense patterns, the hero
weaving between them.

**What's already in place:** `src/systems/safety.js` is the enabling piece — it
answers "can the hero still get out of this?" for any set of moving hazards, and
the spawner already re-rolls launches that would corner them. Without it a bullet
pattern is either trivially safe or randomly unfair.

**What it needs:**
- A hazard abstraction. `safety.js` currently takes `{x, y, vx, vy, r}` and applies
  gravity + a floor bounce in `stepBall()`. Descending triangles want straight-line
  motion with no bounce, so the per-hazard motion model has to become pluggable
  (a `kind` field, or pass a stepper in).
- Pattern authoring: waves/arcs/spirals rather than the current independent random
  spawns, with the safety check run over a whole *wave* before it is committed.
- If the hero ever gains vertical movement, the 1-D reachable-interval sweep has to
  become a 2-D one — the same algorithm, but `dilate()` over a grid and a much
  bigger constant factor. Worth measuring before committing: the 1-D version is
  ~0.1 ms; a 2-D version at the same resolution would be ~100x that.

**Cost / risk:** Medium-large. The safety generalisation is the interesting part;
the rest is content.

## Alternative control schemes

**Idea:** Two more input modes alongside today's "walk toward your finger":
- **Virtual joystick** — a thumb stick in the bottom corner. Better for long
  sessions (no reaching across the screen) and the natural fit for bullet-hell.
- **Drag/relative** — the hero tracks the *delta* of your finger rather than its
  absolute position, so you can steer from anywhere without your thumb covering
  the hero.

**Where it plugs in:** `GameScene.readDirection()` (`src/scenes/GameScene.js`) is
the single choke point — it already returns just -1/0/+1. A drag mode wants finer
granularity than that, so the return type would become a signed 0..1 throttle and
`Player.move()` would scale by it. Add a `controlMode` setting next to the existing
prefs in `src/settings.js`.

**Note:** the pointer-arming guard and the `uiHold` flag in `readDirection()` exist
to fix real bugs (a held pointer jerking the hero on restart, and HUD taps being
read as movement) — any new scheme has to keep both.

## 搞笑模式 — catch the balls

**Idea:** Invert the objective: you must actively *touch* a ball within N seconds
or you die. Same physics, opposite instinct — funny precisely because every reflex
the normal game trains is now wrong.

**Sketch:** Reuse the existing `physics.add.overlap(player, balls)` in `GameScene`;
`onHit()` becomes "reset the timer" instead of "lose a life", and a new countdown
drives death. The arena timer bar (`src/systems/arena.js`, `setBar`) can be reused
as the countdown. Difficulty knob = the timer length and how few balls are on
screen. Note this mode wants the dodgeability guarantee turned *off* — it needs
balls to be reachable, not avoidable.

## Power-ups / 多種道具

**Idea:** Beyond the existing number pickups and hearts — e.g. slow-motion, shield
(one free hit), magnet (numbers fly to you), shrink (smaller hitbox), clear-screen.

**Where it plugs in:** `src/objects/NumberPickup.js` / `HeartPickup.js` are the
template (construct → add to group → `configure()`; the group add resets the body,
which is why configure is separate). `Spawner.spawnPickup()` already picks between
kinds by weighted roll. A timed-effect power-up additionally needs an "active
effects" list on `GameScene` with expiry, which nothing has yet.

**Note:** effects that change the hero's hitbox feed `safety.js` via
`GameScene.playerHalfW` / `playerTop` / `playerBottom`. By the rule at the top of
this file, *shrink* and *shield* are safe to leave unmodelled (the analysis just
stays conservative), but anything that makes the hero slower, bigger or otherwise
worse off — a stun, a "drunk" reversed-controls effect, gravity changes that
speed the balls up — has to be reflected there before shipping, or the guarantee
silently starts lying.

## Double-tap dash

**Idea:** Double-tap a direction for a short burst of speed.

**Status:** Partly addressed — the move-speed slider now goes to 900 (was 600), so
"the hero feels too slow" is tunable without new mechanics.

**Correction to an earlier note here:** this was recorded as blocked on
"modelling the dash budget in `analyseSurvivability`". It isn't. `safety.js`
derives the hero's per-step reach from a constant `playerSpeed`
(`rate = playerSpeed * step / binW`), so a hero that can *exceed* that speed has
a reachable set strictly larger than the model's. The model therefore only ever
rejects spawns the player could in fact have escaped — over-protective, never
unfair (see the rule at the top). A dash can ship without touching the analysis;
modelling it properly is an optional follow-up to stop leaving difficulty on the
table, not a prerequisite.

## Fairness margin, not just survivability

**Idea:** `safety.js` currently rejects a spawn only when the reachable set becomes
*empty* — technically survivable by a pixel still counts as fair. A margin
(reject when the corridor narrows below N bins, or below some fraction of the
arena) would make hard difficulties feel less cheap.

**Risk:** at high ball density this could reject a large fraction of spawns and
flatten the difficulty curve. The spawner already counts rejections
(`spawner.rejected` / `skipped`, shown in the F4 overlay) — measure with that
before picking a threshold.

## First-load bundle size

**Problem:** `npm run build` emits a single ~1.75 MB chunk (~405 KB gzip) and
warns about it every time. On a phone over mobile data that's the whole
time-to-first-play, and it's paid before the loading doodle can even animate.
Phaser is nearly all of it; our own code is a few tens of KB.

**Options, cheapest first:**
- Split the vendor chunk out (`build.rollupOptions.output.manualChunks`) so
  Phaser caches independently of game code. Doesn't shrink the first load, but
  every subsequent deploy only re-downloads the small chunk — which now matters,
  since `src/pwa-update.js` makes updates frequent and visible.
- A custom Phaser build. Phaser 4 ships a modular build; this game uses Arcade
  physics, the Canvas/WebGL renderer, Text, Shapes, Particles and Tweens — no
  tilemaps, no Matter, no camera effects, no animations, no loader beyond
  generated canvas textures. Potentially a large cut, but bundling Phaser from
  source is fiddly and easy to get subtly wrong.
- Lazy-load nothing else: the art is procedural (`src/doodle.js`), so there are
  no assets to defer. This is purely an engine-size problem.

**Measure first:** `npx vite-bundle-visualizer` before picking. Don't do the
custom build without numbers showing it's worth the maintenance.

## Custom-difficulty leaderboard bucket

**Problem:** `leaderboard.bucketOf(mode, difficulty)` maps every tuned setup to a
single `classic:custom` / `lives:custom` board, so a run at `playerSpeed` 900 with
Easy ball speeds ranks against one at 180 with Crazy. The number is meaningless.

**Options:** hash the preset-controlled keys (`PRESET_KEYS` in `src/settings.js`)
into the bucket name so each distinct setup gets its own board — accurate but
produces endless near-empty boards; or drop custom runs from the leaderboard
entirely and say so in the UI. The second is probably the honest one: a custom
setup is a sandbox, not a competition.

## Rewind mode (time-rollback continue)

**Idea:** A third game mode where, instead of losing a life outright, death lets you
*rewind* a second or two to just before the fatal hit and resume (with brief
invincibility). Distinct from Lives mode — here the ball trajectories are *rewound*
too, not just continued.

**Why it's harder than Lives mode:** Lives mode only needs a flag + invincibility
timer; the world keeps running forward. Rewind needs the world to actually go
*backwards*, which means recording and restoring full simulation state.

**Sketch:**
- Keep a ring buffer of world snapshots, ~1 per frame for the last ~2–3s
  (e.g. 180 frames). Each snapshot stores: player x; every ball's
  `{textureKey, x, y, vx, vy, angularVelocity, scale}`; every pickup's
  `{value, x, y, vx, vy}`; `elapsed`/`collected`/`segment`.
- On death: pick the snapshot from ~1.2s before now, then rebuild the scene from it
  — destroy current balls/pickups, recreate from the snapshot (Arcade physics isn't
  deterministic to *replay*, but restoring a position+velocity snapshot is exact),
  rewind `elapsed`/score, grant invincibility, resume.
- Optional polish: a visual "rewind" effect (fast-reverse a few frames by stepping
  the buffer backwards before resuming, desaturate/scanline shader, a whoosh SFX).
- Limit uses (e.g. N rewinds per run) so it's not infinite, like Lives.

**Cost / risk:** Memory for the buffer is small (a few hundred plain objects).
Main work is a clean serialize/restore of Ball/NumberPickup (their constructors take
indices, not raw state — would need a `fromSnapshot()` path or a restore method that
bypasses `launch()`/`configure()`). Moderate effort; well-contained.

**Full plan:** see [docs/rewind-mode-plan.md](docs/rewind-mode-plan.md).

**Status:** Not started, and **deprioritised to P4**. Its motivating problem was
"that death felt unfair / I want the run back". Two things have since eaten most
of that: Lives mode shipped with a heart economy, and `src/systems/safety.js` now
rejects spawns that would make death unavoidable, so the remaining deaths are
ones the player could have avoided — exactly the deaths a rewind shouldn't undo.
The plan is still good if it's wanted for its own sake (the fast-reverse effect is
genuinely fun); it just no longer fixes anything.
