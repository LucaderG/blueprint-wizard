import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryProjectRepository } from '@/core/storage'
import { openRouterHandlers } from '@/test/msw/openrouter'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'

const DAY = 24 * 60 * 60 * 1000

/** Repository mit Einträgen, die vor der angegebenen Zahl an Tagen in den Papierkorb kamen. */
async function repositoryWithTrash(...daysAgo: number[]) {
  let now = new Date()
  const repository = new MemoryProjectRepository({ now: () => now })
  for (const days of daysAgo) {
    const project = await repository.create(`Vor ${days} Tagen`)
    now = new Date(Date.now() - days * DAY)
    await repository.trash(project.id)
    now = new Date()
  }
  return repository
}

describe('Abschnitt Papierkorb', () => {
  beforeEach(() => {
    server.use(...openRouterHandlers)
  })

  it('zeigt die Standardfrist von einem Tag und speichert eine neue Wahl sofort', async () => {
    const user = userEvent.setup()
    const { settingsStore } = renderRoute('/einstellungen')

    const select = screen.getByRole('combobox', { name: 'Aufbewahrung im Papierkorb' })
    expect(select).toHaveValue('1')
    expect(select).toHaveAccessibleDescription(
      'Eine kürzere Frist gilt sofort, auch für Einträge, die schon im Papierkorb liegen.',
    )
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(
      expect.arrayContaining(['1 Tag', '7 Tage', '30 Tage']),
    )

    await user.selectOptions(select, '7')

    expect(settingsStore.load().trashRetentionDays).toBe(7)
    expect(select).toHaveValue('7')
  })

  it('nennt, für wie viele Einträge die gewählte Frist schon abgelaufen ist', async () => {
    const user = userEvent.setup()
    const repository = await repositoryWithTrash(3, 10)
    renderRoute('/einstellungen', { repository, settings: { trashRetentionDays: 30 } })
    const select = screen.getByRole('combobox', { name: 'Aufbewahrung im Papierkorb' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.selectOptions(select, '7')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Mit dieser Frist ist für 1 Eintrag im Papierkorb die Zeit schon abgelaufen.',
    )

    await user.selectOptions(select, '1')
    expect(screen.getByRole('alert')).toHaveTextContent('für 2 Einträge im Papierkorb')
  })
})
