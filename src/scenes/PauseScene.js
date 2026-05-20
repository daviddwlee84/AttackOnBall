import * as Phaser from 'phaser';
import { GAME_W, GAME_H, SCALE } from '../config.js';
import { makeDoodleButton } from '../ui/button.js';

// Overlay launched on top of a paused GameScene. Esc/P (or Resume) unpauses.
export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('PauseScene');
  }

  create() {
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x2b2b2b, 0.6).setOrigin(0);

    this.add
      .text(GAME_W / 2, GAME_H * 0.24, 'Paused', {
        fontFamily: '"Comic Sans MS", "Marker Felt", sans-serif',
        fontSize: `${56 * SCALE}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    makeDoodleButton(this, GAME_W / 2, GAME_H * 0.45, '▶ Resume', 0x9ad42b, () => this.resumeGame());
    makeDoodleButton(this, GAME_W / 2, GAME_H * 0.62, '↻ Restart', 0x4dabf7, () => {
      this.scene.stop();
      this.scene.start('GameScene');
    });
    makeDoodleButton(this, GAME_W / 2, GAME_H * 0.79, '⚙ Main Menu', 0xffd43b, () => {
      this.scene.stop('GameScene');
      this.scene.stop();
      this.scene.start('MenuScene');
    });

    this.input.keyboard.on('keydown-ESC', () => this.resumeGame());
    this.input.keyboard.on('keydown-P', () => this.resumeGame());
  }

  resumeGame() {
    this.scene.resume('GameScene');
    this.scene.stop();
  }
}
