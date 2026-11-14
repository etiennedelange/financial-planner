export const GENERIC_NARRATIVE_ERROR = "Couldn't generate a summary right now. Please try again."

/**
 * The message to show for a failed narrative request. The route returns
 * `{ error }` with a user-facing message for every failure it handles; anything
 * else (HTML error page, proxy failure, oversized message) gets the generic one.
 */
export function narrativeErrorMessage(body: unknown): string {
  if (typeof body !== "object" || body === null) return GENERIC_NARRATIVE_ERROR
  const error = (body as { error?: unknown }).error
  if (typeof error !== "string") return GENERIC_NARRATIVE_ERROR
  const trimmed = error.trim()
  if (trimmed.length === 0 || trimmed.length > 300) return GENERIC_NARRATIVE_ERROR
  // The 400 for a schema failure is a client bug, not something the user can act on.
  if (trimmed === "Invalid request body") return GENERIC_NARRATIVE_ERROR
  return trimmed
}

export async function readNarrativeError(response: Response): Promise<string> {
  try {
    return narrativeErrorMessage(await response.json())
  } catch {
    return GENERIC_NARRATIVE_ERROR
  }
}

/**
 * Reads a streamed narrative to the end, reporting the text so far after each
 * chunk. Throws if the stream breaks: the route aborts the response when the
 * model fails part-way, and a partial summary must never be treated as a
 * finished one (cached, cooled down, shown without an error).
 */
export async function readNarrativeStream(
  body: ReadableStream<Uint8Array>,
  onText: (textSoFar: string) => void,
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let text = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
    onText(text)
  }
  text += decoder.decode()
  return text
}
