import { ProjectFormatError } from './errors'
import { EXPORT_FORMAT, parseProjectExport, serializeProject } from './exchange'
import { makeProject } from './testing'

const now = new Date('2026-10-11T09:00:00.000Z')

describe('Projekt-Export', () => {
  it('übersteht einen Roundtrip unverändert', () => {
    const project = makeProject({ entryPoint: 'partialIdea' })

    expect(parseProjectExport(serializeProject(project, now))).toEqual(project)
  })

  it('trägt die Monetarisierung mit', () => {
    const project = makeProject({
      monetization: {
        models: [
          {
            id: 'm1',
            kind: 'subscription',
            title: 'Team-Abo',
            summary: 'Monatlich zahlen.',
            fitReason: '',
            concerns: ['Abo-Müdigkeit'],
            scores: {
              revenuePotential: 4,
              implementationEase: 3,
              userAcceptance: 3,
              predictability: 5,
              audienceFit: 4,
              techFit: 3,
            },
            recommended: true,
          },
        ],
        chosenModelIds: ['m1'],
        modelRationale: 'Teams zahlen.',
        pricingOptions: [
          {
            id: 'p1',
            strategy: 'perSeat',
            title: '',
            summary: 'Pro Person.',
            examplePrices: '3–6 € pro Person',
            reason: '',
            recommended: false,
          },
        ],
        chosenPricingIds: ['p1'],
        pricingRationale: '',
        status: 'decided',
        decidedAt: '2026-10-12T10:00:00.000Z',
      },
    })

    expect(parseProjectExport(serializeProject(project, now))).toEqual(project)
  })

  it('schreibt Formatkennung und Exportzeitpunkt', () => {
    const payload = JSON.parse(serializeProject(makeProject(), now))

    expect(payload.format).toBe(EXPORT_FORMAT)
    expect(payload.exportedAt).toBe('2026-10-11T09:00:00.000Z')
  })

  it.each([
    ['kein JSON', '{kaputt', 'invalidJson'],
    ['fremdes JSON', JSON.stringify({ hallo: 'welt' }), 'invalidFormat'],
    ['JSON-Array', '[]', 'invalidFormat'],
    ['ohne Projekt', JSON.stringify({ format: EXPORT_FORMAT }), 'invalidFormat'],
    [
      'neuere Version',
      JSON.stringify({ format: EXPORT_FORMAT, project: { ...makeProject(), schemaVersion: 99 } }),
      'unsupportedVersion',
    ],
  ])('lehnt ab: %s', (_label, json, code) => {
    expect(() => parseProjectExport(json)).toThrow(ProjectFormatError)
    try {
      parseProjectExport(json)
    } catch (error) {
      expect((error as ProjectFormatError).code).toBe(code)
    }
  })
})
