// Headless checks for the Phaser-free game logic: launch planning
// (src/systems/ballistics.js), the dodgeability analysis
// (src/systems/safety.js) and the leaderboard store
// (src/systems/leaderboard.js). Plain Node, no test framework and no browser —
// run it with `npm run logic`.
//
// The ballistics assertions are the regression test for the two complaints that
// motivated the flight-model rework: Easy balls that didn't arc high enough to
// duck, and Crazy balls that flew clean over the arena without bouncing.
import { PRESETS } from '../src/settings.js';
import { planLaunch, bouncePeriod, spawnInterval, extraBallChance, timeToFloor } from '../src/systems/ballistics.js';
import { analyseSurvivability } from '../src/systems/safety.js';
import { createLeaderboard } from '../src/systems/leaderboard.js';

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ok   ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// Design-unit world (SCALE is not applied here; the maths is scale-invariant).
const GRAVITY = 1000;
const PLAYER_SIZE = 56;
const GROUND_Y = 476;
const ARENA_W = 960;
const ADVANCED = {
  gravity: GRAVITY,
  ballBounce: 1,
  minApexClearance: 20,
  spawnMarginMin: 40,
  spawnMarginMax: 160,
  speedRamp: 0.006,
  speedRampCap: 0.6,
};

// Deterministic sampler so "min", "max" and "middle" rolls are all exercised.
const fixedRng = (v) => () => v;

console.log('\nballistics — per-preset flight envelope');
// Minimum apex, in hero-heights — the "Easy balls must arc high enough to duck"
// requirement. The bounce floor comes from each preset's own minBounces, which
// planLaunch must honour even at the far end of the pressure ramp.
const EXPECT = {
  easy: { minApexRatio: 2.5 },
  medium: { minApexRatio: 1.9 },
  hard: { minApexRatio: 1.6 },
  crazy: { minApexRatio: 1.5 },
};

for (const [name, preset] of Object.entries(PRESETS)) {
  const params = { ...ADVANCED, ...preset };
  let worstBounces = Infinity;
  let worstApex = Infinity;
  let apexOk = true;
  // Sample the whole random range, including the pressure ramp at t=0 and t=180.
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    for (const elapsed of [0, 60, 180]) {
      for (const radius of [18, 48]) {
        const plan = planLaunch({
          params,
          radius,
          elapsed,
          arenaW: ARENA_W,
          groundY: GROUND_Y,
          playerSize: PLAYER_SIZE,
          rng: fixedRng(v),
        });
        const period = bouncePeriod(plan.apex, GRAVITY);
        const crossing = ARENA_W / Math.abs(plan.vx);
        worstBounces = Math.min(worstBounces, crossing / period);
        worstApex = Math.min(worstApex, plan.apex);
        if (plan.apex < PLAYER_SIZE + params.minApexClearance - 1e-6) apexOk = false;
        // The ball must start off-screen and be launched upward.
        if (plan.vy >= 0) apexOk = false;
        if (plan.x > -radius && plan.x < ARENA_W + radius) apexOk = false;
      }
    }
  }
  const e = EXPECT[name];
  check(
    `${name}: bounces while crossing >= ${preset.minBounces}`,
    worstBounces >= preset.minBounces - 1e-6,
    `worst ${worstBounces.toFixed(2)}`
  );
  check(
    `${name}: apex >= ${e.minApexRatio} hero-heights`,
    worstApex / PLAYER_SIZE >= e.minApexRatio,
    `worst ${(worstApex / PLAYER_SIZE).toFixed(2)}x`
  );
  check(`${name}: apex floor + off-screen launch respected`, apexOk);
}

console.log('\nballistics — ramps taper, never step');
{
  const p = { ...ADVANCED, ...PRESETS.medium };
  const iv = [0, 10, 30, 60, 120, 300].map((t) => spawnInterval(p, t));
  check('spawn interval decreases monotonically', iv.every((v, i) => i === 0 || v < iv[i - 1]), iv.map((v) => v.toFixed(2)).join(' > '));
  check('spawn interval never dips below its floor', Math.min(...iv) >= p.spawnMin, `min ${Math.min(...iv).toFixed(3)} >= ${p.spawnMin}`);
  const dens = [20, 60, 200, 1000].map((t) => extraBallChance(t, p.doubleAfter, p.densityRamp, 0.9));
  check('extra-ball chance stays below its cap', dens.every((v) => v < 0.9), `max ${Math.max(...dens).toFixed(3)}`);
  check('extra-ball chance is 0 before its threshold', extraBallChance(5, p.doubleAfter, p.densityRamp, 0.9) === 0);
}

console.log('\nballistics — timeToFloor');
{
  // Dropped from 500px at rest: t = sqrt(2h/g).
  const t = timeToFloor(500, 0, GRAVITY);
  check('free fall', Math.abs(t - Math.sqrt((2 * 500) / GRAVITY)) < 1e-9, `t=${t.toFixed(4)}`);
  // Already on the floor, moving down — lands now.
  check('at the floor', Math.abs(timeToFloor(0, 200, GRAVITY)) < 1e-9, `t=${timeToFloor(0, 200, GRAVITY)}`);
  // Moving upward still returns the *later* (descending) root.
  check('rising ball lands later', timeToFloor(100, -400, GRAVITY) > timeToFloor(100, 0, GRAVITY));
}

