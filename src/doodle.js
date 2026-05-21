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
 * 'idle' | 'left' | 'right' | 'scared' | 'dead'.
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

  const isScared = expression === 'scared';
  const isSmug = expression === 'smug';
  const isTongue = expression === 'tongue';
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
  } else if (isScared) {
    // Wide "O_O" eyes: white sclera ring with a small dark pupil.
    for (const ex of [cx - eyeDX, cx + eyeDX]) {
      ctx.beginPath();
      ctx.fillStyle = '#ffffff';
      ctx.arc(ex, eyeY, size * 0.085, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.5 * S;
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = '#2b2b2b';
      ctx.arc(ex, eyeY + size * 0.02, size * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (isSmug) {
    // Half-lidded confident squint with one cocked eyebrow.
    ctx.lineWidth = 4 * S;
    for (const ex of [cx - eyeDX, cx + eyeDX]) {
      ctx.beginPath();
      ctx.moveTo(ex - size * 0.05, eyeY);
      ctx.lineTo(ex + size * 0.05, eyeY - size * 0.015);
      ctx.stroke();
    }
    ctx.lineWidth = 2.5 * S;
    ctx.beginPath();
    ctx.moveTo(cx + eyeDX - size * 0.06, eyeY - size * 0.11);
    ctx.lineTo(cx + eyeDX + size * 0.06, eyeY - size * 0.15);
    ctx.stroke();
  } else if (isTongue) {
    // Cheeky wink: left eye a happy arc, right eye wide open.
    ctx.lineWidth = 4 * S;
    ctx.beginPath();
    ctx.arc(cx - eyeDX, eyeY + size * 0.04, size * 0.06, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = '#2b2b2b';
    ctx.arc(cx + eyeDX, eyeY, size * 0.05, 0, Math.PI * 2);
    ctx.fill();
  } else {
    for (const ex of [cx - eyeDX, cx + eyeDX]) {
      ctx.beginPath();
      ctx.arc(ex + lean, eyeY, size * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (isSmug || isTongue) {
    // A cocky grin instead of the open box.
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 4 * S;
    ctx.lineJoin = 'round';
    const my = y + size * 0.62;
    ctx.beginPath();
    if (isSmug) {
      // Lopsided smirk.
      ctx.moveTo(cx - size * 0.13, my - size * 0.01);
      ctx.quadraticCurveTo(cx + size * 0.04, my + size * 0.11, cx + size * 0.17, my - size * 0.04);
    } else {
      // Open grin.
      ctx.moveTo(cx - size * 0.15, my - size * 0.02);
      ctx.quadraticCurveTo(cx, my + size * 0.13, cx + size * 0.15, my - size * 0.02);
    }
    ctx.stroke();
    if (isTongue) {
      // Pink tongue poking out.
      ctx.fillStyle = '#ff8aa8';
      ctx.lineWidth = 2 * S;
      ctx.beginPath();
      ctx.ellipse(cx + size * 0.02, my + size * 0.09, size * 0.07, size * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else {
    // Open mouth (white box with dark outline) — the franchise's signature look.
    // Scared gapes wider/taller; death sags open.
    const mw = isScared ? size * 0.3 : size * 0.34;
    const mh = expression === 'dead' ? size * 0.22 : isScared ? size * 0.26 : size * 0.16;
    const mx = cx - mw / 2 + lean * 0.5;
    const my = y + (isScared ? size * 0.56 : size * 0.58);
    rc.rectangle(mx, my, mw, mh, {
      roughness: 1.6,
      stroke: '#2b2b2b',
      strokeWidth: 3 * S,
      fill: '#ffffff',
      fillStyle: 'solid',
    });
  }

  // A little blue sweat drop sells the panic.
  if (isScared) {
    ctx.fillStyle = '#4dabf7';
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 1.5 * S;
    const dx = x + size * 0.9;
    const dy = y + size * 0.26;
    ctx.beginPath();
    ctx.moveTo(dx, dy - size * 0.07);
    ctx.quadraticCurveTo(dx + size * 0.06, dy + size * 0.02, dx, dy + size * 0.05);
    ctx.quadraticCurveTo(dx - size * 0.06, dy + size * 0.02, dx, dy - size * 0.07);
    ctx.fill();
    ctx.stroke();
  }

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

/** Collectible heart (lives mode): a doodle heart with a dark outline. */
export function makeHeart(scene, key) {
  const size = 48 * S;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const x = size / 2;
  const top = size * 0.16;
  const w = size * 0.74;
  const h = size * 0.66;
  ctx.beginPath();
  ctx.moveTo(x, top + h * 0.3);
  ctx.bezierCurveTo(x, top, x - w / 2, top, x - w / 2, top + h * 0.3);
  ctx.bezierCurveTo(x - w / 2, top + h * 0.62, x, top + h * 0.82, x, top + h);
  ctx.bezierCurveTo(x, top + h * 0.82, x + w / 2, top + h * 0.62, x + w / 2, top + h * 0.3);
  ctx.bezierCurveTo(x + w / 2, top, x, top, x, top + h * 0.3);
  ctx.closePath();
  ctx.fillStyle = '#ff5b6b';
  ctx.fill();
  ctx.lineWidth = 3.5 * S;
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineJoin = 'round';
  ctx.stroke();
  // little glossy highlight
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.2, top + h * 0.32, w * 0.11, h * 0.09, -0.4, 0, Math.PI * 2);
  ctx.fill();
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

/** Soft round puff for the dust kicked up when a ball lands. */
export function makePuff(scene, key) {
  const size = 28 * S;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
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
