import { ProjectFormatError } from './errors'
import { migrateProject, PROJECT_MIGRATIONS, runMigrations, type MigrationMap } from './migrations'
import { CURRENT_SCHEMA_VERSION, projectSchema } from './schema'
import { SECTION_IDS, type SectionId } from './sections'
import { makeProject } from './testing'
import projectV1 from './__fixtures__/project-v1.json'
import projectV2 from './__fixtures__/project-v2.json'
import projectV3 from './__fixtures__/project-v3.json'

function formatError(fn: () => unknown) {
  try {
    fn()
  } catch (error) {
    if (error instanceof ProjectFormatError) return error.code
    throw error
  }
  throw new Error('Kein Fehler geworfen')
}

describe('runMigrations', () => {
  const dummy: MigrationMap = {
    1: (data) => ({ ...data, schemaVersion: 2, renamed: data.name }),
    2: (data) => ({ ...data, schemaVersion: 3, tags: [] }),
  }

  it('wendet alle Schritte nacheinander an', () => {
    expect(runMigrations({ schemaVersion: 1, name: 'A' }, dummy, 3)).toEqual({
      schemaVersion: 3,
      name: 'A',
      renamed: 'A',
      tags: [],
    })
  })

  it('lässt aktuelle Daten unverändert', () => {
    const data = { schemaVersion: 3, name: 'A' }

    expect(runMigrations(data, dummy, 3)).toBe(data)
  })

  it('lehnt neuere Versionen ab', () => {
    expect(formatError(() => runMigrations({ schemaVersion: 4 }, dummy, 3))).toBe(
      'unsupportedVersion',
    )
  })

  it('meldet eine fehlende Migration', () => {
    expect(formatError(() => runMigrations({ schemaVersion: 0 }, dummy, 3))).toBe(
      'unsupportedVersion',
    )
  })

  it.each([null, [], 'text', {}, { schemaVersion: '1' }, { schemaVersion: 1.5 }])(
    'lehnt Daten ohne gültige Version ab: %j',
    (data) => {
      expect(formatError(() => runMigrations(data, dummy, 3))).toBe('invalidFormat')
    },
  )

  it('erkennt eine fehlerhafte Migration', () => {
    const broken: MigrationMap = { 1: (data) => ({ ...data }) }

    expect(() => runMigrations({ schemaVersion: 1 }, broken, 2)).toThrow(
      'muss schemaVersion auf 2 setzen',
    )
  })
})

describe('migrateProject', () => {
  it('hat für jede ältere Version eine Migration', () => {
    for (let version = 1; version < CURRENT_SCHEMA_VERSION; version++) {
      expect(PROJECT_MIGRATIONS[version], `Migration ${version}`).toBeTypeOf('function')
    }
  })

  it('liefert ein gültiges Projekt zurück', () => {
    const project = makeProject()

    expect(migrateProject(JSON.parse(JSON.stringify(project)))).toEqual(project)
  })

  it('lehnt Daten ab, die nach der Migration ungültig sind', () => {
    expect(formatError(() => migrateProject({ ...makeProject(), name: '' }))).toBe('invalidFormat')
  })
})

