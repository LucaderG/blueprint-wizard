import { expect, test, type Page, type Route } from '@playwright/test'

/** Gültiger Key für den E2E-Lauf; jeder andere Key wird wie bei OpenRouter mit 401 abgelehnt. */
const KEY = 'sk-or-v1-e2e'
const API = 'https://openrouter.ai/api/v1'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const FEATURE = 'Projekte als Markdown-Datei exportieren'
const FEATURE_REASON = 'Ohne Export bleibt der Blueprint an die App gebunden.'
const RISK = 'Datenverlust, wenn der Browser-Speicher geleert wird'
const RISK_REASON = 'Alle Daten liegen bisher nur im Browser.'

const CORE_TITLE = 'Web-App oder native App?'
const CORE_OPTION = 'Native App'
const RATIONALE = 'Native Apps erreichen Nutzer besser auf dem Smartphone.'
const OFFLINE = 'Offline-first: Die App funktioniert auch ohne Netz.'
const REALTIME = 'Echtzeit-Zusammenarbeit mehrerer Nutzer im selben Projekt'

/** Antwort „Vorschläge holen“ im Schema `additionsResultSchema`. */
const additionsResponse = {
  additions: [
    { sectionId: 'features', text: FEATURE, reason: FEATURE_REASON },
    { sectionId: 'risks', text: RISK, reason: RISK_REASON },
  ],
}

