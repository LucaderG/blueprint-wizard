import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages liefert die App unter /<repo>/ aus; der Deploy-Workflow setzt dafür BASE_PATH.
// Ein fehlender Schrägstrich am Ende wird ergänzt, sonst zeigt der Service-Worker-Fallback ins Leere.
const base = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/')

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    // Installierbar und offline zu öffnen: Der Service Worker cacht nur die App selbst. KI-Anfragen
    // an OpenRouter laufen immer übers Netz; Projekte liegen ohnehin lokal in IndexedDB.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'Blueprint-Wizard',
        short_name: 'Blueprint',
        description: 'Von der Idee zum Projekt-Blueprint fürs Vibe-Coding, lokal im Browser.',
        lang: 'de',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#fcfcfc',
        theme_color: '#4f46e5',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // React in einen eigenen, selten geänderten Chunk; übrige Bibliotheken folgen den Seiten, die sie
        // brauchen (z. B. fflate nur mit der Exportseite).
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
