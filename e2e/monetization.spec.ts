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

const PROJECT_NAME = 'Monetarisierungs-Test'
const UNFINISHED_TITLE = 'Dein Blueprint ist noch nicht weit genug'
const MODELS_HEADING = '1. Monetarisierungsmodelle'
const PRICING_HEADING = '2. Preisstrategie'
const FINISH_HEADING = '3. Abschließen'
const NONE_WARNING = '„Nicht monetarisieren“ lässt sich nicht mit anderen Modellen kombinieren.'

const FREEMIUM = 'Freemium für Einzelne'
const SUBSCRIPTION = 'Abo für Teams'
const ADS = 'Werbung im Gratistarif'
const NONE = 'Hobbyprojekt ohne Einnahmen'
const RATIONALE = 'Die Basis bleibt gratis, Teams zahlen ein Abo.'

const TIERS = 'Gratis und Pro'
const EXAMPLE_PRICES = 'Gratis · Pro 6 € pro Monat'

/** Auswirkung von Freemium und Abo: Zahlungsanbieter, Abschnitt „Integrationen & externe Dienste“. */
const PAYMENTS = 'Zahlungsanbieter anbinden (z. B. Stripe oder Paddle)'
const PAYMENTS_SECTION = 'Integrationen & externe Dienste'

/** Antwort „Modelle vorschlagen“ im Schema `monetizationModelsResultSchema`. */
const modelsResponse = {
  models: [
    {
      kind: 'freemium',
      title: FREEMIUM,
      summary: 'Die Grundfunktionen sind kostenlos, erweiterte Funktionen kosten im Monat.',
      fitReason:
        'Viele Nutzer probieren die App zuerst aus und zahlen erst, wenn sie gebraucht wird.',
      concerns: ['Die Grenze zwischen Gratis und Bezahlt muss gut gewählt sein.'],
      scores: {
        revenuePotential: 3,
        implementationEase: 3,
        userAcceptance: 4,
        predictability: 2,
        audienceFit: 4,
        techFit: 4,
      },
      recommended: true,
    },
    {
      kind: 'subscription',
      title: SUBSCRIPTION,
      summary: 'Teams zahlen monatlich oder jährlich für einen Zugang mit allen Funktionen.',
      fitReason: 'Planbare Einnahmen, wenn Teams die App regelmäßig nutzen.',
      concerns: ['Teams müssen erst überzeugt werden, dauerhaft zu zahlen.'],
      scores: {
        revenuePotential: 4,
        implementationEase: 3,
        userAcceptance: 3,
        predictability: 5,
        audienceFit: 3,
        techFit: 4,
      },
      recommended: false,
    },
    {
      kind: 'ads',
      title: ADS,
      summary: 'Der Gratistarif zeigt dezente Anzeigen.',
      fitReason: 'Keine Zahlungshürde für Nutzer.',
      concerns: ['Anzeigen stören die Bedienung und brauchen eine Einwilligung.'],
      scores: {
        revenuePotential: 2,
        implementationEase: 2,
        userAcceptance: 2,
        predictability: 2,
        audienceFit: 2,
        techFit: 3,
      },
      recommended: false,
    },
    {
      kind: 'none',
      title: NONE,
      summary: 'Das Projekt bleibt ein Hobby ohne Einnahmen.',
      fitReason: 'Es klingt nach einem Lernprojekt ohne Verkaufsabsicht.',
      concerns: ['Die laufenden Kosten trägt die Person selbst.'],
      scores: {
        revenuePotential: 1,
        implementationEase: 5,
        userAcceptance: 5,
        predictability: 5,
        audienceFit: 5,
        techFit: 5,
      },
      recommended: false,
    },
  ],
}

