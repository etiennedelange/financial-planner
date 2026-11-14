/** The subset of AI SDK stream parts this module reads. */
export type NarrativeStreamPart =
  | { type: "text-delta"; text: string }
  | { type: "error"; error: unknown }
  | { type: string }

export type NarrativeStreamStart =
  | { ok: true; stream: ReadableStream<string> }
  | { ok: false; error: unknown }

export class EmptyNarrativeError extends Error {
  constructor() {
    super("The model returned no text")
    this.name = "EmptyNarrativeError"
  }
}

function isTextDelta(part: NarrativeStreamPart): part is { type: "text-delta"; text: string } {
  return part.type === "text-delta" && "text" in part && typeof part.text === "string"
}

function isError(part: NarrativeStreamPart): part is { type: "error"; error: unknown } {
  return part.type === "error"
}

/**
 * Waits for the first piece of text before committing to a streamed 200.
 *
 * Provider failures (rejected key, no credit, unknown model) arrive as an
 * `error` part before any text. Streaming straight away would turn them into an
 * empty 200 that the browser can only report as "something went wrong"; waiting
 * lets the route answer with a real status and message instead. Errors after
 * text has started end the stream early and are passed to `onLateError`.
 */
export async function startNarrativeStream(
  parts: AsyncIterable<NarrativeStreamPart>,
  onLateError: (error: unknown) => void = () => {},
): Promise<NarrativeStreamStart> {
  const iterator = parts[Symbol.asyncIterator]()

  let first: string | null = null
  while (first === null) {
    const next = await iterator.next()
    if (next.done) return { ok: false, error: new EmptyNarrativeError() }
    const part = next.value
    if (isError(part)) {
      await iterator.return?.()
      return { ok: false, error: part.error }
    }
    if (isTextDelta(part) && part.text.length > 0) first = part.text
  }

  const firstText = first
  let sentFirst = false
  const stream = new ReadableStream<string>({
    async pull(controller) {
      if (!sentFirst) {
        sentFirst = true
        controller.enqueue(firstText)
        return
      }
      while (true) {
        const next = await iterator.next()
        if (next.done) {
          controller.close()
          return
        }
        const part = next.value
        if (isError(part)) {
          onLateError(part.error)
          await iterator.return?.()
          controller.close()
          return
        }
        if (isTextDelta(part) && part.text.length > 0) {
          controller.enqueue(part.text)
          return
        }
      }
    },
    async cancel() {
      await iterator.return?.()
    },
  })

  return { ok: true, stream }
}
