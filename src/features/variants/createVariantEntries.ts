import type { Project } from '@/core/blueprint'
import { applyProfile, type VariantDraft } from '@/core/engine'
import type { ProjectRepository } from '@/core/storage'

/**
 * Legt je Steckbrief einen Eintrag an. Neu Erzeugtes liegt im Papierkorb, bis man es speichert
 * (ADR 0012).
 */
export async function createVariantEntries(
  repository: ProjectRepository,
  drafts: readonly VariantDraft[],
): Promise<Project[]> {
  const entries: Project[] = []
  for (const draft of drafts) {
    const created = await repository.create(draft.name)
    await repository.save(applyProfile(created, draft))
    entries.push(await repository.trash(created.id))
  }
  return entries
}
