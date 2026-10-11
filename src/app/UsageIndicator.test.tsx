import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MockAiProvider } from '@/core/ai'
import { renderRoute } from '@/test/render'

const idea = {
  title: 'Alpha',
  pitch: 'Alpha hilft.',
  problem: 'Problem.',
  audience: 'Studierende',
  features: ['Eins'],
  platform: 'Web',
  effort: 'small',
  novelty: 3,
  learningValue: 3,
  learningNote: 'Viel.',
}
const answer = (title: string, cost?: number) => ({
  text: JSON.stringify({ ideas: [{ ...idea, title }] }),
  model: 'anthropic/claude-haiku-5.5',
  usage: { promptTokens: 1200, completionTokens: 300, totalTokens: 1500, cost },
})

beforeEach(() => sessionStorage.clear())

describe('Kostenanzeige', () => {
  it('erscheint erst nach einer Anfrage und zeigt letzte Anfrage und Sitzungssumme', async () => {
    const user = userEvent.setup()
    renderRoute('/neu/keine-idee', {
      settings: { apiKey: 'x' },
      aiProvider: new MockAiProvider([answer('Alpha', 0.0004), answer('Beta', 0.0021)]),
    })
    expect(screen.queryByLabelText(/KI-Kosten dieser Sitzung/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Musik' }))
    await user.click(screen.getByRole('button', { name: 'Ideen finden' }))
    await screen.findByRole('article', { name: 'Alpha' })
    await user.click(screen.getByRole('button', { name: 'Neu würfeln' }))
    await screen.findByRole('article', { name: 'Beta' })

    const summary = screen.getByLabelText(/KI-Kosten dieser Sitzung/)
    expect(summary).toHaveTextContent('0,0025')
    await user.click(summary)
    const details = summary.closest('details') as HTMLElement
    expect(within(details).getByText('Ideen finden')).toBeVisible()
    expect(within(details).getByText('1.200 ein / 300 aus')).toBeVisible()
    expect(within(details).getByText('0,0021 $')).toBeVisible()
    expect(within(details).getByText('3.000')).toBeVisible()

    await user.click(within(details).getByRole('button', { name: 'Zurücksetzen' }))
    expect(screen.queryByLabelText(/KI-Kosten dieser Sitzung/)).not.toBeInTheDocument()
  })

  it('kennzeichnet eine Summe ohne vollständige Kostenangaben als Untergrenze', async () => {
    const user = userEvent.setup()
    renderRoute('/neu/keine-idee', {
      settings: { apiKey: 'x' },
      aiProvider: new MockAiProvider([answer('Alpha')]),
    })
    await user.click(screen.getByRole('button', { name: 'Musik' }))
    await user.click(screen.getByRole('button', { name: 'Ideen finden' }))
    await screen.findByRole('article', { name: 'Alpha' })

    const summary = screen.getByLabelText(/KI-Kosten dieser Sitzung/)
    expect(summary).toHaveTextContent('≥')
    await user.click(summary)
    expect(screen.getByText('unbekannt')).toBeVisible()
    expect(screen.getByText(/Untergrenze/)).toBeVisible()
  })
})
