import { expect, test, type Page } from '@playwright/test'

/** Gültiger Key für den E2E-Lauf; jeder andere Key wird wie bei OpenRouter mit 401 abgelehnt. */
const KEY = 'sk-or-v1-e2e'
const API = 'https://openrouter.ai/api/v1'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const models = {
  data: [
    {
      id: 'anthropic/claude-sonnet-5.5',
      name: 'Anthropic: Claude Sonnet 5.5',
      context_length: 1_000_000,
      pricing: { prompt: '0.000002', completion: '0.00001' },
      supported_parameters: ['response_format', 'structured_outputs'],
    },
    {
      id: 'anthropic/claude-haiku-5.5',
      name: 'Anthropic: Claude Haiku 5.5',
      context_length: 200_000,
      pricing: { prompt: '0.0000001', completion: '0.0000005' },
      supported_parameters: ['structured_outputs'],
    },
  ],
}

/** OpenRouter ist aus dem Testnetz nicht erreichbar, daher werden alle Aufrufe hier beantwortet. */
async function mockOpenRouter(page: Page) {
  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    if (path === '/api/v1/models') return route.fulfill({ json: models, headers: CORS })
    if (path === '/api/v1/key') {
      const authorized = request.headers()['authorization'] === `Bearer ${KEY}`
      if (authorized) {
        const body = {
          data: { label: 'e2e', limit_remaining: null, usage: 1.25, is_free_tier: false },
        }
        return route.fulfill({ json: body, headers: CORS })
      }
      const body = { error: { code: 401, message: 'No auth credentials found' } }
      return route.fulfill({ status: 401, json: body, headers: CORS })
    }
    return route.fulfill({
      status: 404,
      json: { error: { code: 404, message: 'nicht gemockt' } },
      headers: CORS,
    })
  })
}

const keyInput = (page: Page) => page.getByLabel('API-Key', { exact: true })

test('ohne Key führt die Startseite zu den Einstellungen; Key bleibt nach dem Neuladen', async ({
  page,
}) => {
  await mockOpenRouter(page)
  await page.goto('/')
  await expect(
    page.getByText('Für die KI-Funktionen brauchst du einen OpenRouter-API-Key.'),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Zu den Einstellungen' }).click()
  await expect(page).toHaveURL(/\/einstellungen$/)
  await expect(page.getByText('Kein Key hinterlegt')).toBeVisible()

  await keyInput(page).fill(KEY)
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Key gespeichert')).toBeVisible()

  await page.getByRole('button', { name: 'Verbindung testen' }).click()
  await expect(page.getByText('Verbindung erfolgreich')).toBeVisible()
  await expect(page.getByText(/Bisher verbraucht: 1,25\s\$/)).toBeVisible()

  await page.reload()
  await expect(page.getByText('Key gespeichert')).toBeVisible()
  await expect(keyInput(page)).toHaveValue(KEY)

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Von der Idee zum Blueprint')
  await expect(page.getByText('Für die KI-Funktionen')).toHaveCount(0)
})

test('ungültiger Key zeigt die verständliche Fehlermeldung', async ({ page }) => {
  await mockOpenRouter(page)
  await page.goto('/einstellungen')

  await keyInput(page).fill('sk-or-v1-falsch')
  await page.getByRole('button', { name: 'Verbindung testen' }).click()

  await expect(page.getByRole('alert')).toHaveText(
    'Der API-Key ist ungültig oder wurde widerrufen.',
  )
})

test('Modell aus der Liste wählen und nach dem Neuladen behalten', async ({ page }) => {
  await mockOpenRouter(page)
  await page.goto('/einstellungen')

  const list = page.getByRole('listbox', { name: 'Verfügbare Modelle' })
  await expect(list.getByRole('option')).toHaveCount(2)
  await list.selectOption('anthropic/claude-haiku-5.5')
  await expect(page.getByText('Gespeichert', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('listbox', { name: 'Verfügbare Modelle' })).toHaveValue(
    'anthropic/claude-haiku-5.5',
  )
  await expect(page.locator('code', { hasText: 'anthropic/claude-haiku-5.5' })).toBeVisible()
})

test('Key löschen mit Bestätigung', async ({ page }) => {
  await mockOpenRouter(page)
  await page.goto('/einstellungen')
  await keyInput(page).fill(KEY)
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Key gespeichert')).toBeVisible()

  await page.getByRole('button', { name: 'Key löschen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()

  await expect(page.getByText('Kein Key hinterlegt')).toBeVisible()
  await expect(keyInput(page)).toHaveValue('')
  await page.reload()
  await expect(page.getByText('Kein Key hinterlegt')).toBeVisible()

  await page.goto('/')
  await expect(
    page.getByText('Für die KI-Funktionen brauchst du einen OpenRouter-API-Key.'),
  ).toBeVisible()
})
