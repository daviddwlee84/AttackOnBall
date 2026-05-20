import * as Phaser from 'phaser';
import { GAME_W, SCALE } from '../config.js';

// A falling number the player walks over to add straight to their score.
export default class NumberPickup extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, value) {
    const x = Phaser.Math.Between(40 * SCALE, GAME_W - 40 * SCALE);
    super(scene, x, -40 * SCALE, `num-${value}`);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.value = value;
  }

  // Configure the body — call *after* adding to the physics group (the group
  // resets body settings, same gotcha as Ball).
  configure() {
    this.body.setCircle(20 * SCALE, 4 * SCALE, 4 * SCALE);
    this.body.setAllowGravity(true);
    this.body.setGravityY(this.scene.params.gravity * 0.35); // floats down gently
    this.setBounce(0, 0.3);

    // Fade out if left uncollected so the floor doesn't clutter with numbers.
    this.scene.time.delayedCall(6000, () => {
      if (!this.active) return;
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 600, onComplete: () => this.destroy() });
    });
    return this;
  }
}