/**
 * Antwort „Entscheidungen finden“ im Schema `decisionsResultSchema`.
 * Die Reihenfolge ist absichtlich gemischt: die Rangfolge bestimmt die App, nicht die Antwort.
 */
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
      title: CORE_TITLE,
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
          label: CORE_OPTION,
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
  if (name === 'core_decisions') {
    return route.fulfill({ json: completion(decisionsResponse), headers: CORS })
  }
  if (name === 'blueprint_additions') {
    return route.fulfill({ json: completion(additionsResponse), headers: CORS })
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

/** Legt ein Projekt über „Neues Projekt“ an und landet auf der Projektseite. */
async function createProject(page: Page, name: string) {
  await page.goto('/')
  await expect(page.getByText(/Du hast noch keine Projekte/)).toBeVisible()
  await page.getByRole('button', { name: 'Neues Projekt' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neues Projekt' })
  await dialog.getByLabel('Projektname').fill(name)
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
}

test('Vorschlag annehmen → erscheint im Blueprint', async ({ page }) => {
  await mockOpenRouter(page)
  await saveKey(page)
  await createProject(page, 'Vorschlags-Test')

  // Zur Entscheidungsseite und Vorschläge holen.
  await page.getByRole('link', { name: 'Entscheidungen & Vorschläge' }).click()
  await expect(page).toHaveURL(/\/projekte\/[\w-]+\/entscheidungen$/)
  await page.getByRole('button', { name: 'Vorschläge holen', exact: true }).click()

  // Den Kernfunktions-Vorschlag annehmen, den Risiko-Vorschlag ablehnen.
  const featureItem = page.getByRole('listitem').filter({ hasText: FEATURE })
  const riskItem = page.getByRole('listitem').filter({ hasText: RISK })
  await expect(featureItem).toBeVisible()
  await expect(riskItem).toBeVisible()
  await featureItem.getByRole('button', { name: 'Annehmen', exact: true }).click()
  await expect(featureItem).toHaveCount(0)
  await riskItem.getByRole('button', { name: 'Ablehnen', exact: true }).click()
  await expect(riskItem).toHaveCount(0)
  await expect(page.getByText('Angenommen: 1 · Abgelehnt: 1')).toBeVisible()

  // Zurück zur Projektseite: der angenommene Punkt steht bei den Kernfunktionen, der abgelehnte nirgends.
  await page.getByRole('link', { name: 'Zurück zum Projekt' }).click()
  await expect(page).toHaveURL(/\/projekte\/[\w-]+$/)
  const features = page.getByRole('article', { name: 'Kernfunktionen (MVP)' })
  await expect(features.getByText(FEATURE)).toBeVisible()
  await expect(page.getByText(RISK)).toHaveCount(0)

  // Nach dem Neuladen ist der Vorschlag weiterhin im Blueprint, der abgelehnte weiterhin weg.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vorschlags-Test')
  await expect(
    page.getByRole('article', { name: 'Kernfunktionen (MVP)' }).getByText(FEATURE),
  ).toBeVisible()
  await expect(page.getByText(RISK)).toHaveCount(0)
})

test('Entscheidung treffen → Protokoll, Widerspruch wird angezeigt', async ({ page }) => {
  await mockOpenRouter(page)
  await saveKey(page)
  await createProject(page, 'Entscheidungs-Test')

  // Entscheidungen ermitteln: die Grundsatzentscheidung (Hebel 5) steht an erster Stelle.
  await page.getByRole('link', { name: 'Entscheidungen & Vorschläge' }).click()
  await expect(page).toHaveURL(/\/projekte\/[\w-]+\/entscheidungen$/)
  await page.getByRole('button', { name: 'Entscheidungen finden', exact: true }).click()
  const cards = page.getByRole('article')
  await expect(cards).toHaveCount(3)
  await expect(cards.nth(0).getByRole('heading', { name: CORE_TITLE, exact: true })).toBeVisible()
  await expect(
    cards.nth(1).getByRole('heading', { name: 'Wo werden die Daten gespeichert?' }),
  ).toBeVisible()
  await expect(
    cards.nth(2).getByRole('heading', { name: 'Wie heißt der Start-Button?' }),
  ).toBeVisible()

  // Nicht die empfohlene Option wählen, Begründung eintippen und entscheiden.
  const core = page.getByRole('article', { name: CORE_TITLE })
  await core.getByRole('radio', { name: CORE_OPTION, exact: true }).check()
  await core.getByLabel('Begründung (optional)').fill(RATIONALE)
  await core.getByRole('button', { name: 'Entscheiden', exact: true }).click()
  await expect(core).toHaveCount(0)

  // Im Entscheidungsprotokoll stehen Titel, gewählte Option und Begründung.
  const log = page.getByRole('region', { name: 'Entscheidungsprotokoll' })
  await expect(log.getByRole('heading', { name: CORE_TITLE })).toBeVisible()
  await expect(log.getByText(CORE_OPTION, { exact: true })).toBeVisible()
  await expect(log.getByText(RATIONALE)).toBeVisible()

  // Zurück zur Projektseite: das Protokoll zeigt die Entscheidung.
  await page.getByRole('link', { name: 'Zurück zum Projekt' }).click()
  await expect(page).toHaveURL(/\/projekte\/[\w-]+$/)
  const projectLog = page.getByRole('region', { name: 'Entscheidungsprotokoll' })
  await expect(projectLog.getByRole('heading', { name: CORE_TITLE })).toBeVisible()
  await expect(projectLog.getByText(RATIONALE)).toBeVisible()

  // Widerspruch: „offline-first“ und „Echtzeit“ in zwei Abschnitten.
  const problem = page.getByRole('article', { name: 'Problem & Vision' })
  await problem.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
  await problem.getByRole('textbox', { name: 'Problem & Vision' }).fill(OFFLINE)
  await problem.getByRole('button', { name: 'Fertig', exact: true }).click()
  const features = page.getByRole('article', { name: 'Kernfunktionen (MVP)' })
  await features.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
  await features.getByRole('textbox', { name: 'Kernfunktionen (MVP)' }).fill(REALTIME)
  await features.getByRole('button', { name: 'Fertig', exact: true }).click()

  // Projektseite zeigt das Widerspruchs-Badge, die Entscheidungsseite die Warnung.
  await expect(page.getByRole('img', { name: '1 Widerspruch', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Entscheidungen & Vorschläge' }).click()
  await expect(page).toHaveURL(/\/projekte\/[\w-]+\/entscheidungen$/)
  await expect(page.getByRole('heading', { name: 'Widersprüche im Blueprint' })).toBeVisible()
  await expect(page.getByText('vertragen sich schlecht')).toBeVisible()
  await expect(page.getByText(OFFLINE)).toBeVisible()
  await expect(page.getByText(REALTIME)).toBeVisible()
})
