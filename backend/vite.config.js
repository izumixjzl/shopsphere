import { defineConfig } from 'vite'
import laravel from 'laravel-vite-plugin'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    laravel({
      input: ['resources/js/main.jsx'],
      refresh: true,
    }),
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['chart.js', 'react-chartjs-2'],
          vendor: ['react', 'react-dom', 'react-router-dom', 'axios'],
        },
      },
    },
  },
})
