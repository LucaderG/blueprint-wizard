import type { BuildInfo } from '@/core/build/buildInfo'

declare global {
  /** Zur Build-Zeit von vite.config.ts gesetzt. */
  const __BUILD_INFO__: BuildInfo
}
