import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page, type Route } from '@playwright/test'

/** Gültiger Key für den E2E-Lauf; jeder andere Key wird wie bei OpenRouter mit 401 abgelehnt. */
const KEY = 'sk-or-v1-e2e'
const API = 'https://openrouter.ai/api/v1'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const PLATFORM = 'Für welche Plattform soll die Anwendung laufen?'
const AUDIENCE = 'Wer sind die Hauptnutzer der App?'
const DETAIL = 'Welche Bildschirme braucht der Anmelde-Ablauf?'
const FRUSTRATION = 'Ich finde Lesezeichen im Browser nie wieder.'
const FEATURE = 'Projekte als Markdown-Datei exportieren'
const RISK = 'Datenverlust, wenn der Browser-Speicher geleert wird'

/** Antwort der Analyse („Blueprint analysieren“) im Schema `blueprintAnalysisResultSchema`. */
const analysis = {
  summary: 'Der Blueprint ist noch leer; Ziel, Zielgruppe und Plattform fehlen.',
  gaps: [{ sectionIds: ['techStack'], text: 'Die Plattform ist offen.' }],
  contradictions: [],
  questions: [
    {
      key: 'q1',
      sectionId: 'techStack',
      text: PLATFORM,
      why: 'Die Plattform bestimmt die Technik.',
      leverage: 5,
      options: ['Web', 'Mobil'],
      dependsOn: [],
    },
    {
      key: 'q2',
      sectionId: 'audience',
      text: AUDIENCE,
      why: 'Die Zielgruppe bestimmt Funktionen und Oberfläche.',
      leverage: 4,
      options: [],
      dependsOn: [],
    },
    {
      key: 'q3',
      sectionId: 'flows',
      text: DETAIL,
      why: 'Ein Detail, das erst mit den Kernfunktionen Sinn hat.',
      leverage: 1,
      options: [],
      dependsOn: [],
    },
  ],
}

/** Antwort „Entscheidungen finden“ im Schema `decisionsResultSchema`. */
const decisionsResponse = {
  decisions: [
    {
      sectionId: 'flows',
      title: 'Wie heißt der Start-Button?',
      context: 'Die Beschriftung prägt den ersten Eindruck, hängt aber kaum an der Technik.',
      leverage: 1,
      options: [
        {
          label: 'Loslegen',
          pros: ['Kurz und locker'],
          cons: ['Sagt wenig über die Aktion'],
          consequence: 'Die Schaltfläche bleibt schlicht.',
        },
        {
          label: 'Projekt anlegen',
          pros: ['Klar verständlich'],
          cons: ['Etwas länger'],
          consequence: 'Der Einstieg ist eindeutig.',
        },
      ],
      recommendedOption: 1,
    },
    {
      sectionId: 'techStack',
      title: 'Web-App oder native App?',
      context: 'Die Plattform bestimmt Technik, Aufwand und Verbreitung der Anwendung.',
      leverage: 5,
      options: [
        {
          label: 'Web-App im Browser',
          pros: ['Ein Code für alle Geräte', 'Kein Store nötig'],
          cons: ['Eingeschränkter Zugriff auf das Gerät'],
          consequence: 'Die Anwendung läuft direkt im Browser ohne Installation.',
        },
        {
          label: 'Native App',
          pros: ['Volle Gerätefunktionen'],
          cons: ['Zwei Plattformen oder ein aufwendiges Framework', 'Store-Freigaben'],
          consequence: 'Der Aufwand für Entwicklung und Pflege steigt deutlich.',
        },
      ],
      recommendedOption: 0,
    },
    {
      sectionId: 'dataModel',
      title: 'Wo werden die Daten gespeichert?',
      context: 'Der Speicherort legt fest, wie Daten gesichert und geteilt werden können.',
      leverage: 3,
      options: [
        {
          label: 'Lokal im Browser',
          pros: ['Keine Serverkosten'],
          cons: ['Kein Zugriff von anderen Geräten'],
          consequence: 'Daten bleiben auf dem Gerät der Person.',
        },
        {
          label: 'Auf einem Server',
          pros: ['Zugriff von überall'],
          cons: ['Serverbetrieb und Datenschutz'],
          consequence: 'Ein Backend muss betrieben und abgesichert werden.',
        },
      ],
      recommendedOption: null,
    },
  ],
}

/** Antwort „Vorschläge holen“ im Schema `additionsResultSchema`. */
const additionsResponse = {
  additions: [
    {
      sectionId: 'features',
      text: FEATURE,
      reason: 'Ohne Export bleibt der Blueprint an die App gebunden.',
    },
    {
      sectionId: 'risks',
      text: RISK,
      reason: 'Alle Daten liegen bisher nur im Browser.',
    },
  ],
}

