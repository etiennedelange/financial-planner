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

/** What the response stream errors with when generation fails part-way. Deliberately generic. */
export class NarrativeInterruptedError extends Error {
  constructor() {
    super("The model stopped before finishing")
    this.name = "NarrativeInterruptedError"
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
 * lets the route answer with a real status and message instead.
 *
 * A failure after text has started is passed to `onLateError` and then *errors*
 * the stream, which aborts the HTTP response. Closing it normally would hand the
 * browser a clean 200 with half a summary, which it would cache and show as
 * complete. The stream errors with a generic `NarrativeInterruptedError`, so the
 * provider's message never reaches the framework's logs.
 */
export async function startNarrativeStream(
  parts: AsyncIterable<NarrativeStreamPart>,
  onLateError: (error: unknown) => void = () => {},
): Promise<NarrativeStreamStart> {
  const iterator = parts[Symbol.asyncIterator]()

  let first: string | null = null
  try {
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
  } catch (error) {
    // The upstream iterator itself threw (rather than yielding an error part).
    return { ok: false, error }
  }

  const firstText = first
  let sentFirst = false

  const fail = async (controller: ReadableStreamDefaultController<string>, error: unknown) => {
    onLateError(error)
    try {
      await iterator.return?.()
    } catch {
      // Already failing; the original error is what matters.
    }
    controller.error(new NarrativeInterruptedError())
  }

  const stream = new ReadableStream<string>({
    async pull(controller) {
      if (!sentFirst) {
        sentFirst = true
        controller.enqueue(firstText)
        return
      }
      try {
        while (true) {
          const next = await iterator.next()
          if (next.done) {
            controller.close()
            return
          }
          const part = next.value
          if (isError(part)) {
            await fail(controller, part.error)
            return
          }
          if (isTextDelta(part) && part.text.length > 0) {
            controller.enqueue(part.text)
            return
          }
        }
      } catch (error) {
        await fail(controller, error)
      }
    },
    async cancel() {
      await iterator.return?.()
    },
  })

  return { ok: true, stream }
}
