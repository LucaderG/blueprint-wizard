import { downloadTextFile } from './download'

describe('downloadTextFile', () => {
  it('lädt den Text als Datei mit dem gewünschten Namen herunter', async () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob
      return 'blob:test'
    })
    const revokeObjectURL = vi.fn()
    // jsdom kennt keine Object-URLs; für den Test kurz nachrüsten.
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL }
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadTextFile('projekt.blueprint.json', '{"a":1}')

    const clicked = click.mock.contexts[0] as HTMLAnchorElement | undefined
    expect(clicked?.download).toBe('projekt.blueprint.json')
    expect(clicked?.href).toBe('blob:test')
    expect(clicked?.isConnected).toBe(false)
    const blob = createObjectURL.mock.calls[0]?.[0]
    expect(blob?.type).toBe('application/json')
    expect(await blob?.text()).toBe('{"a":1}')

    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')

    vi.useRealTimers()
    URL.createObjectURL = original.create
    URL.revokeObjectURL = original.revoke
  })
})
