import * as Phaser from 'phaser';
import { GAME_W, GAME_H, GROUND_Y, SCALE } from '../config.js';
import { isRotated } from '../orientation.js';
import { spawnInterval } from '../systems/ballistics.js';

// Admin / teaching view. Zooms the camera out past the arena edge and draws
// everything the game normally hides:
//
//   * a red frame around the arena — everything outside it is off-screen in a
//     normal run, which is where balls are launched from and culled
//   * Arcade Physics bodies, so the hitboxes are visible rather than inferred
//     (the hero's box is deliberately smaller than its sprite)
//   * live input state, which is the thing you actually want when a control
//     bug is being reported: is the hero being told to go left or right, and
//     by which input path?
//   * the launch parameters of every live ball, so an odd-looking arc can be
//     traced back to the numbers that produced it
//
// Runs are unranked in this mode (see GameOverScene) — the zoomed-out view is
// a real advantage, so scores from it don't belong on the board.
const ZOOM = 0.72;
const REFRESH_MS = 100;

export default class AdminOverlay {
  constructor(scene) {
    this.scene = scene;
    this.acc = REFRESH_MS;

    scene.cameras.main.setZoom(ZOOM);
    scene.cameras.main.centerOn(GAME_W / 2, GAME_H / 2);

    // Arcade's own body renderer. Not enabled via the game config because that
    // would cost every normal run; created on demand instead.
    const world = scene.physics.world;
    if (!world.debugGraphic) world.createDebugGraphic();
    world.drawDebug = true;
    world.debugGraphic.setDepth(150).setVisible(true);

    this.g = scene.add.graphics().setDepth(151);
    this.text = scene.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: `${13 * SCALE}px`,
        color: '#e8e8e8',
        backgroundColor: '#0b0b0bdd',
        padding: { x: 8 * SCALE, y: 6 * SCALE },
        lineSpacing: 2 * SCALE,
      })
      .setDepth(152);
    this.ballText = scene.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: `${12 * SCALE}px`,
        color: '#9bffba',
        backgroundColor: '#0b0b0bdd',
        padding: { x: 8 * SCALE, y: 6 * SCALE },
      })
      .setDepth(152)
      .setOrigin(1, 0);

    this.drawFrame();
  }

  // The arena rectangle plus the water line — the boundary between what a
  // player sees and what the simulation actually contains.
  drawFrame() {
    const g = this.g;
    g.clear();
    g.lineStyle(3 * SCALE, 0xff3b3b, 0.9);
    g.strokeRect(0, 0, GAME_W, GAME_H);
    g.lineStyle(2 * SCALE, 0xff3b3b, 0.35);
    g.lineBetween(0, GROUND_Y, GAME_W, GROUND_Y);
    // Hero's legal centre range, which is inset from the arena edge.
    const s = this.scene;
    if (s.playerMinX != null) {
      g.lineStyle(2 * SCALE, 0x4dabf7, 0.5);
      g.lineBetween(s.playerMinX, GROUND_Y - 30 * SCALE, s.playerMinX, GROUND_Y);
      g.lineBetween(s.playerMaxX, GROUND_Y - 30 * SCALE, s.playerMaxX, GROUND_Y);
    }
  }

  update(dtMs) {
    this.acc += dtMs;
    if (this.acc < REFRESH_MS) return;
    this.acc = 0;
    this.drawFrame();

    const s = this.scene;
    const p = s.params;
    const pointer = s.input.activePointer;
    const dir = s.player.body.velocity.x === 0 ? 0 : Math.sign(s.player.body.velocity.x);
    const arrow = dir < 0 ? '<= LEFT ' : dir > 0 ? ' RIGHT =>' : '  idle   ';
    const keyLeft = s.cursors.left.isDown || s.keyA.isDown;
    const keyRight = s.cursors.right.isDown || s.keyD.isDown;
    const src = keyLeft || keyRight ? 'keyboard' : pointer.isDown ? 'pointer' : 'none';
    // Both directions held at once is the interesting case — show which press
    // won and by how much, so "the key didn't register" can be told apart from
    // "the opposite key was still down".
    const socd = keyLeft && keyRight
      ? `BOTH held -> newest wins (${(
          Math.abs(
            Math.max(s.cursors.left.timeDown, s.keyA.isDown ? s.keyA.timeDown : -Infinity) -
              Math.max(s.cursors.right.timeDown, s.keyD.isDown ? s.keyD.timeDown : -Infinity)
          ) / 1000
        ).toFixed(2)}s apart)`
      : '·';

    this.text.setPosition(14 * SCALE, 190 * SCALE); // clears the FPS graph above it
    this.text.setText(
      [
        `INPUT   ${arrow}   via ${src}`,
        `  keys L/R      ${keyLeft ? 'DOWN' : '·'} / ${keyRight ? 'DOWN' : '·'}`,
        `  opposing      ${socd}`,
        `  pointer       ${pointer.isDown ? 'down' : 'up'} @ ${pointer.worldX.toFixed(0)},${pointer.worldY.toFixed(0)}`,
        `  fingers down  ${s.input.manager.pointers.filter((q) => q.isDown).length}` +
          `  ignored ${s.ignoredPointers.size} (HUD / held from last screen)`,
        '',
        `HERO    x ${s.player.x.toFixed(0)}  vx ${s.player.body.velocity.x.toFixed(0)}  speed ${p.playerSpeed.toFixed(0)}`,
        `  bounds        ${s.playerMinX?.toFixed(0)} .. ${s.playerMaxX?.toFixed(0)}`,
        `  hitbox        ${(s.playerHalfW * 2).toFixed(0)} x ${(s.playerBottom - s.playerTop).toFixed(0)}`,
        '',
        `ARENA   ${GAME_W} x ${GAME_H}   zoom ${ZOOM}   ${isRotated() ? 'SOFT-ROTATED' : 'upright'}`,
        `  viewport      ${window.innerWidth} x ${window.innerHeight}  dpr ${window.devicePixelRatio}`,
        '',
        `SPAWN   t ${s.elapsed.toFixed(1)}s   interval ${spawnInterval(p, s.elapsed).toFixed(2)}s`,
        `  next in       ${Math.max(0, spawnInterval(p, s.elapsed) - s.spawner.ballAcc).toFixed(2)}s`,
        `  dodge re-roll ${s.spawner.rejected} rerolled, ${s.spawner.skipped} skipped`,
        `  balls         ${s.balls.getChildren().length}`,
      ].join('\n')
    );

    // Per-ball launch parameters: the numbers behind each arc.
    const rows = s.balls
      .getChildren()
      .slice(0, 10)
      .map((b) => {
        const pl = b.plan || {};
        return (
          `${pl.lob ? 'LOB ' : '    '}r${String(Math.round(b.radius)).padStart(3)}` +
          ` apex${String(Math.round(pl.apex ?? 0)).padStart(4)}` +
          ` cross${(pl.crossTime ?? 0).toFixed(1)}s` +
          ` x${String(Math.round(b.x)).padStart(5)}`
        );
      });
    this.ballText.setPosition(GAME_W - 14 * SCALE, 190 * SCALE); // clears the FPS graph above it
    this.ballText.setText(rows.length ? ['BALLS (apex/cross are design units)', ...rows].join('\n') : '');
  }

  // Called from the scene's shutdown handler, i.e. *during* teardown: by then
  // physics.world is already null, and touching it threw — which aborted
  // GameOverScene.restart() halfway, leaving the buttons looking dead when in
  // fact they had fired. Everything here is optional cleanup (each scene builds
  // its own Arcade world and camera, so nothing leaks into the next run), so it
  // is all guarded.
  destroy() {
    const world = this.scene.physics && this.scene.physics.world;
    if (world) {
      world.drawDebug = false;
      if (world.debugGraphic) world.debugGraphic.setVisible(false);
    }
    for (const obj of [this.g, this.text, this.ballText]) {
      if (obj && obj.scene) obj.destroy();
    }
  }
}
