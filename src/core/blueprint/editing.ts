import type { EntryPoint, Project, Section } from './schema'
import type { SectionId } from './sections'

export type SectionPatch = Partial<Pick<Section, 'content' | 'maturity' | 'source'>>

/**
 * Ändert einen Abschnitt und liefert ein neues Projekt (das Original bleibt unverändert).
 * Wer den Inhalt von Hand ändert, macht ihn zu eigenem Inhalt: `source` wird dann `user`,
 * sofern der Patch nichts anderes angibt. Zeitstempel setzt das Repository beim Speichern.
 */
export function updateSection(project: Project, id: SectionId, patch: SectionPatch): Project {
  const current = project.blueprint.sections[id]
  const contentChanged = patch.content !== undefined && patch.content !== current.content
  const next: Section = {
    ...current,
    ...patch,
    source: patch.source ?? (contentChanged ? 'user' : current.source),
  }
  // Leerer Inhalt kann nicht „vage“ oder „entschieden“ sein.
  if (next.content.trim() === '') next.maturity = 'empty'
  // Wer Inhalt einträgt, ohne die Reife anzugeben, hat mindestens eine vage Vorstellung.
  else if (next.maturity === 'empty' && patch.maturity === undefined) next.maturity = 'vague'

  return {
    ...project,
    blueprint: { sections: { ...project.blueprint.sections, [id]: next } },
  }
}

/** Übernimmt einen KI-Vorschlag als bestätigten Inhalt. */
export function acceptSuggestion(project: Project, id: SectionId): Project {
  if (project.blueprint.sections[id].source !== 'aiSuggestion') return project
  return updateSection(project, id, { source: 'aiAccepted' })
}

export function setEntryPoint(project: Project, entryPoint: EntryPoint): Project {
  return { ...project, entryPoint }
}
