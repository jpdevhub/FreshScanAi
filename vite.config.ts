import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

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
})
