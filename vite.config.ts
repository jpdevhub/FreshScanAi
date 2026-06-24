import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'FreshScan AI',
        short_name: 'FreshScan',
        description: 'AI-powered fish freshness scanner',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/localhost:8000\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          }
        ]
      }
    })
  ],
      // Use the existing manifest.json in public/
      manifest: false,
      workbox: {
        // Precache ONLY small app-shell assets (JS/CSS/HTML/icons).
        // DO NOT include .wasm or .onnx here — they are large (12–26 MB each)
        // and would cause the Service Worker install to time out.
        // They are handled below with lazy runtime caching instead.
        globPatterns: ['**/*.{js,css,html,ico,svg,gif,png}'],
        // Runtime caching: WASM and ONNX files are cached on first use
        // (CacheFirst) so subsequent offline scans load instantly.
        runtimeCaching: [
          {
            urlPattern: /\/models\/.*\.onnx$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'onnx-models',
              expiration: { maxAgeSeconds: 30 * 24 * 60 * 60 }, // 30 days
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /.*\.wasm$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-cache',
              expiration: { maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
});
