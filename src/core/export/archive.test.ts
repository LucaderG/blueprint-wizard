import { strFromU8, unzipSync } from 'fflate'
import { exportLabels } from './testing'
import { createExportZip } from './archive'
import { generateExportFiles } from './generators'
import { makeExportProject } from './testing'

describe('ZIP-Paket', () => {
  it('enthält exakt die angezeigten UTF-8-Dateien ohne zusätzliche Pfade oder Einstellungen', () => {
    const files = generateExportFiles(makeExportProject(), exportLabels)
    const bytes = createExportZip(files)
    const archive = unzipSync(bytes)
    expect(Object.keys(archive)).toEqual([
      'BLUEPRINT.md',
      'CLAUDE.md',
      'AGENTS.md',
      'TASKS.md',
      'START-PROMPT.md',
    ])
    for (const file of files) expect(strFromU8(archive[file.name]!)).toBe(file.content)
    expect(strFromU8(archive['BLUEPRINT.md']!)).toContain('Küchengeräte')
    expect(createExportZip(files)).toEqual(bytes)
  })
})