/** Vier Ideen der ersten Runde im Schema der Ideenantwort. */
const IDEAS = ['Lesezeichen-Helfer', 'Kochplan-Assistent', 'Garten-Tagebuch', 'Reisekasse'].map(
  (title) => ({
    title,
    pitch: `${title} macht den Alltag ein Stück leichter.`,
    problem: 'Der Alltag ist unübersichtlich.',
    audience: 'Die Person selbst.',
    features: ['Eine Liste anlegen', 'Einträge suchen'],
    platform: 'Web-App im Browser',
    effort: 'small',
    novelty: 3,
    learningValue: 4,
    learningNote: 'Man lernt, Daten im Browser zu speichern.',
  }),
)

function completion(content: unknown) {
  return {
    id: 'gen-e2e',
    model: 'anthropic/claude-haiku-5.5',
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content: JSON.stringify(content) },
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, cost: 0.0001 },
  }
}

/** Unterscheidet die Anfragen am `response_format`-Schemanamen. */
function answerChat(route: Route) {
  const body = route.request().postDataJSON() as {
    response_format?: { json_schema?: { name?: string } }
  }
  const name = body.response_format?.json_schema?.name
  const answers: Record<string, unknown> = {
    blueprint_analysis: analysis,
    core_decisions: decisionsResponse,
    blueprint_additions: additionsResponse,
    project_ideas: { ideas: IDEAS },
  }
  if (name && name in answers) {
    return route.fulfill({ json: completion(answers[name]), headers: CORS })
  }
  return route.fulfill({
    status: 400,
    json: { error: { code: 400, message: `unerwartetes Schema: ${name}` } },
    headers: CORS,
  })
}

/** OpenRouter ist aus dem Testnetz nicht erreichbar, daher werden alle Aufrufe hier beantwortet. */
async function mockOpenRouter(page: Page) {
  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    if (path === '/api/v1/models') {
      const models = {
        data: [
          {
            id: 'anthropic/claude-haiku-5.5',
            name: 'Anthropic: Claude Haiku 5.5',
            context_length: 200_000,
            pricing: { prompt: '0.0000001', completion: '0.0000005' },
            supported_parameters: ['structured_outputs'],
          },
        ],
      }
      return route.fulfill({ json: models, headers: CORS })
    }
    if (path === '/api/v1/key') {
      const authorized = request.headers()['authorization'] === `Bearer ${KEY}`
      if (!authorized) {
        const body = { error: { code: 401, message: 'No auth credentials found' } }
        return route.fulfill({ status: 401, json: body, headers: CORS })
      }
      const body = { data: { label: 'e2e', limit_remaining: null, usage: 0, is_free_tier: false } }
      return route.fulfill({ json: body, headers: CORS })
    }
    if (path === '/api/v1/chat/completions' && request.method() === 'POST') {
      return answerChat(route)
    }
    return route.fulfill({
      status: 404,
      json: { error: { code: 404, message: 'nicht gemockt' } },
      headers: CORS,
    })
  })
}

async function saveKey(page: Page) {
  await page.goto('/einstellungen')
  await page.getByLabel('API-Key', { exact: true }).fill(KEY)
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Key gespeichert')).toBeVisible()
}

/** Legt ein Projekt über „Neues Projekt“ an und wartet auf die Projektseite. */
async function createProject(page: Page, name: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Neues Projekt' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neues Projekt' })
  await dialog.getByLabel('Projektname').fill(name)
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
}

/** Projekt mit Inhalt ohne KI anlegen (Einstieg „Teil-Idee“, „Ohne KI starten“). */
async function createProjectWithContent(page: Page) {
  await page.goto('/neu/teil-idee')
  await page.getByLabel('Beschreib deine Idee').fill('Eine Idee ohne KI')
  await page.getByRole('button', { name: 'Ohne KI starten' }).click()
  await expect(page).toHaveURL(/\/projekte\/[\w-]+$/)
  await expect(page.getByText('Eine Idee ohne KI')).toBeVisible()
}

/** Ein Szenario richtet den Zustand ein und landet auf der zu prüfenden Seite. */
type Scenario = {
  name: string
  /** Ob die Seite KI-Antworten braucht (dann mit gespeichertem Key und Mock). */
  ai: boolean
  setup: (page: Page) => Promise<void>
}

