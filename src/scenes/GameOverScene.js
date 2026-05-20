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

    const prompt = this.add
      .text(GAME_W / 2, GAME_H * 0.72, 'Tap or press Space\nto play again', {
        fontFamily: '"Comic Sans MS", sans-serif',
        fontSize: `${26 * SCALE}px`,
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(71);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    // Small delay so the death tap doesn't instantly restart.
    this.time.delayedCall(500, () => {
      const restart = () => this.scene.start('GameScene');
      this.input.once('pointerdown', restart);
      this.input.keyboard.once('keydown-SPACE', restart);
    });
  }
}
