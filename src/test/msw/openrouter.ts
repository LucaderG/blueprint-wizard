import { http, HttpResponse } from 'msw'
import { OPENROUTER_BASE_URL } from '@/core/ai'

/** Gültiger Test-Key; jeder andere Key wird von `openRouterHandlers` mit 401 abgelehnt. */
export const VALID_TEST_KEY = 'sk-or-v1-test'

export const modelsFixture = {
  data: [
    {
      id: 'anthropic/claude-sonnet-5.5',
      name: 'Anthropic: Claude Sonnet 5.5',
      context_length: 1_000_000,
      pricing: { prompt: '0.000002', completion: '0.00001' },
      supported_parameters: ['temperature', 'response_format', 'structured_outputs'],
    },
    {
      id: 'anthropic/claude-haiku-5.5',
      name: 'Anthropic: Claude Haiku 5.5',
      context_length: 200_000,
      pricing: { prompt: '0.0000001', completion: '0.0000005' },
      supported_parameters: ['temperature', 'structured_outputs'],
    },
    {
      id: 'example/plain-model',
      name: 'Example: Plain Model',
      context_length: 8_000,
      pricing: { prompt: '0', completion: '0' },
      supported_parameters: ['temperature'],
    },
  ],
}

export const keyFixture = {
  data: {
    label: 'sk-or-v1-tes...',
    limit: null,
    limit_remaining: null,
    usage: 1.25,
    is_free_tier: false,
  },
}

export function completionFixture(content: string, model = 'anthropic/claude-sonnet-5.5') {
  return {
    id: 'gen-1',
    model,
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
    usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20, cost: 0.0001 },
  }
}

function isAuthorized(request: Request): boolean {
  return request.headers.get('Authorization') === `Bearer ${VALID_TEST_KEY}`
}

const unauthorized = () =>
  HttpResponse.json({ error: { code: 401, message: 'No auth credentials found' } }, { status: 401 })

/**
 * Standard-Mocks für OpenRouter: Modellliste, Key-Prüfung und eine einfache Chat-Antwort.
 * In Tests mit `server.use(...openRouterHandlers)` aktivieren und bei Bedarf einzelne Routen überschreiben.
 */
export const openRouterHandlers = [
  http.get(`${OPENROUTER_BASE_URL}/models`, () => HttpResponse.json(modelsFixture)),
  http.get(`${OPENROUTER_BASE_URL}/key`, ({ request }) =>
    isAuthorized(request) ? HttpResponse.json(keyFixture) : unauthorized(),
  ),
  http.post(`${OPENROUTER_BASE_URL}/chat/completions`, ({ request }) =>
    isAuthorized(request) ? HttpResponse.json(completionFixture('Hallo!')) : unauthorized(),
  ),
]