/** Antwort „Preisstrategien vorschlagen“ im Schema `pricingStrategiesResultSchema`. */
const pricingResponse = {
  strategies: [
    {
      strategy: 'tiers',
      title: TIERS,
      summary: 'Ein kostenloses Paket und ein Pro-Paket mit allen Zusatzfunktionen.',
      examplePrices: EXAMPLE_PRICES,
      reason: 'Die Stufen machen den Schritt zum Bezahlen klar.',
      recommended: true,
    },
    {
      strategy: 'trialDiscount',
      title: 'Jahrespreis mit Rabatt',
      summary: 'Wer jährlich zahlt, bekommt zwei Monate geschenkt.',
      examplePrices: 'Pro 60 € im Jahr statt 72 €',
      reason: 'Ein Jahresabo bringt planbare Einnahmen.',
      recommended: false,
    },
    {
      strategy: 'perSeat',
      title: 'Preis pro Platz',
      summary: 'Der Preis wächst mit der Zahl der Nutzer im Team.',
      examplePrices: '4 € pro Platz und Monat',
      reason: 'Teams mit mehr Personen zahlen entsprechend mehr.',
      recommended: false,
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
  if (name === 'monetization_models') {
    return route.fulfill({ json: completion(modelsResponse), headers: CORS })
  }
  if (name === 'pricing_strategies') {
    return route.fulfill({ json: completion(pricingResponse), headers: CORS })
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

/**
 * Öffnet die Monetarisierung von der Projektseite aus. Der Blueprint ist leer und damit zu dünn,
 * deshalb wird „Trotzdem starten“ gedrückt.
 */
async function openMonetization(page: Page) {
  await page.getByRole('link', { name: 'Monetarisierung', exact: true }).click()
  await expect(page).toHaveURL(/\/projekte\/[\w-]+\/monetarisierung$/)
  await expect(page.getByRole('heading', { name: UNFINISHED_TITLE, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Trotzdem starten', exact: true }).click()
  await expect(page.getByRole('region', { name: MODELS_HEADING, exact: true })).toBeVisible()
}

/** Barrierefreiheit wie in `a11y.spec.ts`: keine Verstöße mit Impact „serious“ oder „critical“. */
async function expectNoSeriousViolations(page: Page) {
  // Nach einem Farbschemawechsel erst die fertigen Farben prüfen, nicht einen Übergangszustand.
  await page.evaluate(async () => {
    const transitions = document
      .getAnimations()
      .filter((animation) => animation instanceof CSSTransition)
    await Promise.all(transitions.map((animation) => animation.finished.catch(() => undefined)))
  })
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )
  expect(serious.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
}

test('Kompletter Ablauf: Modelle, Preisstrategie, Abschluss, Export und Neuladen', async ({
  page,
}) => {
  await mockOpenRouter(page)
  await saveKey(page)
  await createProject(page, PROJECT_NAME)
  const projectUrl = page.url()
  await openMonetization(page)

  // Schritt 1: Modelle vorschlagen, Freemium und Abo wählen und mit Begründung übernehmen.
  const models = page.getByRole('region', { name: MODELS_HEADING, exact: true })
  await models.getByRole('button', { name: 'Modelle vorschlagen', exact: true }).click()
  await expect(models.getByRole('table')).toBeVisible()
  await expect(models.getByRole('checkbox', { name: NONE })).toBeVisible()
  await models.getByRole('checkbox', { name: FREEMIUM }).check()
  await models.getByRole('checkbox', { name: SUBSCRIPTION }).check()
  await models.getByLabel('Begründung (optional)').fill(RATIONALE)
  await models.getByRole('button', { name: 'Auswahl übernehmen', exact: true }).click()
  await expect(models.getByText('Auswahl gespeichert.')).toBeVisible()

  // Schritt 2: Preisstrategien vorschlagen, eine wählen und übernehmen.
  const pricing = page.getByRole('region', { name: PRICING_HEADING, exact: true })
  await expect(pricing).toBeVisible()
  await pricing.getByRole('button', { name: 'Preisstrategien vorschlagen', exact: true }).click()
  await expect(pricing.getByRole('checkbox', { name: TIERS })).toBeVisible()
  await pricing.getByRole('checkbox', { name: TIERS }).check()
  await expect(pricing.getByText(EXAMPLE_PRICES)).toBeVisible()
  await pricing.getByRole('button', { name: 'Preisstrategie übernehmen', exact: true }).click()
  await expect(pricing.getByText('Preisstrategie gespeichert.')).toBeVisible()

  // Schritt 3: abschließen, danach eine Auswirkung auf den Blueprint übernehmen.
  const finish = page.getByRole('region', { name: FINISH_HEADING, exact: true })
  await finish.getByRole('button', { name: 'Monetarisierung abschließen', exact: true }).click()
  await expect(finish.getByText(/Abgeschlossen am/)).toBeVisible()
  await expect(finish.getByRole('button', { name: 'Wieder öffnen', exact: true })).toBeVisible()

  // Alle Schritte sichtbar: Barrierefreiheit hell und dunkel prüfen.
  await expectNoSeriousViolations(page)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  await expectNoSeriousViolations(page)
  await page.emulateMedia({ colorScheme: 'light' })

  const impactButton = `In „${PAYMENTS_SECTION}“ übernehmen: ${PAYMENTS}`
  await finish.getByRole('button', { name: impactButton, exact: true }).click()
  const paymentsItem = finish.getByRole('listitem').filter({ hasText: PAYMENTS })
  await expect(paymentsItem).toContainText('Übernommen')

  // Export: Die BLUEPRINT.md-Vorschau enthält das Kapitel „Monetarisierung“ mit dem Preistext.
  await page.getByRole('link', { name: 'Zurück zum Blueprint' }).click()
  await expect(page).toHaveURL(/\/projekte\/[\w-]+$/)
  await page.getByRole('link', { name: 'Blueprint fertigstellen' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blueprint fertigstellen')
  await page.getByLabel('Datei auswählen').selectOption('BLUEPRINT.md')
  const preview = page.getByRole('textbox', { name: 'Dateivorschau' })
  await expect(preview).toHaveValue(/## Monetarisierung/)
  const content = await preview.inputValue()
  expect(content).toContain(`${FREEMIUM} (Freemium)`)
  expect(content).toContain(`${TIERS} (Staffelpreise)`)
  expect(content).toContain(EXAMPLE_PRICES)
  expect(content).toContain(PAYMENTS)

  // Neuladen: Abschluss, Auswahl und übernommene Auswirkung bleiben erhalten.
  await page.goto(`${projectUrl}/monetarisierung`)
  await page.reload()
  await expect(page.getByText(/Abgeschlossen am/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Wieder öffnen', exact: true })).toBeVisible()
  await expect(
    page.getByRole('region', { name: MODELS_HEADING, exact: true }).getByRole('checkbox', {
      name: FREEMIUM,
    }),
  ).toBeChecked()
  await expect(page.getByRole('listitem').filter({ hasText: PAYMENTS })).toContainText('Übernommen')
})

test('Nicht monetarisieren: Warnung bei Kombination, kein Preisschritt, abschließbar', async ({
  page,
}) => {
  await mockOpenRouter(page)
  await saveKey(page)
  await createProject(page, 'Hobby-Test')
  await openMonetization(page)

  const models = page.getByRole('region', { name: MODELS_HEADING, exact: true })
  await models.getByRole('button', { name: 'Modelle vorschlagen', exact: true }).click()
  const none = models.getByRole('checkbox', { name: NONE })
  const freemium = models.getByRole('checkbox', { name: FREEMIUM })
  await expect(none).toBeVisible()
  const apply = models.getByRole('button', { name: 'Auswahl übernehmen', exact: true })

  // „Nicht monetarisieren“ zusammen mit Freemium: Warnung sichtbar, übernehmen gesperrt.
  await none.check()
  await freemium.check()
  await expect(page.getByText(NONE_WARNING)).toBeVisible()
  await expect(apply).toBeDisabled()

  // Nur „Nicht monetarisieren“ bleibt: Warnung weg, übernehmen möglich.
  await freemium.uncheck()
  await expect(page.getByText(NONE_WARNING)).toHaveCount(0)
  await expect(apply).toBeEnabled()
  await apply.click()
  await expect(models.getByText('Auswahl gespeichert.')).toBeVisible()

  // Ohne Bezahlmodell gibt es keinen Preisschritt.
  await expect(page.getByRole('region', { name: PRICING_HEADING, exact: true })).toHaveCount(0)

  // Abschließen ist trotzdem möglich.
  const finish = page.getByRole('region', { name: FINISH_HEADING, exact: true })
  const finalize = finish.getByRole('button', { name: 'Monetarisierung abschließen', exact: true })
  await expect(finalize).toBeEnabled()
  await finalize.click()
  await expect(finish.getByText(/Abgeschlossen am/)).toBeVisible()
})
