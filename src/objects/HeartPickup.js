import * as Phaser from 'phaser';
import { GAME_W, SCALE } from '../config.js';

// A falling heart (lives mode only). Walk over it to gain a life. Drifts down
// gently like the number pickups and fades if left uncollected.
export default class HeartPickup extends Phaser.Physics.Arcade.Sprite {
  constructor(scene) {
    const x = Phaser.Math.Between(40 * SCALE, GAME_W - 40 * SCALE);
    super(scene, x, -40 * SCALE, 'heart-pickup');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.kind = 'heart';
  }

  // Configure the body — call *after* adding to the physics group (the group
  // resets body settings, same gotcha as Ball / NumberPickup).
  configure() {
    this.body.setCircle(18 * SCALE, 6 * SCALE, 6 * SCALE);
    this.body.setAllowGravity(true);
    this.body.setGravityY(this.scene.params.gravity * 0.3); // floats down gently
    this.setBounce(0, 0.4);

    // A soft pulse so it reads as a desirable bonus.
    this.scene.tweens.add({
      targets: this,
      scale: { from: 0.9, to: 1.12 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    // Fade out if left uncollected so the floor doesn't clutter.
    this.scene.time.delayedCall(7000, () => {
      if (!this.active) return;
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 600, onComplete: () => this.destroy() });
    });
    return this;
  }
}
