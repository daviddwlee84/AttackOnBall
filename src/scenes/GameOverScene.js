import * as Phaser from 'phaser';
import { GAME_W, GAME_H, MAX_GAME_W, SCALE } from '../config.js';
import { makeDoodleButton } from '../ui/button.js';
import { askName, closeNameEntry } from '../ui/nameEntry.js';
import { leaderboard } from '../systems/leaderboard.js';
import { getSettings, setSettings } from '../settings.js';
import { onArenaResize } from '../systems/viewport.js';
import { setUpdatePromptVisible } from '../pwa-update.js';
import { releaseLandscape } from '../orientation.js';

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

const FONT = '"Comic Sans MS", "Marker Felt", sans-serif';

// Shows the final score, the per-mode best, this run's leaderboard placing, and
// the top of the board for the exact difficulty that was played.
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.score = data.score || 0;
    this.mode = data.mode || 'classic';
    this.difficulty = data.difficulty || getSettings().difficulty;
    this.admin = !!data.admin;
    this.rank = 0;
  }

  create() {
    // The run is over — a pending update can be offered without costing anything.
    setUpdatePromptVisible(true);

    // Admin runs are played zoomed out with every hitbox on show — a real
    // advantage — so they touch neither the best score nor the leaderboard.
    const best = this.admin ? readBest(this.mode) : Math.max(this.score, readBest(this.mode));
    if (!this.admin) localStorage.setItem(bestKey(this.mode), String(best));
    const isNewBest = !this.admin && this.score >= best && this.score > 0;
    this.bucket = leaderboard.bucketOf(this.mode, this.difficulty);

    // MAX_GAME_W so a resize while this overlay is up can't reveal a gap.
    this.add.rectangle(0, 0, MAX_GAME_W, GAME_H, 0x2b2b2b, 0.55).setOrigin(0).setDepth(70);

    const title = this.text(GAME_H * 0.16, 'Game Over', 52, '#ffffff', 'bold');
    const scoreText = this.text(GAME_H * 0.3, `Score: ${this.score.toFixed(1)}`, 34, '#ffffff');
    const bestText = this.text(
      GAME_H * 0.38,
      isNewBest ? 'New best! 🎉' : `Best: ${best.toFixed(1)}`,
      24,
      '#ffd43b'
    );
    this.rankText = this.text(GAME_H * 0.455, '', 24, '#9ad42b', 'bold');
    this.boardTitle = this.text(GAME_H * 0.54, '', 20, '#ffffff');
    this.boardRows = [0, 1, 2].map((i) => this.text(GAME_H * (0.6 + i * 0.06), '', 20, '#ffffff'));

    // Buttons exist immediately but only act after a short delay so the death
    // tap can't accidentally trigger them.
    this.ready = false;
    const gap = 150 * SCALE;
    const playAgain = makeDoodleButton(this, 0, GAME_H * 0.86, '▶ Play Again', 0x4dabf7, () => {
      if (this.ready) this.restart();
    }).setDepth(72);
    const settings = makeDoodleButton(this, 0, GAME_H * 0.86, '⚙ Settings', 0xffd43b, () => {
      if (this.ready) this.toMenu();
    }).setDepth(72);
    [playAgain, settings].forEach((b) => b.setAlpha(0));

    const centre = () => {
      for (const o of [title, scoreText, bestText, this.rankText, this.boardTitle, ...this.boardRows]) {
        o.x = GAME_W / 2;
      }
      playAgain.x = GAME_W / 2 - gap;
      settings.x = GAME_W / 2 + gap;
    };
    centre();
    const offResize = onArenaResize(centre);
    this.events.once('shutdown', offResize);
    this.events.once('shutdown', closeNameEntry);

    this.renderBoard();
    this.maybeRecordScore();

    this.time.delayedCall(450, () => {
      this.ready = true;
      this.tweens.add({ targets: [playAgain, settings], alpha: 1, duration: 200 });
      this.input.keyboard.once('keydown-SPACE', () => this.restart());
      this.input.keyboard.once('keydown-M', () => this.toMenu());
    });
  }

  text(y, value, size, color, style = '') {
    return this.add
      .text(0, y, value, {
        fontFamily: FONT,
        fontSize: `${size * SCALE}px`,
        color,
        fontStyle: style,
      })
      .setOrigin(0.5)
      .setDepth(71);
  }

  // Offer a name only when the run actually placed. The prompt is HTML, so it
  // sits above the canvas and the scene keeps running underneath.
  maybeRecordScore() {
    if (this.admin) return; // unranked by design
    if (!leaderboard.qualifies(this.bucket, this.score)) return;
    const provisional = leaderboard.top(this.bucket).filter((e) => e.score >= this.score).length + 1;
    askName({ defaultName: getSettings().playerName, rank: provisional, score: this.score }).then((name) => {
      if (name == null || !this.scene.isActive()) return;
      setSettings({ playerName: name });
      this.rank = leaderboard.submit(this.bucket, name, this.score, Date.now());
      this.renderBoard();
    });
  }

  renderBoard() {
    if (this.admin) {
      this.rankText.setColor('#ff9f43').setText('🔧 Debug run — not ranked');
      this.boardTitle.setText('');
      this.boardRows.forEach((t) => t.setText(''));
      return;
    }
    const rows = leaderboard.top(this.bucket, 3);
    this.rankText.setText(this.rank ? `Leaderboard rank #${this.rank}` : '');
    this.boardTitle.setText(rows.length ? `🏆 ${this.difficulty} · ${this.mode}` : '');
    this.boardRows.forEach((t, i) => {
      const e = rows[i];
      t.setText(e ? `${i + 1}. ${e.name} — ${e.score.toFixed(1)}` : '');
      // Highlight the row this run just claimed.
      t.setColor(this.rank === i + 1 ? '#9ad42b' : '#ffffff');
    });
  }

  // This scene is an overlay on top of the (frozen) GameScene — tear both down.
  restart() {
    closeNameEntry();
    this.scene.stop('GameScene');
    this.scene.stop();
    this.scene.start('GameScene', { admin: this.admin }); // stay in debug mode
  }

  toMenu() {
    closeNameEntry();
    // Settings are an HTML form — hand the device back its real orientation so
    // they're read upright. Done here rather than in MenuScene.create(), which
    // also runs on the scene restart that a rotation change itself triggers
    // (rotate -> resize broadcast -> menu restart -> release -> un-rotate).
    releaseLandscape();
    this.scene.stop('GameScene');
    this.scene.stop();
    this.scene.start('MenuScene');
  }
}
