import * as Phaser from 'phaser';
import {
  GAME_W,
  GAME_H,
  GROUND_Y,
  GROUND_H,
  SCORE_PER_SECOND,
  SEGMENT,
  BALL_COLORS,
} from '../config.js';
import Player from '../objects/Player.js';
import Arena from '../systems/arena.js';
import Spawner from '../systems/spawner.js';

// The core gameplay loop: move the hero, dodge the bouncing balls, grab numbers,
// and survive. Score climbs with time; every 10 points the arena recolors.
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.elapsed = 0;
    this.collected = 0;
    this.score = 0;
    this.segment = 0;
    this.over = false;

    this.arena = new Arena(this);

    // Static ground body the balls and pickups land on (surface at GROUND_Y).
    this.ground = this.add.rectangle(GAME_W / 2, GROUND_Y + GROUND_H / 2, GAME_W, GROUND_H);
    this.ground.setVisible(false);
    this.physics.add.existing(this.ground, true);

    this.player = new Player(this, GAME_W / 2);
    this.balls = this.physics.add.group();
    this.pickups = this.physics.add.group();
    this.spawner = new Spawner(this);

    // Balls bounce elastically on the ground (energy conserved → stable height).
    this.physics.add.collider(this.balls, this.ground);
    this.physics.add.collider(this.pickups, this.ground);

    this.physics.add.overlap(this.player, this.balls, () => this.die());
    this.physics.add.overlap(this.player, this.pickups, (_p, pickup) => this.collect(pickup));

    // Input: keyboard + touch (move toward wherever a finger is held).
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey('A');
    this.keyD = this.input.keyboard.addKey('D');

    // Test hook (used by scripts/smoke-test.mjs) — harmless in normal play.
    if (typeof window !== 'undefined') window.__aob = this;
  }

  readDirection() {
    if (this.cursors.left.isDown || this.keyA.isDown) return -1;
    if (this.cursors.right.isDown || this.keyD.isDown) return 1;
    const p = this.input.activePointer;
    if (p.isDown) {
      const dx = p.worldX - this.player.x;
      if (Math.abs(dx) > 6) return Math.sign(dx);
    }
    return 0;
  }

  update(_time, dtMs) {
    if (this.over) return;
    const dt = dtMs / 1000;
    this.elapsed += dt;

    this.player.move(this.readDirection());
    this.spawner.update(dt, this.elapsed);

    // Cull balls that have flown off the far side. Copy the list first since
    // destroy() mutates the group's child array mid-iteration.
    for (const ball of [...this.balls.getChildren()]) {
      if (ball.isOffscreen()) ball.destroy();
    }
    // Catch any pickup that slips past the bottom.
    for (const pickup of [...this.pickups.getChildren()]) {
      if (pickup.y > GAME_H + 60) pickup.destroy();
    }

    this.score = Math.floor(this.elapsed * SCORE_PER_SECOND) + this.collected;
    this.arena.setScore(this.score);
    this.arena.setBar((this.score % SEGMENT) / SEGMENT);

    const seg = Math.floor(this.score / SEGMENT);
    if (seg > this.segment) {
      this.segment = seg;
      this.arena.nextPalette();
    }
  }

  collect(pickup) {
    this.collected += pickup.value;
    // Little pop where the number was grabbed.
    const burst = this.add
      .text(pickup.x, pickup.y, `+${pickup.value}`, {
        fontFamily: '"Comic Sans MS", sans-serif',
        fontSize: '24px',
        color: '#2b2b2b',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.tweens.add({
      targets: burst,
      y: burst.y - 40,
      alpha: 0,
      duration: 600,
      onComplete: () => burst.destroy(),
    });
    pickup.destroy();
  }

  die() {
    if (this.over) return;
    this.over = true;
    this.player.die();

    // Explode the hero into doodle shards.
    const colors = BALL_COLORS.map((c) => Phaser.Display.Color.HexStringToColor(c).color);
    const emitter = this.add.particles(this.player.x, this.player.y, 'fragment', {
      speed: { min: 120, max: 360 },
      angle: { min: 0, max: 360 },
      lifespan: 800,
      gravityY: 600,
      scale: { start: 1.2, end: 0.4 },
      rotate: { min: 0, max: 360 },
      tint: colors,
      emitting: false,
    });
    emitter.explode(28);
    this.player.setVisible(false);

    // Freeze the balls in place for a beat, then go to the game-over screen.
    this.balls.getChildren().forEach((b) => b.body.setVelocity(0, 0).setAllowGravity(false));
    this.cameras.main.shake(250, 0.01);
    this.time.delayedCall(1000, () => {
      this.scene.start('GameOverScene', { score: this.score });
    });
  }
}
