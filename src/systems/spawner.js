import * as Phaser from 'phaser';
import Ball from '../objects/Ball.js';
import NumberPickup from '../objects/NumberPickup.js';
import HeartPickup from '../objects/HeartPickup.js';
import { BALL_SIZES, BALL_COLORS, PICKUP_INTERVAL, PICKUP_VALUES } from '../config.js';

// Drives difficulty: ball spawn interval shrinks the longer you survive, and
// extra simultaneous balls ramp in over time so on-screen density keeps rising.
// Number pickups drop on a slower, jittered timer.
export default class Spawner {
  constructor(scene) {
    this.scene = scene;
    this.ballAcc = 0;
    this.pickupAcc = 0;
    this.pickupNext = PICKUP_INTERVAL;
  }

  update(dt, elapsed) {
    const p = this.scene.params;
    const interval = Math.max(p.spawnMin, p.spawnStart - elapsed * p.spawnRamp);
    this.ballAcc += dt;
    if (this.ballAcc >= interval) {
      this.ballAcc = 0;
      // Always one ball; chance of a 2nd/3rd grows with time for rising density.
      let count = 1;
      if (elapsed > p.doubleAfter && Math.random() < (elapsed - p.doubleAfter) / p.densityRamp) count++;
      if (elapsed > p.tripleAfter && Math.random() < (elapsed - p.tripleAfter) / p.densityRamp) count++;
      for (let i = 0; i < count; i++) this.spawnBall(elapsed);
    }

    this.pickupAcc += dt;
    if (this.pickupAcc >= this.pickupNext) {
      this.pickupAcc = 0;
      this.pickupNext = PICKUP_INTERVAL + Phaser.Math.FloatBetween(-1.5, 2);
      this.spawnPickup();
    }
  }

  spawnBall(elapsed) {
    const sizeIdx = Phaser.Math.Between(0, BALL_SIZES.length - 1);
    const colorIdx = Phaser.Math.Between(0, BALL_COLORS.length - 1);
    const ball = new Ball(this.scene, sizeIdx, colorIdx);
    this.scene.balls.add(ball);
    ball.launch(elapsed);
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
