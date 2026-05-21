import * as Phaser from 'phaser';
import { GAME_W, GAME_H, GROUND_Y, GROUND_H, PALETTES, SCALE } from '../config.js';
import { Sfx } from '../audio.js';

// Tween a value from one packed-hex color to another, calling apply(color) each
// frame. Used for the smooth arena recolor on every palette change.
function tweenColor(scene, fromInt, toInt, apply, duration = 500) {
  const from = Phaser.Display.Color.IntegerToColor(fromInt);
  const to = Phaser.Display.Color.IntegerToColor(toInt);
  scene.tweens.addCounter({
    from: 0,
    to: 100,
    duration,
    onUpdate: (tw) => {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, tw.getValue());
      apply(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
    },
  });
}

// Owns all non-gameplay visuals: paper background, notebook grid, water strip,
// the top timer/score bar, and the per-10-point palette shuffle.
export default class Arena {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;
    const p = PALETTES[0];

    this.bg = scene.add.rectangle(0, 0, GAME_W, GAME_H, p.bg).setOrigin(0).setDepth(-20);
    this.grid = scene.add
      .image(0, 0, 'grid')
      .setOrigin(0)
      .setDepth(-19)
      .setTint(p.grid)
      .setAlpha(0.7);
    this.water = scene.add
      .rectangle(0, GROUND_Y, GAME_W, GROUND_H, p.water)
      .setOrigin(0, 0)
      .setDepth(-18);

    // Top progress bar (fills continuously across each 10-second segment).
    const margin = 40 * SCALE;
    const barW = GAME_W - 2 * margin;
    this.barW = barW;
    this.barInset = 2 * SCALE;
    scene.add.rectangle(margin, 24 * SCALE, barW, 18 * SCALE, 0x000000, 0.12).setOrigin(0, 0.5).setDepth(40);
    this.barBg = scene.add
      .rectangle(margin, 24 * SCALE, barW, 18 * SCALE, 0xffffff, 0.6)
      .setOrigin(0, 0.5)
      .setStrokeStyle(3 * SCALE, 0x2b2b2b)
      .setDepth(41);
    this.barFill = scene.add
      .rectangle(margin + this.barInset, 24 * SCALE, 0, 12 * SCALE, p.water)
      .setOrigin(0, 0.5)
      .setDepth(42);

    this.scoreText = scene.add
      .text(GAME_W / 2, 44 * SCALE, '0.0', {
        fontFamily: '"Comic Sans MS", "Marker Felt", sans-serif',
        fontSize: `${32 * SCALE}px`,
        color: '#2b2b2b',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setDepth(43);
  }

  // frac: 0..1 progress through the current 10-second segment.
  setBar(frac) {
    this.barFill.width = Phaser.Math.Clamp(frac, 0, 1) * (this.barW - 2 * this.barInset);
  }

  setScore(score) {
    this.scoreText.setText(score.toFixed(1));
  }

  // Cross-fade to the next palette and flash the bar to signal the milestone.
  nextPalette() {
    Sfx.milestone();
    const prev = PALETTES[this.index];
    this.index = (this.index + 1) % PALETTES.length;
    const next = PALETTES[this.index];

    tweenColor(this.scene, prev.bg, next.bg, (c) => this.bg.setFillStyle(c));
    tweenColor(this.scene, prev.grid, next.grid, (c) => this.grid.setTint(c));
    tweenColor(this.scene, prev.water, next.water, (c) => {
      this.water.setFillStyle(c);
      this.barFill.setFillStyle(c);
    });

    this.scene.tweens.add({
      targets: this.barFill,
      alpha: { from: 0.2, to: 1 },
      duration: 220,
    });
  }
}
