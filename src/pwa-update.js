// Service-worker update lifecycle: notice a new deploy, then let the player
// take it when it won't cost them anything.
//
// WHY THIS ISN'T JUST `registerType: 'autoUpdate'`
// -----------------------------------------------
// Two problems with the automatic path for a game like this:
//
//  1. Nothing ever re-checks. The browser only refetches sw.js on a navigation
//     (and roughly once a day), so an open tab — or an installed PWA resumed
//     from the home screen rather than cold-started — can serve a stale build
//     indefinitely. The fix is to call registration.update() ourselves whenever
//     the app comes back to the foreground.
//  2. Auto-applying is worse than useless mid-run. skipWaiting()+clientsClaim()
//     hands control to the new worker immediately, but the page keeps executing
//     the *old* bundle until something navigates — so the player gets no new
//     version and no notice. Reloading automatically to fix that would kill a
//     run in progress, and the score here IS the elapsed time.
//
// So: check eagerly, apply only on an explicit tap, and only offer the tap on
// the menu / game-over screens. GameScene suppresses the prompt entirely.
import { registerSW } from 'virtual:pwa-register';

let applyFn = null;
let updateReady = false;
let promptAllowed = false;
let toast;

function el() {
  if (toast !== undefined) return toast;
  toast = document.getElementById('aob-update') || null;
  if (toast) {
    toast.querySelector('.update-btn')?.addEventListener('click', applyUpdate);
    toast.querySelector('.later-btn')?.addEventListener('click', () => {
      // Dismiss for this screen only — it comes back next time we're between
      // runs, because the update is still pending.
      promptAllowed = false;
      sync();
    });
  }
  return toast;
}

function sync() {
  const node = el();
  if (node) node.classList.toggle('aob-show', updateReady && promptAllowed);
}

/** True once a newer build has been downloaded and is waiting to activate. */
export function isUpdateReady() {
  return updateReady;
}

/**
 * Whether this screen is a safe moment to interrupt. Scenes call this on
 * create(): true for menu / game over, false while a run is live.
 */
export function setUpdatePromptVisible(allowed) {
  promptAllowed = !!allowed;
  sync();
}

/** Activate the waiting worker and reload onto the new build. */
export function applyUpdate() {
  if (applyFn) applyFn(true);
}

export function initPwaUpdate() {
  applyFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true;
      sync();
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // The missing piece in the default setup: ask the server for a new
      // worker every time the app is brought back to the foreground, so a
      // long-lived tab or a resumed PWA notices a deploy.
      const check = () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      };
      window.addEventListener('focus', check);
      document.addEventListener('visibilitychange', check);
    },
  });
}
