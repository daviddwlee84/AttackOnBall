import * as Phaser from 'phaser';
import Ball from '../objects/Ball.js';
import NumberPickup from '../objects/NumberPickup.js';
import {
  BALL_SIZES,
  BALL_COLORS,
  BALL_SPAWN_START,
  BALL_SPAWN_MIN,
  BALL_SPAWN_RAMP,
  PICKUP_INTERVAL,
  PICKUP_VALUES,
} from '../config.js';

// Drives difficulty: ball spawn interval shrinks the longer you survive, while
// number pickups drop on a slower, jittered timer.
export default class Spawner {
  constructor(scene) {
    this.scene = scene;
    this.ballAcc = 0;
    this.pickupAcc = 0;
    this.pickupNext = PICKUP_INTERVAL;
  }

  update(dt, elapsed) {
    const interval = Math.max(BALL_SPAWN_MIN, BALL_SPAWN_START - elapsed * BALL_SPAWN_RAMP);
    this.ballAcc += dt;
    if (this.ballAcc >= interval) {
      this.ballAcc = 0;
      this.spawnBall();
    }

    this.pickupAcc += dt;
    if (this.pickupAcc >= this.pickupNext) {
      this.pickupAcc = 0;
      this.pickupNext = PICKUP_INTERVAL + Phaser.Math.FloatBetween(-1.5, 2);
      this.spawnPickup();
    }
  }

  spawnBall() {
    const sizeIdx = Phaser.Math.Between(0, BALL_SIZES.length - 1);
    const colorIdx = Phaser.Math.Between(0, BALL_COLORS.length - 1);
    const ball = new Ball(this.scene, sizeIdx, colorIdx);
    this.scene.balls.add(ball);
    ball.launch();
  }

  spawnPickup() {
    const value = Phaser.Utils.Array.GetRandom(PICKUP_VALUES);
    const pickup = new NumberPickup(this.scene, value);
    this.scene.pickups.add(pickup);
    pickup.configure();
  }
}
