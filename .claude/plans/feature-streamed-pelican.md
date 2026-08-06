# Attack on Ball — screen adaptation, difficulty rework, leaderboard, dodgeability guarantee

## Context

After playing the shipped game, two bugs and several design gaps surfaced:

1. **Screen fit.** The game is authored at a fixed 960×540 design surface (`SCALE=2` →
   1920×1080 buffer) and displayed with `Phaser.Scale.FIT` (`src/main.js:22-25`). On a
   19.5:9 phone in landscape that letterboxes into dead strips left and right. Combined
   with a 240×180-world-px "ignore taps" rectangle in the top-right of `readDirection()`
   (`src/scenes/GameScene.js:118`) and the touch-follow control scheme (the hero can never
   go further right than your finger), the far right of the screen behaves like an
   **invisible wall**.
2. **Restart jerks right.** `makeDoodleButton` binds its callback to `pointerdown`
   (`src/ui/button.js:31`). "▶ Play Again" / "↻ Restart" therefore starts `GameScene`
   while the finger is still down; on the first frames `readDirection()` sees
   `activePointer.isDown` at the button position and walks the fresh hero toward it.
3. **Difficulty presets don't deliver their promise.** `gravity`, `ballBounce` and
   `angleMin/Max` are identical for every preset (`src/settings.js:24-32`); only speed
   changes. Since apex = (v·sinθ)²/2g, *Easy's slow balls arc lowest* and get clamped to
   the bare `minApexClearance` minimum — barely above the hero's head, so they're hard to
   dodge. *Crazy's fast balls* get huge vx and cross the whole arena in one arc without
   ever bouncing inside it. Growth curves are all linear-then-clamped, and the extra-ball
   probability is uncapped, so after `doubleAfter + densityRamp` seconds *every* tick
   spawns 2 balls — a step, not a taper.
4. **No per-difficulty ranking**, no landing-point prediction, and no formal answer to
   "is this run actually survivable?".

Intended outcome: the game fills any screen and any window, presents landscape without
the player having to physically rotate, each difficulty preset feels the way its name
promises, runs are provably dodgeable, and scores are ranked top-10 per difficulty.

Deferred ideas (Super Crazy / bullet-hell, joystick + drag control modes, 搞笑模式, power-ups,
double-tap dash) go to `BACKLOG.md` — see the final phase.

---

## Phase 1 — Responsive arena (full-bleed on any screen)

**Goal:** the design surface matches the real viewport aspect, so `Scale.FIT` no longer
letterboxes and every pixel of the screen is playable.

**`src/config.js`**
- Keep `GAME_H = 540 * SCALE` fixed (so hero size, gravity, apex heights and the HUD are
  unchanged everywhere) and make the width dynamic:
  ```js
  export let GAME_W = 960 * SCALE;
  export const ASPECT_MIN = 4 / 3, ASPECT_MAX = 21 / 9;
  export function recomputeArenaSize(w = window.innerWidth, h = window.innerHeight) {
    const a = Phaser.Math.Clamp(w / h, ASPECT_MIN, ASPECT_MAX);
    const next = Math.round(GAME_H * a / 2) * 2;
    const changed = next !== GAME_W;
    GAME_W = next;
    return changed;
  }
  ```
  `export let` gives ES **live bindings**, so every existing `import { GAME_W }` call site
  (Ball, NumberPickup, HeartPickup, GameScene, arena, MenuScene, PauseScene, GameOverScene,
  BootScene) picks up the new value with **zero edits**. Do the clamp math without Phaser
  so `config.js` stays import-light.
- Add `MAX_GAME_W = Math.round(GAME_H * ASPECT_MAX)` for texture sizing.

**`src/main.js`** — call `recomputeArenaSize()` before `new Phaser.Game({...})`.

**`src/scenes/BootScene.js`** — generate the grid once at `MAX_GAME_W` instead of `GAME_W`
(`makeGrid(this, 'grid', MAX_GAME_W, GAME_H)`). The grid image is drawn at origin (0,0)
(`src/systems/arena.js:30-35`), so extra width simply falls off the right edge — no
regeneration on resize, no rough.js cost on rotate.

