import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryProjectRepository } from '@/core/storage'
import { makeExportProject } from '@/core/export/testing'
import { makeProject } from '@/core/blueprint/testing'
import { renderRoute } from '@/test/render'

async function openExport(project = makeProject()) {
  const repository = new MemoryProjectRepository({
    newId: () => project.id,
    now: () => new Date(project.updatedAt),
  })
  await repository.create(project.name)
  await repository.save(project)
  return renderRoute(`/projekte/${project.id}/export`, { repository })
}

describe('Blueprint fertigstellen', () => {
  it('lässt trotz offener Punkte ohne API-Key alle Dateien ansehen und exportieren', async () => {
    const user = userEvent.setup()
    await openExport()
    expect(await screen.findByRole('heading', { name: 'Blueprint fertigstellen' })).toBeVisible()
    expect(screen.getByText(/Es gibt noch offene Punkte/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Alles als ZIP herunterladen' })).toBeEnabled()
    expect(
      (screen.getByRole('textbox', { name: 'Dateivorschau' }) as HTMLTextAreaElement).value,
    ).toContain('# Testprojekt')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Datei auswählen' }), 'TASKS.md')
    expect(
      (screen.getByRole('textbox', { name: 'Dateivorschau' }) as HTMLTextAreaElement).value,
    ).toContain('Umsetzungsschritte & Abnahme')
    await user.click(screen.getByRole('button', { name: 'Start-Prompt kopieren' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Start-Prompt kopiert.')
    expect(await navigator.clipboard.readText()).toContain('BLUEPRINT.md')
  })

  it('zeigt einen fertigen Stand und erhält das Projekt beim Export unverändert', async () => {
    const project = makeExportProject()
    const { repository } = await openExport(project)
    expect(await screen.findByText('Dein Blueprint ist ausgearbeitet.')).toBeVisible()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(await repository.get(project.id)).toEqual(project)
  })

  it('zeigt eine verständliche Meldung bei einem fehlenden Projekt', async () => {
    renderRoute('/projekte/unbekannt/export')
    expect(await screen.findByRole('heading', { name: 'Projekt nicht gefunden' })).toBeVisible()
  })
})

describe('Export im Browser', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lädt ZIP und Markdown mit dem sichtbaren Inhalt herunter und meldet Downloadfehler', async () => {
    const user = userEvent.setup()
    const blobs: Blob[] = []
    const filenames: string[] = []
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn((blob: Blob) => {
          blobs.push(blob)
          return 'blob:test'
        })
        static revokeObjectURL = vi.fn()
      },
    )
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      filenames.push(this.download)
    })
    await openExport(makeExportProject())
    await screen.findByRole('heading', { name: 'Blueprint fertigstellen' })
    const visible = (screen.getByRole('textbox', { name: 'Dateivorschau' }) as HTMLTextAreaElement)
      .value
    await user.click(screen.getByRole('button', { name: /^Datei herunterladen$/ }))
    expect(filenames[0]).toBe('BLUEPRINT.md')
    expect(await blobs[0]!.text()).toBe(visible)
    await user.click(screen.getByRole('button', { name: 'Alles als ZIP herunterladen' }))
    expect(filenames[1]).toBe('koch-leihboerse-blueprint.zip')
    expect(blobs[1]!.type).toBe('application/zip')
    const { unzipSync, strFromU8 } = await import('fflate')
    expect(
      strFromU8(unzipSync(new Uint8Array(await blobs[1]!.arrayBuffer()))['BLUEPRINT.md']!),
    ).toBe(visible)
    expect(screen.getByRole('status')).toHaveTextContent('Download gestartet.')
    vi.mocked(URL.createObjectURL).mockImplementationOnce(() => {
      throw new Error('Download nicht verfügbar')
    })
    await user.click(screen.getByRole('button', { name: 'Alles als ZIP herunterladen' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Der Download hat nicht geklappt.')
  })

  it('zeigt und markiert den Start-Prompt, wenn die Zwischenablage nicht verfügbar ist', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(
      new Error('Zugriff verweigert'),
    )
    await openExport()
    await screen.findByRole('heading', { name: 'Blueprint fertigstellen' })
    await user.click(screen.getByRole('button', { name: 'Start-Prompt kopieren' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Kopieren hat nicht geklappt.')
    const preview = screen.getByRole('textbox', { name: 'Dateivorschau' }) as HTMLTextAreaElement
    expect(preview.value).toContain('# Start-Prompt')
    expect(preview).toHaveFocus()
    expect(preview.selectionStart).toBe(0)
    expect(preview.selectionEnd).toBe(preview.value.length)
  })

  it('meldet einen Ladefehler, statt einen leeren Blueprint zu exportieren', async () => {
    const repository = new MemoryProjectRepository()
    vi.spyOn(repository, 'get').mockRejectedValueOnce(new Error('Speicherfehler'))
    renderRoute('/projekte/p1/export', { repository })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Das Projekt konnte nicht geladen werden.',
    )
    expect(
      screen.queryByRole('button', { name: 'Alles als ZIP herunterladen' }),
    ).not.toBeInTheDocument()
  })
})
