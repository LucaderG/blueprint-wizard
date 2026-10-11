import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Dialog } from './dialog'

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Öffnen</button>
      <Dialog
        open={open}
        onClose={() => {
          onClose()
          setOpen(false)
        }}
        title="Titel"
        description="Beschreibung"
      >
        <button>Erster</button>
        <input aria-label="Feld" data-autofocus />
        <button>Letzter</button>
      </Dialog>
    </>
  )
}

async function openDialog(onClose?: () => void) {
  const user = userEvent.setup()
  render(<Harness onClose={onClose} />)
  await user.click(screen.getByRole('button', { name: 'Öffnen' }))
  return user
}

describe('Dialog', () => {
  it('rendert nichts, solange er geschlossen ist', () => {
    render(<Harness />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ist zugänglich benannt und fokussiert das markierte Element', async () => {
    await openDialog()

    const dialog = screen.getByRole('dialog', { name: 'Titel' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('Beschreibung')
    expect(screen.getByRole('textbox', { name: 'Feld' })).toHaveFocus()
  })

  it('hält den Fokus per Tab im Dialog', async () => {
    const user = await openDialog()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Letzter' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Erster' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Letzter' })).toHaveFocus()
  })

  it('schließt mit Escape und gibt den Fokus zurück', async () => {
    const onClose = vi.fn()
    const user = await openDialog(onClose)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Öffnen' })).toHaveFocus()
  })

  it('schließt beim Klick auf den Hintergrund, nicht beim Klick in den Dialog', async () => {
    const onClose = vi.fn()
    const user = await openDialog(onClose)

    await user.click(screen.getByRole('button', { name: 'Erster' }))
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fokussiert ohne Markierung das erste fokussierbare Element', async () => {
    const user = userEvent.setup()
    function Plain() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Öffnen</button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Ohne Markierung">
            <button>Ok</button>
          </Dialog>
        </>
      )
    }
    render(<Plain />)
    await user.click(screen.getByRole('button', { name: 'Öffnen' }))

    expect(screen.getByRole('button', { name: 'Ok' })).toHaveFocus()
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby')
  })
})
