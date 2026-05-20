import * as Phaser from 'phaser';
import {
  GAME_W,
  GROUND_Y,
  GRAVITY,
  BALL_BOUNCE,
  BALL_SIZES,
  BALL_SPEED_MIN,
  BALL_SPEED_MAX,
  BALL_ANGLE_MIN,
  BALL_ANGLE_MAX,
  BALL_SPEED_RAMP,
  BALL_SPEED_RAMP_CAP,
  MIN_APEX_CLEARANCE,
  PLAYER_SIZE,
} from '../config.js';
import { PAD } from '../doodle.js';

// A bouncing ball. Flies in from one side with a random speed + angle, arcs
// under gravity, and bounces elastically on the ground (stable height). The
// launch is clamped so its apex always clears the hero's head — keeping the
// game winnable regardless of the random roll. Despawns once it sails off the
// far side.
export default class Ball extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, sizeIdx, colorIdx) {
    const size = BALL_SIZES[sizeIdx];
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -size.r : GAME_W + size.r;
    // Spawn just above the floor so the launch velocity alone sets the (stable,
    // elastic) bounce height — keeps balls in a predictable, threatening band.
    const y = GROUND_Y - size.r - Math.random() * size.r;
    super(scene, x, y, `ball-${sizeIdx}-${colorIdx}`);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.radius = size.r;
    this.dir = fromLeft ? 1 : -1;
  }

  // Configure the body and apply the launch velocity. MUST be called *after* the
  // ball is added to its physics group: adding to the group re-enables the body
  // and resets gravity/bounce/velocity to the group defaults, so doing this in
  // the constructor left balls flying in straight lines (no gravity, no bounce).
  // `elapsed` (seconds survived) gently ramps launch speed for rising pressure.
  launch(elapsed = 0) {
    const ramp = 1 + Math.min(BALL_SPEED_RAMP_CAP, elapsed * BALL_SPEED_RAMP);
    const speed = Phaser.Math.FloatBetween(BALL_SPEED_MIN, BALL_SPEED_MAX) * ramp;
    const angle = Phaser.Math.DegToRad(Phaser.Math.FloatBetween(BALL_ANGLE_MIN, BALL_ANGLE_MAX));
    let vx = Math.cos(angle) * speed * this.dir;
    let vy = -Math.sin(angle) * speed;

    // Playability guarantee: the bounce apex (vy^2 / 2g above the floor) must
    // clear the hero's head plus a margin, or the ball would be undodgeable.
    const minApex = PLAYER_SIZE + this.radius + MIN_APEX_CLEARANCE;
    const minVy = Math.sqrt(2 * GRAVITY * minApex);
    if (-vy < minVy) vy = -minVy;

    this.body.setCircle(this.radius, PAD, PAD);
    this.body.setAllowGravity(true);
    this.body.setGravityY(GRAVITY);
    this.setBounce(0, BALL_BOUNCE);
    this.setVelocity(vx, vy);
    this.setAngularVelocity(this.dir * Phaser.Math.Between(60, 200));
    return this;
  }

  // True once the ball has drifted well off either side and can be culled.
  isOffscreen() {
    return this.x < -2 * this.radius - 40 || this.x > GAME_W + 2 * this.radius + 40;
  }
}
