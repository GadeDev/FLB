import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
<<<<<<< HEAD
      includeAssets: ['icon-192.png', 'icon-512.png', 'levels.json'],
      manifest: {
        name: 'LINE BREAK LAB',
        short_name: 'LineBreak',
        description: 'Tactical Football Puzzle',
        theme_color: '#0a0e17',
        background_color: '#0a0e17',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
=======
      includeAssets: [
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-512.png',
        'levels.json',
      ],
      manifest: {
        name: 'Football Line Break',
        short_name: 'FLB',
        description: 'Break the line. Solve football tactics in seconds.',
        theme_color: '#08131F',
        background_color: '#08131F',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,json}'],
        navigateFallback: '/index.html'
>>>>>>> e2a4063 (Initial commit: Football Line Break (PWA demo))
      }
    })
  ]
});
