import * as Phaser from 'phaser';
import { GAME_W, GROUND_Y, SCALE } from '../config.js';
import { analyseSurvivability, sceneSafetyConfig, HORIZON } from '../systems/safety.js';

// Visualiser for the dodgeability guarantee (F4). Draws the hero's reachable
// corridor along the water line — the set of positions still open to them after
// simulating HORIZON seconds ahead — plus how many launches the spawner has
// vetoed. If the green band ever vanishes during play, the guarantee is leaking
// and something upstream needs fixing.
const REFRESH_MS = 100;

export default class SafetyOverlay {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    this.acc = REFRESH_MS;
    this.result = null;

    this.g = scene.add.graphics().setDepth(199).setScrollFactor(0).setVisible(false);
    this.text = scene.add
      .text(16 * SCALE, GROUND_Y - 30 * SCALE, '', {
        fontFamily: 'monospace',
        fontSize: `${14 * SCALE}px`,
        color: '#9bffba',
        backgroundColor: '#0b0b0bcc',
        padding: { x: 6 * SCALE, y: 3 * SCALE },
      })
      .setDepth(201)
      .setScrollFactor(0)
      .setVisible(false);
  }

  setVisible(v) {
    this.visible = v;
    this.g.setVisible(v);
    this.text.setVisible(v);
    if (!v) this.g.clear();
  }

  update(dtMs) {
    this.acc += dtMs;
    if (this.acc < REFRESH_MS) return;
    this.acc = 0;
    this.result = analyseSurvivability({ ...sceneSafetyConfig(this.scene), keepRows: true });
    this.draw();
  }

  draw() {
    const g = this.g;
    g.clear();
    const r = this.result;
    if (!r) return;

    const y0 = GROUND_Y + 6 * SCALE;
    const binW = r.binW ?? GAME_W / (r.reach.length || 1);
    // Stack a few snapshots of the corridor: nearest-in-time at the top,
    // furthest at the bottom, so you can watch it narrow as balls converge.
    const rows = r.rows || [r.reach];
    const shown = 6;
    const h = 5 * SCALE;
    for (let k = 0; k < shown; k++) {
      const row = rows[Math.min(rows.length - 1, Math.floor((k / (shown - 1)) * (rows.length - 1)))];
      if (!row) continue;
      g.fillStyle(0x66ff99, 0.5 - k * 0.06);
      for (let i = 0; i < row.length; i++) {
        if (row[i]) g.fillRect(r.minX + i * binW, y0 + k * h, Math.ceil(binW), h - 1);
      }
    }
    if (!r.survivable) {
      g.fillStyle(0xff5555, 0.5);
      g.fillRect(0, y0 + shown * h, GAME_W, h);
    }

    const sp = this.scene.spawner;
    const verdict = r.survivable ? `safe (+${HORIZON}s)` : `TRAPPED in ${r.tDeath.toFixed(2)}s`;
    this.text.setText(`dodge: ${verdict}  rerolled ${sp?.rejected ?? 0}  skipped ${sp?.skipped ?? 0}`);
    this.text.setColor(r.survivable ? '#9bffba' : '#ff7777');
    this.text.x = Phaser.Math.Clamp(16 * SCALE, 0, GAME_W);
  }

  destroy() {
    this.g.destroy();
    this.text.destroy();
  }
}
