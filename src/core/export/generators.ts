import type {
  InterviewLogEntry,
  Maturity,
  MonetizationModelKind,
  PricingStrategyKind,
  Project,
} from '@/core/blueprint/schema'
import { formatAnswer } from '@/core/engine/interview'
import { chosenModels, chosenPricing, needsPricing } from '@/core/engine/monetization'
import { SECTION_IDS, type SectionId } from '@/core/blueprint/sections'
import { checkReadiness, type Readiness } from './readiness'

/** Alle Texte werden übergeben: Kernlogik hängt weder an i18next noch an React. */
export interface ExportLabels {
  sectionTitles: Record<SectionId, string>
  modelKinds: Record<MonetizationModelKind, string>
  pricingStrategies: Record<PricingStrategyKind, string>
  monetizationTitle: string
  monetizationStatus: Record<'open' | 'decided', string>
  monetizationModel: string
  monetizationPricing: string
  examplePrices: string
  monetizationTask: string
  maturity: Record<Maturity, string>
  maturityLabel: string
  missing: string
  updatedAt: string
  formatVersion: string
  unaccepted: string
  openPoints: string
  noOpenPoints: string
  emptySections: string
  vagueSections: string
  unacceptedSections: string
  questions: string
  decisions: string
  additions: string
  contradictions: string
  analysisGaps: string
  analysisContradictions: string
  decisionLog: string
  chosen: string
  recommended: string
  rationale: string
  context: string
  pros: string
  cons: string
  consequence: string
  questionWhy: string
  deferred: string
  suggestedAddition: string
  analysis: string
  gaps: string
  interviewLog: string
  answer: string
  agentTitle: string
  agentIntro: string
  rulesTitle: string
  rules: readonly string[]
  tasksTitle: string
  roadmapMissing: string
  planNote: string
  acceptance: string
  phases: readonly { title: string; tasks: readonly string[]; acceptance: string }[]
  startTitle: string
  startIntro: string
  startBody: string
}

export const EXPORT_FILE_NAMES = [
  'BLUEPRINT.md',
  'CLAUDE.md',
  'AGENTS.md',
  'TASKS.md',
  'START-PROMPT.md',
] as const
export type ExportFilename = (typeof EXPORT_FILE_NAMES)[number]
export interface ExportFile {
  name: ExportFilename
  content: string
}
export const EXPORT_VERSION = 1

/** Namen in Überschriften bleiben einzeilig; die Abschnittsinhalte werden unverändert bewahrt. */
const heading = (text: string) => text.replace(/[\r\n]+/g, ' ')
const document = (parts: readonly string[]) => parts.filter(Boolean).join('\n\n') + '\n'
const bullets = (items: readonly string[]) => items.map((item) => `- ${heading(item)}`).join('\n')
const sectionNames = (ids: readonly SectionId[], labels: ExportLabels) =>
  ids.map((id) => labels.sectionTitles[id]).join(', ')

/** Gemeinsame Hinweise für Vorschau und exportiertes Dokument. */
export function describeReadiness(readiness: Readiness, labels: ExportLabels): string[] {
  return [
    ...(['emptySections', 'vagueSections', 'unacceptedSections'] as const).flatMap((key) =>
      readiness[key].length ? [`${labels[key]}: ${sectionNames(readiness[key], labels)}`] : [],
    ),
    ...(['questions', 'decisions', 'additions'] as const).flatMap((key) =>
      readiness[key].length ? [`${labels[key]}: ${readiness[key].length}`] : [],
    ),
    ...readiness.contradictions.map(
      (c) =>
        `${labels.contradictions} (${sectionNames(c.sectionIds, labels)}): ${c.evidence.join(' ↔ ')}`,
    ),
    ...readiness.analysisGaps.map(
      (gap) => `${labels.analysisGaps} (${sectionNames(gap.sectionIds, labels)}): ${gap.text}`,
    ),
    ...readiness.analysisContradictions.map(
      (c) => `${labels.analysisContradictions} (${sectionNames(c.sectionIds, labels)}): ${c.text}`,
    ),
  ]
}

function renderSection(project: Project, id: SectionId, labels: ExportLabels): string {
  const section = project.blueprint.sections[id]
  return document([
    `## ${labels.sectionTitles[id]}`,
    `_${labels.maturityLabel}: ${labels.maturity[section.maturity]}_`,
    section.source === 'aiSuggestion' && section.content.trim() ? `**${labels.unaccepted}**` : '',
    section.content.trim() ? section.content : labels.missing,
  ]).trimEnd()
}

