import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Project is deployed to GitHub Pages at https://<user>.github.io/AttackOnBall/
// so all asset URLs must be prefixed with the repo name in production.
const base = process.env.GITHUB_PAGES ? '/AttackOnBall/' : '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      // 'prompt', not 'autoUpdate': a new worker must WAIT until the player
      // accepts. autoUpdate emits skipWaiting()+clientsClaim(), which swaps the
      // worker out from under a live run — and since nothing reloads the page,
      // the tab then keeps executing the old bundle anyway. src/pwa-update.js
      // owns the lifecycle and only offers the refresh between runs.
      registerType: 'prompt',
      // We register from src/pwa-update.js via `virtual:pwa-register`, so the
      // plugin must not also inject its own registerSW.js (double registration).
      injectRegister: null,
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'og-image.png'],
      manifest: {
        name: 'Attack on Ball',
        short_name: 'AttackBall',
        description: 'Dodge the bouncing balls as long as you can!',
        theme_color: '#7ed957',
        background_color: '#fdf6e3',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
