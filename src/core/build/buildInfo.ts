// Versionsangabe der gebauten App. Bestimmt wird sie zur Build-Zeit (vite.config.ts) aus
// package.json und git; die App liest das Ergebnis nur noch über `__BUILD_INFO__`.

export type BuildChannel = 'stable' | 'nightly'

export interface BuildInfo {
  /** Version aus package.json, ohne „v“, z. B. „1.0.0“. */
  version: string
  /** „stable“ nur, wenn der gebaute Commit genau den Release-Tag dieser Version trägt. */
  channel: BuildChannel
  /** Kurzer Commit-Hash; `null`, wenn git nicht verfügbar war. */
  commit: string | null
}

export interface BuildSource {
  version: string
  commit: string | null
  /** Alle Tags, die auf den gebauten Commit zeigen. */
  tagsAtCommit: readonly string[]
}

export function releaseTag(version: string): string {
  return `v${version}`
}

export function resolveBuildInfo({ version, commit, tagsAtCommit }: BuildSource): BuildInfo {
  const stable = commit !== null && tagsAtCommit.includes(releaseTag(version))
  return { version, channel: stable ? 'stable' : 'nightly', commit }
}

/** Anzeige, z. B. „v1.0.0 · stable“ oder „v1.0.0 · nightly · abc1234“. */
export function formatVersion({ version, channel, commit }: BuildInfo): string {
  const parts = [releaseTag(version), channel]
  if (channel === 'nightly' && commit) parts.push(commit)
  return parts.join(' · ')
}
