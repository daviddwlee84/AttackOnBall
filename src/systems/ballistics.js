// Pure launch math for the balls. No Phaser, no scene, no DOM — so it can be
// exercised straight from Node (scripts/logic-check.mjs) and reused by the
// dodgeability simulator in systems/safety.js.
//
// WHY THIS EXISTS
// ---------------
// The old model picked a random *speed* and *launch angle*. That couples the
// two properties difficulty actually cares about, and it made the presets lie:
//
//   apex = (v·sinθ)² / 2g          horizontal pressure = v·cosθ
//
// so Easy's slow balls produced the *lowest* arcs — they got clamped to the
// bare minimum head clearance and became the hardest thing in the game to duck
// — while Crazy's fast balls got so much horizontal speed that they crossed the
// whole arena in a single arc and never threatened anything.
//
// The model here parameterises the two independently:
//
//   apex      how far the ball's lowest point clears the water line, in design
//             px. Radius-independent: a ball resting on the floor has its
//             centre at GROUND_Y - r, so its bottom rises exactly vy²/2g.
//             With PLAYER_SIZE = 56, apex reads directly as hero-heights.
//   crossTime how many seconds it takes to traverse the arena. Time, not speed,
//             because the arena width now varies per device.
//
// Bounces-while-crossing then falls out of the two: crossTime / bouncePeriod.

// Vertical speed needed to raise the ball's underside `apex` above the floor.
export function apexToVy(apex, gravity) {
  return Math.sqrt(2 * gravity * apex);
}

// Seconds between two ground contacts for a given apex (elastic bounce).
export function bouncePeriod(apex, gravity) {
  return 2 * Math.sqrt((2 * apex) / gravity);
}

// Time until the ball's underside next touches the floor, given its current
// height above it and its current vertical velocity in Phaser's *down-positive*
// convention. Height falls as y grows, so H(t) = h - vy·t - ½gt²; solving
// H = 0 for the positive root gives the expression below. Note the sign of vy:
// a rising ball (vy < 0) lands later, not sooner.
export function timeToFloor(height, vy, gravity) {
  const h = Math.max(0, height);
  const disc = vy * vy + 2 * gravity * h;
  return (-vy + Math.sqrt(Math.max(0, disc))) / gravity;
}

// Difficulty ramps. All three used to be linear-then-clamped, which meant they
// slammed into their ceiling and stopped contributing; the density one wasn't
// even capped, so past `doubleAfter + densityRamp` *every* tick spawned an
// extra ball. These are asymptotic instead — always still rising, never
// stepping. Time constants are derived from the old per-second rates so the
// existing preset numbers keep their initial slope.

export function spawnInterval(p, elapsed) {
  const span = p.spawnStart - p.spawnMin;
  if (span <= 0 || p.spawnRamp <= 0) return p.spawnMin;
  const tau = span / p.spawnRamp;
  return p.spawnMin + span * Math.exp(-elapsed / tau);
}

// Probability of an *additional* simultaneous ball once `after` seconds have
// passed. pMax < 1 keeps single-ball spawns possible forever.
export function extraBallChance(elapsed, after, densityRamp, pMax) {
  if (elapsed <= after || densityRamp <= 0) return 0;
  return pMax * (1 - Math.exp(-(elapsed - after) / densityRamp));
}

// Horizontal pressure multiplier: shortens crossTime as the run goes on.
// Deliberately does NOT touch apex — the arcs stay as readable at 3 minutes as
// they are at 3 seconds; only the pace rises.
export function pressureRamp(p, elapsed) {
  if (p.speedRampCap <= 0 || p.speedRamp <= 0) return 1;
  const tau = p.speedRampCap / p.speedRamp;
  return 1 + p.speedRampCap * (1 - Math.exp(-elapsed / tau));
}

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Work out a ball's launch without touching the scene, so a candidate can be
 * rejected (see systems/safety.js) before anything is instantiated.
 *
 * @returns {{x,y,vx,vy,r,apex,crossTime,dir}} spawn state, in game units.
 */
export function planLaunch({ params: p, radius, elapsed = 0, arenaW, groundY, playerSize, rng = Math.random }) {
  const dir = rng() < 0.5 ? 1 : -1;

  // Random off-screen head start. Because the ball is launched from the floor,
  // varying this also varies where in its bounce cycle it enters the arena —
  // free phase variety, instead of every ball arriving at the same point.
  const margin = lerp(p.spawnMarginMin, p.spawnMarginMax, rng());

  // Occasional high lob. Sampling apex from one narrow band makes every ball
  // trace more or less the same arc, which reads as monotonous however varied
  // the speeds are. A small chance of drawing from a much taller band —
  // deliberately allowed to exceed the top of the screen — restores the sense
  // that any given ball could do something different.
  const lob = rng() < (p.lobChance || 0);
  const apexLo = lob ? p.apexMax : p.apexMin;
  const apexHi = lob ? Math.max(p.lobApexMax, p.apexMax) : p.apexMax;

  // Hard floor on the arc so a ball can never be physically un-duckable.
  const apex = Math.max(lerp(apexLo, apexHi, rng()), playerSize + p.minApexClearance);
  const vy = -apexToVy(apex, p.gravity);

  // crossTime is defined over the arena width, so the margin costs extra
  // off-screen time rather than making the ball faster on screen.
  //
  // The floor matters: without it the pressure ramp keeps shortening crossTime
  // until balls once again cross in a single arc and stop being a threat at all
  // — exactly the "Crazy balls just fly over the field" problem. Past this
  // point extra difficulty has to come from ball *count*, not raw speed.
  //
  // A lob keeps a *lower* bounce floor than a normal ball: its arc is already
  // several seconds long, so demanding the preset's 2-3 bounces would drag the
  // crossing out to something sluggish. One bounce is the actual requirement —
  // the ball must land inside the arena rather than sail clean over it.
  const minBounces = lob ? p.lobMinBounces : p.minBounces;
  const minCross = minBounces * bouncePeriod(apex, p.gravity);
  const crossTime = Math.max(lerp(p.crossMin, p.crossMax, rng()) / pressureRamp(p, elapsed), minCross);
  const vx = (arenaW / crossTime) * dir;

  return {
    x: dir > 0 ? -(radius + margin) : arenaW + radius + margin,
    y: groundY - radius,
    vx,
    vy,
    r: radius,
    apex,
    crossTime,
    dir,
    lob,
  };
}
