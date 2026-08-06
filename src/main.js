import * as Phaser from 'phaser';
import { GAME_W, GAME_H, recomputeArenaSize } from './config.js';
import { initViewport } from './systems/viewport.js';
import { initOrientation } from './orientation.js';
import { getSettings } from './settings.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import PauseScene from './scenes/PauseScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import { initInstallPrompt } from './pwa-install.js';
import { initPwaUpdate } from './pwa-update.js';

initInstallPrompt();
initPwaUpdate();

// Ask the browser not to evict our localStorage (best score + settings) under
// storage pressure. Best-effort — granted based on engagement / install state.
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

// Match the design surface to this screen's aspect *before* the game is built,
// so the very first frame is already full-bleed.
recomputeArenaSize();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#fdf6e3',
  scale: {
    mode: Phaser.Scale.FIT,
    // NO_CENTER on purpose: #game is already a centering flexbox, and Phaser's
    // autoCenter computes its margins from canvas.getBoundingClientRect() —
    // which is the *rotated* box under software landscape (src/orientation.js)
    // and would fling the canvas off-screen. Letting CSS centre it is correct
    // in both orientations.
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  input: {
    // Phaser creates ONE touch pointer by default, so a second finger was never
    // tracked at all: playing with two thumbs, the hero froze the moment the
    // first thumb lifted because nothing was following the one still down.
    activePointers: 3,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: [BootScene, MenuScene, GameScene, PauseScene, GameOverScene],
});

initOrientation(game, getSettings().rotateClockwise);
initViewport(game);
