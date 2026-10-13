import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { ProjectProfile } from '@/core/blueprint'
import { ProfileCard } from './ProfileCard'

const PROFILE: ProjectProfile = {
  pitch: 'Eine App für Lerntermine',
  problem: 'Termine gehen verloren',
  audience: 'Studierende',
  features: ['Erinnerungen', 'Kalenderexport'],
  platform: 'Web',
  monetization: {
    model: 'Abo',
    priceRange: '3 bis 5 Euro im Monat',
    reason: 'Wiederkehrender Nutzen',
  },
  effort: 'medium',
  risks: ['Datenschutz'],
}

const EMPTY_LISTS_PROFILE: ProjectProfile = {
  ...PROFILE,
  problem: '',
  audience: '',
  features: [],
  monetization: { model: '', priceRange: '', reason: '' },
  risks: [],
}

function renderCard(profile: ProjectProfile = PROFILE, onChange = vi.fn()) {
  render(<ProfileCard profile={profile} onChange={onChange} />)
  return { onChange }
}

describe('ProfileCard', () => {
  it('zeigt im Lesemodus die gefüllten Felder', () => {
    renderCard()

    const card = screen.getByRole('region', { name: 'Steckbrief' })
    expect(within(card).getByText('Eine App für Lerntermine')).toBeVisible()
    expect(within(card).getByText('Termine gehen verloren')).toBeVisible()
    expect(within(card).getByText('Studierende')).toBeVisible()
    expect(within(card).getByText('mittel')).toBeVisible()
    expect(within(card).getByText('Abo')).toBeVisible()
    expect(within(card).getByText('Preise sind eine Annahme, keine Marktdaten.')).toBeVisible()
    expect(within(card).getByText('Erinnerungen')).toBeVisible()
    expect(within(card).getByText('Datenschutz')).toBeVisible()
    expect(within(card).getByRole('button', { name: 'Steckbrief bearbeiten' })).toBeVisible()
  })

  it('lässt leere Felder und Listen weg', () => {
    renderCard(EMPTY_LISTS_PROFILE)

    const card = screen.getByRole('region', { name: 'Steckbrief' })
    expect(within(card).queryByText('Zielgruppe')).not.toBeInTheDocument()
    expect(within(card).queryByText('Problem')).not.toBeInTheDocument()
    expect(within(card).queryByText('Monetarisierung')).not.toBeInTheDocument()
    expect(within(card).queryByText('Kernfunktionen')).not.toBeInTheDocument()
    expect(within(card).queryByText('Risiken')).not.toBeInTheDocument()
    expect(within(card).getByText('Web')).toBeVisible()
  })

  it('übernimmt Änderungen als Listen über onChange', async () => {
    const user = userEvent.setup()
    const { onChange } = renderCard()

    await user.click(screen.getByRole('button', { name: 'Steckbrief bearbeiten' }))
    const pitch = screen.getByLabelText('Pitch')
    expect(pitch).toHaveFocus()
    await user.clear(pitch)
    await user.type(pitch, 'Neuer Pitch')
    await user.clear(screen.getByLabelText('Kernfunktionen'))
    await user.type(screen.getByLabelText('Kernfunktionen'), 'Eins{Enter}Zwei{Enter}  ')
    await user.selectOptions(screen.getByLabelText('Aufwand'), 'large')
    await user.click(screen.getByRole('button', { name: 'Übernehmen' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({
      ...PROFILE,
      pitch: 'Neuer Pitch',
      features: ['Eins', 'Zwei', '  '],
      effort: 'large',
    })
    expect(screen.getByRole('button', { name: 'Steckbrief bearbeiten' })).toHaveFocus()
    expect(screen.queryByLabelText('Pitch')).not.toBeInTheDocument()
  })

  it('verwirft Änderungen beim Abbrechen', async () => {
    const user = userEvent.setup()
    const { onChange } = renderCard()

    await user.click(screen.getByRole('button', { name: 'Steckbrief bearbeiten' }))
    await user.type(screen.getByLabelText('Pitch'), ' geändert')
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Eine App für Lerntermine')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Steckbrief bearbeiten' })).toHaveFocus()
  })

  it('deaktiviert Übernehmen bei leerem Pitch', async () => {
    const user = userEvent.setup()
    renderCard()

    await user.click(screen.getByRole('button', { name: 'Steckbrief bearbeiten' }))
    await user.clear(screen.getByLabelText('Pitch'))

    expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeDisabled()
  })
})
