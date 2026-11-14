import { describe, it, expect } from "vite-plus/test"
import {
  GENERIC_NARRATIVE_ERROR,
  narrativeErrorMessage,
  readNarrativeError,
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
