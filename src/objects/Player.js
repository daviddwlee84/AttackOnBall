import * as Phaser from 'phaser';
import { EDGE_PAD, GAME_H, GAME_W, GROUND_Y, PLAYER_SIZE, SCALE } from '../config.js';
import { Sfx } from '../audio.js';

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
    this.refreshBounds();
    // Scale/rotate around the feet so squash & lean read as planted on the ground.
    this.setOrigin(0.5, 0.5);

    this.speed = scene.params.playerSpeed; // px/s, from the active settings
    this.facing = 'idle'; // current face texture suffix
    this.dir = 0; // -1 / 0 / 1
    this.lastDir = 0;
    this.threat = false; // a ball is dangerously close
    this.dead = false;

    // Gloating: after surviving a close call the hero pulls a smug face and
    // does a little celebratory move for a beat.
    this.scaredSince = 0;
    this.tauntUntil = 0;
    this.tauntStart = 0;
    this.tauntFace = 'smug';
    this.tauntStyle = null;

    // Soft grounding shadow under the feet.
    this.shadow = scene.add
      .ellipse(x, GROUND_Y + 2 * SCALE, PLAYER_SIZE * 0.9, PLAYER_SIZE * 0.26, 0x000000, 0.18)
      .setDepth(-1);
  }

  // Collide-with-world-bounds would stop the *body* at the arena edge, parking
  // the hero's centre 0.35*PLAYER_SIZE short of it — a visible gap the player
  // reads as an invisible wall. Give the body its own bounds rect, expanded by
  // exactly that half-width, so the centre reaches the edge minus EDGE_PAD.
  // Safe to widen: balls and pickups never use world bounds, only the ground body.
  refreshBounds() {
    const inset = PLAYER_SIZE * 0.35 - EDGE_PAD;
    this.body.setBoundsRectangle(new Phaser.Geom.Rectangle(-inset, 0, GAME_W + 2 * inset, GAME_H));
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

  // A ball within the danger radius makes the hero panic; clearing the danger
  // after a real scare triggers a gloat.
  setThreatened(threat) {
    if (this.dead || threat === this.threat) return;
    const now = this.scene.time.now;
    if (threat) {
      this.scaredSince = now;
      this.tauntUntil = 0; // a fresh threat snaps it out of any gloating
      Sfx.scared();
    } else {
      // Survived a close call — gloat if enabled, it was a real scare, and we're
      // off cooldown.
      const scaredFor = now - this.scaredSince;
      if (this.scene.params.tauntOn && scaredFor > 150 && now > this.tauntUntil + 1200) {
        this.startTaunt();
      }
    }
    this.threat = threat;
    this.refreshFace();
  }

  // Begin a brief gloat: random smug face + random celebratory move, sometimes
  // with a taunting word.
  startTaunt() {
    this.tauntFace = Math.random() < 0.5 ? 'smug' : 'tongue';
    this.tauntStyle = ['hop', 'wiggle', 'spin'][Math.floor(Math.random() * 3)];
    this.tauntStart = this.scene.time.now;
    this.tauntUntil = this.tauntStart + 850;
    Sfx.taunt();
    if (Math.random() < 0.55) this.popTaunt();
  }

  // Floating taunt word above the hero's head.
  popTaunt() {
    const words = ['哼!', '切~', '太慢了', '嘿嘿', '就這?'];
    const t = this.scene.add
      .text(this.x, this.y - PLAYER_SIZE * 0.85, Phaser.Utils.Array.GetRandom(words), {
        fontFamily: '"Comic Sans MS", "Marker Felt", sans-serif',
        fontSize: `${22 * SCALE}px`,
        color: '#2b2b2b',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.scene.tweens.add({
      targets: t,
      y: t.y - 32 * SCALE,
      alpha: { from: 1, to: 0 },
      duration: 850,
      onComplete: () => t.destroy(),
    });
  }

  // Pick the texture from current state: dead > gloating > scared > direction.
  refreshFace() {
    let exp;
    if (this.dead) exp = 'dead';
    else if (this.scene.time.now < this.tauntUntil) exp = this.tauntFace;
    else if (this.threat) exp = 'scared';
    else exp = this.dir < 0 ? 'left' : this.dir > 0 ? 'right' : 'idle';
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

    const now = this.scene.time.now;
    if (now < this.tauntUntil) {
      this.updateTaunt(now);
      this.shadow.x = this.x;
      this.shadow.setScale(Phaser.Math.Clamp(this.scaleX, 0.85, 1.2), 1);
      return;
    }
    // Just finished gloating — unwind any spin so we don't lerp the long way back.
    if (this.tauntStyle) {
      this.angle = Phaser.Math.Angle.WrapDegrees(this.angle);
      this.tauntStyle = null;
    }

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

  // Cosmetic celebration driven by the random taunt style (p = 0..1 progress).
  updateTaunt(now) {
    const p = (now - this.tauntStart) / (this.tauntUntil - this.tauntStart);
    if (this.tauntStyle === 'spin') {
      this.angle = 360 * p * (this.lastDir < 0 ? -1 : 1);
      this.scaleX = 1;
      this.scaleY = 1;
    } else if (this.tauntStyle === 'wiggle') {
      this.angle = Math.sin(p * Math.PI * 6) * 16;
      const s = 1 + Math.sin(p * Math.PI * 6) * 0.05;
      this.scaleX = s;
      this.scaleY = 2 - s;
    } else {
      // hop: a couple of excited squash-and-stretch bounces in place
      this.angle = 0;
      const b = Math.abs(Math.sin(p * Math.PI * 2));
      this.scaleX = 1 - b * 0.12;
      this.scaleY = 1 + b * 0.18;
    }
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
