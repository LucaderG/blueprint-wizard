import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/**/*.contract.ts',
          'src/**/testing.ts',
          'src/test/**',
          'src/main.tsx',
        ],
        thresholds: {
          lines: 70,
          // Kernlogik muss besonders gut getestet sein (siehe Plan, Abschnitt 5).
          'src/core/**': { lines: 80, branches: 80 },
        },
      },
    },
  }),
)
