import * as Phaser from 'phaser';
import { GAME_W, GAME_H, GROUND_Y, GROUND_H, PALETTES, SCALE } from '../config.js';
import { openSettings, closeSettings } from '../ui/settingsPanel.js';
import { Sfx, unlockAudio } from '../audio.js';

// Animated backdrop behind the HTML settings panel. The panel (presets +
// advanced settings + Play) is the actual start screen; Play launches the game.
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    // Textures are ready and the menu is up — fade out the HTML loading screen.
    const loader = document.getElementById('aob-loading');
    if (loader) {
      loader.classList.add('aob-fade');
      setTimeout(() => loader.remove(), 400);
    }

    const p = PALETTES[0];
    this.add.rectangle(0, 0, GAME_W, GAME_H, p.bg).setOrigin(0);
    this.add.image(0, 0, 'grid').setOrigin(0).setTint(p.grid).setAlpha(0.7);
    this.add.rectangle(0, GROUND_Y, GAME_W, GROUND_H, p.water).setOrigin(0, 0);

    const hero = this.add.image(GAME_W / 2, GROUND_Y - 36 * SCALE, 'hero-idle');
    this.tweens.add({
      targets: hero,
      y: hero.y - 14 * SCALE,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    openSettings({
      onPlay: () => {
        unlockAudio(); // first user gesture — enable the AudioContext
        Sfx.ui();
        closeSettings();
        this.scene.start('GameScene');
      },
    });

    // Make sure the panel can't linger if the scene is torn down another way.
    this.events.once('shutdown', closeSettings);
  }
}
