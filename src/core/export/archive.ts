import { strToU8, zipSync, type Zippable } from 'fflate'
import type { ExportFile } from './generators'

/** Feste ZIP-Zeitstempel machen denselben Projektstand reproduzierbar exportierbar. */
export function createExportZip(files: readonly ExportFile[]): Uint8Array<ArrayBuffer> {
  const entries: Zippable = Object.fromEntries(
    files.map((file) => [file.name, [strToU8(file.content), { mtime: new Date(1980, 0, 1) }]]),
  )
  return Uint8Array.from(zipSync(entries, { level: 6 }))
}
