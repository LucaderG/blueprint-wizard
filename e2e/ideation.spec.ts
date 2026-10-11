import { expect, test, type Page, type Route } from '@playwright/test'

/** Gültiger Key für den E2E-Lauf; jeder andere Key wird wie bei OpenRouter mit 401 abgelehnt. */
const KEY = 'sk-or-v1-e2e'
const API = 'https://openrouter.ai/api/v1'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const FRUSTRATION = 'Ich finde Lesezeichen im Browser nie wieder.'
const COMBINED_TITLE = 'Lesezeichen-Kochplan'
const COMBINED_PITCH =
  'Ein Kochplan, der aus gespeicherten Rezepten automatisch Einkaufslisten macht.'
const COMBINED_FEATURE = 'Rezepte aus Lesezeichen importieren'

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

/** Die kombinierte Idee im Schema der Ideenantwort. */
const COMBINED = {
  title: COMBINED_TITLE,
  pitch: COMBINED_PITCH,
  problem: 'Gespeicherte Rezepte liegen ungenutzt herum.',
  audience: 'Kochende im Alltag.',
  features: [COMBINED_FEATURE, 'Einkaufsliste erzeugen'],
  platform: 'Web-App im Browser',
  effort: 'medium',
  novelty: 4,
  learningValue: 4,
  learningNote: 'Man lernt, zwei Datenquellen zu verbinden.',
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

/**
 * Unterscheidet die Anfragen am Aufgabenteil des Prompts: Kombinieren liefert eine Idee, die erste
 * Runde vier Ideen.
 */
function answerIdeas(route: Route) {
  const body = route.request().postDataJSON() as {
    messages?: { content?: string }[]
    response_format?: { json_schema?: { name?: string } }
  }
  const name = body.response_format?.json_schema?.name
  if (name !== 'project_ideas') {
    return route.fulfill({
      status: 400,
      json: { error: { code: 400, message: `unerwartetes Schema: ${name}` } },
      headers: CORS,
    })
  }
  const prompt = body.messages?.at(-1)?.content ?? ''
  const content = prompt.includes('Verbinde diese beiden Ideen')
    ? { ideas: [COMBINED] }
    : { ideas: IDEAS }
  return route.fulfill({ json: completion(content), headers: CORS })
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
      return answerIdeas(route)
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

test('keine Idee → Idee gewählt → Wizard startet', async ({ page }) => {
  await mockOpenRouter(page)
  await saveKey(page)

  // Startseite: „Ich habe keine Idee“ öffnet den Fragebogen.
  await page.goto('/')
  await page.getByRole('link', { name: 'Ich habe keine Idee' }).click()
  await expect(page).toHaveURL(/\/neu\/keine-idee$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ich habe keine Idee')

  // Fragebogen: ein Interesse und ein Ärgernis aus dem Alltag, dann „Ideen finden“.
  await page.getByRole('button', { name: 'Musik' }).click()
  await page.getByLabel('Was nervt dich im Alltag?').fill(FRUSTRATION)
  const findIdeas = page.getByRole('button', { name: 'Ideen finden' })
  await findIdeas.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await findIdeas.click()

  // Vier Ideen erscheinen; zwei davon werden zum Kombinieren gewählt.
  for (const title of IDEAS.map((idea) => idea.title)) {
    await expect(page.getByRole('article', { name: title })).toBeVisible()
  }
  await page
    .getByRole('article', { name: 'Lesezeichen-Helfer' })
    .getByRole('checkbox', { name: 'Zum Kombinieren auswählen' })
    .check()
  await page
    .getByRole('article', { name: 'Kochplan-Assistent' })
    .getByRole('checkbox', { name: 'Zum Kombinieren auswählen' })
    .check()
  await page.getByRole('button', { name: 'Ausgewählte kombinieren' }).click()

  // Die kombinierte Idee steht vorn; die beiden Ausgangsideen bleiben.
  const combined = page.getByRole('article', { name: COMBINED_TITLE })
  await expect(combined).toBeVisible()
  await expect(combined).toContainText(COMBINED_PITCH)

  // Die kombinierte Idee nehmen: das Projekt startet mit ihrem Inhalt.
  await combined.getByRole('button', { name: 'Diese Idee nehmen' }).click()
  await expect(page).toHaveURL(/\/projekte\/[\w-]+$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(COMBINED_TITLE)

  const problem = page.getByRole('listitem').filter({ hasText: 'Problem & Vision' })
  await expect(problem).toContainText(COMBINED_PITCH)
  const features = page.getByRole('listitem').filter({ hasText: 'Kernfunktionen (MVP)' })
  await expect(features).toContainText(COMBINED_FEATURE)

  // Neuladen behält das Projekt.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(COMBINED_TITLE)
  await expect(page.getByRole('listitem').filter({ hasText: 'Problem & Vision' })).toContainText(
    COMBINED_PITCH,
  )

  await page.goto('/')
  await expect(
    page.getByRole('list', { name: 'Projektliste' }).getByRole('link', {
      name: COMBINED_TITLE,
      exact: true,
    }),
  ).toBeVisible()
})
