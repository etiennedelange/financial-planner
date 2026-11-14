import { describe, it, expect, vi } from "vite-plus/test"
import {
  EmptyNarrativeError,
  startNarrativeStream,
  type NarrativeStreamPart,
} from "./narrative-stream"

async function* parts(...items: NarrativeStreamPart[]): AsyncGenerator<NarrativeStreamPart> {
  for (const item of items) yield item
}

async function readAll(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader()
  let out = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) return out
    out += value
  }
}

describe("startNarrativeStream", () => {
  it("streams every text delta in order, skipping non-text parts", async () => {
    const started = await startNarrativeStream(
      parts(
        { type: "start" },
        { type: "reasoning-delta" },
        { type: "text-delta", text: "Hello " },
        { type: "finish-step" },
        { type: "text-delta", text: "world" },
        { type: "finish" },
      ),
    )
    expect(started.ok).toBe(true)
    if (started.ok) expect(await readAll(started.stream)).toBe("Hello world")
  })

  it("reports an error that arrives before any text, so the route can return a real status", async () => {
    const error = Object.assign(new Error("Unauthorized"), { statusCode: 401 })
    const started = await startNarrativeStream(
      parts({ type: "start" }, { type: "error", error }, { type: "text-delta", text: "never" }),
    )
    expect(started).toEqual({ ok: false, error })
  })

  it("treats a stream with no text as a failure", async () => {
    const started = await startNarrativeStream(
      parts({ type: "start" }, { type: "text-delta", text: "" }, { type: "finish" }),
    )
    expect(started.ok).toBe(false)
    if (!started.ok) expect(started.error).toBeInstanceOf(EmptyNarrativeError)
  })

  it("ends the stream early on a late error and reports it", async () => {
    const onLateError = vi.fn()
    const late = new Error("dropped")
    const started = await startNarrativeStream(
      parts(
        { type: "text-delta", text: "Partial" },
        { type: "error", error: late },
        { type: "text-delta", text: " never" },
      ),
      onLateError,
    )
    if (!started.ok) throw new Error("expected ok")
    expect(await readAll(started.stream)).toBe("Partial")
    expect(onLateError).toHaveBeenCalledWith(late)
  })

  it("stops the upstream iterator when the client cancels", async () => {
    let finalized = false
    async function* upstream(): AsyncGenerator<NarrativeStreamPart> {
      try {
        yield { type: "text-delta", text: "a" }
        yield { type: "text-delta", text: "b" }
        yield { type: "text-delta", text: "c" }
      } finally {
        finalized = true
      }
    }
    const started = await startNarrativeStream(upstream())
    if (!started.ok) throw new Error("expected ok")
    const reader = started.stream.getReader()
    expect((await reader.read()).value).toBe("a")
    await reader.cancel()
    expect(finalized).toBe(true)
  })
})
