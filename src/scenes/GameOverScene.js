import * as Phaser from 'phaser';
import { GAME_W, GAME_H, SCALE } from '../config.js';
import { makeDoodleButton } from '../ui/button.js';

// Best score is tracked per mode (lives mode is more forgiving, so it would
// otherwise inflate the classic best). Classic migrates the legacy 'aob-best'.
function bestKey(mode) {
  return `aob-best-${mode}`;
}
function readBest(mode) {
  let v = Number(localStorage.getItem(bestKey(mode)) || 0);
  if (mode === 'classic') v = Math.max(v, Number(localStorage.getItem('aob-best') || 0));
  return v;
}

// Shows the final score, tracks the best run in localStorage, and restarts.
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.score = data.score || 0;
    this.mode = data.mode || 'classic';
  }

  create() {
    const best = Math.max(this.score, readBest(this.mode));
    localStorage.setItem(bestKey(this.mode), String(best));
    const isNewBest = this.score >= best && this.score > 0;

    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x2b2b2b, 0.55).setOrigin(0).setDepth(70);

    this.add
      .text(GAME_W / 2, GAME_H * 0.28, 'Game Over', {
        fontFamily: '"Comic Sans MS", "Marker Felt", sans-serif',
        fontSize: `${56 * SCALE}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(71);

    this.add
      .text(GAME_W / 2, GAME_H * 0.43, `Score: ${this.score.toFixed(1)}`, {
        fontFamily: '"Comic Sans MS", sans-serif',
        fontSize: `${36 * SCALE}px`,
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(71);

    this.add
      .text(GAME_W / 2, GAME_H * 0.51, isNewBest ? 'New best! 🎉' : `Best: ${best.toFixed(1)}`, {
        fontFamily: '"Comic Sans MS", sans-serif',
        fontSize: `${26 * SCALE}px`,
        color: '#ffd43b',
      })
      .setOrigin(0.5)
      .setDepth(71);

    // Buttons exist immediately but only act after a short delay so the death
    // tap can't accidentally trigger them.
    this.ready = false;
    const playAgain = makeDoodleButton(this, GAME_W / 2, GAME_H * 0.66, '▶ Play Again', 0x4dabf7, () => {
      if (this.ready) this.scene.start('GameScene');
    }).setDepth(72);
    const settings = makeDoodleButton(this, GAME_W / 2, GAME_H * 0.82, '⚙ Settings', 0xffd43b, () => {
      if (this.ready) this.scene.start('MenuScene');
    }).setDepth(72);
    [playAgain, settings].forEach((b) => b.setAlpha(0));

    this.time.delayedCall(450, () => {
      this.ready = true;
      this.tweens.add({ targets: [playAgain, settings], alpha: 1, duration: 200 });
      this.input.keyboard.once('keydown-SPACE', () => this.scene.start('GameScene'));
      this.input.keyboard.once('keydown-M', () => this.scene.start('MenuScene'));
    });
  }
}
