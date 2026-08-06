// Keeps the design surface matching the real viewport.
//
// The game is authored at a fixed height (GAME_H) and a *variable* width derived
// from the window's aspect ratio. Phaser then FITs that surface to the screen —
// and because the aspect already matches, there is nothing left to letterbox.
// Without this the 960x540 surface pillarboxes on a 19.5:9 phone in landscape,
// leaving dead strips at both edges that read as invisible walls.
import { GAME_H, GAME_W, recomputeArenaSize } from '../config.js';
import { VIEWPORT_DIRTY, isPortrait, isRotated, setRotated, viewportSize } from '../orientation.js';

// Scene-agnostic event bus for "the arena width changed". Scenes subscribe in
// create() and unsubscribe on shutdown.
const listeners = new Set();

export function onArenaResize(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Safe-area insets (notch / home indicator), in *design units*. With a
// full-bleed canvas the arena now runs underneath them, so HUD corners need to
// stay clear even though gameplay still uses the full width.
let insets = { left: 0, right: 0 };

export function safeInsets() {
  return insets;
}

function measureInsets(game) {
  if (typeof document === 'undefined') return;
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;' +
    'padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const leftPx = parseFloat(cs.paddingLeft) || 0;
  const rightPx = parseFloat(cs.paddingRight) || 0;
  probe.remove();
  // CSS px -> design units. Derived from base/display rather than
  // scale.displayScale, which is computed off the canvas bounding rect and so
  // reports the rotated axes under software landscape.
  const perCssPx = game.scale.baseSize.width / (game.scale.displaySize.width || 1);
  insets = { left: leftPx * perCssPx, right: rightPx * perCssPx };
}

// Wire the game up to window resize / orientation changes. Debounced, because
// mobile browsers fire a burst of resizes while the URL bar animates.
export function initViewport(game) {
  let timer = null;

  const apply = () => {
    timer = null;
    // If we were faking landscape in CSS and the player has now actually turned
    // the device, drop the fake — setRotated() re-runs the size math itself.
    if (isRotated() && !isPortrait()) {
      setRotated(false);
      for (const fn of listeners) fn();
      return;
    }
    const changed = recomputeArenaSize(...viewportSize());
    measureInsets(game);
    // setGameSize, NOT resize: displaySize is an aspect-locked Size, and
    // ScaleManager.resize() only calls setSize() on it — which keeps the *old*
    // aspect ratio, so the canvas stays letterboxed at the previous shape.
    // setGameSize() calls displaySize.setAspectRatio() and is the documented
    // entry point for non-NONE scale modes.
    //
    // refresh() even when the design width is unchanged: the *parent* box may
    // have moved (rotation, URL bar) and FIT needs to re-measure it.
    if (changed) game.scale.setGameSize(GAME_W, GAME_H);
    else game.scale.refresh();
    for (const fn of listeners) fn();
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(apply, 150);
  };

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  if (screen.orientation) screen.orientation.addEventListener?.('change', schedule);
  // Orientation changes we caused ourselves: apply straight away, so the game
  // never renders a frame at the old size.
  window.addEventListener(VIEWPORT_DIRTY, apply);
  // First measurement once the canvas exists.
  game.events.once('ready', apply);
}