**Resize handling** — new `src/systems/viewport.js`:
- Listen for `resize` / `orientationchange` (debounced ~150 ms).
- If `recomputeArenaSize()` returns `true`: call `game.scale.resize(GAME_W, GAME_H)` and
  emit an app-level event.
- `MenuScene` restarts itself on that event (cheap, it's just a backdrop).
- `GameScene` **does not** restart mid-run — it re-lays-out instead: `arena.relayout()`
  (bar width, score/HUD x), `layoutHearts()`, pause/mute button x, and
  `this.physics.world.setBounds(0, 0, GAME_W, GAME_H)`. Add `Arena.relayout()` next to the
  existing `setBar`/`setScore` methods. Mid-run resize is an edge case (desktop window
  drag); correctness matters more than perfection.
- `GameScene.create()` must call `this.physics.world.setBounds(...)` explicitly — Phaser
  seeds world bounds from the game config, which is stale after any resize.

**Hero edge reachability** — `src/objects/Player.js:18`. `setCollideWorldBounds(true)` with
a `0.7 * PLAYER_SIZE` body stops the hero's centre `0.35 * PLAYER_SIZE` short of each edge.
Give the player its own expanded bounds so its *centre* can reach the arena edges minus a
small pad:
```js
const inset = PLAYER_SIZE * 0.35 - EDGE_PAD;   // EDGE_PAD ≈ 6 * SCALE
this.body.setBoundsRectangle(new Phaser.Geom.Rectangle(-inset, 0, GAME_W + 2 * inset, GAME_H));
```
Safe because balls and pickups don't use world bounds at all (they only collide with the
`this.ground` static body, `GameScene.js:73-74`).

**Notch / safe area** — with full-bleed the canvas now runs under the notch and home
indicator. Read `env(safe-area-inset-left/right)` once via a probe element in
`viewport.js`, convert to design units, and inset the pause/mute buttons (`makePauseButton`,
`makeMuteButton`) and the score text accordingly. Gameplay area stays full width.

---

## Phase 2 — Input bugs

**`src/ui/button.js`** — fire on release, not press:
```js
let armed = false;
bg.on('pointerdown', () => { armed = true; });
bg.on('pointerout',  () => { armed = false; btn.setScale(1); });
bg.on('pointerup',   () => { if (armed) { armed = false; onClick?.(); } });
```
This alone kills the restart jerk for both `GameOverScene.restart()` and `PauseScene`'s
"↻ Restart".

**`src/scenes/GameScene.js` — pointer arming guard** (belt and braces, also covers the HTML
"▶ Play" button in `settingsPanel.js`): in `create()`, `this.pointerArmed = !this.input.activePointer.isDown;`
and at the top of `readDirection()`:
```js
if (!this.pointerArmed) { if (!this.input.activePointer.isDown) this.pointerArmed = true; return 0; }
```

**Delete the top-right dead rectangle** (`GameScene.js:118`) — it is a literal invisible
wall over 12.5% × 16.7% of the arena. Replace it with an explicit UI-capture flag: in
`makePauseButton` / `makeMuteButton`, `bg.on('pointerdown', () => { this.uiHold = true; })`,
and clear it with a scene-level `this.input.on('pointerup', () => { this.uiHold = false; })`.
`readDirection()` returns `0` while `this.uiHold` is set.

**Verify** that after these three changes the hero is stationary for the first ~500 ms of a
restart (assert in the smoke test, Phase 7).

---

## Phase 3 — Default landscape without asking the user to rotate

New `src/orientation.js`, called from the menu's `onPlay` handler
(`src/scenes/MenuScene.js:36-43`) — it must run inside the user gesture:

1. **Preferred path:** `await document.documentElement.requestFullscreen()` then
   `await screen.orientation.lock('landscape')`. Works on Android Chrome and installed
   PWAs (the manifest already declares `orientation: 'landscape'`, `vite.config.js:21`).
   Wrap both in `try/catch` — failure is expected and silent.
2. **Fallback (iOS Safari, where neither API exists):** a `portraitRotate` mode. Add
   `body.aob-rotated` CSS that rotates `#game` by 90° with swapped width/height. Phaser
   derives pointer coordinates from `getBoundingClientRect()`, which returns the *rotated*
   box, so input must be corrected: monkey-patch `game.input.manager.transformPointer` to
   apply the inverse rotation before delegating to the original. This is ~20 lines and
   contained, but it is the **riskiest piece of the plan** — it touches Phaser internals.
   Gate it behind a `portraitRotate` setting (default on, only activated when
   orientation-lock throws) so it can be switched off, and keep the existing
   `#aob-rotate` prompt markup (`index.html:212-215`) as the last-resort fallback: if the
   patch can't be installed, show the prompt as today.
