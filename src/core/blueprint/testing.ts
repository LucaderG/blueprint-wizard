import { createEmptyProject } from './factory'
import type { Maturity, Project } from './schema'
import type { SectionId } from './sections'

/** Testhilfe: ein gültiges Projekt mit festen Werten. */
export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    ...createEmptyProject({
      id: 'p1',
      name: 'Testprojekt',
      now: new Date('2026-01-01T00:00:00.000Z'),
    }),
    ...overrides,
  }
}

/** Testhilfe: setzt den Reifegrad mehrerer Abschnitte. */
export function withMaturity(
  project: Project,
  maturities: Partial<Record<SectionId, Maturity>>,
): Project {
  const sections = { ...project.blueprint.sections }
  for (const [id, maturity] of Object.entries(maturities) as [SectionId, Maturity][]) {
    sections[id] = { ...sections[id], maturity }
  }
  return { ...project, blueprint: { sections } }
}
