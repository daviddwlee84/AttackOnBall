import * as Phaser from 'phaser';
import { GAME_W, GAME_H, SCALE } from '../config.js';

const BEST_KEY = 'aob-best';

// Shows the final score, tracks the best run in localStorage, and restarts.
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.score = data.score || 0;
  }

  create() {
    const best = Math.max(this.score, Number(localStorage.getItem(BEST_KEY) || 0));
    localStorage.setItem(BEST_KEY, String(best));
    const isNewBest = this.score >= best && this.score > 0;

    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x2b2b2b, 0.55).setOrigin(0).setDepth(70);

    this.add
      .text(GAME_W / 2, GAME_H * 0.3, 'Game Over', {
        fontFamily: '"Comic Sans MS", "Marker Felt", sans-serif',
        fontSize: `${56 * SCALE}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(71);

    this.add
      .text(GAME_W / 2, GAME_H * 0.45, `Score: ${this.score.toFixed(1)}`, {
        fontFamily: '"Comic Sans MS", sans-serif',
        fontSize: `${36 * SCALE}px`,
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(71);

    this.add
      .text(GAME_W / 2, GAME_H * 0.53, isNewBest ? 'New best! 🎉' : `Best: ${best.toFixed(1)}`, {
        fontFamily: '"Comic Sans MS", sans-serif',
        fontSize: `${26 * SCALE}px`,
        color: '#ffd43b',
      })
      .setOrigin(0.5)
      .setDepth(71);

    // Buttons appear after a short delay so the death tap can't trigger them.
    const playAgain = this.makeButton(GAME_W / 2, GAME_H * 0.68, '▶ Play Again', 0x4dabf7);
    const settings = this.makeButton(GAME_W / 2, GAME_H * 0.82, '⚙ Settings', 0xffd43b);
    [playAgain, settings].forEach((b) => b.setAlpha(0));

    this.time.delayedCall(450, () => {
      this.tweens.add({ targets: [playAgain, settings], alpha: 1, duration: 200 });
      playAgain.on('pointerdown', () => this.scene.start('GameScene'));
      settings.on('pointerdown', () => this.scene.start('MenuScene'));
      this.input.keyboard.once('keydown-SPACE', () => this.scene.start('GameScene'));
      this.input.keyboard.once('keydown-M', () => this.scene.start('MenuScene'));
    });
  }

  // A rounded doodle-style text button (returns an interactive container).
  makeButton(x, y, label, color) {
    const text = this.add
      .text(0, 0, label, {
        fontFamily: '"Comic Sans MS", "Marker Felt", sans-serif',
        fontSize: `${26 * SCALE}px`,
        color: '#08334d',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const padX = 28 * SCALE;
    const padY = 14 * SCALE;
    const w = text.width + padX * 2;
    const h = text.height + padY * 2;
    const bg = this.add.rectangle(0, 0, w, h, color).setStrokeStyle(3 * SCALE, 0x2b2b2b);
    const btn = this.add.container(x, y, [bg, text]).setDepth(72);
    btn.setSize(w, h);
    btn.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    btn.input.cursor = 'pointer';
    return btn;
  }
}