/**
 * Kapitel „Monetarisierung“; leer, solange kein Modell gewählt ist. Preise bleiben als Annahme
 * gekennzeichnet (Label `examplePrices`).
 */
export function renderMonetization(project: Project, labels: ExportLabels): string {
  const monetization = project.monetization
  if (!monetization || monetization.chosenModelIds.length === 0) return ''
  const title = (kindLabel: string, own: string) =>
    heading(own ? `${own} (${kindLabel})` : kindLabel)
  return document([
    `## ${labels.monetizationTitle}`,
    `_${labels.monetizationStatus[monetization.status]}_`,
    ...chosenModels(monetization).map((model) =>
      document([
        `### ${labels.monetizationModel}: ${title(labels.modelKinds[model.kind], model.title)}`,
        model.summary,
        model.fitReason,
      ]).trimEnd(),
    ),
    monetization.modelRationale ? `${labels.rationale}: ${monetization.modelRationale}` : '',
    ...chosenPricing(monetization).map((option) =>
      document([
        `### ${labels.monetizationPricing}: ${title(labels.pricingStrategies[option.strategy], option.title)}`,
        option.summary,
        option.examplePrices ? `${labels.examplePrices}: ${option.examplePrices}` : '',
        option.reason,
      ]).trimEnd(),
    ),
    monetization.pricingRationale ? `${labels.rationale}: ${monetization.pricingRationale}` : '',
  ]).trimEnd()
}

/** Vollständiger Blueprint einschließlich Entscheidungsprotokoll und ungeklärtem Kontext. */
export function generateBlueprint(project: Project, labels: ExportLabels): string {
  const answerLog = interviewEntries(project)
  const readiness = checkReadiness(project)
  const warnings = describeReadiness(readiness, labels)
  const decided = project.decisions.filter((d) => d.status === 'decided')
  const analysis = project.interview.analysis
  return document([
    `# ${heading(project.name)}`,
    `${labels.updatedAt}: ${project.updatedAt} · ${labels.formatVersion}: ${EXPORT_VERSION}`,
    ...SECTION_IDS.map((id) => renderSection(project, id, labels)),
    renderMonetization(project, labels),
    `## ${labels.openPoints}`,
    warnings.length ? bullets(warnings) : labels.noOpenPoints,
    ...readiness.questions.map((q) =>
      document([
        `### ${labels.questions}: ${heading(q.text)}`,
        `${labels.sectionTitles[q.sectionId]}${q.status === 'deferred' ? ` · ${labels.deferred}` : ''}`,
        q.why ? `${labels.questionWhy}: ${q.why}` : '',
        bullets(q.options.map((option) => option.label)),
      ]).trimEnd(),
    ),
    ...readiness.decisions.map((d) =>
      document([
        `### ${labels.decisions}: ${heading(d.title)}`,
        d.context ? `${labels.context}: ${d.context}` : '',
        ...d.options.map((option) =>
          document([
            `#### ${heading(option.label)}`,
            option.id === d.recommendedOptionId ? `_${labels.recommended}_` : '',
            option.pros.length ? `${labels.pros}:\n${bullets(option.pros)}` : '',
            option.cons.length ? `${labels.cons}:\n${bullets(option.cons)}` : '',
            option.consequence ? `${labels.consequence}: ${option.consequence}` : '',
          ]).trimEnd(),
        ),
      ]).trimEnd(),
    ),
    ...readiness.additions.map((a) =>
      document([
        `### ${labels.suggestedAddition}: ${labels.sectionTitles[a.sectionId]}`,
        a.text,
        a.reason,
      ]).trimEnd(),
    ),
    decided.length ? `## ${labels.decisionLog}` : '',
    ...decided.map((d) => {
      const chosen = d.options.find((option) => option.id === d.chosenOptionId)!
      return document([
        `### ${heading(d.title)}`,
        labels.sectionTitles[d.sectionId],
        d.context ? `${labels.context}: ${d.context}` : '',
        `${labels.chosen}: ${chosen.label}`,
        chosen.pros.length ? `${labels.pros}:\n${bullets(chosen.pros)}` : '',
        chosen.cons.length ? `${labels.cons}:\n${bullets(chosen.cons)}` : '',
        chosen.consequence ? `${labels.consequence}: ${chosen.consequence}` : '',
        d.rationale ? `${labels.rationale}: ${d.rationale}` : '',
        `${labels.updatedAt}: ${d.decidedAt}`,
      ]).trimEnd()
    }),
    analysis
      ? document([
          `## ${labels.analysis}`,
          `${labels.updatedAt}: ${analysis.analyzedAt}`,
          analysis.summary,
          analysis.gaps.length
            ? `### ${labels.gaps}\n\n${bullets(analysis.gaps.map((gap) => `${sectionNames(gap.sectionIds, labels)}: ${gap.text}`))}`
            : '',
        ]).trimEnd()
      : '',
    answerLog.length ? `## ${labels.interviewLog}` : '',
    ...answerLog.map((entry) =>
      document([
        `### ${heading(entry.questionText)}`,
        `${labels.sectionTitles[entry.sectionId]} · ${entry.at}`,
        entry.action === 'deferred' ? labels.deferred : `${labels.answer}: ${entry.answerText}`,
      ]).trimEnd(),
    ),
  ])
}