console.log('\nsafety — reachability');
const baseCfg = {
  playerX: ARENA_W / 2,
  playerSpeed: 380,
  playerHalfW: PLAYER_SIZE * 0.35,
  playerTop: GROUND_Y - PLAYER_SIZE * 0.85,
  minX: 6,
  maxX: ARENA_W - 6,
  gravity: GRAVITY,
  bounce: 1,
  groundY: GROUND_Y,
};
{
  const oneSlowBall = analyseSurvivability({
    ...baseCfg,
    balls: [{ x: -30, y: GROUND_Y - 30, vx: 250, vy: -500, r: 30 }],
  });
  check('a single slow ball is survivable', oneSlowBall.survivable);

  // A solid wall of overlapping balls sweeping the arena at hero height leaves
  // nowhere to stand.
  const wall = [];
  for (let x = -40; x < ARENA_W + 200; x += 40) {
    wall.push({ x, y: GROUND_Y - 20, vx: 0, vy: 0, r: 40 });
  }
  const trapped = analyseSurvivability({ ...baseCfg, balls: wall });
  check('a wall of balls is NOT survivable', !trapped.survivable, `tDeath=${trapped.tDeath.toFixed(2)}s`);

  // Two balls converging on the hero from both sides, faster than they can run:
  // still escapable only if a gap exists. Here they close completely.
  const pincer = analyseSurvivability({
    ...baseCfg,
    balls: [
      { x: 40, y: GROUND_Y - 20, vx: 900, vy: 0, r: 60 },
      { x: ARENA_W - 40, y: GROUND_Y - 20, vx: -900, vy: 0, r: 60 },
    ],
  });
  check('a closing pincer is NOT survivable', !pincer.survivable, `tDeath=${pincer.tDeath.toFixed(2)}s`);

  // Balls passing overhead must not block. Short horizon on purpose: they are
  // in free fall, so over a full 3s they would land and legitimately block.
  const overhead = analyseSurvivability({
    ...baseCfg,
    horizon: 0.3,
    balls: Array.from({ length: 12 }, (_, i) => ({
      x: i * 80,
      y: GROUND_Y - 400,
      vx: 0,
      vy: 0,
      r: 30,
    })),
  });
  check('balls above head height do not block', overhead.survivable);

  // A faster hero survives strictly more situations. It has to be a *reachable
  // gap* rather than a pincer: motion here is one-dimensional, so two balls
  // closing from both sides are inescapable at any speed.
  const wallWithGap = [];
  for (let x = 0; x <= ARENA_W; x += 60) {
    if (x > 690 && x < 810) continue; // the gap the hero must run to
    wallWithGap.push({ x, y: GROUND_Y - 500, vx: 0, vy: 0, r: 40 });
  }
  const gapCfg = { ...baseCfg, playerX: 100, horizon: 1.2, balls: wallWithGap };
  const slow = analyseSurvivability({ ...gapCfg, playerSpeed: 120 });
  const fast = analyseSurvivability({ ...gapCfg, playerSpeed: 1400 });
  check(
    'hero speed decides whether a gap is reachable',
    !slow.survivable && fast.survivable,
    `slow=${slow.survivable} fast=${fast.survivable}`
  );
}

console.log('\nsafety — cost');
{
  const balls = Array.from({ length: 18 }, (_, i) => ({
    x: i * 55,
    y: GROUND_Y - 40 - (i % 5) * 30,
    vx: (i % 2 ? 1 : -1) * 400,
    vy: -300,
    r: 20 + (i % 4) * 10,
  }));
  const t0 = process.hrtime.bigint();
  const N = 200;
  for (let i = 0; i < N; i++) analyseSurvivability({ ...baseCfg, balls });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  check('one analysis stays well under a frame', ms < 4, `${ms.toFixed(3)} ms with 18 balls`);
}

console.log('\nleaderboard');
{
  const mem = new Map();
  const store = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
  };
  const lb = createLeaderboard(store);
  const bucket = lb.bucketOf('classic', 'crazy');
  check('bucket key', bucket === 'classic:crazy', bucket);

  for (let i = 1; i <= 15; i++) lb.submit(bucket, `p${i}`, i);
  const top = lb.top(bucket);
  check('keeps only ten', top.length === 10, `${top.length}`);
  check('sorted descending', top.every((e, i) => i === 0 || e.score <= top[i - 1].score), top.map((e) => e.score).join(','));
  check('keeps the best, drops the rest', top[0].score === 15 && top[9].score === 6);
  check('a low score no longer qualifies', !lb.qualifies(bucket, 3));
  check('a high score qualifies', lb.qualifies(bucket, 99));
  check('rank is 1-based', lb.submit(bucket, 'new', 100) === 1);
  check('other buckets are untouched', lb.top(lb.bucketOf('lives', 'easy')).length === 0);
  check('custom gets its own bucket', lb.bucketOf('classic', 'custom') === 'classic:custom');
  const reread = createLeaderboard(store);
  check('survives a reload', reread.top(bucket)[0].score === 100);
}

console.log('');
if (failures) {
  console.error(`LOGIC FAIL — ${failures} check(s) failed`);
  process.exit(1);
}
console.log('LOGIC PASS — all checks passed');
