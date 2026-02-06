import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages（https://<user>.github.io/FLB/）用
  base: '/FLB/',

  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-512.png',
        'levels.json',
      ],
      manifest: {
        name: 'Football Line Break',
        short_name: 'FLB',
        description: 'Tactical Football Puzzle',
        theme_color: '#08131F',
        background_color: '#08131F',
        display: 'standalone',
        orientation: 'any',

        // /FLB/ 配下でもローカルでも壊れにくい
        scope: '.',
        start_url: '.',

        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      // これを入れると dev でもPWA挙動を試しやすい（不要なら削除OK）
      devOptions: {
        enabled: true,
      },
    }),
  ],
});
