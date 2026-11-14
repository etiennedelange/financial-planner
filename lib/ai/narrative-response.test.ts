import { describe, it, expect } from "vite-plus/test"
import {
  GENERIC_NARRATIVE_ERROR,
  narrativeErrorMessage,
  readNarrativeError,
  readNarrativeStream,
} from "./narrative-response"

describe("narrativeErrorMessage", () => {
  it("passes through the route's user-facing message", () => {
    expect(narrativeErrorMessage({ error: "Your AI provider account is out of credit." })).toBe(
      "Your AI provider account is out of credit.",
    )
  })

  it("falls back to the generic message for anything unexpected", () => {
    for (const body of [
      null,
      "text",
      42,
      {},
      { error: 5 },
      { error: "  " },
      { error: "x".repeat(301) },
    ]) {
      expect(narrativeErrorMessage(body)).toBe(GENERIC_NARRATIVE_ERROR)
    }
  })

  it("hides schema-validation failures, which the user cannot act on", () => {
    expect(narrativeErrorMessage({ error: "Invalid request body", issues: [] })).toBe(
      GENERIC_NARRATIVE_ERROR,
    )
  })
})

describe("readNarrativeError", () => {
  it("reads the JSON error body", async () => {
    const response = new Response(
      JSON.stringify({ error: "Too many requests. Try again later." }),
      {
        status: 429,
      },
    )
    expect(await readNarrativeError(response)).toBe("Too many requests. Try again later.")
  })

  it("handles a non-JSON error page", async () => {
    const response = new Response("<html>502</html>", { status: 502 })
    expect(await readNarrativeError(response)).toBe(GENERIC_NARRATIVE_ERROR)
  })
})

describe("readNarrativeStream", () => {
  const encode = (text: string) => new TextEncoder().encode(text)

  it("returns the whole text and reports progress after each chunk", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encode("Your plan "))
        controller.enqueue(encode("looks steady."))
        controller.close()
      },
    })
    const seen: string[] = []
    expect(await readNarrativeStream(body, (t) => seen.push(t))).toBe("Your plan looks steady.")
    expect(seen).toEqual(["Your plan ", "Your plan looks steady."])
  })

  it("decodes a multi-byte character split across chunks", async () => {
    const bytes = encode("R1 000 — done")
    const split = bytes.indexOf(0xe2) + 1 // inside the em dash
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, split))
        controller.enqueue(bytes.slice(split))
        controller.close()
      },
    })
    expect(await readNarrativeStream(body, () => {})).toBe("R1 000 — done")
  })

  it("regression: throws when the stream aborts part-way, so partial text is never treated as finished", async () => {
    let pulls = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1
        if (pulls === 1) controller.enqueue(encode("Partial"))
        else controller.error(new TypeError("network error"))
      },
    })
    const seen: string[] = []
    await expect(readNarrativeStream(body, (t) => seen.push(t))).rejects.toThrow("network error")
    expect(seen).toEqual(["Partial"])
  })
})
