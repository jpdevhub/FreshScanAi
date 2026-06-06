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
    // In local dev, proxy /api/* to the FastAPI backend at :8000.
    // This avoids CORS issues and means the frontend never needs to
    // hard-code the backend port.
    // In production, VITE_API_URL is set externally so this block is unused.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
