import * as Phaser from 'phaser';
import { GROUND_Y, PLAYER_SIZE, SCALE } from '../config.js';

// The green doodle hero. Moves only horizontally and stands on the water line.
// Its facial expression (texture) reflects what it's doing — looking where it
// moves, panicking when a ball is near, and X-eyed when hit. A light layer of
// squash/stretch + idle "breathing" + a grounding shadow gives it some life
// without any extra art assets.
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
    // Scale/rotate around the feet so squash & lean read as planted on the ground.
    this.setOrigin(0.5, 0.5);

    this.speed = scene.params.playerSpeed; // px/s, from the active settings
    this.facing = 'idle'; // current face texture suffix
    this.dir = 0; // -1 / 0 / 1
    this.lastDir = 0;
    this.threat = false; // a ball is dangerously close
    this.dead = false;

    // Soft grounding shadow under the feet.
    this.shadow = scene.add
      .ellipse(x, GROUND_Y + 2 * SCALE, PLAYER_SIZE * 0.9, PLAYER_SIZE * 0.26, 0x000000, 0.18)
      .setDepth(-1);
  }

  // dir: -1 (left), 0 (idle), 1 (right). Only sets motion + intent; the visible
  // face is resolved by refreshFace() so the "scared" state can override it.
  move(dir) {
    if (this.dead) return;
    this.setVelocityX(dir * this.speed);
    this.setVelocityY(0);
    this.dir = dir;
    this.refreshFace();
  }

  // A ball within the danger radius makes the hero panic.
  setThreatened(threat) {
    if (this.threat === threat || this.dead) return;
    this.threat = threat;
    this.refreshFace();
  }

  // Pick the texture from current state: dead > scared > facing direction.
  refreshFace() {
    const exp = this.dead ? 'dead' : this.threat ? 'scared' : this.dir < 0 ? 'left' : this.dir > 0 ? 'right' : 'idle';
    if (exp !== this.facing) {
      this.facing = exp;
      this.setTexture('hero-' + exp);
    }
  }

  // Per-frame visual polish: lean + squash while moving, a breathing bob while
  // idle, a tremble when scared, and a pop on direction change. Driven from the
  // scene's update (dt in seconds, time in ms). Purely cosmetic — the physics
  // body keeps its fixed size, so collisions are unaffected.
  updateVisual(time, dt) {
    if (this.dead) return;
    const dir = Math.sign(this.body.velocity.x);

    let tSx;
    let tSy;
    let tAng;
    if (dir !== 0) {
      tSx = 1.08;
      tSy = 0.92;
      tAng = dir * 6;
    } else {
      const breathe = Math.sin(time * 0.005) * 0.04;
      tSx = 1 - breathe;
      tSy = 1 + breathe;
      tAng = 0;
    }
    // Anticipation pop the instant the hero changes heading.
    if (dir !== 0 && dir !== this.lastDir) {
      this.scaleX = 0.86;
      this.scaleY = 1.18;
    }
    this.lastDir = dir;
    if (this.threat) tAng += Math.sin(time * 0.05) * 4; // panicked jitter

    const k = 1 - Math.exp(-dt * 14); // frame-rate independent smoothing
    this.scaleX = Phaser.Math.Linear(this.scaleX, tSx, k);
    this.scaleY = Phaser.Math.Linear(this.scaleY, tSy, k);
    this.angle = Phaser.Math.Linear(this.angle, tAng, k);

    this.shadow.x = this.x;
    this.shadow.setScale(Phaser.Math.Clamp(this.scaleX, 0.85, 1.2), 1);
  }

  die() {
    this.move(0);
    this.dead = true;
    this.facing = 'dead';
    this.setTexture('hero-dead');
    this.setScale(1, 1);
    this.setAngle(0);
    this.shadow.setVisible(false);
  }
}
