import * as Phaser from 'phaser';
import { GAME_W, GROUND_Y, BALL_SIZES, PLAYER_SIZE } from '../config.js';
import { PAD } from '../doodle.js';
import { Sfx } from '../audio.js';

// A bouncing ball. Flies in from one side with a random speed + angle, arcs
// under gravity, and bounces elastically on the ground (stable height). The
// launch is clamped so its apex always clears the hero's head — keeping the
// game winnable regardless of the random roll. Despawns once it sails off the
// far side.
//
// Each ball owns a ground shadow that tracks its height (selling the bounce)
// and squashes on landing; the scene drives this via tick() each frame.
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
    this.sizeIdx = sizeIdx;
    this.dir = fromLeft ? 1 : -1;
    this.wasOnFloor = false;

    // Ground shadow, sized/faded each frame from the ball's height.
    this.shadow = scene.add
      .ellipse(x, GROUND_Y + 2, this.radius * 2, this.radius * 0.55, 0x000000, 0.22)
      .setDepth(-1);
  }

  // Configure the body and apply the launch velocity. MUST be called *after* the
  // ball is added to its physics group: adding to the group re-enables the body
  // and resets gravity/bounce/velocity to the group defaults, so doing this in
  // the constructor left balls flying in straight lines (no gravity, no bounce).
  // `elapsed` (seconds survived) gently ramps launch speed for rising pressure.
  launch(elapsed = 0) {
    const p = this.scene.params;
    const ramp = 1 + Math.min(p.speedRampCap, elapsed * p.speedRamp);
    const speedLo = Math.min(p.ballSpeedMin, p.ballSpeedMax);
    const speedHi = Math.max(p.ballSpeedMin, p.ballSpeedMax);
    const speed = Phaser.Math.FloatBetween(speedLo, speedHi) * ramp;
    const angLo = Math.min(p.angleMin, p.angleMax);
    const angHi = Math.max(p.angleMin, p.angleMax);
    const angle = Phaser.Math.DegToRad(Phaser.Math.FloatBetween(angLo, angHi));
    let vx = Math.cos(angle) * speed * this.dir;
    let vy = -Math.sin(angle) * speed;

    // Playability guarantee: the bounce apex (vy^2 / 2g above the floor) must
    // clear the hero's head plus a margin, or the ball would be undodgeable.
    const minApex = PLAYER_SIZE + this.radius + p.minApexClearance;
    const minVy = Math.sqrt(2 * p.gravity * minApex);
    if (-vy < minVy) vy = -minVy;

    this.body.setCircle(this.radius, PAD, PAD);
    this.body.setAllowGravity(true);
    this.body.setGravityY(p.gravity);
    this.setBounce(0, p.ballBounce);
    this.setVelocity(vx, vy);
    this.setAngularVelocity(this.dir * Phaser.Math.Between(60, 200));
    return this;
  }

  // Per-frame upkeep (called from GameScene.update): sync the shadow to the
  // ball's height and detect the landing edge to squash + kick up dust.
  tick() {
    const bottom = this.y + this.radius;
    const height = Math.max(0, GROUND_Y - bottom); // px above the floor
    const t = Phaser.Math.Clamp(1 - height / (260 * (this.radius / 36)), 0.25, 1);
    this.shadow.x = this.x;
    this.shadow.setScale(t, t);
    this.shadow.setAlpha(0.22 * t);

    const onFloor = this.body.onFloor();
    if (onFloor && !this.wasOnFloor) this.land();
    this.wasOnFloor = onFloor;
  }

  // Squash on impact, then spring back; ask the scene to puff dust.
  land() {
    this.scene.tweens.killTweensOf(this);
    this.setScale(1.28, 0.72);
    this.scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.out' });
    if (this.scene.spawnDust) this.scene.spawnDust(this.x, this.radius);
    Sfx.bounce(this.sizeIdx);
  }

  // True once the ball has drifted well off either side and can be culled.
  isOffscreen() {
    return this.x < -2 * this.radius - 40 || this.x > GAME_W + 2 * this.radius + 40;
  }

  destroy(fromScene) {
    if (this.shadow) {
      this.shadow.destroy();
      this.shadow = null;
    }
    super.destroy(fromScene);
  }
}
