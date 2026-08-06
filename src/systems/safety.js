// "Can this still be survived?" — a dodgeability check run at spawn time.
//
// Pure math: no Phaser, no scene. Takes plain {x, y, vx, vy, r} ball states and
// a plain config object, so it runs from Node in scripts/logic-check.mjs.
//
// WHY IT'S CHEAP
// --------------
// The hero only moves along one axis at a constant speed, and every ball's
// trajectory is deterministic. So this isn't a search — it's reachable-interval
// propagation over a time x position grid:
//
//   reach[t+1] = dilate(reach[t], playerSpeed·dt) AND NOT blocked[t+1]
//
// Start from the hero's current cell, widen it by how far they could run in one
// step, knock out anything a ball occupies, repeat. If the reachable set ever
// empties, every line of play from here ends in a hit — the state is a forced
// death, and the spawn that would create it gets rejected and re-rolled.
//
// WHAT IT DOES AND DOESN'T PROMISE
// --------------------------------
// It guarantees that, *assuming optimal play*, the balls alive at spawn time
// cannot corner the hero within HORIZON seconds. It says nothing about balls
// spawned later (each of those is checked against the state at its own spawn
// time, so the property composes but is not a global proof), and nothing about
// how hard a surviving line is to actually execute. It is a floor on fairness,
// not a difficulty setting.

export const HORIZON = 3.0; // seconds simulated ahead
export const STEP = 1 / 60; // simulation timestep (matches the game's own)
export const BINS = 192; // x-axis resolution

// Advance one ball by `dt` with an elastic (or damped) floor bounce. Numeric
// rather than closed-form so it stays correct when ballBounce != 1.
function stepBall(b, dt, gravity, bounce, groundY) {
  b.vy += gravity * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  const floor = groundY - b.r;
  if (b.y > floor) {
    b.y = floor;
    if (b.vy > 0) b.vy = -b.vy * bounce;
  }
}

// Smallest vertical gap between the segment y0->y1 and the band [top, bottom].
// Zero when the ball's centre passes through the hero's height at any point in
// the interval. Sampling only the endpoints of each step would let a fast ball
// tunnel straight through the hero between two samples, which made the whole
// analysis optimistic — it declared states safe that the game then killed you in.
function bandGap(y0, y1, top, bottom) {
  const lo = Math.min(y0, y1);
  const hi = Math.max(y0, y1);
  if (hi >= top && lo <= bottom) return 0;
  return lo > bottom ? lo - bottom : top - hi;
}

// Widen a boolean row by `k` cells on each side, in O(n) via a run-length
// scan (a sliding-window OR).
function dilate(src, dst, k) {
  const n = src.length;
  let last = -1e9;
  for (let i = 0; i < n; i++) {
    if (src[i]) last = i;
    dst[i] = i - last <= k ? 1 : 0;
  }
  last = 1e9;
  for (let i = n - 1; i >= 0; i--) {
    if (src[i]) last = i;
    if (!dst[i] && last - i <= k) dst[i] = 1;
  }
  return dst;
}

/**
 * @param {object} cfg
 *   balls        [{x, y, vx, vy, r}]  live ball states (copied, not mutated)
 *   playerX      current hero centre
 *   playerSpeed  px/s
 *   playerHalfW  half the hero hitbox width
 *   playerTop    y of the top of the hero hitbox
 *   minX, maxX   hero's legal centre range
 *   gravity, bounce, groundY
 *   horizon, step, bins  (optional overrides)
 * @returns {{survivable: boolean, tDeath: number, reach: Uint8Array}}
 *   tDeath is the time at which the hero runs out of room (Infinity if never).
 */
