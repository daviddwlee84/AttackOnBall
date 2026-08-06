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
  EDGE_PAD,
  INVINCIBLE_MS,
  MAX_LIVES,
} from '../config.js';
import Player from '../objects/Player.js';
import Arena from '../systems/arena.js';
import Spawner from '../systems/spawner.js';
import { onArenaResize, safeInsets } from '../systems/viewport.js';
import { setUpdatePromptVisible } from '../pwa-update.js';
import { gameParams, setSettings } from '../settings.js';
import { Sfx, isMuted, toggleMuted, startMusic, stopMusic } from '../audio.js';
import DebugOverlay from '../ui/debugOverlay.js';
import SafetyOverlay from '../ui/safetyOverlay.js';

// The core gameplay loop: move the hero, dodge the bouncing balls, grab numbers,
// and survive. Score climbs with time; every 10 points the arena recolors.
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    // A run is live: never interrupt it with the "new version" prompt. The
    // score IS the elapsed time, so a reload here costs the player everything.
    setUpdatePromptVisible(false);

    // Snapshot the active settings (SCALE-applied) for this run. Read before any
    // entity is created — Player/Ball/Spawner all read scene.params.
    this.params = gameParams();

    this.elapsed = 0;
    this.collected = 0;
    this.score = 0;
    this.segment = 0;
    this.over = false;

    // Game mode: classic = one hit ends it; lives = N hits, each non-fatal hit
    // costs a life and grants brief invincibility while the balls keep flying.
    this.mode = this.params.mode === 'lives' ? 'lives' : 'classic';
    this.lives = this.mode === 'lives' ? Phaser.Math.Clamp(this.params.lives | 0, 1, 5) : 1;
    this.maxLives = Math.max(MAX_LIVES, this.lives);
    this.invincible = false;
    this.heartProgress = 0; // 0..10 toward the next heart (numbers + optional time)

    // World bounds are seeded from the game config, which goes stale after any
    // viewport resize — re-assert them before anything is placed.
    this.physics.world.setBounds(0, 0, GAME_W, GAME_H);

    this.arena = new Arena(this);

    // Static ground body the balls and pickups land on (surface at GROUND_Y).
    this.ground = this.add.rectangle(GAME_W / 2, GROUND_Y + GROUND_H / 2, GAME_W, GROUND_H);
    this.ground.setVisible(false);
    this.physics.add.existing(this.ground, true);

    this.player = new Player(this, GAME_W / 2);
    // Hero hitbox geometry, published for systems/safety.js (which is
    // deliberately Phaser-free and can't read the body itself). Mirrors
    // Player's body: 0.7 x 0.85 of PLAYER_SIZE, centred on a sprite whose own
    // centre sits half a PLAYER_SIZE above the water line.
    this.playerHalfW = PLAYER_SIZE * 0.35;
    this.playerTop = GROUND_Y - PLAYER_SIZE * 0.925;
    this.playerBottom = GROUND_Y - PLAYER_SIZE * 0.075;
    this.groundY = GROUND_Y;
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

    this.physics.add.overlap(this.player, this.balls, () => this.onHit());
    this.physics.add.overlap(this.player, this.pickups, (_p, pickup) => this.collect(pickup));

    this.makeLivesHud();

    // Input: keyboard + touch (move toward wherever a finger is held).
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey('A');
    this.keyD = this.input.keyboard.addKey('D');

    // If the scene started while a finger/button was still down (tapping
    // "Play Again" / "Restart"), that held pointer would otherwise be read as a
    // move command and jerk the fresh hero toward the button. Ignore the pointer
    // until it has been released once.
    this.pointerArmed = !this.input.activePointer.isDown;
    // Set while a press started on one of the HUD buttons, so dragging off it
    // doesn't turn into a move command. Replaces the old blanket "ignore the
    // top-right corner" rectangle, which was a real invisible wall.
    this.uiHold = false;
    this.input.on('pointerup', () => {
      this.uiHold = false;
    });

    // Pause: Esc / P keys, or the corner button.
    this.input.keyboard.on('keydown-ESC', this.pauseGame, this);
    this.input.keyboard.on('keydown-P', this.pauseGame, this);
    this.makePauseButton();
    this.makeMuteButton();
    this.relayout();
    // Re-fit (rather than restart) if the viewport changes mid-run.
    const offResize = onArenaResize(() => this.relayout());
    this.events.once('shutdown', offResize);

    // Background music plays only during a live game; stop it when the scene is
    // paused, restart on resume, and stop on teardown (death / restart).
    startMusic();
    this.events.on('pause', stopMusic);
    this.events.on('resume', startMusic);
    this.events.once('shutdown', stopMusic);

    // Debug FPS overlay (F3 toggles; persisted via the `debug` setting).
    this.debug = new DebugOverlay(this);
    this.debug.setVisible(!!this.params.debug);
    this.input.keyboard.on('keydown-F3', () => {
      const on = !this.debug.visible;
      this.debug.setVisible(on);
      setSettings({ debug: on });
    });

    // Dodgeability corridor (F4) — see systems/safety.js.
    this.safetyView = new SafetyOverlay(this);
    this.input.keyboard.on('keydown-F4', () => this.safetyView.setVisible(!this.safetyView.visible));

    // Test hook (used by scripts/smoke-test.mjs) — harmless in normal play.
    if (typeof window !== 'undefined') window.__aob = this;
  }

  readDirection() {
    if (this.cursors.left.isDown || this.keyA.isDown) return -1;
    if (this.cursors.right.isDown || this.keyD.isDown) return 1;
    if (!this.pointerArmed) {
      if (!this.input.activePointer.isDown) this.pointerArmed = true;
      return 0;
    }
    if (this.uiHold) return 0;
    const p = this.input.activePointer;
    if (p.isDown) {
      const dx = p.worldX - this.player.x;
      if (Math.abs(dx) > 6 * SCALE) return Math.sign(dx);
    }
    return 0;
  }

  // Small unobtrusive pause button tucked in the top-right corner.
  makePauseButton() {
    const size = 40 * SCALE;
    const bg = this.add.rectangle(0, 0, size, size, 0xffffff, 0.85).setStrokeStyle(3 * SCALE, 0x2b2b2b);
    const barW = 6 * SCALE;
    const barH = 18 * SCALE;
    const b1 = this.add.rectangle(-5 * SCALE, 0, barW, barH, 0x2b2b2b);
    const b2 = this.add.rectangle(5 * SCALE, 0, barW, barH, 0x2b2b2b);
    this.pauseBtn = this.add.container(0, 0, [bg, b1, b2]).setDepth(80);
    // Make the background rectangle interactive (container-level hitAreas don't
    // hit-test reliably in Phaser).
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => {
      this.uiHold = true;
      this.pauseGame();
    });
  }

  // Sound on/off toggle, just left of the pause button.
  makeMuteButton() {
    const size = 40 * SCALE;
    const bg = this.add.rectangle(0, 0, size, size, 0xffffff, 0.85).setStrokeStyle(3 * SCALE, 0x2b2b2b);
    const icon = this.add
      .text(0, 0, isMuted() ? '🔇' : '🔊', { fontSize: `${20 * SCALE}px` })
      .setOrigin(0.5);
    this.muteBtn = this.add.container(0, 0, [bg, icon]).setDepth(80);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => {
      this.uiHold = true;
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

  // Everything whose position depends on the arena width. Called at create() and
  // again on a viewport change, so a mid-run resize doesn't strand the HUD.
  relayout() {
    const size = 40 * SCALE;
    const right = GAME_W - size * 0.5 - 16 * SCALE - safeInsets().right;
    const y = size * 0.5 + 16 * SCALE;
    this.pauseBtn.setPosition(right, y);
    this.muteBtn.setPosition(right - (size + 12 * SCALE), y);
    this.arena.relayout();
    this.layoutHearts();
    this.physics.world.setBounds(0, 0, GAME_W, GAME_H);
    this.player.refreshBounds();
    this.playerMinX = EDGE_PAD;
    this.playerMaxX = GAME_W - EDGE_PAD;
    this.ground.setSize(GAME_W, GROUND_H);
    this.ground.setPosition(GAME_W / 2, GROUND_Y + GROUND_H / 2);
    this.ground.body.updateFromGameObject();
  }

  pauseGame() {
    if (this.over || this.scene.isPaused()) return;
    this.scene.launch('PauseScene');
    this.scene.pause();
  }

  update(time, dtMs) {
    if (this.debug.visible) this.debug.update();
    if (this.over) return;
    if (this.safetyView.visible) this.safetyView.update(dtMs);
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

    if (this.mode === 'lives') {
      if (this.params.autoRecover) this.addHeartProgress(dt); // optional ~10s = +1 heart
      this.updateCharger(Math.min(this.heartProgress / 10, 1));
    }

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

  // A floating heart where a bonus heart was won (texture, not an emoji glyph).
  heartPopup(x, y) {
    const img = this.add.image(x, y, 'heart-pickup').setDepth(61);
    img.setScale((28 * SCALE) / img.width);
    this.tweens.add({ targets: img, y: y - 44 * SCALE, alpha: 0, duration: 700, onComplete: () => img.destroy() });
  }

  collect(pickup) {
    // Heart drops give a life outright.
    if (pickup.kind === 'heart') {
      if (this.gainLife()) this.heartPopup(pickup.x, pickup.y);
      pickup.destroy();
      return;
    }
    this.collected += pickup.value;
    Sfx.collect();
    // Numbers fill the charging heart (accumulate to 10 = +1 life).
    if (this.mode === 'lives') this.addHeartProgress(pickup.value);
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

  // Row of hearts under the score (lives mode only): full hearts for current
  // lives plus a "charging" heart that fills bottom-up with segment progress.
  makeLivesHud() {
    if (this.mode !== 'lives') return;
    // Use the doodle heart *texture* (not a '♥' font glyph): iOS renders the
    // glyph as a color emoji, which ignores our color and breaks the fill
    // effect. A texture looks identical on every platform and crops cleanly.
    this.heartObjs = [];
    for (let i = 0; i < this.maxLives; i++) {
      this.heartObjs.push(this.add.image(0, 0, 'heart-pickup').setDepth(44).setVisible(false));
    }
    // Faint heart behind + a solid heart cropped to the fill fraction in front.
    this.chargerBg = this.add.image(0, 0, 'heart-pickup').setDepth(44).setVisible(false);
    this.chargerFill = this.add.image(0, 0, 'heart-pickup').setDepth(45).setVisible(false);
    this.heartScale = (36 * SCALE) / this.heartObjs[0].width;
    [...this.heartObjs, this.chargerBg, this.chargerFill].forEach((h) => h.setScale(this.heartScale));
    this.chargerBg.setAlpha(0.3);
    this.heartGap = 40 * SCALE;
    this.layoutHearts();
  }

  // Position/visibility of the heart row (recomputed whenever lives change).
  layoutHearts() {
    if (this.mode !== 'lives') return;
    const gap = this.heartGap;
    const y = 96 * SCALE;
    const charging = this.lives < this.maxLives;
    const count = this.lives + (charging ? 1 : 0);
    const startX = GAME_W / 2 - ((count - 1) * gap) / 2;
    this.heartObjs.forEach((h, i) => {
      if (i < this.lives) h.setVisible(true).setPosition(startX + i * gap, y);
      else h.setVisible(false);
    });
    this.chargerBg.setVisible(charging);
    this.chargerFill.setVisible(charging);
    if (charging) {
      const cx = startX + this.lives * gap;
      this.chargerBg.setPosition(cx, y);
      this.chargerFill.setPosition(cx, y);
    }
  }

  // frac: 0..1 progress to the next heart — fill the heart shape bottom-up.
  updateCharger(frac) {
    if (this.mode !== 'lives' || !this.chargerFill.visible) return;
    const fw = this.chargerFill.frame.width;
    const fh = this.chargerFill.frame.height;
    // The heart occupies ~16%..82% of the texture height (see makeHeart).
    const top = 0.16 * fh;
    const bot = 0.82 * fh;
    const f = Phaser.Math.Clamp(frac, 0, 1);
    const visTop = bot - f * (bot - top);
    this.chargerFill.setCrop(0, visTop, fw, bot - visTop);
  }

  // Bank a heart (filled charger or heart drop), capped, with a pop + chime.
  gainLife() {
    if (this.mode !== 'lives' || this.lives >= this.maxLives) return false;
    this.lives += 1;
    this.layoutHearts();
    Sfx.heart();
    const h = this.heartObjs[this.lives - 1];
    this.tweens.add({
      targets: h,
      scaleX: { from: this.heartScale * 1.6, to: this.heartScale },
      scaleY: { from: this.heartScale * 1.6, to: this.heartScale },
      duration: 320,
      ease: 'Back.out',
    });
    return true;
  }

  // Feed the charging heart; each full 10 banks a life (carrying the remainder).
  addHeartProgress(amount) {
    if (this.mode !== 'lives') return;
    this.heartProgress += amount;
    while (this.heartProgress >= 10 && this.lives < this.maxLives) {
      this.heartProgress -= 10;
      this.gainLife();
    }
    if (this.lives >= this.maxLives) this.heartProgress = 0;
  }

  // A ball touched the hero. In lives mode with lives to spare, lose one and
  // become briefly invincible (balls keep flying); otherwise it's game over.
  onHit() {
    if (this.over || this.invincible) return;
    if (this.mode === 'lives' && this.lives > 1) {
      this.lives -= 1;
      this.layoutHearts();
      this.hurt();
    } else {
      this.die();
    }
  }

  // Non-fatal hit: flash + blink + short invincibility, no freeze.
  hurt() {
    this.invincible = true;
    Sfx.hurt();
    this.cameras.main.shake(150, 0.006);
    const blink = this.tweens.add({ targets: this.player, alpha: 0.3, duration: 110, yoyo: true, repeat: -1 });
    this.time.delayedCall(INVINCIBLE_MS, () => {
      blink.stop();
      this.player.setAlpha(1);
      this.invincible = false;
    });
  }

  die() {
    if (this.over) return;
    this.over = true;
    stopMusic();
    Sfx.death();
    this.player.die();

    // Clear the heart HUD so it reads empty on the game-over screen (the last
    // life isn't decremented by onHit, so zero it here).
    if (this.mode === 'lives' && this.heartObjs) {
      this.lives = 0;
      this.layoutHearts();
      this.chargerBg.setVisible(false);
      this.chargerFill.setVisible(false);
    }

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

    // Freeze the balls in place for a beat, then overlay the game-over screen
    // (launch, not start, so the frozen arena shows through it like Pause does).
    this.balls.getChildren().forEach((b) => b.body.setVelocity(0, 0).setAllowGravity(false));
    this.cameras.main.shake(250, 0.01);
    this.time.delayedCall(1000, () => {
      this.scene.launch('GameOverScene', {
        score: this.score,
        mode: this.mode,
        // The difficulty this run was actually played at — settings could be
        // changed before the game-over screen is dismissed.
        difficulty: this.params.difficulty,
      });
    });
  }
}