/**
 * Verlauf plus beantwortete Fragen ohne Verlaufseintrag. Aus v1 migrierte Projekte haben gespeicherte
 * Antworten, aber einen leeren Verlauf; ohne diese Ergänzung fehlten sie im Export.
 */
export function interviewEntries(project: Project): InterviewLogEntry[] {
  const { log, questions } = project.interview
  const logged = new Set(log.filter((e) => e.action === 'answered').map((e) => e.questionId))
  const missing = questions
    .filter((q) => q.status === 'answered' && q.answer !== null && !logged.has(q.id))
    .map((q): InterviewLogEntry => ({
      questionId: q.id,
      questionText: q.text,
      sectionId: q.sectionId,
      action: 'answered',
      answerText: q.answer ? formatAnswer(q, q.answer) : '',
      at: q.answeredAt ?? q.createdAt,
    }))
  return [...log, ...missing]
}

/** Beide Tools bekommen denselben Kontext und dieselben Regeln. */
export function generateAgentContext(project: Project, labels: ExportLabels): string {
  return document([
    `# ${heading(project.name)} – ${labels.agentTitle}`,
    labels.agentIntro,
    ...(['problem', 'audience', 'features', 'nonGoals', 'techStack'] as const).map((id) =>
      renderSection(project, id, labels),
    ),
    renderMonetization(project, labels),
    `## ${labels.rulesTitle}`,
    labels.rules.map((rule, index) => `${index + 1}. ${rule}`).join('\n'),
    `## ${labels.openPoints}`,
    bullets(describeReadiness(checkReadiness(project), labels)) || labels.noOpenPoints,
  ])
}

/** Die gespeicherte Roadmap hat Vorrang; die vier Phasen sind ausdrücklich eine Vorlage. */
export function generateTasks(project: Project, labels: ExportLabels): string {
  return document([
    `# ${heading(project.name)} – ${labels.tasksTitle}`,
    renderSection(project, 'roadmap', labels),
    project.blueprint.sections.roadmap.content.trim() ? '' : labels.roadmapMissing,
    labels.planNote,
    ...labels.phases.map((phase) =>
      document([
        `## ${phase.title}`,
        phase.tasks.map((task) => `- [ ] ${task}`).join('\n'),
        `**${labels.acceptance}:** ${phase.acceptance}`,
      ]).trimEnd(),
    ),
    project.monetization && needsPricing(project.monetization)
      ? `## ${labels.monetizationTitle}\n\n- [ ] ${labels.monetizationTask}`
      : '',
    renderSection(project, 'features', labels),
    renderSection(project, 'flows', labels),
    renderSection(project, 'nonGoals', labels),
  ])
}

export function generateStartPrompt(project: Project, labels: ExportLabels): string {
  return document([
    `# ${labels.startTitle}`,
    labels.startIntro.replace('{{name}}', () => heading(project.name)),
    labels.startBody,
  ])
}

export function generateExportFiles(project: Project, labels: ExportLabels): ExportFile[] {
  const context = generateAgentContext(project, labels)
  return [
    { name: 'BLUEPRINT.md', content: generateBlueprint(project, labels) },
    { name: 'CLAUDE.md', content: context },
    { name: 'AGENTS.md', content: context },
    { name: 'TASKS.md', content: generateTasks(project, labels) },
    { name: 'START-PROMPT.md', content: generateStartPrompt(project, labels) },
  ]
}
