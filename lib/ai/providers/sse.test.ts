import { describe, it, expect } from "vite-plus/test"
import { readSseData } from "./sse"
import { chunkedResponse } from "./test-helpers"

async function all(chunks: string[]): Promise<string[]> {
  const out: string[] = []
  for await (const data of readSseData(chunkedResponse(chunks).body!)) out.push(data)
  return out
}

describe("readSseData", () => {
  it("yields each data line", async () => {
    expect(await all(["data: one\n\ndata: two\n\n"])).toEqual(["one", "two"])
  })

  it("reassembles an event split across network chunks", async () => {
    expect(await all(["da", "ta: hel", "lo\n", "\ndata: wor", "ld\n\n"])).toEqual([
      "hello",
      "world",
    ])
  })

  it("handles CRLF line endings", async () => {
    expect(await all(["data: a\r\n\r\ndata: b\r\n\r\n"])).toEqual(["a", "b"])
  })

  it("ignores comments, event names and blank lines", async () => {
    expect(await all([": keep-alive\nevent: ping\ndata: x\n\n\n"])).toEqual(["x"])
  })

  it("yields a final data line that has no trailing newline", async () => {
    expect(await all(["data: first\n\ndata: last"])).toEqual(["first", "last"])
  })

  it("keeps multi-byte characters intact when a chunk boundary splits them", async () => {
    const bytes = new TextEncoder().encode("data: R€ 5\n\n")
    const split = bytes.indexOf(0xe2) + 1 // inside the 3-byte euro sign
    const encoder = new TextDecoder()
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, split))
        c.enqueue(bytes.slice(split))
        c.close()
      },
    })
    const out: string[] = []
    for await (const d of readSseData(body)) out.push(d)
    expect(out).toEqual(["R€ 5"])
    expect(encoder).toBeDefined()
  })

  it("keeps a data payload that itself contains a colon", async () => {
    expect(await all(['data: {"a":"b:c"}\n\n'])).toEqual(['{"a":"b:c"}'])
  })
})