describe('Migration v1 → v2', () => {
  // Echte v1-Altdaten: siehe __fixtures__/project-v1.json.
  const migrated = () => migrateProject(JSON.parse(JSON.stringify(projectV1)))
  const questionById = (id: string) => migrated().interview.questions.find((q) => q.id === id)

  it('liefert ein gültiges v2-Projekt', () => {
    const project = migrated()

    expect(project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(() => projectSchema.parse(project)).not.toThrow()
  })

  it('übernimmt Identität, Name, Einstieg und Zeitstempel', () => {
    const { id, name, entryPoint, createdAt, updatedAt } = migrated()

    expect({ id, name, entryPoint, createdAt, updatedAt }).toEqual({
      id: projectV1.id,
      name: projectV1.name,
      entryPoint: projectV1.entryPoint,
      createdAt: projectV1.createdAt,
      updatedAt: projectV1.updatedAt,
    })
  })

  it('verschiebt alle Fragen in den Fragenmotor, mit ihrem Abschnitt', () => {
    const questions = migrated().interview.questions

    expect(questions.map((q) => q.id)).toEqual(['v1-q1', 'v1-q2', 'v1-q3', 'v1-q4'])
    expect(questions.map((q) => q.sectionId)).toEqual([
      'problem',
      'audience',
      'features',
      'techStack',
    ])
  })

  it('macht eine beantwortete Frage mit Antworttext zur Freitext-Antwort', () => {
    expect(questionById('v1-q1')).toEqual({
      id: 'v1-q1',
      sectionId: 'problem',
      text: 'Welches Problem lösen wir?',
      why: '',
      leverage: 5,
      options: [],
      dependsOn: [],
      status: 'answered',
      answer: { kind: 'text', text: 'Ich verliere den Überblick über meine Rezepte.' },
      createdAt: projectV1.updatedAt,
      answeredAt: projectV1.updatedAt,
    })
  })

  it('macht eine „beantwortete“ Frage ohne Antworttext wieder offen', () => {
    expect(questionById('v1-q2')).toMatchObject({
      status: 'open',
      answer: null,
      answeredAt: null,
    })
  })

  it('behält zurückgestellte Fragen als zurückgestellt', () => {
    expect(questionById('v1-q3')).toMatchObject({
      status: 'deferred',
      answer: null,
      answeredAt: null,
      leverage: 4,
    })
  })

  it('lässt offene Fragen offen', () => {
    expect(questionById('v1-q4')).toMatchObject({ status: 'open', answer: null })
  })

  it('entfernt das questions-Feld aus allen Abschnitten', () => {
    const { sections } = migrated().blueprint

    for (const id of SECTION_IDS) {
      expect(sections[id], id).not.toHaveProperty('questions')
    }
  })

  it('lässt Inhalt, Reife und Quelle der Abschnitte unverändert', () => {
    const { sections } = migrated().blueprint

    for (const id of SECTION_IDS) {
      const old = projectV1.blueprint.sections[id]
      expect(sections[id], id).toMatchObject({
        id,
        content: old.content,
        maturity: old.maturity,
        source: old.source,
      })
    }
    expect(sections.dataModel.source).toBe('aiSuggestion')
  })

  it('startet mit leerem Verlauf und ohne Analyse', () => {
    const { interview } = migrated()

    expect(interview.log).toEqual([])
    expect(interview.analysis).toBeNull()
  })

  it('lässt bereits migrierte Daten unverändert', () => {
    const once = migrated()

    expect(migrateProject(JSON.parse(JSON.stringify(once)))).toEqual(once)
  })

  it('kennt die Fixture-Abschnitte als Abschnittskatalog', () => {
    const fixtureIds = Object.keys(projectV1.blueprint.sections) as SectionId[]

    expect(fixtureIds.sort()).toEqual([...SECTION_IDS].sort())
  })
})

describe('Migration v2 → v3', () => {
  // Echte v2-Altdaten: siehe __fixtures__/project-v2.json (Entscheidungen noch in den Abschnitten).
  const migrated = () => migrateProject(JSON.parse(JSON.stringify(projectV2)))
  const decisionById = (id: string) => migrated().decisions.find((d) => d.id === id)

  it('liefert ein gültiges v3-Projekt', () => {
    const project = migrated()

    expect(project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(() => projectSchema.parse(project)).not.toThrow()
  })

  it('übernimmt Identität, Name, Einstieg und Zeitstempel', () => {
    const { id, name, entryPoint, createdAt, updatedAt } = migrated()

    expect({ id, name, entryPoint, createdAt, updatedAt }).toEqual({
      id: projectV2.id,
      name: projectV2.name,
      entryPoint: projectV2.entryPoint,
      createdAt: projectV2.createdAt,
      updatedAt: projectV2.updatedAt,
    })
  })

  it('überführt alle Entscheidungen in die Projektliste, mit ihrem Abschnitt', () => {
    const decisions = migrated().decisions

    // Die Reihenfolge der Liste folgt den Abschnitten der Altdaten und ist nicht bedeutsam.
    expect(decisions.map((d) => [d.id, d.sectionId]).sort()).toEqual([
      ['v2-d1', 'techStack'],
      ['v2-d2', 'dataModel'],
    ])
  })

  it('macht aus „question“ den Titel', () => {
    expect(decisionById('v2-d1')?.title).toBe('Web-App oder native App?')
    expect(decisionById('v2-d2')?.title).toBe('Wo werden die Rezepte gespeichert?')
  })

  it('macht eine getroffene Entscheidung zu „entschieden“ mit Begründung und Zeitpunkt', () => {
    expect(decisionById('v2-d1')).toMatchObject({
      status: 'decided',
      chosenOptionId: 'web',
      rationale: 'Der Browser reicht für die erste Version.',
      decidedAt: projectV2.updatedAt,
      leverage: 5,
    })
  })

  it('lässt eine offene Entscheidung offen', () => {
    expect(decisionById('v2-d2')).toMatchObject({
      status: 'open',
      chosenOptionId: null,
      rationale: '',
      decidedAt: null,
      leverage: 4,
    })
  })

  it('übernimmt Optionen mit Bezeichnung und Folgen, ergänzt Vor- und Nachteile leer', () => {
    expect(decisionById('v2-d1')?.options).toEqual([
      {
        id: 'web',
        label: 'Web-App',
        pros: [],
        cons: [],
        consequence: 'Läuft im Browser auf allen Geräten, ohne App-Store',
      },
      {
        id: 'native',
        label: 'Native App',
        pros: [],
        cons: [],
        consequence: 'Eine App je Plattform und Veröffentlichung im App-Store',
      },
    ])
  })

  it('setzt Empfehlung und Kontext auf leer, weil das Altformat sie nicht kannte', () => {
    expect(decisionById('v2-d1')).toMatchObject({ context: '', recommendedOptionId: null })
  })

  it('entfernt das decisions-Feld aus allen Abschnitten', () => {
    const { sections } = migrated().blueprint

    for (const id of SECTION_IDS) {
      expect(sections[id], id).not.toHaveProperty('decisions')
    }
  })

  it('lässt Inhalt, Reife und Quelle der Abschnitte unverändert', () => {
    const { sections } = migrated().blueprint

    for (const id of SECTION_IDS) {
      const old = projectV2.blueprint.sections[id]
      expect(sections[id], id).toMatchObject({
        id,
        content: old.content,
        maturity: old.maturity,
        source: old.source,
      })
    }
    expect(sections.risks.source).toBe('aiAccepted')
  })

  it('lässt den Fragenmotor unverändert', () => {
    expect(migrated().interview).toEqual(projectV2.interview)
  })

  it('startet ohne Vorschläge', () => {
    expect(migrated().additions).toEqual([])
  })

  it('lässt bereits migrierte Daten unverändert', () => {
    const once = migrated()

    expect(migrateProject(JSON.parse(JSON.stringify(once)))).toEqual(once)
  })
})

describe('Migration v1 → aktuell (Kette)', () => {
  it('läuft die v1-Fixture über alle Migrationen bis zur aktuellen Version', () => {
    const project = migrateProject(JSON.parse(JSON.stringify(projectV1)))

    expect(project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(() => projectSchema.parse(project)).not.toThrow()
    expect(project.interview.questions).toHaveLength(4)
    expect(project.decisions).toEqual([])
    expect(project.additions).toEqual([])
    expect(project.monetization).toBeNull()
  })
})

describe('Migration v3 → v4', () => {
  // v3-Daten: die echte v2-Sicherung, mit dem Migrationscode von v1.0.0 nach v3 gehoben und um
  // Entscheidungen, Vorschläge und Abschnittsinhalt ergänzt (__fixtures__/project-v3.json).
  const migrated = () => migrateProject(JSON.parse(JSON.stringify(projectV3)))

  it('ergänzt eine noch nicht begonnene Monetarisierung', () => {
    const project = migrated()

    expect(project.schemaVersion).toBe(4)
    expect(project.monetization).toBeNull()
  })

  it('lässt alle übrigen Daten unverändert', () => {
    const { schemaVersion: _old, ...rest } = projectV3
    const { schemaVersion: _new, monetization: _m, ...migratedRest } = migrated()

    expect(migratedRest).toEqual(rest)
  })

  it('lässt bereits migrierte Daten unverändert', () => {
    const once = migrated()

    expect(migrateProject(JSON.parse(JSON.stringify(once)))).toEqual(once)
  })
})
