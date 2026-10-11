import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { DEFAULT_MODEL, OPENROUTER_BASE_URL } from '@/core/ai'
import { server } from '@/test/msw/server'
import { openRouterHandlers } from '@/test/msw/openrouter'
import { renderRoute } from '@/test/render'

const MODELS_URL = `${OPENROUTER_BASE_URL}/models`

async function modelList() {
  return screen.findByRole('listbox', { name: 'Verfügbare Modelle' })
}

describe('Abschnitt Modell', () => {
  beforeEach(() => {
    server.use(...openRouterHandlers)
  })

  it('lädt die Modellliste und zeigt Namen und Preise', async () => {
    renderRoute('/einstellungen')

    const list = await modelList()
    const options = within(list).getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(within(list).getByRole('option', { name: /Claude Sonnet 5\.5/ })).toHaveTextContent(
      /Eingabe 2,00\s\$, Ausgabe 10,00\s\$ pro Mio\. Tokens/,
    )
    expect(within(list).getByRole('option', { name: /Claude Haiku 5\.5/ })).toHaveTextContent(
      /Eingabe 0,10\s\$, Ausgabe 0,50\s\$/,
    )
  })

  it('blendet Modelle ohne strukturierte Antworten standardmäßig aus', async () => {
    renderRoute('/einstellungen')

    const list = await modelList()
    expect(within(list).queryByRole('option', { name: /Plain Model/ })).not.toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Nur Modelle mit strukturierten Antworten' }),
    ).toBeChecked()
  })

  it('zeigt kostenlose Modelle mit „kostenlos“ und blendet sie nach Abwahl des Filters ein', async () => {
    const user = userEvent.setup()
    renderRoute('/einstellungen')

    await user.click(
      await screen.findByRole('checkbox', { name: 'Nur Modelle mit strukturierten Antworten' }),
    )

    const list = await modelList()
    expect(within(list).getByRole('option', { name: /Plain Model/ })).toHaveTextContent(
      'Eingabe kostenlos, Ausgabe kostenlos',
    )
    expect(within(list).getAllByRole('option')).toHaveLength(3)
  })

  it('filtert per Text nach Name und ID', async () => {
    const user = userEvent.setup()
    renderRoute('/einstellungen', { settings: { model: 'anthropic/claude-sonnet-5.5' } })

    const filter = await screen.findByRole('searchbox', { name: 'Modelle filtern' })
    await user.type(filter, 'HAIKU')
    let list = await modelList()
    // Das gewählte Modell (Sonnet) bleibt sichtbar, auch wenn der Filter es ausblendet.
    expect(
      within(list)
        .getAllByRole('option')
        .map((option) => option.getAttribute('value')),
    ).toEqual(['anthropic/claude-sonnet-5.5', 'anthropic/claude-haiku-5.5'])

    await user.clear(filter)
    await user.type(filter, 'haiku-5.5')
    list = await modelList()
    expect(within(list).getByRole('option', { name: /Haiku/ })).toBeInTheDocument()
    expect(within(list).queryByRole('option', { name: /Sonnet/ })).not.toBeInTheDocument()
  })

  it('zeigt einen Hinweis, wenn kein Modell passt', async () => {
    const user = userEvent.setup()
    renderRoute('/einstellungen')

    await user.type(
      await screen.findByRole('searchbox', { name: 'Modelle filtern' }),
      'gibt-es-nicht',
    )

    expect(screen.getByText('Keine Modelle passen zu deinem Filter.')).toBeVisible()
  })

  it('speichert die gewählte Auswahl sofort', async () => {
    const user = userEvent.setup()
    const { settingsStore } = renderRoute('/einstellungen')

    const list = await modelList()
    await user.selectOptions(list, 'anthropic/claude-haiku-5.5')

    expect(settingsStore.load().model).toBe('anthropic/claude-haiku-5.5')
    expect(screen.getByText('Gespeichert')).toBeVisible()
    expect(screen.getByText('anthropic/claude-haiku-5.5', { selector: 'code' })).toBeVisible()
  })

  it('stellt das Standardmodell wieder her', async () => {
    const user = userEvent.setup()
    const { settingsStore } = renderRoute('/einstellungen', {
      settings: { model: 'anthropic/claude-haiku-5.5' },
    })

    await user.click(screen.getByRole('button', { name: 'Standard wiederherstellen' }))

    expect(settingsStore.load().model).toBe(DEFAULT_MODEL)
    expect(screen.getByText(DEFAULT_MODEL, { selector: 'code' })).toBeVisible()
  })

  it('zeigt bei Ladefehler eine Meldung und lädt nach „Erneut versuchen“ neu', async () => {
    server.use(http.get(MODELS_URL, () => HttpResponse.json({}, { status: 500 }), { once: true }))
    const user = userEvent.setup()
    renderRoute('/einstellungen')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Die Modellliste konnte nicht geladen werden.')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    await user.click(within(alert).getByRole('button', { name: 'Erneut versuchen' }))

    expect(await modelList()).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('erlaubt bei Ladefehler die manuelle Eingabe einer Modell-ID', async () => {
    server.use(http.get(MODELS_URL, () => HttpResponse.error()))
    const user = userEvent.setup()
    const { settingsStore } = renderRoute('/einstellungen')

    await screen.findByRole('alert')
    const input = screen.getByLabelText('Modell-ID')
    expect(input).toHaveValue(DEFAULT_MODEL)
    await user.clear(input)
    await user.type(input, 'mistral/custom-model')
    await user.click(screen.getByRole('button', { name: 'Übernehmen' }))

    expect(settingsStore.load().model).toBe('mistral/custom-model')
    expect(screen.getByText('mistral/custom-model', { selector: 'code' })).toBeVisible()
  })
})
