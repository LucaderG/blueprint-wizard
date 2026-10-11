import type { Classification } from '@/core/ai'
import { setEntryPoint, updateSection, type EntryPoint, type Project } from '@/core/blueprint'
import { applyClassification } from '@/core/engine'
import type { ProjectRepository } from '@/core/storage'

export interface NewProjectOptions {
  /** Vom Nutzer eingegebener Projektname (kann leer sein). */
  name: string
  entryPoint: EntryPoint
  /** Name für Projekte ohne Eingabe und ohne Vorschlag der KI. */
  defaultName: string
}

/**
 * Legt ein Projekt aus einer KI-Einordnung an und speichert es. Ein eingegebener Name hat Vorrang
 * vor dem Vorschlag der KI.
 */
export async function createProjectFromClassification(
  repository: ProjectRepository,
  classification: Classification,
  { name, entryPoint, defaultName }: NewProjectOptions,
): Promise<Project> {
  const typedName = name.trim()
  const created = await repository.create(typedName || defaultName)
  const { project } = applyClassification(created, classification, entryPoint, {
    useSuggestedName: typedName === '',
  })
  return repository.save(project)
}

/**
 * Legt ein leeres Projekt an. Ein eingegebener Text landet als eigener Inhalt im Abschnitt
 * „Problem & Vision“.
 */
export async function createProjectWithoutAi(
  repository: ProjectRepository,
  { name, entryPoint, defaultName }: NewProjectOptions,
  text: string,
): Promise<Project> {
  const created = await repository.create(name.trim() || defaultName)
  let project = setEntryPoint(created, entryPoint)
  const problem = text.trim()
  if (problem) project = updateSection(project, 'problem', { content: problem })
  return repository.save(project)
}
