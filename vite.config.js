import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Project is deployed to GitHub Pages at https://<user>.github.io/AttackOnBall/
// so all asset URLs must be prefixed with the repo name in production.
const base = process.env.GITHUB_PAGES ? '/AttackOnBall/' : '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
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
