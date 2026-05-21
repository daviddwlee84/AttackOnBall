import * as Phaser from 'phaser';
import { GAME_W, GAME_H, PLAYER_SIZE, BALL_SIZES, BALL_COLORS, HERO_COLOR, PICKUP_VALUES } from '../config.js';
import { makeBall, makeHero, makeNumber, makeFragment, makePuff, makeGrid } from '../doodle.js';

// Generates every doodle texture once at startup, then hands off to the menu.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.add
      .text(GAME_W / 2, GAME_H / 2, 'doodling…', {
        fontFamily: '"Comic Sans MS", sans-serif',
        fontSize: '28px',
        color: '#2b2b2b',
      })
      .setOrigin(0.5);

    // Hero expressions
    for (const exp of ['idle', 'left', 'right', 'scared', 'dead']) {
      makeHero(this, `hero-${exp}`, PLAYER_SIZE, HERO_COLOR, exp);
    }

    // Balls: one texture per (size, color) combo
    BALL_SIZES.forEach((size, sizeIdx) => {
      BALL_COLORS.forEach((color, colorIdx) => {
        makeBall(this, `ball-${sizeIdx}-${colorIdx}`, size.r, color);
      });
    });

    // Number pickups
    for (const value of PICKUP_VALUES) {
      makeNumber(this, `num-${value}`, value, '#ffd43b');
    }

    makeFragment(this, 'fragment');
    makePuff(this, 'puff');
    makeGrid(this, 'grid', GAME_W, GAME_H);

    this.scene.start('MenuScene');
  }
}