const scenarios: Scenario[] = [
  {
    name: 'Startseite',
    ai: false,
    setup: async (page) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Von der Idee zum Blueprint')
    },
  },
  {
    name: 'Startseite: Bibliothek mit Rückgängig-Hinweis',
    ai: false,
    setup: async (page) => {
      await createProject(page, 'Behalten')
      await createProject(page, 'Weg')
      await page.goto('/')
      await page.getByRole('button', { name: 'Weg löschen' }).click()
      await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeVisible()
    },
  },
  {
    name: 'Startseite: Papierkorb',
    ai: false,
    setup: async (page) => {
      await createProject(page, 'Weg')
      await page.goto('/')
      await page.getByRole('button', { name: 'Weg löschen' }).click()
      await page.getByRole('button', { name: 'Papierkorb (1)' }).click()
      await expect(page.getByRole('list', { name: 'Papierkorb' })).toBeVisible()
    },
  },
  {
    name: 'Einstellungen ohne Key',
    ai: false,
    setup: async (page) => {
      await page.goto('/einstellungen')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Einstellungen')
    },
  },
  {
    name: 'Einstellungen mit Key',
    ai: true,
    setup: async (page) => {
      await page.goto('/einstellungen')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Einstellungen')
    },
  },
  {
    name: 'Neu: Teil-Idee',
    ai: false,
    setup: async (page) => {
      await page.goto('/neu/teil-idee')
      await expect(page.getByLabel('Beschreib deine Idee')).toBeVisible()
    },
  },
  {
    name: 'Neu: fast fertig',
    ai: false,
    setup: async (page) => {
      await page.goto('/neu/fast-fertig')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ich habe fast alles')
    },
  },
  {
    name: 'Neu: keine Idee (Fragebogen)',
    ai: false,
    setup: async (page) => {
      await page.goto('/neu/keine-idee')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ich habe keine Idee')
    },
  },
  {
    name: 'Neu: keine Idee (Ideenansicht)',
    ai: true,
    setup: async (page) => {
      await page.goto('/neu/keine-idee')
      await page.getByRole('button', { name: 'Musik' }).click()
      await page.getByLabel('Was nervt dich im Alltag?').fill(FRUSTRATION)
      await page.getByRole('button', { name: 'Ideen finden' }).click()
      await expect(page.getByRole('article', { name: IDEAS[0]!.title })).toBeVisible()
    },
  },
  {
    name: 'Projektseite mit Inhalt',
    ai: false,
    setup: async (page) => {
      await createProjectWithContent(page)
      await expect(page.getByRole('list', { name: 'Abschnitte' })).toBeVisible()
    },
  },
  {
    name: 'Fragen-Seite mit offenen Fragen',
    ai: true,
    setup: async (page) => {
      await createProject(page, 'Fragen-Test')
      await page.getByRole('link', { name: 'Fragen beantworten' }).click()
      await expect(page).toHaveURL(/\/fragen$/)
      await expect(page.getByRole('region', { name: /Offene Fragen/ })).toContainText(PLATFORM)
    },
  },
  {
    name: 'Entscheidungsseite mit Entscheidungen und Vorschlägen',
    ai: true,
    setup: async (page) => {
      await createProject(page, 'Entscheidungs-Test')
      await page.getByRole('link', { name: 'Entscheidungen & Vorschläge' }).click()
      await expect(page).toHaveURL(/\/entscheidungen$/)
      await page.getByRole('button', { name: 'Entscheidungen finden', exact: true }).click()
      await expect(page.getByRole('article').first()).toBeVisible()
      await page.getByRole('button', { name: 'Vorschläge holen', exact: true }).click()
      await expect(page.getByRole('listitem').filter({ hasText: FEATURE })).toBeVisible()
    },
  },
  {
    name: 'Exportseite',
    ai: false,
    setup: async (page) => {
      await createProjectWithContent(page)
      await page.getByRole('link', { name: 'Blueprint fertigstellen' }).click()
      await expect(page).toHaveURL(/\/export$/)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blueprint fertigstellen')
    },
  },
  {
    name: '404-Seite',
    ai: false,
    setup: async (page) => {
      await page.goto('/gibt-es-nicht')
      await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
    },
  },
]

/**
 * Prüft mit axe (WCAG 2.0/2.1 A und AA). Schlägt nur bei Verstößen mit impact „serious“ oder
 * „critical“ fehl und nennt dann jeden Knoten mit Regel, Impact, Hilfetext und Selektor.
 */
async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )
  const report = serious.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `- [${violation.impact}] ${violation.id}: ${violation.help}\n` +
        `  Seite: ${new URL(page.url()).pathname}\n` +
        `  Selektor: ${node.target.join(' ')}\n` +
        `  Details: ${node.failureSummary ?? '(keine)'}\n` +
        `  Hilfe: ${violation.helpUrl}`,
    ),
  )
  expect(serious, `Barrierefreiheit: ${serious.length} Verstöße\n${report.join('\n')}`).toEqual([])
}

const schemes = [
  { label: 'hell', colorScheme: 'light' },
  { label: 'dunkel', colorScheme: 'dark' },
] as const

for (const scheme of schemes) {
  for (const scenario of scenarios) {
    test(`a11y ${scenario.name} (${scheme.label})`, async ({ page }) => {
      // Das Farbschema wird vor dem Laden gesetzt, damit die Seite direkt im Dark Mode rendert.
      await page.emulateMedia({ colorScheme: scheme.colorScheme })
      if (scenario.ai) {
        // Mit Key: Die KI-Aufrufe laufen gegen den Mock; der Key wird wie bei einer Person gespeichert.
        await mockOpenRouter(page)
        await saveKey(page)
      }
      await scenario.setup(page)
      await expectNoSeriousViolations(page)
    })
  }
}
