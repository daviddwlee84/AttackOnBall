import * as Phaser from 'phaser';
import { GROUND_Y, PLAYER_SIZE } from '../config.js';

// The green doodle hero. Moves only horizontally and stands on the water line.
// Its facial expression (texture) reflects the direction it's moving.
export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x) {
    super(scene, x, GROUND_Y - PLAYER_SIZE * 0.5, 'hero-idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setAllowGravity(false);
    this.setImmovable(true);
    this.setCollideWorldBounds(true);
    // Hit box a touch smaller than the sprite so near-misses feel fair.
    this.body.setSize(PLAYER_SIZE * 0.7, PLAYER_SIZE * 0.85);
    this.body.setOffset((this.width - PLAYER_SIZE * 0.7) / 2, (this.height - PLAYER_SIZE * 0.85) / 2);

    this.speed = scene.params.playerSpeed; // px/s, from the active settings
    this.facing = 'idle';
  }

  // dir: -1 (left), 0 (idle), 1 (right)
  move(dir) {
    this.setVelocityX(dir * this.speed);
    this.setVelocityY(0);
    const exp = dir < 0 ? 'left' : dir > 0 ? 'right' : 'idle';
    if (exp !== this.facing) {
      this.facing = exp;
      this.setTexture('hero-' + exp);
    }
  }

  die() {
    this.move(0);
    this.setTexture('hero-dead');
    this.facing = 'dead';
  }
}
