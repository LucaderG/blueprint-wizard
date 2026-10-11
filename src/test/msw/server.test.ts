import { http, HttpResponse } from 'msw'
import { server } from './server'

describe('MSW-Testserver', () => {
  it('liefert gemockte Antworten für registrierte Handler', async () => {
    server.use(http.get('https://example.test/ping', () => HttpResponse.json({ ok: true })))

    const response = await fetch('https://example.test/ping')

    await expect(response.json()).resolves.toEqual({ ok: true })
  })
})
