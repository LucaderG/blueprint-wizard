import { PROJECT_NAME_MAX_LENGTH } from '@/core/blueprint'
import { exportFileName, validateProjectName } from './projectName'

describe('validateProjectName', () => {
  it('verlangt einen nicht leeren Namen', () => {
    expect(validateProjectName('')).toBe('required')
    expect(validateProjectName('   ')).toBe('required')
  })

  it('begrenzt die Länge nach dem Trimmen', () => {
    expect(validateProjectName('x'.repeat(PROJECT_NAME_MAX_LENGTH))).toBeNull()
    expect(validateProjectName(` ${'x'.repeat(PROJECT_NAME_MAX_LENGTH)} `)).toBeNull()
    expect(validateProjectName('x'.repeat(PROJECT_NAME_MAX_LENGTH + 1))).toBe('tooLong')
  })
})

describe('exportFileName', () => {
  it('bildet den Dateinamen aus dem Projektnamen', () => {
    expect(exportFileName('Mein Projekt')).toBe('mein-projekt.blueprint.json')
  })

  it('nutzt einen Ersatznamen, wenn vom Namen nichts übrig bleibt', () => {
    expect(exportFileName('???')).toBe('projekt.blueprint.json')
  })
})
