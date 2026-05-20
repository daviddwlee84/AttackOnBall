import * as Phaser from 'phaser';
import { GAME_W, GRAVITY } from '../config.js';

// A falling number the player walks over to add straight to their score.
export default class NumberPickup extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, value) {
    const x = Phaser.Math.Between(40, GAME_W - 40);
    super(scene, x, -40, `num-${value}`);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.value = value;
  }

  // Configure the body — call *after* adding to the physics group (the group
  // resets body settings, same gotcha as Ball).
  configure() {
    this.body.setCircle(20, 4, 4);
    this.body.setAllowGravity(true);
    this.body.setGravityY(GRAVITY * 0.35); // floats down gently
    this.setBounce(0, 0.3);
    return this;
  }
}
