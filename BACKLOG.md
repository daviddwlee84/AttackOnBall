# Backlog

Ideas captured for later, with enough notes to pick up cold.

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

**Note:** a shrink or shield power-up changes the hero's effective hitbox, so
`GameScene.playerHalfW` / `playerTop` / `playerBottom` (read by `safety.js`) must be
updated with it or the dodgeability guarantee will be computed against the wrong
body.

## Double-tap dash

**Idea:** Double-tap a direction for a short burst of speed.

**Status:** Partly addressed — the move-speed slider now goes to 900 (was 600), so
"the hero feels too slow" is tunable without new mechanics. A dash is still a nice
skill expression, but it interacts badly with the dodgeability guarantee: the
analysis assumes a constant top speed, so a dash would make it *pessimistic*
(rejecting spawns the player could actually escape). Fixing that properly means
modelling the dash budget in `analyseSurvivability`, which is a real piece of work.

## Fairness margin, not just survivability

**Idea:** `safety.js` currently rejects a spawn only when the reachable set becomes
*empty* — technically survivable by a pixel still counts as fair. A margin
(reject when the corridor narrows below N bins, or below some fraction of the
arena) would make hard difficulties feel less cheap.

**Risk:** at high ball density this could reject a large fraction of spawns and
flatten the difficulty curve. The spawner already counts rejections
(`spawner.rejected` / `skipped`, shown in the F4 overlay) — measure with that
before picking a threshold.

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

**Status:** Not started. Lives mode (shipped, now with a heart economy) covers the
"more forgiving" need for now.
