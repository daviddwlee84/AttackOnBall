import * as Phaser from 'phaser';
import { GAME_W, GROUND_Y, BALL_SIZES, BALL_COLORS, SCALE } from '../config.js';
import { PAD } from '../doodle.js';
import { timeToFloor } from '../systems/ballistics.js';
import { Sfx } from '../audio.js';

// A bouncing ball. Flies in from one side, arcs under gravity and bounces
// elastically on the ground (so its apex is stable). Everything about the
// trajectory — where it starts, how high it arcs, how long it takes to cross —
// is decided up front by ballistics.planLaunch(), *before* the object exists,
// so the spawner can reject a launch that would make death unavoidable
// (systems/safety.js) without having to build and destroy sprites.
//
// Each ball owns two ground graphics, both driven from tick() each frame:
//   shadow  a squashed ellipse under the ball, sized by its height (sells the bounce)
//   marker  where it will next land — off / a second shadow / a ring
//           (`landingMarkerMode`)
export default class Ball extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, sizeIdx, colorIdx, plan) {
    super(scene, plan.x, plan.y, `ball-${sizeIdx}-${colorIdx}`);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.radius = plan.r;
    this.sizeIdx = sizeIdx;
    this.dir = plan.dir;
    this.plan = plan;
    this.wasOnFloor = false;

    // Ground shadow, sized/faded each frame from the ball's height.
    this.shadow = scene.add
      .ellipse(plan.x, GROUND_Y + 2, this.radius * 2, this.radius * 0.55, 0x000000, 0.22)
      .setDepth(-1);

    // Predicted landing spot, in one of two styles (see updateMarker):
    //   shadow  the same squashed ellipse this ball already casts, so the cue
    //           reads as the shadow sliding into place rather than as UI
    //   ring    a stroked outline in the ball's own colour — louder, and tells
    //           you which incoming ball the marker belongs to
    this.markerMode = scene.params.landingMarkerMode;
    if (this.markerMode === 'shadow') {
      this.marker = scene.add
        .ellipse(plan.x, GROUND_Y + 2, this.radius * 2, this.radius * 0.55, 0x000000, 0.22)
        .setDepth(-2)
        .setVisible(false);
    } else if (this.markerMode === 'ring') {
      const tint = Phaser.Display.Color.HexStringToColor(BALL_COLORS[colorIdx]).color;
      this.marker = scene.add
        .circle(plan.x, GROUND_Y + 2, this.radius * 0.9)
        .setStrokeStyle(3 * SCALE, tint, 0.9)
        .setDepth(-2)
        .setVisible(false);
    }
  }

  // Apply the planned launch. MUST be called *after* the ball is added to its
  // physics group: adding to the group re-enables the body and resets
  // gravity/bounce/velocity to the group defaults, so doing this in the
  // constructor left balls flying in straight lines (no gravity, no bounce).
  applyPlan(plan = this.plan) {
    const p = this.scene.params;
    this.body.setCircle(this.radius, PAD, PAD);
    this.body.setAllowGravity(true);
    this.body.setGravityY(p.gravity);
    this.setBounce(0, p.ballBounce);
    this.setVelocity(plan.vx, plan.vy);
    this.setAngularVelocity(this.dir * Phaser.Math.Between(60, 200));
    return this;
  }

  // Per-frame upkeep (called from GameScene.update): sync the shadow and the
  // landing marker to the ball's flight, and detect the landing edge to squash
  // + kick up dust.
  tick() {
    const height = Math.max(0, GROUND_Y - (this.y + this.radius)); // px above the floor
    // Falloff reference is a design-unit distance, so compare against a
    // design-unit radius ratio rather than the SCALE-applied radius.
    const t = Phaser.Math.Clamp(1 - height / (260 * SCALE * (this.radius / (36 * SCALE))), 0.25, 1);
    this.shadow.x = this.x;
    this.shadow.setScale(t, t);
    this.shadow.setAlpha(0.22 * t);

    if (this.marker) this.updateMarker(height);

    const onFloor = this.body.onFloor();
    if (onFloor && !this.wasOnFloor) this.land();
    this.wasOnFloor = onFloor;
  }

  // Mark the ground where this ball's underside will next touch down, growing
  // more insistent as the landing approaches.
  updateMarker(height) {
    const g = this.scene.params.gravity;
    const t = timeToFloor(height, this.body.velocity.y, g);
    const x = this.x + this.body.velocity.x * t;
    // Nothing useful to point at once the landing would happen off-field.
    if (!(t > 0.02) || x < 0 || x > GAME_W) {
      this.marker.setVisible(false);
      return;
    }
    this.marker.setVisible(true);
    this.marker.x = x;
    const k = Phaser.Math.Clamp(1 - t / 1.1, 0, 1); // 0 far off … 1 about to land

    if (this.markerMode === 'shadow') {
      // Deliberately converges on this ball's *own* shadow values (scale 1,
      // alpha 0.22 at touchdown, and the ellipse is already sized from the
      // radius) so the two become indistinguishable at the moment of impact —
      // the cue is the shadow arriving early, not a separate widget.
      const s = 0.5 + 0.5 * k;
      this.marker.setScale(s, s);
      this.marker.setAlpha(0.04 + 0.18 * k);
    } else {
      this.marker.setAlpha(Phaser.Math.Clamp(0.15 + 0.75 * k, 0.15, 0.9));
    }
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
  // Kept wider than the spawn margin so a freshly launched ball is never culled
  // before it has flown in.
  isOffscreen() {
    const slack = 2 * this.radius + this.scene.params.spawnMarginMax + 40 * SCALE;
    return this.x < -slack || this.x > GAME_W + slack;
  }

  destroy(fromScene) {
    if (this.shadow) {
      this.shadow.destroy();
      this.shadow = null;
    }
    if (this.marker) {
      this.marker.destroy();
      this.marker = null;
    }
    super.destroy(fromScene);
  }
}

// Radius for a size index — handy for planning a launch before the Ball exists.
export function ballRadius(sizeIdx) {
  return BALL_SIZES[sizeIdx].r;
}
