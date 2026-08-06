import * as Phaser from 'phaser';
import { SCALE } from '../config.js';

// A rounded doodle-style text button. Returns a container (for easy positioning
// + alpha tweening); the background rectangle carries the interactivity.
//
// NOTE: we make the *rectangle child* interactive rather than giving the
// container a custom hitArea — a container-level Geom hitArea does not
// hit-test reliably in Phaser (the pointer never registers as "over"), which
// silently breaks clicks.
//
// NOTE: the callback fires on pointer*up*, not pointerdown. Firing on down
// started the next scene while the finger was still held, and GameScene's
// "walk toward the finger" control then read that held pointer and jerked the
// freshly spawned hero toward the button.
export function makeDoodleButton(scene, x, y, label, color, onClick) {
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: '"Comic Sans MS", "Marker Felt", sans-serif',
      fontSize: `${24 * SCALE}px`,
      color: '#08334d',
      fontStyle: 'bold',
    })
    .setOrigin(0.5);

  const padX = 30 * SCALE;
  const padY = 14 * SCALE;
  const w = text.width + padX * 2;
  const h = text.height + padY * 2;
  const bg = scene.add.rectangle(0, 0, w, h, color).setStrokeStyle(3 * SCALE, 0x2b2b2b);

  const btn = scene.add.container(x, y, [bg, text]);
  bg.setInteractive({ useHandCursor: true });

  let armed = false;
  bg.on('pointerover', () => btn.setScale(1.04));
  bg.on('pointerout', () => {
    armed = false;
    btn.setScale(1);
  });
  bg.on('pointerdown', () => {
    armed = true;
  });
  bg.on('pointerup', () => {
    if (!armed) return; // press started elsewhere and was dragged onto us
    armed = false;
    if (onClick) onClick();
  });

  btn.bg = bg;
  return btn;
}
