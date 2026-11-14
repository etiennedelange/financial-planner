import { describe, it, expect, afterEach, vi } from "vite-plus/test"
import { streamAnthropic } from "./anthropic"
import { streamOpenAI } from "./openai"
import { streamGemini } from "./gemini"
import type { StreamRequest } from "./types"
import { collect, mockFetch, sseResponse } from "./test-helpers"

afterEach(() => vi.restoreAllMocks())

const KEY = "sk-test-SECRET-0123456789"
const req = (over: Partial<StreamRequest> = {}): StreamRequest => ({
  apiKey: KEY,
  model: "model-x",
  system: "SYSTEM",
  prompt: "PROMPT",
  maxOutputTokens: 700,
  ...over,
})

describe("Anthropic", () => {
  const events = [
    JSON.stringify({ type: "message_start" }),
    JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "Hello " } }),
    JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "world" } }),
    JSON.stringify({ type: "message_stop" }),
  ]

  it("sends the key and the browser opt-in header, and streams the text", async () => {
    const { calls } = mockFetch(() => sseResponse(events))
    const text = await collect(streamAnthropic(req()))
    expect(text).toBe("Hello world")
    expect(calls[0].url.href).toBe("https://api.anthropic.com/v1/messages")
    expect(calls[0].headers).toMatchObject({
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    })
    expect(calls[0].body).toMatchObject({
      model: "model-x",
      max_tokens: 700,
      system: "SYSTEM",
      stream: true,
      messages: [{ role: "user", content: "PROMPT" }],
    })
  })

  it("keeps the key out of the URL and the body", async () => {
    const { calls } = mockFetch(() => sseResponse(events))
    await collect(streamAnthropic(req()))
    expect(calls[0].url.href).not.toContain(KEY)
    expect(JSON.stringify(calls[0].body)).not.toContain(KEY)
  })

  it("stops at message_stop and skips non-text and malformed events", async () => {
    mockFetch(() =>
      sseResponse([
        "not json",
        JSON.stringify({ type: "content_block_delta", delta: { type: "input_json_delta" } }),
        JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "A" } }),
        JSON.stringify({ type: "message_stop" }),
        JSON.stringify({
          type: "content_block_delta",
          delta: { type: "text_delta", text: "IGNORED" },
        }),
      ]),
    )
    expect(await collect(streamAnthropic(req()))).toBe("A")
  })

  it("turns a mid-stream error event into a fixed-message error", async () => {
    mockFetch(() =>
      sseResponse([JSON.stringify({ type: "error", error: { message: `bad key ${KEY}` } })]),
    )
    const error = await collect(streamAnthropic(req())).catch((e) => e)
    expect(error.code).toBe("unknown")
    expect(error.message).not.toContain(KEY)
  })
})

describe("OpenAI", () => {
  const chunk = (content: string | null) => JSON.stringify({ choices: [{ delta: { content } }] })

  it("sends a Bearer token, bounded tokens and system+user messages", async () => {
    const { calls } = mockFetch(() =>
      sseResponse([chunk("Hi"), chunk(" there"), chunk(null), "[DONE]"]),
    )
    expect(await collect(streamOpenAI(req()))).toBe("Hi there")
    expect(calls[0].url.href).toBe("https://api.openai.com/v1/chat/completions")
    expect(calls[0].headers.Authorization).toBe(`Bearer ${KEY}`)
    expect(calls[0].body).toMatchObject({
      model: "model-x",
      max_completion_tokens: 700,
      stream: true,
      messages: [
        { role: "system", content: "SYSTEM" },
        { role: "user", content: "PROMPT" },
      ],
    })
    expect(calls[0].url.href).not.toContain(KEY)
  })

  it("stops at [DONE]", async () => {
    mockFetch(() => sseResponse([chunk("A"), "[DONE]", chunk("IGNORED")]))
    expect(await collect(streamOpenAI(req()))).toBe("A")
  })

  it("maps an in-stream error object to a fixed-message error", async () => {
    mockFetch(() =>
      sseResponse([JSON.stringify({ error: { message: `Incorrect API key ${KEY}` } })]),
    )
    const error = await collect(streamOpenAI(req())).catch((e) => e)
    expect(error.code).toBe("unknown")
    expect(error.message).not.toContain(KEY)
  })

  it("ignores malformed chunks and empty choices", async () => {
    mockFetch(() => sseResponse(["garbage", JSON.stringify({ choices: [] }), chunk("ok")]))
    expect(await collect(streamOpenAI(req()))).toBe("ok")
  })
})

describe("Gemini", () => {
  const chunk = (...texts: string[]) =>
    JSON.stringify({ candidates: [{ content: { parts: texts.map((text) => ({ text })) } }] })

  it("puts the key in a HEADER, never the query string, and requests SSE", async () => {
    const { calls } = mockFetch(() => sseResponse([chunk("Hello"), chunk(" ", "there")]))
    expect(await collect(streamGemini(req({ model: "gemini-2.5-flash" })))).toBe("Hello there")
    expect(calls[0].url.pathname).toBe("/v1beta/models/gemini-2.5-flash:streamGenerateContent")
    expect(calls[0].url.search).toBe("?alt=sse")
    expect(calls[0].url.href).not.toContain(KEY)
    expect(calls[0].headers["x-goog-api-key"]).toBe(KEY)
    expect(calls[0].body).toMatchObject({
      systemInstruction: { parts: [{ text: "SYSTEM" }] },
      contents: [{ role: "user", parts: [{ text: "PROMPT" }] }],
      generationConfig: { maxOutputTokens: 700 },
    })
  })

  it.each(["../../evil", "a/b", "model?key=1", "m#x", "a b", ""])(
    "rejects model id %j that could alter the URL path",
    async (model) => {
      const { calls } = mockFetch(() => sseResponse([]))
      const error = await collect(streamGemini(req({ model }))).catch((e) => e)
      expect(error.code).toBe("bad-request")
      expect(calls).toHaveLength(0)
    },
  )

  it("maps an in-stream error to a fixed-message error", async () => {
    mockFetch(() => sseResponse([JSON.stringify({ error: { message: KEY } })]))
    const error = await collect(streamGemini(req({ model: "gemini-2.5-pro" }))).catch((e) => e)
    expect(error.code).toBe("unknown")
    expect(error.message).not.toContain(KEY)
  })

  it("tolerates chunks with no candidates", async () => {
    mockFetch(() => sseResponse([JSON.stringify({}), chunk("fine")]))
    expect(await collect(streamGemini(req({ model: "gemini-2.5-pro" })))).toBe("fine")
  })
})
