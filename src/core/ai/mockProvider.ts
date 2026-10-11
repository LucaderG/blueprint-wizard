import { AiError } from './errors'
import type { AiProvider, CompletionRequest, CompletionResult } from './types'

/** Eine vorbereitete Antwort: Text, ein komplettes Ergebnis oder ein Fehler. */
export type MockResponse = string | CompletionResult | AiError

/**
 * KI-Anbieter für Tests und Offline-Demos. Liefert die vorbereiteten Antworten der Reihe nach
 * und merkt sich alle Anfragen in `requests`.
 */
export class MockAiProvider implements AiProvider {
  readonly requests: CompletionRequest[] = []
  private readonly queue: MockResponse[]

  constructor(responses: MockResponse[] = []) {
    this.queue = [...responses]
  }

  enqueue(...responses: MockResponse[]): void {
    this.queue.push(...responses)
  }

  private next(request: CompletionRequest): CompletionResult {
    this.requests.push(request)
    if (request.signal?.aborted) throw new AiError('aborted', 'Anfrage abgebrochen')
    const response = this.queue.shift()
    if (response === undefined) throw new Error('MockAiProvider: keine Antwort mehr vorbereitet')
    if (response instanceof AiError) throw response
    return typeof response === 'string' ? { text: response, model: 'mock/model' } : response
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    return this.next(request)
  }

  async stream(
    request: CompletionRequest,
    onDelta: (delta: string) => void,
  ): Promise<CompletionResult> {
    const result = this.next(request)
    // In Wortstücken ausliefern, damit Streaming-UIs realistisch getestet werden können.
    for (const piece of result.text.match(/\S+\s*|\s+/g) ?? []) onDelta(piece)
    return result
  }
}