3. Re-run `recomputeArenaSize()` after any orientation change (Phase 1's listener already
   does this).

If the pointer patch proves flaky in testing, ship 1 + the existing rotate prompt and move
the CSS-rotation fallback to the backlog. Report which path landed.

---

## Phase 4 — Ball flight model, spawn geometry and tapering difficulty

### 4a. Replace speed+angle with apex+crossing-time

The root problem is that `(speed, angle)` couples the two things difficulty actually cares
about. Re-parameterise the launch so each preset controls them independently:

- **`apex`** — height of the ball's *lowest point* at the top of its arc, above the water
  line, in design px. Radius-independent: at the floor the centre sits at `GROUND_Y - r`,
  so the ball's bottom rises exactly `H = vy²/2g`. Therefore `vy = sqrt(2 * g * apex)`.
  Hero head height is `PLAYER_SIZE = 56` design px, so `apex` reads directly as
  "how many hero-heights of clearance".
- **`crossTime`** — seconds to traverse the arena. `vx = (GAME_W + 2 * margin) / crossTime'`
  where `crossTime' = crossTime * (1 + 2*margin/GAME_W)`. Using *time* rather than speed
  keeps difficulty consistent now that `GAME_W` varies per device (Phase 1).
- Bounces inside the arena fall out of the two: `crossTime / (2·sqrt(2·apex/g))`.

New preset keys in `src/settings.js` replacing `ballSpeedMin/ballSpeedMax/angleMin/angleMax`:
`apexMin`, `apexMax`, `crossMin`, `crossMax`. Starting values (design units, g = 1000 —
**playtest and retune**):

| preset | apexMin–apexMax | ≈ hero-heights | crossMin–crossMax (s) | ≈ bounces crossing |
|---|---|---|---|---|
| easy   | 150 – 240 | 2.7× – 4.3× | 3.6 – 5.0 | 3.5 – 5   |
| medium | 110 – 190 | 2.0× – 3.4× | 2.4 – 3.4 | 2.5 – 3.5 |
| hard   |  95 – 170 | 1.7× – 3.0× | 1.9 – 2.7 | 2.2 – 3   |
| crazy  |  90 – 150 | 1.6× – 2.7× | 1.5 – 2.2 | 1.7 – 2.5 |

This directly fixes both complaints: **Easy now arcs high** (its slow balls no longer get
squashed onto the `minApexClearance` floor) and **Crazy still bounces inside the arena**
(its pressure comes from ball *count*, not from balls that sail clean over the field).

Keep `minApexClearance` as a hard floor: `apex = max(apex, PLAYER_SIZE + minApexClearance)`,
default `minApexClearance: 20`.

### 4b. Extract launch planning into pure math

Split `Ball.launch()` (`src/objects/Ball.js:43-68`) into:
- `planLaunch(params, sizeIdx, elapsed, rng)` → `{ x, y, vx, vy, r, dir }` — **pure, no
  Phaser, no scene**. Lives in a new `src/systems/ballistics.js`.
- `Ball.applyPlan(plan)` — does the `body.setCircle / setAllowGravity / setGravityY /
  setBounce / setVelocity / setAngularVelocity` work, keeping the existing "must be called
  after group add" contract documented at `Ball.js:38-42`.

`ballistics.js` also exports the helpers Phases 5 and 6 need:
`bouncePeriod(apex, g)`, `heightAt(t, plan, g)`, `xAt(t, plan)`, `timeToFloor(h, vy, g)`.
Keeping it Phaser-free makes it unit-testable from plain Node (Phase 7).

### 4c. Spawn geometry

`src/objects/Ball.js:17-21` currently spawns at `x = ±r` (balls pop in at the very edge)
and `y = GROUND_Y - r - Math.random()*r` (a random height that silently adds energy and
makes the real apex non-deterministic).

