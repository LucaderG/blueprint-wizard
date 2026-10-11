import { expect, test, type Page } from '@playwright/test'

/** Gültiger Key für den E2E-Lauf; jeder andere Key wird wie bei OpenRouter mit 401 abgelehnt. */
const KEY = 'sk-or-v1-e2e'
const API = 'https://openrouter.ai/api/v1'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

/** Antwort der „Idee einordnen“-Anfrage im Schema der Klassifikation. */
const classification = {
  projectName: 'Familien-Organizer',
  summary: 'Eine App, die Familien den Alltag organisiert.',
  sections: [
    {
      id: 'problem',
      content: 'Familien verlieren den Überblick über Termine und Aufgaben.',
      maturity: 'vague',
    },
    { id: 'audience', content: 'Eltern mit Schulkindern.', maturity: 'decided' },
  ],
}

const completion = {
  id: 'gen-e2e',
  model: 'anthropic/claude-haiku-5.5',
  choices: [
    {
      index: 0,
      finish_reason: 'stop',
      message: { role: 'assistant', content: JSON.stringify(classification) },
    },
  ],
  usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, cost: 0.0001 },
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
      return route.fulfill({ json: completion, headers: CORS })
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

test('Abnahme Phase 3: Teil-Idee eingeben, Abschnitte werden gefüllt', async ({ page }) => {
  await mockOpenRouter(page)
  await saveKey(page)

  await page.goto('/')
  await page.getByRole('link', { name: 'Ich habe eine Teil-Idee' }).click()
  await expect(page).toHaveURL(/\/neu\/teil-idee$/)

  await page
    .getByLabel('Beschreib deine Idee')
    .fill('Eine App, die Familien hilft, Termine und Aufgaben gemeinsam zu planen.')
  await page.getByRole('button', { name: 'Idee einordnen' }).click()

  await expect(page).toHaveURL(/\/projekte\/[\w-]+$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Familien-Organizer')
  await expect(
    page.getByText('Familien verlieren den Überblick über Termine und Aufgaben.'),
  ).toBeVisible()
  await expect(page.getByText('Eltern mit Schulkindern.')).toBeVisible()

  await page.goto('/')
  await expect(
    page.getByRole('list', { name: 'Projektliste' }).getByRole('link', {
      name: 'Familien-Organizer',
      exact: true,
    }),
  ).toBeVisible()
})

test('ohne Key: Hinweis, „Idee einordnen“ gesperrt, „Ohne KI starten“ legt ein Projekt mit Text an', async ({
  page,
}) => {
  await page.goto('/neu/teil-idee')

  await expect(
    page.getByText('Für die KI-Funktionen brauchst du einen OpenRouter-API-Key.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Idee einordnen' })).toBeDisabled()

  await page.getByLabel('Beschreib deine Idee').fill('Eine Idee ohne KI')
  await page.getByRole('button', { name: 'Ohne KI starten' }).click()

  await expect(page).toHaveURL(/\/projekte\/[\w-]+$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Neues Projekt')
  const problem = page.getByRole('listitem').filter({ hasText: 'Problem & Vision' })
  await expect(problem).toContainText('vage')
  await expect(page.getByText('Eine Idee ohne KI')).toBeVisible()
})

test('unbekannter Einstieg zeigt die 404-Seite', async ({ page }) => {
  await page.goto('/neu/gibt-es-nicht')
  await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
})
