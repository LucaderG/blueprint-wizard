/**
 * Liest einen Server-Sent-Events-Stream und liefert den Inhalt jeder `data:`-Zeile.
 * Kommentarzeilen (`: …`, z. B. OpenRouters Keep-Alive) und andere Felder werden ignoriert.
 */
export async function* readSseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newline: number
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, '')
        buffer = buffer.slice(newline + 1)
        if (line.startsWith('data:')) yield line.slice(5).trimStart()
      }
    }
    buffer += decoder.decode()
    const rest = buffer.replace(/\r$/, '')
    if (rest.startsWith('data:')) yield rest.slice(5).trimStart()
  } finally {
    reader.releaseLock()
  }
}
