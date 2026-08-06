// "Just be landscape" — the player should never have to physically turn the
// phone. Three strategies, tried in order:
//
//   1. Fullscreen + screen.orientation.lock('landscape'). The real thing.
//      Works on Android Chrome and installed PWAs; must run inside a user
//      gesture, so it's kicked off from the menu's Play button.
//   2. Software rotation — rotate the whole page 90° in CSS (index.html,
//      `body.aob-rotated`) and correct Phaser's pointer mapping to match. This
//      is the iOS Safari path, where neither the Fullscreen nor the Screen
//      Orientation API is available.
//   3. Give up and show the "rotate your device" prompt (body.aob-needs-rotate),
//      which is what the game used to do unconditionally.
//
// Strategy 2 is the delicate one: Phaser derives pointer coordinates from
// getBoundingClientRect() and knows nothing about our transform, so
// InputManager.transformPointer is replaced with a version that inverts the
// rotation. Everything else (rendering, layout, the HTML settings panel) is
// handled by the browser.
// Fired when something here changes what the game should be sized against;
// systems/viewport.js listens and does the resize immediately (no debounce).
export const VIEWPORT_DIRTY = 'aob-viewport-dirty';

let game = null;
let rotated = false;
let clockwise = true;
let originalTransformPointer = null;
let originalGetParentBounds = null;

const coarsePointer = () =>
  typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export function isPortrait() {
  return window.innerHeight > window.innerWidth;
}

// Publish the *unrotated* viewport size as CSS variables. vw/vh units can't be
// used here: inside the rotated body they still refer to the real viewport, and
// on mobile they lag behind the URL bar.
function publishViewportVars() {
  const s = document.documentElement.style;
  s.setProperty('--aob-vw', `${window.innerWidth}px`);
  s.setProperty('--aob-vh', `${window.innerHeight}px`);
}

// Inverse of the CSS rotation, about the top-left corner.
//
// The canvas's on-screen box R is the rotated one, so R.width is the canvas's
// own (unrotated) CSS *height* and R.height its CSS *width*. Undo the rotation
// to get unrotated element coordinates, then scale into game space.
//
//   cw  — `rotate(90deg) translateY(-100%)`:  ex = sy,            ey = R.width - sx
//   ccw — `rotate(-90deg) translateX(-100%)`: ex = R.height - sy, ey = sx
function mapRotatedPointer(scale, pageX, pageY) {
  const r = scale.canvas.getBoundingClientRect();
  const sx = pageX - window.scrollX - r.left;
  const sy = pageY - window.scrollY - r.top;
  const ex = clockwise ? sy : r.height - sy;
  const ey = clockwise ? r.width - sx : sx;
  return {
    x: ex * (scale.baseSize.width / r.height),
    y: ey * (scale.baseSize.height / r.width),
  };
}

// Phaser sizes the canvas from `parent.getBoundingClientRect()`, which for our
// rotated wrapper reports the *rotated* AABB (portrait) instead of the layout
// box (landscape) — so FIT would shrink the canvas into a portrait box. Feed it
// the swapped dimensions instead. Same contract as the original: return true
// when the recorded parent size actually changed.
function patchParentBounds() {
  const scale = game.scale;
  if (originalGetParentBounds) return;
  originalGetParentBounds = scale.getParentBounds;
  scale.getParentBounds = function () {
    if (!rotated) return originalGetParentBounds.call(this);
    const [w, h] = viewportSize();
    if (this.parentSize.width !== w || this.parentSize.height !== h) {
      this.parentSize.setSize(w, h);
      return true;
    }
    return false;
  };
}

// Replace InputManager.transformPointer. Mirrors Phaser's own implementation
// (including prevPosition bookkeeping and move smoothing) but swaps in the
// rotation-aware mapping.
function patchPointerTransform() {
  const manager = game.input;
  if (!manager || typeof manager.transformPointer !== 'function') return false;
  if (originalTransformPointer) return true;
  originalTransformPointer = manager.transformPointer;
  const scale = game.scale;
  manager.transformPointer = function (pointer, pageX, pageY, wasMove) {
    if (!rotated) return originalTransformPointer.call(this, pointer, pageX, pageY, wasMove);
    const p0 = pointer.position;
    const p1 = pointer.prevPosition;
    p1.x = p0.x;
    p1.y = p0.y;
    const { x, y } = mapRotatedPointer(scale, pageX, pageY);
    const a = pointer.smoothFactor;
    if (!wasMove || a === 0) {
      p0.x = x;
      p0.y = y;
    } else {
      p0.x = x * a + p1.x * (1 - a);
      p0.y = y * a + p1.y * (1 - a);
    }
  };
  return true;
}

// True while the page is being displayed rotated — the viewport listener needs
// this to feed recomputeArenaSize() the swapped dimensions.
export function isRotated() {
  return rotated;
}

// Flip which way the page is rotated (see the CSS note above). Persisted by the
// caller; a no-op unless software rotation is actually in use.
export function setRotationClockwise(cw) {
  clockwise = !!cw;
  document.body.classList.toggle('aob-cw', clockwise);
  document.body.classList.toggle('aob-ccw', !clockwise);
}

export function setRotated(on) {
  if (on === rotated) return rotated;
  if (on && !patchPointerTransform()) return false; // couldn't take over input — don't rotate
  patchParentBounds();
  rotated = on;
  publishViewportVars();
  document.body.classList.toggle('aob-rotated', on);
  setRotationClockwise(clockwise);
  // Hand the actual resize back to systems/viewport.js (which owns the canvas
  // size and the re-layout broadcast) via its undebounced dirty event. Doing it
  // this way keeps the module dependency one-directional.
  window.dispatchEvent(new Event(VIEWPORT_DIRTY));
  return rotated;
}

// The viewport as the game sees it — swapped while software-rotated.
export function viewportSize() {
  return rotated
    ? [window.innerHeight, window.innerWidth]
    : [window.innerWidth, window.innerHeight];
}

export function initOrientation(phaserGame, rotateClockwise = true) {
  game = phaserGame;
  clockwise = !!rotateClockwise;
  publishViewportVars();
  window.addEventListener('resize', publishViewportVars);
  window.addEventListener('orientationchange', publishViewportVars);
}

// Called from the Play button, inside the user gesture. Best-effort throughout:
// every one of these APIs is allowed to be missing or to reject.
export async function ensureLandscape() {
  if (!isPortrait()) {
    document.body.classList.remove('aob-needs-rotate');
    return 'already-landscape';
  }

  // 1. The real orientation lock (needs fullscreen on Chrome Android).
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: 'hide' });
    }
    if (screen.orientation?.lock) {
      await screen.orientation.lock('landscape');
      document.body.classList.remove('aob-needs-rotate');
      return 'locked';
    }
  } catch {
    /* not supported / rejected — fall through */
  }

  // 2. Software rotation (iOS Safari). Touch devices only: a tall desktop
  //    window should letterbox, not stand on its head.
  if (coarsePointer() && setRotated(true)) {
    document.body.classList.remove('aob-needs-rotate');
    return 'css-rotated';
  }

  // 3. Ask nicely.
  document.body.classList.add('aob-needs-rotate');
  return 'prompt';
}
