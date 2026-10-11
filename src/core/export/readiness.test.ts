import { makeProject } from '@/core/blueprint/testing'
import { checkReadiness } from './readiness'
import { makeExportProject } from './testing'

describe('Reife-Check', () => {
  it('meldet alle leeren Abschnitte, auch bei inkonsistentem Reifegrad', () => {
    const project = makeProject()
    project.blueprint.sections.problem.maturity = 'decided'
    project.blueprint.sections.problem.content = '  \n '
    const result = checkReadiness(project)
    expect(result.ready).toBe(false)
    expect(result.emptySections).toHaveLength(10)
    expect(result.emptySections).toContain('problem')
  })

  it('gibt einen ausgearbeiteten, widerspruchsfreien Blueprint frei', () => {
    expect(checkReadiness(makeExportProject())).toMatchObject({ ready: true, completeness: 100 })
  })

  it('meldet vage Inhalte, nicht übernommene Vorschläge und Widersprüche', () => {
    const project = makeExportProject()
    project.blueprint.sections.techStack = {
      id: 'techStack',
      content: 'Offline-first',
      maturity: 'vague',
      source: 'aiSuggestion',
    }
    project.blueprint.sections.features.content = 'Echtzeit-Zusammenarbeit'
    expect(checkReadiness(project)).toMatchObject({
      ready: false,
      vagueSections: ['techStack'],
      unacceptedSections: ['techStack'],
      contradictions: [expect.objectContaining({ ruleId: 'offlineVsRealtime' })],
    })
  })
})

describe('Offener Kontext', () => {
  it('meldet offene, zurückgestellte und abhängige Fragen sowie ungelöste Entscheidungen und Vorschläge', async () => {
    const { migrateProject } = await import('@/core/blueprint/migrations')
    const { default: legacy } = await import('@/core/blueprint/__fixtures__/project-v2.json')
    const project = migrateProject(legacy)
    const question = project.interview.questions[1]!
    project.interview.questions.push({
      ...question,
      id: 'later',
      status: 'deferred',
      dependsOn: ['unanswered'],
    })
    project.interview.questions.push({ ...question, id: 'dismissed', status: 'dismissed' })
    project.additions = [
      {
        id: 'open',
        sectionId: 'features',
        text: 'Erinnerung',
        reason: '',
        status: 'open',
        createdAt: project.createdAt,
        resolvedAt: null,
      },
      {
        id: 'accepted',
        sectionId: 'features',
        text: 'Filter',
        reason: '',
        status: 'accepted',
        createdAt: project.createdAt,
        resolvedAt: project.updatedAt,
      },
    ]
    expect(checkReadiness(project)).toMatchObject({
      ready: false,
      questions: [
        expect.objectContaining({ id: 'v2-q2' }),
        expect.objectContaining({ id: 'later' }),
      ],
      decisions: [expect.objectContaining({ id: 'v2-d2' })],
      additions: [expect.objectContaining({ id: 'open' })],
    })
  })

  it('kennzeichnet Lücken und Widersprüche aus der letzten Analyse als noch zu prüfen', () => {
    const project = makeExportProject()
    project.interview.analysis = {
      summary: '',
      gaps: [{ sectionIds: ['features'], text: 'Fehlerfall fehlt' }],
      contradictions: [],
      analyzedAt: project.updatedAt,
      promptVersion: 1,
    }
    expect(checkReadiness(project)).toMatchObject({
      ready: false,
      analysisGaps: [{ sectionIds: ['features'], text: 'Fehlerfall fehlt' }],
    })
    project.interview.analysis.contradictions.push({
      sectionIds: ['features', 'techStack'],
      text: 'Plattform prüfen',
    })
    expect(checkReadiness(project).analysisContradictions).toHaveLength(1)
  })
})
