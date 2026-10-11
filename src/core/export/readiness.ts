import { computeCompleteness } from '@/core/blueprint/completeness'
import type { Project } from '@/core/blueprint/schema'
import { SECTION_IDS } from '@/core/blueprint/sections'
import { detectContradictions } from '@/core/engine/contradictions'

/** Hinweise sind informativ: Der Export bleibt auch bei offenen Punkten möglich. */
export function checkReadiness(project: Project) {
  const emptySections = SECTION_IDS.filter((id) => !project.blueprint.sections[id].content.trim())
  const vagueSections = SECTION_IDS.filter(
    (id) =>
      project.blueprint.sections[id].content.trim() &&
      project.blueprint.sections[id].maturity !== 'decided',
  )
  const unacceptedSections = SECTION_IDS.filter(
    (id) =>
      project.blueprint.sections[id].content.trim() &&
      project.blueprint.sections[id].source === 'aiSuggestion',
  )
  const questions = project.interview.questions.filter(
    (q) => q.status === 'open' || q.status === 'deferred',
  )
  const decisions = project.decisions.filter((d) => d.status === 'open')
  const additions = project.additions.filter((a) => a.status === 'open')
  const contradictions = detectContradictions(project)
  const analysisGaps = project.interview.analysis?.gaps ?? []
  const analysisContradictions = project.interview.analysis?.contradictions ?? []
  return {
    ready: [
      emptySections,
      vagueSections,
      unacceptedSections,
      questions,
      decisions,
      additions,
      contradictions,
      analysisContradictions,
      analysisGaps,
    ].every((items) => items.length === 0),
    completeness: computeCompleteness(project.blueprint).total,
    emptySections,
    vagueSections,
    unacceptedSections,
    questions,
    decisions,
    additions,
    contradictions,
    analysisContradictions,
    analysisGaps,
  }
}

export type Readiness = ReturnType<typeof checkReadiness>