export function analyseSurvivability(cfg) {
  const horizon = cfg.horizon ?? HORIZON;
  const step = cfg.step ?? STEP;
  const bins = cfg.bins ?? BINS;
  const { minX, maxX, playerSpeed, playerHalfW, playerTop, gravity, bounce, groundY } = cfg;
  const playerBottom = cfg.playerBottom ?? groundY;

  const span = maxX - minX;
  if (span <= 0) return { survivable: true, tDeath: Infinity, reach: new Uint8Array(0) };
  const binW = span / bins;
  const binCentre = (i) => minX + (i + 0.5) * binW;

  // Local mutable copies — callers keep their live objects untouched.
  const sim = cfg.balls.map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, r: b.r }));

  let reach = new Uint8Array(bins);
  let next = new Uint8Array(bins);
  const blocked = new Uint8Array(bins);

  const seed = Math.round((cfg.playerX - minX) / binW - 0.5);
  reach[Math.max(0, Math.min(bins - 1, seed))] = 1;

  // How many bins the hero covers per step — FRACTIONAL, and carried across
  // steps. Rounding this up (the obvious `Math.ceil`) hands the hero up to
  // double its real speed, which quietly turns the whole analysis optimistic:
  // it green-lights states the game then kills you in. Rounding down instead
  // would drift pessimistic. Carrying the remainder is exact.
  const rate = (playerSpeed * step) / binW;
  const steps = Math.ceil(horizon / step);
  let carry = 0;
  let dilateBy = Math.max(1, Math.round(rate)); // reported, for path-following
  // Per-step snapshots of the corridor. Needed to *follow* a safe path rather
  // than merely know one exists (and to draw the corridor narrowing over time
  // in the F4 overlay).
  const rows = cfg.keepRows ? [] : null;

  for (let s = 0; s < steps; s++) {
    blocked.fill(0);
    for (const b of sim) {
      // Swept test over the whole step, not a snapshot at its end: take the
      // ball's closest vertical approach to the hero's band anywhere in the
      // interval, and block the full horizontal span it travels through.
      const x0 = b.x;
      const y0 = b.y;
      stepBall(b, step, gravity, bounce, groundY);
      const dy = bandGap(y0, b.y, playerTop, playerBottom);
      if (dy >= b.r) continue; // stayed clear of the hero's height all step
      const rEff = Math.sqrt(b.r * b.r - dy * dy);
      const half = rEff + playerHalfW;
      let lo = Math.floor((Math.min(x0, b.x) - half - minX) / binW);
      let hi = Math.ceil((Math.max(x0, b.x) + half - minX) / binW);
      if (hi < 0 || lo >= bins) continue;
      lo = Math.max(0, lo);
      hi = Math.min(bins - 1, hi);
      for (let i = lo; i <= hi; i++) blocked[i] = 1;
    }

    // Mask BEFORE dilating as well as after. Masking only after would let the
    // hero start the step inside the ball's swept region and escape it within
    // that same step — a free frame of reaction right at the moment of contact.
    // That is why deaths used to happen with the analysis still reporting
    // "safe": it was optimistic by exactly one step. Requiring the position to
    // be clear at both ends approximates a swept hero-vs-swept-ball test.
    for (let i = 0; i < bins; i++) if (blocked[i]) reach[i] = 0;

    carry += rate;
    const k = Math.floor(carry);
    carry -= k;
    next = dilate(reach, next, k);
    let alive = 0;
    for (let i = 0; i < bins; i++) {
      const ok = next[i] && !blocked[i];
      next[i] = ok ? 1 : 0;
      alive += ok;
    }
    const tmp = reach;
    reach = next;
    next = tmp;
    if (rows) rows.push(Uint8Array.from(reach));

    if (alive === 0) return { survivable: false, tDeath: (s + 1) * step, reach, rows, binW, minX, dilateBy };
  }
  return { survivable: true, tDeath: Infinity, reach, rows, binW, minX, dilateBy };
}

export function isSurvivable(cfg) {
  return analyseSurvivability(cfg).survivable;
}

// Convenience: build the analyser config from a live GameScene plus an optional
// candidate launch plan that hasn't been instantiated yet.
export function sceneSafetyConfig(scene, extraPlans = []) {
  const p = scene.params;
  const balls = scene.balls.getChildren().map((b) => ({
    x: b.x,
    y: b.y,
    vx: b.body.velocity.x,
    vy: b.body.velocity.y,
    r: b.radius,
  }));
  for (const plan of extraPlans) {
    balls.push({ x: plan.x, y: plan.y, vx: plan.vx, vy: plan.vy, r: plan.r });
  }
  return {
    balls,
    playerX: scene.player.x,
    playerSpeed: scene.player.speed,
    playerHalfW: scene.playerHalfW,
    playerTop: scene.playerTop,
    playerBottom: scene.playerBottom,
    minX: scene.playerMinX,
    maxX: scene.playerMaxX,
    gravity: p.gravity,
    bounce: p.ballBounce,
    groundY: scene.groundY,
  };
}
