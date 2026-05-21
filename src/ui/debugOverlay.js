import * as Phaser from 'phaser';
import { SCALE } from '../config.js';

// A lightweight in-game debug HUD: current FPS (smoothed), the worst FPS in the
// recent window, current frame time in ms, and a scrolling line graph of the
// last ~N frames. Frame time is measured from wall-clock `performance.now()` so
// real stutters (long frames) show up as sharp dips, instead of being hidden by
// Phaser's smoothed average. Toggle from GameScene (F3 / settings).
const N = 150; // samples kept in the graph (~2.5s at 60fps)
const MAX_FPS = 70; // graph vertical scale

export default class DebugOverlay {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    this.buf = [];
    this.lastNow = null;
    this.lastFrameMs = 0;
    this.textAccum = 0;

    this.x = 16 * SCALE;
    this.y = 60 * SCALE;
    this.w = 250 * SCALE;
    this.h = 112 * SCALE;
    this.pad = 8 * SCALE;
    this.headerH = 22 * SCALE;
    this.gx = this.x + this.pad;
    this.gy = this.y + this.pad + this.headerH;
    this.gw = this.w - 2 * this.pad;
    this.gh = this.h - 2 * this.pad - this.headerH;

    this.g = scene.add.graphics().setDepth(200).setScrollFactor(0).setVisible(false);
    this.text = scene.add
      .text(this.x + this.pad, this.y + this.pad, '', {
        fontFamily: 'monospace',
        fontSize: `${15 * SCALE}px`,
        color: '#e8e8e8',
      })
      .setDepth(201)
      .setScrollFactor(0)
      .setVisible(false);
  }

  setVisible(v) {
    this.visible = v;
    this.g.setVisible(v);
    this.text.setVisible(v);
    if (!v) {
      this.buf.length = 0;
      this.lastNow = null;
    }
  }

  yFor(fps) {
    return this.gy + this.gh - (Math.min(fps, MAX_FPS) / MAX_FPS) * this.gh;
  }

  update() {
    const now = performance.now();
    if (this.lastNow != null) {
      const frameMs = now - this.lastNow;
      if (frameMs > 0 && frameMs < 1000) {
        this.lastFrameMs = frameMs;
        this.buf.push(1000 / frameMs);
        if (this.buf.length > N) this.buf.shift();
      }
    }
    this.lastNow = now;
    this.draw();
  }

  draw() {
    const g = this.g;
    g.clear();

    // Panel.
    g.fillStyle(0x0b0b0b, 0.72);
    g.fillRoundedRect(this.x, this.y, this.w, this.h, 8 * SCALE);

    // Reference grid lines at 30 and 60 fps.
    g.lineStyle(1 * SCALE, 0x555555, 0.9);
    g.lineBetween(this.gx, this.yFor(60), this.gx + this.gw, this.yFor(60));
    g.lineBetween(this.gx, this.yFor(30), this.gx + this.gw, this.yFor(30));

    // FPS history, colored per segment by the lower of its two endpoints.
    const n = this.buf.length;
    for (let i = 1; i < n; i++) {
      const x0 = this.gx + ((i - 1) / (N - 1)) * this.gw;
      const x1 = this.gx + (i / (N - 1)) * this.gw;
      const f0 = this.buf[i - 1];
      const f1 = this.buf[i];
      const lo = Math.min(f0, f1);
      const col = lo < 45 ? 0xff5555 : lo < 55 ? 0xffcc44 : 0x66ff99;
      g.lineStyle(2 * SCALE, col, 1);
      g.lineBetween(x0, this.yFor(f0), x1, this.yFor(f1));
    }

    // Refresh the readout a few times a second (cheaper than every frame).
    this.textAccum += this.lastFrameMs;
    if (this.textAccum >= 200 || this.text.text === '') {
      this.textAccum = 0;
      const cur = this.scene.game.loop.actualFps;
      const min = n ? Math.min(...this.buf) : cur;
      this.text.setText(`FPS ${cur.toFixed(0)}  min ${min.toFixed(0)}  ${this.lastFrameMs.toFixed(1)}ms`);
      this.text.setColor(cur < 45 ? '#ff7777' : cur < 55 ? '#ffd466' : '#9bffba');
    }
  }

  destroy() {
    this.g.destroy();
    this.text.destroy();
  }
}
