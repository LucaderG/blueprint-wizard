import type { EntryPoint, Project, ProjectProfile, Section } from './schema'
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

/**
 * Ersetzt den Steckbrief nach einer Bearbeitung von Hand. Texte werden getrimmt, leere Einträge in
 * Funktionen und Risiken entfallen. Ohne Pitch gibt es keinen gültigen Steckbrief.
 */
export function updateProfile(project: Project, profile: ProjectProfile): Project {
  const pitch = profile.pitch.trim()
  if (!pitch) throw new RangeError('Ein Steckbrief braucht einen Pitch')
  const cleanList = (items: string[]) => items.map((item) => item.trim()).filter(Boolean)
  return {
    ...project,
    profile: {
      pitch,
      problem: profile.problem.trim(),
      audience: profile.audience.trim(),
      features: cleanList(profile.features),
      platform: profile.platform.trim(),
      monetization: {
        model: profile.monetization.model.trim(),
        priceRange: profile.monetization.priceRange.trim(),
        reason: profile.monetization.reason.trim(),
      },
      effort: profile.effort,
      risks: cleanList(profile.risks),
    },
  }
}
