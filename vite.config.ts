import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolveBuildInfo } from './src/core/build/buildInfo.ts'

// GitHub Pages liefert die App unter /<repo>/ aus; der Deploy-Workflow setzt dafür BASE_PATH.
const base = process.env.BASE_PATH ?? '/'

function git(...args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

// Version unten in der App: „stable“ nur, wenn der gebaute Commit den Release-Tag v<Version> trägt
// (dafür braucht der Checkout die Tags), sonst „nightly“. Ohne git ebenfalls „nightly“.
const packageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string }
const buildInfo = resolveBuildInfo({
  version: packageJson.version,
  commit: git('rev-parse', '--short=7', 'HEAD'),
  tagsAtCommit: git('tag', '--points-at', 'HEAD')?.split('\n').filter(Boolean) ?? [],
})

export default defineConfig({
  base,
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
  },
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
