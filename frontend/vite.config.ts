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
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'Jef Investment ERP',
        short_name: 'Jef ERP',
        description: 'Jef Investment Custom ERP System',
        theme_color: '#0056b3',
        background_color: '#f4f6f9',
        display: 'standalone'
      }
    })
  ],
});
