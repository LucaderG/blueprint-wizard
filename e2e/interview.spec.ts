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
const TECH_SECTION = 'Tech-Stack & Plattform'
const TECH_TEXT = 'Web-Anwendung im Browser, keine native App.'

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

/** Antwort der Integration („Antworten speichern“) im Schema `integrationResultSchema`. */
const integration = {
  sections: [{ id: 'techStack', content: TECH_TEXT, maturity: 'decided' }],
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
  if (name === 'blueprint_analysis')
    return route.fulfill({ json: completion(analysis), headers: CORS })
  if (name === 'answer_integration') {
    return route.fulfill({ json: completion(integration), headers: CORS })
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

test('Fragenmotor: automatische Analyse, Antworten übernehmen, Änderungen, Verlauf und Neuladen', async ({
  page,
}) => {
  await mockOpenRouter(page)
  await saveKey(page)

  // Projekt über „Neues Projekt“ anlegen.
  await page.goto('/')
  await expect(page.getByText(/Du hast noch keine Projekte/)).toBeVisible()
  await page.getByRole('button', { name: 'Neues Projekt' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neues Projekt' })
  await dialog.getByLabel('Projektname').fill('Fragenmotor-Test')
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fragenmotor-Test')

  // Fragen-Seite öffnen: die Analyse startet beim ersten Besuch von selbst.
  await page.getByRole('link', { name: 'Fragen beantworten' }).click()
  await expect(page).toHaveURL(/\/projekte\/[\w-]+\/fragen$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fragenmotor-Test')

  // Alle stellbaren Fragen auf einmal, die Grundsatzfrage zur Plattform an erster Stelle.
  // Die Detailfrage bleibt zurück, solange die Grundsatzabschnitte leer sind.
  const platformCard = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: PLATFORM }),
  })
  await expect(platformCard).toBeVisible()
  await expect(page.getByRole('heading', { name: AUDIENCE })).toBeVisible()
  await expect(page.getByRole('heading', { name: DETAIL })).toHaveCount(0)
  const round = page.getByRole('region', { name: /Offene Fragen/ })
  await expect(round.getByRole('listitem').first()).toContainText(PLATFORM)
  await expect(page.getByRole('button', { name: 'Neu analysieren' })).toBeEnabled()

  // Plattform beantworten, Zielgruppe zurückstellen, alles mit einem Klick übernehmen.
  // Die Option wird über ihr sichtbares Label gewählt, wie von einer Person. Die Fußleiste der
  // Runde ist sticky, daher wird die Karte vorher in die Mitte des Viewports geholt.
  const web = platformCard.getByText('Web', { exact: true })
  await web.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await web.click()
  await expect(platformCard.getByRole('radio', { name: 'Web', exact: true })).toBeChecked()
  const audienceCard = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: AUDIENCE }),
  })
  await audienceCard.getByRole('button', { name: 'Später', exact: true }).click()
  await page.getByRole('button', { name: 'Antworten übernehmen', exact: true }).click()

  // Erfolgsmeldung: der Abschnitt wurde direkt eingearbeitet.
  await expect(
    page.getByText(`Eingearbeitet in 1 Abschnitt: ${TECH_SECTION}.`, { exact: true }),
  ).toBeVisible()

  // Änderungen ansehen: Vorher und Nachher.
  await page.getByText('Änderungen ansehen', { exact: true }).click()
  await expect(page.getByText('Vorher', { exact: true })).toBeVisible()
  await expect(page.getByText('Nachher', { exact: true })).toBeVisible()
  await expect(page.getByText(TECH_TEXT)).toBeVisible()

  // Verlauf: Antwort und „Später“ sind sichtbar.
  const history = page.locator('details', { hasText: 'Verlauf' })
  await history.locator('summary').click()
  await expect(history.getByText(PLATFORM)).toBeVisible()
  await expect(history.getByText('Web', { exact: true })).toBeVisible()
  await expect(history.getByText(AUDIENCE)).toBeVisible()
  await expect(history.getByText('Später', { exact: true })).toBeVisible()

  // Zurück zur Projektseite: der Abschnitt enthält den neuen Text, auch nach dem Neuladen.
  await page.getByRole('link', { name: 'Zurück zum Projekt' }).click()
  await expect(page).toHaveURL(/\/projekte\/[\w-]+$/)
  // Die URL wechselt vor dem React-Render. Der Vorher/Nachher-Vergleich auf der
  // Fragenseite hat denselben Artikelnamen und darf nicht als Projektseite zählen.
  await expect(page.getByRole('link', { name: 'Alle Projekte', exact: true })).toBeVisible()
  const section = page
    .getByRole('region', { name: 'Abschnitte', exact: true })
    .getByRole('article', { name: TECH_SECTION })
  await expect(section.getByText(TECH_TEXT)).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fragenmotor-Test')
  await expect(page.getByRole('article', { name: TECH_SECTION }).getByText(TECH_TEXT)).toBeVisible()
})
