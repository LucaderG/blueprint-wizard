import { AiError } from '@/core/ai'
import i18n from '@/shared/i18n'
import { aiErrorDetail } from './aiErrorDetail'

const t = i18n.t.bind(i18n)

describe('aiErrorDetail', () => {
  it('zeigt Statuscode und Originalmeldung', () => {
    const error = new AiError('modelUnavailable', 'No endpoints found', { status: 404 })

    expect(aiErrorDetail(error, t)).toBe('Technische Details (HTTP 404): No endpoints found')
  })

  it('zeigt nur die Meldung, wenn es keinen Statuscode gibt', () => {
    expect(aiErrorDetail(new AiError('network', 'Netzwerkfehler'), t)).toBe(
      'Technische Details: Netzwerkfehler',
    )
  })

  it('liefert null für andere Fehler', () => {
    expect(aiErrorDetail(new Error('x'), t)).toBeNull()
    expect(aiErrorDetail('kaputt', t)).toBeNull()
  })
})
