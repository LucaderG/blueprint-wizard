import { MemoryProjectRepository } from '@/core/storage'
import { trackSave, waitForPendingSaves } from './pendingSaves'

describe('pendingSaves', () => {
  it('wartet auf laufende Speichervorgänge, auch auf fehlgeschlagene', async () => {
    const repository = new MemoryProjectRepository()
    const order: string[] = []
    let resolve = () => {}
    let reject = (_error: Error) => {}
    const ok = new Promise<void>((r) => (resolve = r)).then(() => void order.push('gespeichert'))
    const failing = new Promise<void>((_r, j) => (reject = j))
    trackSave(repository, ok)
    trackSave(repository, failing)

    const waiting = waitForPendingSaves(repository).then(() => void order.push('geladen'))
    resolve()
    reject(new Error('kaputt'))
    await waiting

    expect(order).toEqual(['gespeichert', 'geladen'])
  })

  it('kehrt ohne laufende Speichervorgänge sofort zurück', async () => {
    await expect(waitForPendingSaves(new MemoryProjectRepository())).resolves.toBeUndefined()
  })
})
