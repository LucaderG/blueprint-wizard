import { setEntryPoint, type EntryPoint, type Project } from '@/core/blueprint'
import { applyProfile, type VariantDraft } from '@/core/engine'
import type { ProjectRepository } from '@/core/storage'

/**
 * Legt je Steckbrief einen Eintrag an. Neu Erzeugtes liegt im Papierkorb, bis man es speichert
 * (ADR 0012). Varianten kommen aus „halbe Idee“, Ideen der Ideenfindung aus „keine Idee“.
 */
export async function createVariantEntries(
  repository: ProjectRepository,
  drafts: readonly VariantDraft[],
  entryPoint: EntryPoint = 'partialIdea',
): Promise<Project[]> {
  const entries: Project[] = []
  for (const draft of drafts) {
    const created = await repository.create(draft.name)
    await repository.save(applyProfile(setEntryPoint(created, entryPoint), draft))
    entries.push(await repository.trash(created.id))
  }
  return entries
}
