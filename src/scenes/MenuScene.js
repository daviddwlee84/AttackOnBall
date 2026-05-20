import * as Phaser from 'phaser';
import { GAME_W, GAME_H, GROUND_Y, GROUND_H, PALETTES, SCALE } from '../config.js';

const BEST_KEY = 'aob-best';

// Title screen: shows the hero, the best score, and waits for a tap/Space.
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const p = PALETTES[0];
    this.add.rectangle(0, 0, GAME_W, GAME_H, p.bg).setOrigin(0);
    this.add.image(0, 0, 'grid').setOrigin(0).setTint(p.grid).setAlpha(0.7);
    this.add.rectangle(0, GROUND_Y, GAME_W, GROUND_H, p.water).setOrigin(0, 0);

    this.add
      .text(GAME_W / 2, GAME_H * 0.26, 'Attack\non Ball', {
        fontFamily: '"Comic Sans MS", "Marker Felt", sans-serif',
        fontSize: `${64 * SCALE}px`,
        color: '#2b2b2b',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);

    const hero = this.add.image(GAME_W / 2, GAME_H * 0.55, 'hero-idle');
    this.tweens.add({
      targets: hero,
      y: hero.y - 14 * SCALE,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    const best = Number(localStorage.getItem(BEST_KEY) || 0);
    if (best > 0) {
      this.add
        .text(GAME_W / 2, GAME_H * 0.68, `Best: ${best.toFixed(1)}`, {
          fontFamily: '"Comic Sans MS", sans-serif',
          fontSize: `${24 * SCALE}px`,
          color: '#2b2b2b',
        })
        .setOrigin(0.5);
    }

    const prompt = this.add
      .text(GAME_W / 2, GAME_H * 0.8, 'Tap or press Space', {
        fontFamily: '"Comic Sans MS", sans-serif',
        fontSize: `${26 * SCALE}px`,
        color: '#2b2b2b',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    const start = () => this.scene.start('GameScene');
    this.input.once('pointerdown', start);
    this.input.keyboard.once('keydown-SPACE', start);
  }
}
