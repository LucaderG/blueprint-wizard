import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { OPENROUTER_BASE_URL, OPENROUTER_KEYS_URL } from '@/core/ai'
import { server } from '@/test/msw/server'
import { openRouterHandlers, VALID_TEST_KEY } from '@/test/msw/openrouter'
import { renderRoute } from '@/test/render'

const KEY_URL = `${OPENROUTER_BASE_URL}/key`
const keyInput = () => screen.getByLabelText('API-Key')

describe('Abschnitt OpenRouter-API-Key', () => {
  beforeEach(() => {
    server.use(...openRouterHandlers)
  })

  it('verlinkt auf die OpenRouter-Key-Seite in einem neuen Tab', () => {
    renderRoute('/einstellungen')

    const link = screen.getByRole('link', { name: 'API-Key bei OpenRouter erstellen' })
    expect(link).toHaveAttribute('href', OPENROUTER_KEYS_URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('zeigt Status und Datenschutzhinweis', () => {
    renderRoute('/einstellungen')

    expect(screen.getByText('Kein Key hinterlegt')).toBeVisible()
    expect(screen.getByText(/nur in diesem Browser gespeichert/)).toBeVisible()
    expect(keyInput()).toHaveAttribute('autocomplete', 'off')
    expect(keyInput()).toHaveAttribute('spellcheck', 'false')
  })

  it('speichert den Key dauerhaft', async () => {
    const user = userEvent.setup()
    const { settingsStore } = renderRoute('/einstellungen')

    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled()
    await user.type(keyInput(), `  ${VALID_TEST_KEY}  `)
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(settingsStore.load().apiKey).toBe(VALID_TEST_KEY)
    expect(screen.getByText('Key gespeichert')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Key löschen' })).toBeVisible()
  })

  it('schaltet die Anzeige des Keys um', async () => {
    const user = userEvent.setup()
    renderRoute('/einstellungen', { settings: { apiKey: VALID_TEST_KEY } })

    expect(keyInput()).toHaveAttribute('type', 'password')
    const toggle = screen.getByRole('button', { name: 'Key anzeigen' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await user.click(toggle)
    expect(keyInput()).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Key verbergen' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Key verbergen' }))
    expect(keyInput()).toHaveAttribute('type', 'password')
  })

  it('meldet bei erfolgreichem Test Verbindung und Verbrauch', async () => {
    const user = userEvent.setup()
    renderRoute('/einstellungen')

    await user.type(keyInput(), VALID_TEST_KEY)
    await user.click(screen.getByRole('button', { name: 'Verbindung testen' }))

    expect(await screen.findByText('Verbindung erfolgreich')).toBeVisible()
    expect(screen.getByText(/Bisher verbraucht: 1,25\s\$/)).toBeVisible()
    expect(screen.queryByText('Kostenloses Konto')).not.toBeInTheDocument()
  })

  it('zeigt bei Konten im Gratis-Tarif einen Hinweis', async () => {
    server.use(
      http.get(KEY_URL, () =>
        HttpResponse.json({
          data: { label: 'test', limit_remaining: 5, usage: 0, is_free_tier: true },
        }),
      ),
    )
    const user = userEvent.setup()
    renderRoute('/einstellungen')

    await user.type(keyInput(), VALID_TEST_KEY)
    await user.click(screen.getByRole('button', { name: 'Verbindung testen' }))

    expect(await screen.findByText('Kostenloses Konto')).toBeVisible()
    expect(screen.getByText(/Verbleibendes Limit: 5,00\s\$/)).toBeVisible()
  })

  it('zeigt während der Prüfung einen Ladezustand', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    server.use(
      http.get(KEY_URL, async () => {
        await gate
        return HttpResponse.json({ data: { usage: 0 } })
      }),
    )
    const user = userEvent.setup()
    renderRoute('/einstellungen')

    await user.type(keyInput(), VALID_TEST_KEY)
    await user.click(screen.getByRole('button', { name: 'Verbindung testen' }))

    const busy = await screen.findByRole('button', { name: 'Verbindung wird geprüft …' })
    expect(busy).toBeDisabled()
    release()
    expect(await screen.findByText('Verbindung erfolgreich')).toBeVisible()
  })

  it('zeigt bei ungültigem Key die Meldung für invalidKey', async () => {
    const user = userEvent.setup()
    renderRoute('/einstellungen')

    await user.type(keyInput(), 'sk-or-v1-falsch')
    await user.click(screen.getByRole('button', { name: 'Verbindung testen' }))

    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent(
      'Der API-Key ist ungültig oder wurde widerrufen.',
    )
  })

  it('zeigt bei Netzwerkfehlern die Meldung für network', async () => {
    server.use(http.get(KEY_URL, () => HttpResponse.error()))
    const user = userEvent.setup()
    renderRoute('/einstellungen')

    await user.type(keyInput(), VALID_TEST_KEY)
    await user.click(screen.getByRole('button', { name: 'Verbindung testen' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Keine Verbindung zu OpenRouter. Prüfe deine Internetverbindung.',
    )
  })

  it('löscht den Key nach Bestätigung', async () => {
    const user = userEvent.setup()
    const { settingsStore } = renderRoute('/einstellungen', {
      settings: { apiKey: VALID_TEST_KEY },
    })

    await user.click(screen.getByRole('button', { name: 'Key löschen' }))
    const dialog = screen.getByRole('dialog', { name: 'Key löschen?' })
    await user.click(within(dialog).getByRole('button', { name: 'Löschen' }))

    expect(settingsStore.load().apiKey).toBeNull()
    expect(keyInput()).toHaveValue('')
    expect(screen.getByText('Kein Key hinterlegt')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Key löschen' })).not.toBeInTheDocument()
  })

  it('behält den Key, wenn das Löschen abgebrochen wird', async () => {
    const user = userEvent.setup()
    const { settingsStore } = renderRoute('/einstellungen', {
      settings: { apiKey: VALID_TEST_KEY },
    })

    await user.click(screen.getByRole('button', { name: 'Key löschen' }))
    const dialog = screen.getByRole('dialog', { name: 'Key löschen?' })
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(settingsStore.load().apiKey).toBe(VALID_TEST_KEY)
    expect(keyInput()).toHaveValue(VALID_TEST_KEY)
  })
})
