import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 5000000 // 5 MB — covers Firebase SDK
      },
      manifest: {
        name: 'JIMS ERP',
        short_name: 'JIMS ERP',
        description: 'JIMS ERP Custom ERP System',
        theme_color: '#004bb4',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
  build: {
    // Raise warning threshold — large lazy-loaded chunks (TF.js, Firebase) are
    // only downloaded on demand and cached by the PWA service worker, so the
    // warning is noise for this app's architecture.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // ── TF.js & MobileNet (lazy, only used by Product Finder AI) ──────────
          if (id.includes('@tensorflow-models/mobilenet') || id.includes('node_modules/mobilenet')) {
            return 'chunk-mobilenet';
          }
          if (id.includes('@tensorflow/tfjs-core') || id.includes('tfjs-core')) {
            return 'chunk-tfjs-core';
          }
          if (id.includes('@tensorflow/tfjs-backend')) {
            return 'chunk-tfjs-backend';
          }
          if (id.includes('@tensorflow/tfjs-converter') || id.includes('tfjs-converter')) {
            return 'chunk-tfjs-converter';
          }
          if (id.includes('@tensorflow/tfjs-layers') || id.includes('tfjs-layers')) {
            return 'chunk-tfjs-layers';
          }
          if (id.includes('@tensorflow')) {
            return 'chunk-tfjs-misc';
          }

          // ── Firebase — split into independently-cacheable sub-chunks ──────────
          if (id.includes('@firebase/auth') || id.includes('firebase/auth')) {
            return 'chunk-firebase-auth';
          }
          if (id.includes('@firebase/storage') || id.includes('firebase/storage')) {
            return 'chunk-firebase-storage';
          }
          if (
            id.includes('@firebase/firestore') ||
            id.includes('firebase/firestore') ||
            id.includes('@firebase/app') ||
            id.includes('firebase/app') ||
            id.includes('@firebase/component') ||
            id.includes('@firebase/util') ||
            id.includes('@firebase/logger')
          ) {
            return 'chunk-firebase-core';
          }
          if (id.includes('node_modules/firebase') || id.includes('@firebase')) {
            return 'chunk-firebase-misc';
          }

          // ── UI & charting ─────────────────────────────────────────────────────
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/d3-') ||
            id.includes('node_modules/victory-vendor')
          ) {
            return 'chunk-recharts';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'chunk-icons';
          }

          // ── React core ────────────────────────────────────────────────────────
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router')
          ) {
            return 'chunk-react';
          }

          // ── State & utilities ─────────────────────────────────────────────────
          if (id.includes('node_modules/zustand') || id.includes('node_modules/idb')) {
            return 'chunk-state';
          }
          if (id.includes('node_modules/tesseract')) {
            return 'chunk-tesseract';
          }
        }
      }
    }
  }
});
