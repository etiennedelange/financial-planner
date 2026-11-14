/**
 * Minimal Server-Sent-Events reader: yields the payload of each `data:` line.
 * Handles events split across network chunks, \r\n line endings and multi-byte
 * characters split across chunks (stream-mode TextDecoder).
 */
export async function* readSseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newline: number
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, "")
        buffer = buffer.slice(newline + 1)
        if (line.startsWith("data:")) yield line.slice(5).trimStart()
      }
    }
    // A final line with no trailing newline.
    const tail = (buffer + decoder.decode()).replace(/\r$/, "")
    if (tail.startsWith("data:")) yield tail.slice(5).trimStart()
  } finally {
    reader.releaseLock()
  }
}
