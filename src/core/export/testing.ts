import { SECTION_IDS, type Project } from '@/core/blueprint'
import { makeProject } from '@/core/blueprint/testing'
import de from '@/shared/i18n/locales/de.json'

/** Übersetzungen an derselben Grenze zusammensetzen wie in der Oberfläche. */
export const exportLabels = {
  ...de.export.document,
  sectionTitles: de.sections,
  modelKinds: de.monetization.kinds,
  pricingStrategies: de.monetization.strategies,
  maturity: de.maturity,
}

/** Ein ausgearbeiteter Blueprint mit Inhalten, die unabhängig vom Generator feststehen. */
export function makeExportProject(): Project {
  const project = makeProject({ name: 'Koch-Leihbörse' })
  const contents = [
    'Küchengeräte in der Nachbarschaft leihen.',
    'Nachbarn, die selten kochen.',
    '- Geräte anbieten\n- Leihen mit Rückgabedatum\n- Rezepte pro Gerät',
    '- Keine Bezahlung',
    'Gerät suchen → Details öffnen → Leihe eintragen.',
    'Gerät: Name, Besitzer. Leihe: Gerät, Rückgabedatum.',
    'React-Web-App im Browser.',
    'Keine externen Dienste.',
    'Beschädigte Geräte und verspätete Rückgaben.',
    'Phase 1: Geräte erfassen. Abnahme: Gerät erscheint in der Liste.\nPhase 2: Leihen verwalten.',
  ]
  SECTION_IDS.forEach((id, index) => {
    project.blueprint.sections[id] = {
      id,
      content: contents[index]!,
      maturity: 'decided',
      source: 'user',
    }
  })
  return project
}
