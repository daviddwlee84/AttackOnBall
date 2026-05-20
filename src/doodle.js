// Procedural "doodle/crayon" texture generation with rough.js.
// Each helper draws into an offscreen <canvas> and registers it as a Phaser
// texture so sprites can use it like any loaded image. Expressions and colors
// are just different draws — no external art assets required.
//
// Stroke widths, padding and the small fixed-size textures all scale with
// SCALE so the hand-drawn look stays consistent at the high-res buffer.
import rough from 'roughjs';
import { SCALE } from './config.js';

const S = SCALE;
export const PAD = 8 * S; // breathing room so sketchy strokes don't clip the edge

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Register (or replace) a canvas as a Phaser texture.
function register(scene, key, canvas) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

// Rounded-rectangle path string, drawn with rough.js for the hand-drawn body.
function roundedRectPath(x, y, w, h, r) {
  return (
    `M${x + r},${y} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} ` +
    `v${h - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - 2 * r)} ` +
    `a${r},${r} 0 0 1 ${-r},${-r} v${-(h - 2 * r)} a${r},${r} 0 0 1 ${r},${-r} z`
  );
}

/** Bouncing ball: sketchy circle with a crayon hachure fill. */
export function makeBall(scene, key, radius, fillColor) {
  const size = radius * 2 + PAD * 2;
  const canvas = makeCanvas(size, size);
  const rc = rough.canvas(canvas);
  rc.circle(size / 2, size / 2, radius * 2, {
    roughness: 2.2,
    bowing: 1.5,
    stroke: '#2b2b2b',
    strokeWidth: 3 * S,
    fill: fillColor,
    fillStyle: 'zigzag',
    fillWeight: 3 * S,
    hachureGap: 5 * S,
  });
  register(scene, key, canvas);
}

/**
 * Hero: a rounded green blob with a face. `expression` is one of
 * 'idle' | 'left' | 'right' | 'dead'.
 */
export function makeHero(scene, key, size, color, expression) {
  const canvas = makeCanvas(size + PAD * 2, size + PAD * 2);
  const rc = rough.canvas(canvas);
  const ctx = canvas.getContext('2d');
  const x = PAD;
  const y = PAD;
  const r = size * 0.28;

  // Body
  rc.path(roundedRectPath(x, y, size, size, r), {
    roughness: 1.8,
    bowing: 1.2,
    stroke: '#2b2b2b',
    strokeWidth: 3.5 * S,
    fill: color,
    fillStyle: 'zigzag',
    fillWeight: 3.5 * S,
    hachureGap: 5 * S,
  });

  // Stubby arms
  rc.line(x - 4 * S, y + size * 0.55, x - 12 * S, y + size * 0.45, {
    roughness: 1.5,
    stroke: '#2b2b2b',
    strokeWidth: 3 * S,
  });
  rc.line(x + size + 4 * S, y + size * 0.55, x + size + 12 * S, y + size * 0.45, {
    roughness: 1.5,
    stroke: '#2b2b2b',
    strokeWidth: 3 * S,
  });

  const cx = x + size / 2;
  const eyeY = y + size * 0.38;
  // Eyes shift with direction to read as "looking where I'm going".
  const lean = expression === 'left' ? -size * 0.06 : expression === 'right' ? size * 0.06 : 0;
  const eyeDX = size * 0.16;

  ctx.fillStyle = '#2b2b2b';
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 3 * S;
  ctx.lineCap = 'round';

  if (expression === 'dead') {
    // X eyes
    for (const ex of [cx - eyeDX, cx + eyeDX]) {
      const s = size * 0.05;
      ctx.beginPath();
      ctx.moveTo(ex - s, eyeY - s);
      ctx.lineTo(ex + s, eyeY + s);
      ctx.moveTo(ex + s, eyeY - s);
      ctx.lineTo(ex - s, eyeY + s);
      ctx.stroke();
    }
  } else {
    for (const ex of [cx - eyeDX, cx + eyeDX]) {
      ctx.beginPath();
      ctx.arc(ex + lean, eyeY, size * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Open mouth (white box with dark outline) — the franchise's signature look.
  const mw = size * 0.34;
  const mh = expression === 'dead' ? size * 0.22 : size * 0.16;
  const mx = cx - mw / 2 + lean * 0.5;
  const my = y + size * 0.58;
  rc.rectangle(mx, my, mw, mh, {
    roughness: 1.6,
    stroke: '#2b2b2b',
    strokeWidth: 3 * S,
    fill: '#ffffff',
    fillStyle: 'solid',
  });

  register(scene, key, canvas);
}

/** Falling collectible: a doodle bubble with a number inside. */
export function makeNumber(scene, key, value, accent) {
  const size = 48 * S;
  const canvas = makeCanvas(size, size);
  const rc = rough.canvas(canvas);
  const ctx = canvas.getContext('2d');
  rc.circle(size / 2, size / 2, size - PAD * 2, {
    roughness: 1.8,
    stroke: '#2b2b2b',
    strokeWidth: 3 * S,
    fill: accent,
    fillStyle: 'solid',
  });
  ctx.fillStyle = '#2b2b2b';
  ctx.font = `bold ${size * 0.4}px "Comic Sans MS", "Marker Felt", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), size / 2, size / 2 + 1 * S);
  register(scene, key, canvas);
}

/** Small shard used for the death particle burst. */
export function makeFragment(scene, key) {
  const size = 18 * S;
  const canvas = makeCanvas(size, size);
  const rc = rough.canvas(canvas);
  rc.polygon(
    [
      [3 * S, 3 * S],
      [size - 2 * S, 5 * S],
      [size - 5 * S, size - 3 * S],
      [4 * S, size - 4 * S],
    ],
    {
      roughness: 1.5,
      stroke: '#2b2b2b',
      strokeWidth: 2 * S,
      fill: '#ffffff',
      fillStyle: 'solid',
    }
  );
  register(scene, key, canvas);
}

/**
 * Transparent notebook-grid overlay (drawn once, tinted per palette at runtime).
 */
export function makeGrid(scene, key, w, h, gap = 40 * S) {
  const canvas = makeCanvas(w, h);
  const rc = rough.canvas(canvas);
  const opts = { roughness: 1.2, bowing: 0.8, stroke: '#ffffff', strokeWidth: 1.5 * S };
  for (let x = gap; x < w; x += gap) rc.line(x, 0, x, h, opts);
  for (let y = gap; y < h; y += gap) rc.line(0, y, w, y, opts);
  register(scene, key, canvas);
}