- Spawn at `x = -(r + margin)` / `GAME_W + r + margin` with `margin` randomised in a band
  (new `spawnMarginMin`/`spawnMarginMax`, ≈ 40–160 design px). The random margin gives free
  **bounce-phase variety** — balls no longer all enter at the same point of their arc.
- Spawn exactly at `y = GROUND_Y - r` (resting on the floor). Apex is then exactly
  `vy²/2g`, which the landing marker and the safety simulator both depend on.
- `isOffscreen()` (`Ball.js:95-97`) — make the `40` literal `40 * SCALE` and widen the cull
  margin to match the new spawn margin.

### 4d. Tapering growth curves

Replace the linear ramps with asymptotic ones, choosing time constants that **preserve
today's initial slope** so the existing preset numbers port over directly.

| curve | today | new |
|---|---|---|
| spawn interval (`src/systems/spawner.js:20`) | `max(spawnMin, spawnStart - t*spawnRamp)` | `spawnMin + (spawnStart - spawnMin) * exp(-t / spawnTau)`, `spawnTau = (spawnStart - spawnMin)/spawnRamp` |
| 2nd ball (`spawner.js:26`) | `rand() < (t - doubleAfter)/densityRamp` (uncapped → always 2 balls) | `rand() < 0.90 * (1 - exp(-(t - doubleAfter)/densityRamp))` |
| 3rd ball (`spawner.js:27`) | same | `rand() < 0.75 * (1 - exp(-(t - tripleAfter)/densityRamp))` |
| pressure ramp (`Ball.js:45`) | `1 + min(speedRampCap, t*speedRamp)` | `1 + speedRampCap * (1 - exp(-t / speedTau))`, `speedTau = speedRampCap/speedRamp` |

The pressure ramp now shortens `crossTime` (horizontal pressure) and leaves `apex` alone,
so arcs stay readable as the run gets long.

### 4e. Settings panel + migration

- `src/ui/settingsPanel.js`: swap the four `ballSpeed*/angle*` sliders in `ADVANCED`
  (`:23-26`) for `apexMin/apexMax/crossMin/crossMax` + the two spawn-margin sliders.
- Widen the always-visible move-speed slider (`COMMON`, `:17`) from `200–600` to
  `180–900`, per the "更大範圍的調整角色速度" request. (Double-tap dash → backlog.)
- Bump `STORAGE_KEY` to `'aob-settings-v2'` (`settings.js:9`). On first v2 load, carry over
  the preference keys (`mode`, `lives`, `autoRecover`, `heartDropChance`, audio, `debug`)
  from the v1 blob and drop the stale physics keys; anyone on `difficulty: 'custom'` falls
  back to `medium`. Leaving old keys in place via the current `{...defaults(), ...saved}`
  merge would silently keep dead values around.

---

## Phase 5 — Toggleable landing-point marker

The existing per-ball ellipse (`Ball.js:33-36`) is a *height* shadow directly under the
ball. Add a second, predictive marker showing where it will next touch the ground.

- In `Ball`, alongside `this.shadow`, create `this.marker` — a stroked circle
  (`scene.add.circle(...).setStrokeStyle(...).setFillStyle()`) at depth **−2** (under both
  existing shadows; see the depth table below), stroked in the ball's own colour so you can
  tell which incoming ball it belongs to.
- In `Ball.tick()`, using `ballistics.timeToFloor`: with Phaser's down-positive `vy` and
  `h` = height of the ball's bottom above `GROUND_Y`,
  `t = (vy + sqrt(vy*vy + 2*g*h)) / g`, then `xLand = x + vx * t`. Hide the marker when
  `xLand` falls outside the arena. Fade alpha up as `t → 0` so imminent landings read
  loudest.
- Destroy it in `Ball.destroy()` next to the existing shadow teardown (`Ball.js:99-105`).
- New `landingMarker` setting (default **on**) with a `makeToggle('landingMarker', '🎯 Landing spot')`
  in the settings panel, read once per run through `scene.params` like everything else.
- **Drive-by fix while in `tick()`:** the shadow falloff `260 * (this.radius / 36)`
  (`Ball.js:75`) mixes a design-unit constant with a SCALE-applied radius, so the falloff
  is 2× stronger than intended. Should be `260 * SCALE * (this.radius / (36 * SCALE))`.

