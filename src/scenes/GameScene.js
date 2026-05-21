import * as Phaser from 'phaser';
import {
  GAME_W,
  GAME_H,
  GROUND_Y,
  GROUND_H,
  SEGMENT,
  SCALE,
  BALL_COLORS,
  PLAYER_SIZE,
} from '../config.js';
import Player from '../objects/Player.js';
import Arena from '../systems/arena.js';
import Spawner from '../systems/spawner.js';
import { gameParams } from '../settings.js';
import { Sfx, isMuted, toggleMuted, startMusic, stopMusic } from '../audio.js';

// The core gameplay loop: move the hero, dodge the bouncing balls, grab numbers,
// and survive. Score climbs with time; every 10 points the arena recolors.
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    // Snapshot the active settings (SCALE-applied) for this run. Read before any
    // entity is created — Player/Ball/Spawner all read scene.params.
    this.params = gameParams();

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

    // Reusable dust emitter for ball landings (puffs out along the ground).
    this.dust = this.add
      .particles(0, 0, 'puff', {
        speed: { min: 30 * SCALE, max: 110 * SCALE },
        angle: { min: 200, max: 340 },
        lifespan: 420,
        scale: { start: 0.5, end: 1.2 },
        alpha: { start: 0.55, end: 0 },
        gravityY: -60 * SCALE,
        emitting: false,
      })
      .setDepth(1);

    // Balls bounce elastically on the ground (energy conserved → stable height).
    this.physics.add.collider(this.balls, this.ground);
    this.physics.add.collider(this.pickups, this.ground);

    this.physics.add.overlap(this.player, this.balls, () => this.die());
    this.physics.add.overlap(this.player, this.pickups, (_p, pickup) => this.collect(pickup));

    // Input: keyboard + touch (move toward wherever a finger is held).
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey('A');
    this.keyD = this.input.keyboard.addKey('D');

    // Pause: Esc / P keys, or the corner button.
    this.input.keyboard.on('keydown-ESC', this.pauseGame, this);
    this.input.keyboard.on('keydown-P', this.pauseGame, this);
    this.makePauseButton();
    this.makeMuteButton();

    // Background music plays only during a live game; stop it when the scene is
    // paused, restart on resume, and stop on teardown (death / restart).
    startMusic();
    this.events.on('pause', stopMusic);
    this.events.on('resume', startMusic);
    this.events.once('shutdown', stopMusic);

    // Test hook (used by scripts/smoke-test.mjs) — harmless in normal play.
    if (typeof window !== 'undefined') window.__aob = this;
  }

  readDirection() {
    if (this.cursors.left.isDown || this.keyA.isDown) return -1;
    if (this.cursors.right.isDown || this.keyD.isDown) return 1;
    const p = this.input.activePointer;
    if (p.isDown) {
      // Ignore taps in the top-right button corner (pause + mute) so they don't move.
      if (p.worldX > GAME_W - 120 * SCALE && p.worldY < 90 * SCALE) return 0;
      const dx = p.worldX - this.player.x;
      if (Math.abs(dx) > 6 * SCALE) return Math.sign(dx);
    }
    return 0;
  }

  // Small unobtrusive pause button tucked in the top-right corner.
  makePauseButton() {
    const size = 40 * SCALE;
    const x = GAME_W - size * 0.5 - 16 * SCALE;
    const y = size * 0.5 + 16 * SCALE;
    const bg = this.add.rectangle(0, 0, size, size, 0xffffff, 0.85).setStrokeStyle(3 * SCALE, 0x2b2b2b);
    const barW = 6 * SCALE;
    const barH = 18 * SCALE;
    const b1 = this.add.rectangle(-5 * SCALE, 0, barW, barH, 0x2b2b2b);
    const b2 = this.add.rectangle(5 * SCALE, 0, barW, barH, 0x2b2b2b);
    this.add.container(x, y, [bg, b1, b2]).setDepth(80);
    // Make the background rectangle interactive (container-level hitAreas don't
    // hit-test reliably in Phaser).
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => this.pauseGame());
  }

  // Sound on/off toggle, just left of the pause button.
  makeMuteButton() {
    const size = 40 * SCALE;
    const x = GAME_W - size * 0.5 - 16 * SCALE - (size + 12 * SCALE);
    const y = size * 0.5 + 16 * SCALE;
    const bg = this.add.rectangle(0, 0, size, size, 0xffffff, 0.85).setStrokeStyle(3 * SCALE, 0x2b2b2b);
    const icon = this.add
      .text(0, 0, isMuted() ? '🔇' : '🔊', { fontSize: `${20 * SCALE}px` })
      .setOrigin(0.5);
    this.add.container(x, y, [bg, icon]).setDepth(80);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => {
      const muted = toggleMuted();
      icon.setText(muted ? '🔇' : '🔊');
      if (muted) {
        stopMusic();
      } else {
        Sfx.ui(); // little blip to confirm sound is back
        startMusic();
      }
    });
  }

  pauseGame() {
    if (this.over || this.scene.isPaused()) return;
    this.scene.launch('PauseScene');
    this.scene.pause();
  }

  update(time, dtMs) {
    if (this.over) return;
    const dt = dtMs / 1000;
    this.elapsed += dt;

    this.player.move(this.readDirection());
    this.player.updateVisual(time, dt);
    this.spawner.update(dt, this.elapsed);

    // Drive each ball's shadow/bounce squash, flag whether any ball is close
    // enough to scare the hero, and cull the ones that have flown off-screen.
    // Copy the list first since destroy() mutates the group's child array.
    let threatened = false;
    for (const ball of [...this.balls.getChildren()]) {
      ball.tick();
      if (!threatened) {
        const gap =
          Phaser.Math.Distance.Between(this.player.x, this.player.y, ball.x, ball.y) -
          ball.radius -
          PLAYER_SIZE * 0.5;
        if (gap < 70 * SCALE) threatened = true;
      }
      if (ball.isOffscreen()) ball.destroy();
    }
    this.player.setThreatened(threatened);
    // Catch any pickup that slips past the bottom.
    for (const pickup of [...this.pickups.getChildren()]) {
      if (pickup.y > GAME_H + 60 * SCALE) pickup.destroy();
    }

    // Score is the continuous survival time in seconds (+ collected seconds).
    this.score = this.elapsed + this.collected;
    this.arena.setScore(this.score);
    this.arena.setBar((this.score % SEGMENT) / SEGMENT);

    const seg = Math.floor(this.score / SEGMENT);
    if (seg > this.segment) {
      this.segment = seg;
      this.arena.nextPalette();
    }
  }

  // Puff dust where a ball touches the ground; bigger balls kick up more.
  spawnDust(x, radius) {
    const n = Phaser.Math.Clamp(Math.round(radius / (8 * SCALE)) + 2, 3, 8);
    this.dust.emitParticleAt(x, GROUND_Y, n);
  }

  collect(pickup) {
    this.collected += pickup.value;
    Sfx.collect();
    // Little pop where the number was grabbed.
    const burst = this.add
      .text(pickup.x, pickup.y, `+${pickup.value}`, {
        fontFamily: '"Comic Sans MS", sans-serif',
        fontSize: `${24 * SCALE}px`,
        color: '#2b2b2b',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.tweens.add({
      targets: burst,
      y: burst.y - 40 * SCALE,
      alpha: 0,
      duration: 600,
      onComplete: () => burst.destroy(),
    });
    pickup.destroy();
  }

  die() {
    if (this.over) return;
    this.over = true;
    stopMusic();
    Sfx.death();
    this.player.die();

    // Explode the hero into doodle shards.
    const colors = BALL_COLORS.map((c) => Phaser.Display.Color.HexStringToColor(c).color);
    const emitter = this.add.particles(this.player.x, this.player.y, 'fragment', {
      speed: { min: 120 * SCALE, max: 360 * SCALE },
      angle: { min: 0, max: 360 },
      lifespan: 800,
      gravityY: 600 * SCALE,
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
