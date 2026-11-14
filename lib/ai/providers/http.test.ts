import { describe, it, expect, afterEach, vi } from "vite-plus/test"
import { mapStatus, providerFetch } from "./http"
import { ProviderError } from "./types"
import { chunkedResponse, mockFetch } from "./test-helpers"

afterEach(() => vi.restoreAllMocks())

const ok = () => chunkedResponse(["data: x\n\n"])
const init = { headers: { "x-api-key": "k" }, body: "{}" }

describe("providerFetch hardening — every request carrying a key goes through here", () => {
  it("never sends cookies, referrers or cached responses, and refuses redirects", async () => {
    const { calls } = mockFetch(ok)
    await providerFetch("anthropic", "/v1/messages", init)
    expect(calls[0].init).toMatchObject({
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      redirect: "error",
    })
  })

  it("only ever targets the pinned provider origin", async () => {
    const { calls } = mockFetch(ok)
    await providerFetch("openai", "/v1/chat/completions", init)
    expect(calls[0].url.origin).toBe("https://api.openai.com")
  })

  it("refuses a path that would escape to another origin", async () => {
    const { calls } = mockFetch(ok)
    for (const evil of ["https://evil.example/steal", "//evil.example/steal"]) {
      await expect(providerFetch("openai", evil, init)).rejects.toMatchObject({ code: "blocked" })
    }
    expect(calls).toHaveLength(0)
  })

  it("sets JSON content type and passes the caller's headers through", async () => {
    const { calls } = mockFetch(ok)
    await providerFetch("anthropic", "/v1/messages", init)
    expect(calls[0].headers).toMatchObject({ "Content-Type": "application/json", "x-api-key": "k" })
  })
})

describe("providerFetch error mapping (fixed messages only)", () => {
  it.each([
    [401, "invalid-key"],
    [403, "invalid-key"],
    [402, "quota"],
    [429, "rate-limited"],
    [400, "bad-request"],
    [404, "bad-request"],
    [422, "bad-request"],
    [500, "unknown"],
    [529, "unknown"],
  ])("HTTP %i → %s", async (status, code) => {
    mockFetch(
      () => new Response("provider says: Incorrect API key provided: sk-ABCD****WXYZ", { status }),
    )
    const error = await providerFetch("anthropic", "/x", init).catch((e) => e)
    expect(error).toBeInstanceOf(ProviderError)
    expect(error.code).toBe(code)
    // The provider's body (which can echo part of the key) never reaches the message.
    expect(error.message).not.toContain("sk-ABCD")
    expect(error.message).not.toContain("provider says")
  })

  it("maps a fetch failure (network / CORS / CSP block) to a network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(providerFetch("gemini", "/x", init)).rejects.toMatchObject({ code: "network" })
  })

  it("maps a user abort to 'aborted'", async () => {
    const controller = new AbortController()
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      controller.abort()
      throw new DOMException("aborted", "AbortError")
    })
    await expect(
      providerFetch("gemini", "/x", { ...init, signal: controller.signal }),
    ).rejects.toMatchObject({ code: "aborted" })
  })

  it("maps the built-in timeout to 'timeout'", async () => {
    const expired = AbortSignal.abort()
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(expired)
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("t", "TimeoutError"))
    await expect(providerFetch("gemini", "/x", init)).rejects.toMatchObject({ code: "timeout" })
  })

  it("treats a response with no body as unknown", async () => {
    mockFetch(() => new Response(null, { status: 200 }))
    await expect(providerFetch("gemini", "/x", init)).rejects.toMatchObject({ code: "unknown" })
  })

  it("mapStatus is exported for reuse", () => {
    expect(mapStatus(429).code).toBe("rate-limited")
  })
})