Existing depth map for reference: −20 bg, −19 grid, −18 water, −1 ball/player shadows,
0 sprites, 1 dust, 40-43 bar/score, 44-45 hearts, 60-61 popups, 70-72 game over, 80 buttons,
200-201 debug.

---

## Phase 6 — Per-difficulty top-10 leaderboard

New `src/systems/leaderboard.js`, localStorage key `'aob-scores-v1'`:
```js
// { "classic:crazy": [{ name, score, ts }, ...] }  — sorted desc, sliced to 10
bucketOf(mode, difficulty)     // 'custom' difficulty gets its own bucket per mode
top(bucket, n = 10)
qualifies(bucket, score)       // board < 10 entries, or score beats the last
submit(bucket, name, score)    // → 1-based rank
```
Structure the module as a thin sync wrapper over a storage adapter so a hosted backend can
be swapped in later without touching call sites.

- **Name entry:** new `src/ui/nameEntry.js` — an HTML overlay (same approach and CSS idiom
  as `src/ui/settingsPanel.js`; a Phaser-native text input is not worth the pain). Shown
  from `GameOverScene.create()` only when `qualifies()` is true. Default the field to a new
  `playerName` setting so repeat runs are one tap.
- **`GameOverScene`:** after submitting, show `Rank #N` plus the top 3 for the bucket
  alongside the existing Score/Best lines (`GameOverScene.js:44-60`).
- **`settingsPanel.js`:** a `🏆 Top 10` section that renders the board for the currently
  selected mode + difficulty, refreshed from the existing `refresh()` (`:118-132`) so it
  updates when preset or mode buttons are clicked. Keep the existing per-mode "Best" line —
  legacy `aob-best-*` values can't be attributed to a difficulty, so don't try to migrate
  them into buckets.

---

## Phase 7 — Dodgeability guarantee (`src/systems/safety.js`)

**Yes, this is tractable**, because the problem is one-dimensional: the hero only moves
along x at a constant speed, and every ball's trajectory is closed-form (constant `vx`,
elastic vertical bounce). It reduces to *reachable-interval propagation* — a dilate-then-mask
sweep, not a search.

**Algorithm** (pure math, **no Phaser imports** — takes plain `{x, y, vx, vy, r}` objects):
- Horizon `H = 3.0 s`, step `dt = 1/30` → 90 steps. x discretised into `N = 128` bins across
  the hero's legal range.
- For each step, integrate every live ball forward (`dt` Euler + floor reflection —
  numeric rather than closed-form so it stays correct if `ballBounce < 1`), and mark
  `blocked[i]` where the ball circle intersects the hero AABB (half-width `PLAYER_SIZE*0.35`,
  top `GROUND_Y - PLAYER_SIZE*0.85`) centred on bin `i`, plus a small margin.
- `reach` is a `Uint8Array(N)` seeded at the hero's current bin. Each step:
  dilate by `k = ceil(playerSpeed * dt / binWidth)` bins (O(N) sliding window), then
  `AND NOT blocked`.
- If `reach` is all-zero at any step → the state is a forced death.

**Wiring into `Spawner.spawnBall`:** plan the launch with `planLaunch()` (Phase 4b), test
the candidate against the live ball set, and re-roll up to 6 times; if every candidate
fails, skip that spawn for the tick. Multiple balls in one tick are tested **sequentially**,
each against the state including the previously accepted ones.

**Cost:** worst case ≈ 6 candidates × 90 steps × (≈15 balls + 128-bin dilate) ≈ 80 k
integer ops, a few times per second. Negligible.

**Setting:** `guaranteeDodgeable`, default **on**. With it in place, `minApexClearance` can
be relaxed from a blunt "every ball must clear your head" clamp to a soft floor — low fast
balls become allowed whenever they're provably dodgeable, which is exactly the variety
Crazy mode wants.

**Debug view:** extend `src/ui/debugOverlay.js` with an F4 toggle that draws the reachable
corridor along the ground line and logs the spawn rejection rate, so the system can be
watched while playing.

