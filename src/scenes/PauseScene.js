import * as Phaser from 'phaser';
import { GAME_W, GAME_H, MAX_GAME_W, SCALE } from '../config.js';
import { makeDoodleButton } from '../ui/button.js';
import { onArenaResize } from '../systems/viewport.js';

// Overlay launched on top of a paused GameScene. Esc/P (or Resume) unpauses.
export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('PauseScene');
  }

  create() {
    // Sized at the widest arena we support so a mid-pause resize can never
    // leave an uncovered strip; it just overflows the canvas.
    this.add.rectangle(0, 0, MAX_GAME_W, GAME_H, 0x2b2b2b, 0.6).setOrigin(0);

    const title = this.add
      .text(0, GAME_H * 0.24, 'Paused', {
        fontFamily: '"Comic Sans MS", "Marker Felt", sans-serif',
        fontSize: `${56 * SCALE}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const resume = makeDoodleButton(this, 0, GAME_H * 0.45, '▶ Resume', 0x9ad42b, () => this.resumeGame());
    const restart = makeDoodleButton(this, 0, GAME_H * 0.62, '↻ Restart', 0x4dabf7, () => {
      this.scene.stop();
      this.scene.start('GameScene');
    });
    const menu = makeDoodleButton(this, 0, GAME_H * 0.79, '⚙ Main Menu', 0xffd43b, () => {
      this.scene.stop('GameScene');
      this.scene.stop();
      this.scene.start('MenuScene');
    });

    const centre = () => [title, resume, restart, menu].forEach((o) => (o.x = GAME_W / 2));
    centre();
    const offResize = onArenaResize(centre);
    this.events.once('shutdown', offResize);

    this.input.keyboard.on('keydown-ESC', () => this.resumeGame());
    this.input.keyboard.on('keydown-P', () => this.resumeGame());
  }

  resumeGame() {
    this.scene.resume('GameScene');
    this.scene.stop();
  }
}
