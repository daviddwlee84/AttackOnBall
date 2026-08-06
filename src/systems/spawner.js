import * as Phaser from 'phaser';
import Ball, { ballRadius } from '../objects/Ball.js';
import NumberPickup from '../objects/NumberPickup.js';
import HeartPickup from '../objects/HeartPickup.js';
import { GAME_W, GROUND_Y, PLAYER_SIZE, BALL_SIZES, BALL_COLORS, PICKUP_INTERVAL, PICKUP_VALUES } from '../config.js';
import { planLaunch, spawnInterval, extraBallChance } from './ballistics.js';
import { isSurvivable, sceneSafetyConfig } from './safety.js';

// Chance of a 2nd / 3rd simultaneous ball, asymptotically approached. Below 1
// on purpose so a lone ball stays possible however long you survive.
const DOUBLE_MAX = 0.9;
const TRIPLE_MAX = 0.75;

// How many alternative launches to try before giving up on a spawn slot.
const SAFETY_RETRIES = 6;

// Drives difficulty: the ball spawn interval decays toward its floor the longer
// you survive, and extra simultaneous balls ramp in so on-screen density keeps
// rising. Both curves taper (see ballistics.js) instead of hitting a wall.
// Number pickups drop on a slower, jittered timer.
export default class Spawner {
  constructor(scene) {
    this.scene = scene;
    this.ballAcc = 0;
    this.pickupAcc = 0;
    this.pickupNext = PICKUP_INTERVAL;
    this.rejected = 0; // launches vetoed by the dodgeability check (debug HUD)
    this.skipped = 0; // spawn slots dropped entirely because nothing was safe
  }

  update(dt, elapsed) {
    const p = this.scene.params;
    this.ballAcc += dt;
    if (this.ballAcc >= spawnInterval(p, elapsed)) {
      this.ballAcc = 0;
      // Always one ball; chance of a 2nd/3rd grows with time for rising density.
      let count = 1;
      if (Math.random() < extraBallChance(elapsed, p.doubleAfter, p.densityRamp, DOUBLE_MAX)) count++;
      if (Math.random() < extraBallChance(elapsed, p.tripleAfter, p.densityRamp, TRIPLE_MAX)) count++;
      // Sequential, so ball 2 is judged against a world that already contains
      // ball 1 — otherwise a pair could be individually safe but jointly lethal.
      const accepted = [];
      for (let i = 0; i < count; i++) {
        const plan = this.pickLaunch(elapsed, accepted);
        if (plan) accepted.push(plan);
      }
      for (const plan of accepted) this.spawnBall(plan);
    }

    this.pickupAcc += dt;
    if (this.pickupAcc >= this.pickupNext) {
      this.pickupAcc = 0;
      this.pickupNext = PICKUP_INTERVAL + Phaser.Math.FloatBetween(-1.5, 2);
      this.spawnPickup();
    }
  }

  // Roll a launch, re-rolling while it would corner the hero. Returns null if
  // every candidate was lethal — better to skip the slot than to hand the
  // player an unwinnable frame.
  pickLaunch(elapsed, pending) {
    const s = this.scene;
    const p = s.params;
    const tries = p.guaranteeDodgeable ? SAFETY_RETRIES : 1;
    for (let i = 0; i < tries; i++) {
      const sizeIdx = Phaser.Math.Between(0, BALL_SIZES.length - 1);
      const plan = planLaunch({
        params: p,
        radius: ballRadius(sizeIdx),
        elapsed,
        arenaW: GAME_W,
        groundY: GROUND_Y,
        playerSize: PLAYER_SIZE,
      });
      plan.sizeIdx = sizeIdx;
      plan.colorIdx = Phaser.Math.Between(0, BALL_COLORS.length - 1);
      if (!p.guaranteeDodgeable) return plan;
      if (isSurvivable(sceneSafetyConfig(s, [...pending, plan]))) return plan;
      this.rejected++;
    }
    this.skipped++;
    return null;
  }

  spawnBall(plan) {
    const ball = new Ball(this.scene, plan.sizeIdx, plan.colorIdx, plan);
    this.scene.balls.add(ball);
    ball.applyPlan(plan);
  }

  spawnPickup() {
    const s = this.scene;
    // In lives mode, a slice of drops are bonus hearts (only while below the cap).
    if (s.mode === 'lives' && s.lives < s.maxLives && Math.random() < s.params.heartDropChance) {
      const heart = new HeartPickup(s);
      s.pickups.add(heart);
      heart.configure();
      return;
    }
    const value = Phaser.Utils.Array.GetRandom(PICKUP_VALUES);
    const pickup = new NumberPickup(s, value);
    s.pickups.add(pickup);
    pickup.configure();
  }
}