**Honest limits — state these in the code comment:** it guarantees no *forced* death from
the balls alive at spawn time within a 3 s horizon, assuming optimal play. It does not
account for balls spawned later (each of those is separately checked against the state at
*its* spawn time, so the property composes but isn't a global proof), and it says nothing
about how *hard* a survivable line is to actually execute.

This system is also the prerequisite for the bullet-hell / Super Crazy mode idea.

---

## Phase 8 — Backlog

Append to `BACKLOG.md`, in the existing style (enough notes to pick up cold), the ideas
explicitly deferred:
- **Super Crazy / bullet-hell mode** — vertical descending triangles; note that Phase 7's
  `safety.js` is the enabling piece and that it will need a 2-D reachability variant if the
  hero ever moves on both axes.
- **Alternative control schemes** — virtual joystick, and a drag mode (hero tracks finger
  delta rather than absolute position); pairs with bullet-hell.
- **搞笑模式** — must actively catch balls within a time limit or die (inverted objective).
- **Power-ups / 多種道具.**
- **Double-tap dash** — the widened move-speed slider (Phase 4e) covers the immediate need.

---

## Files touched

| Area | Files |
|---|---|
| Responsive arena | `src/config.js`, `src/main.js`, `src/scenes/BootScene.js`, new `src/systems/viewport.js`, `src/systems/arena.js`, `src/objects/Player.js`, `src/scenes/GameScene.js`, `index.html` (safe-area CSS) |
| Input bugs | `src/ui/button.js`, `src/scenes/GameScene.js` |
| Orientation | new `src/orientation.js`, `src/scenes/MenuScene.js`, `index.html` |
| Flight model | new `src/systems/ballistics.js`, `src/objects/Ball.js`, `src/systems/spawner.js`, `src/settings.js`, `src/ui/settingsPanel.js` |
| Landing marker | `src/objects/Ball.js`, `src/settings.js`, `src/ui/settingsPanel.js` |
| Leaderboard | new `src/systems/leaderboard.js`, new `src/ui/nameEntry.js`, `src/scenes/GameOverScene.js`, `src/ui/settingsPanel.js` |
| Dodgeability | new `src/systems/safety.js`, `src/systems/spawner.js`, `src/ui/debugOverlay.js`, `src/settings.js` |
| Docs | `README.md` (controls/settings/architecture), `BACKLOG.md` |

---

## Verification

**Pure logic (no browser)** — `ballistics.js`, `safety.js` and `leaderboard.js` are
deliberately Phaser-free. Add `scripts/logic-check.mjs` (plain Node, no test framework in
this repo) asserting:
- `planLaunch` produces the requested apex within tolerance across all four presets, and the
  apex never drops below `PLAYER_SIZE + minApexClearance`;
- bounce count while crossing lands in the intended band per preset (Easy ≥ 3, Crazy ≥ 1.5 —
  this is the regression test for the two UX complaints);
- `safety.js` returns `false` for a hand-built forced-death case (a wall of balls covering
  the arena) and `true` for a single slow ball;
- `leaderboard` keeps exactly 10 entries, sorted, and `qualifies()` matches `submit()`'s rank.

**Browser** — `npm run dev`:
- Desktop: resize the window narrow → wide, return to the menu, confirm the arena refills
  the window with no bars; confirm mid-run resize doesn't break the HUD or the hero bounds.
- DevTools device emulation: iPhone 14 Pro (landscape **and** portrait), iPad, a 21:9
  window. Confirm no letterbox strips and that the hero reaches both extreme edges.
- Restart repeatedly by tapping "▶ Play Again" and "↻ Restart" off-centre — the hero must
  not move.
- Tap-and-hold in the former top-right dead rectangle → the hero must now respond.
- Play one run per preset and sanity-check the feel against the table in Phase 4a.
- Toggle 🎯 Landing spot on/off; confirm markers land where balls actually land.
- Score a top-10 run, enter a name, confirm it appears in the menu board for that exact
  mode + difficulty and nowhere else.
- F4: watch the safe corridor; it should never collapse to empty during a run.

**Real device** — the orientation work (Phase 3) cannot be validated in emulation. Test on
an actual Android phone (expect the fullscreen + lock path) and an iPhone in Safari (expect
the CSS-rotation fallback, or the rotate prompt if the pointer patch is dropped).

**Build/CI** — `npm run build && npm run preview`, then `npm run smoke`. Extend
`scripts/smoke-test.mjs` with the restart assertion: after triggering a restart, sample
`window.__aob.player.x` (`GameScene.js:109`) over ~500 ms and assert it hasn't moved.
