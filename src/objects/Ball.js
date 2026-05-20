import * as Phaser from 'phaser';
import {
  GAME_W,
  GROUND_Y,
  GRAVITY,
  BALL_BOUNCE,
  BALL_SIZES,
  BALL_VX_MIN,
  BALL_VX_MAX,
  BALL_VY_MIN,
  BALL_VY_MAX,
} from '../config.js';
import { PAD } from '../doodle.js';

// A bouncing ball. Flies in from one side, arcs under gravity, and bounces on
// the ground forever (a minimum bounce is enforced in GameScene's collider so
// it always stays a threat). Despawns once it sails off the far side.
export default class Ball extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, sizeIdx, colorIdx) {
    const size = BALL_SIZES[sizeIdx];
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -size.r : GAME_W + size.r;
    // Spawn just above the floor so the launch velocity alone sets the (stable,
    // elastic) bounce height — keeps balls in a predictable, threatening band.
    const y = GROUND_Y - size.r - Math.random() * 50;
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
  launch() {
    this.body.setCircle(this.radius, PAD, PAD);
    this.body.setAllowGravity(true);
    this.body.setGravityY(GRAVITY);
    this.setBounce(0, BALL_BOUNCE);
    this.setVelocity(
      this.dir * Phaser.Math.Between(BALL_VX_MIN, BALL_VX_MAX),
      -Phaser.Math.Between(BALL_VY_MIN, BALL_VY_MAX)
    );
    this.setAngularVelocity(this.dir * Phaser.Math.Between(60, 200));
    return this;
  }

  // True once the ball has drifted well off either side and can be culled.
  isOffscreen() {
    return this.x < -120 || this.x > GAME_W + 120;
  }
}
