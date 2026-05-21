// "Add to Home Screen" prompt. Service-worker registration is handled by
// vite-plugin-pwa (registerType: 'autoUpdate'); this module only drives the
// in-page install banner (#aob-install in index.html).
//
//  - Chromium fires `beforeinstallprompt`: we stash it and show an Install button
//    that triggers the native prompt on click.
//  - iOS Safari never fires that event, so we instead show a one-line
//    "Share -> Add to Home Screen" hint.
//  - Nothing is shown when already installed/standalone, or if the user has
//    previously dismissed the banner (remembered in localStorage).

const DISMISS_KEY = 'aob-install-dismissed';

const isStandalone = () =>
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
  window.navigator.standalone === true;

const isIos = () => {
  const ua = window.navigator.userAgent || '';
  const iosUa = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as "MacIntel" but exposes touch points.
  const iPadOs =
    window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return iosUa || iPadOs;
};

const dismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

const remember = () => {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* ignore (private mode / storage disabled) */
  }
};

export function initInstallPrompt() {
  const banner = document.getElementById('aob-install');
  if (!banner || isStandalone() || dismissed()) return;

  const textEl = banner.querySelector('.text');
  const installBtn = banner.querySelector('.install-btn');
  const dismissBtn = banner.querySelector('.dismiss-btn');
  let deferredPrompt = null;

  const hide = () => banner.classList.remove('aob-show');
  const show = () => banner.classList.add('aob-show');

  dismissBtn.addEventListener('click', () => {
    hide();
    remember();
  });

  if (isIos()) {
    // No programmatic prompt on iOS — show manual instructions instead.
    textEl.textContent = 'Install: tap Share, then “Add to Home Screen”.';
    installBtn.style.display = 'none';
    show();
    return;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // suppress Chrome's default mini-infobar
    deferredPrompt = event;
    textEl.textContent = 'Add Attack on Ball to your home screen?';
    show();
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    hide();
    promptEvent.prompt();
    await promptEvent.userChoice; // outcome: 'accepted' | 'dismissed'
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hide();
    remember();
  });
}
