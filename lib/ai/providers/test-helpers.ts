/** Shared by provider tests: builds streaming Responses and captures fetch calls. */
import { vi } from "vite-plus/test"

export function sseResponse(events: string[], init: ResponseInit = { status: 200 }): Response {
  return chunkedResponse([events.map((e) => `data: ${e}\n\n`).join("")], init)
}

export function chunkedResponse(chunks: string[], init: ResponseInit = { status: 200 }): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream, init)
}

interface CapturedCall {
  url: URL
  init: RequestInit
  headers: Record<string, string>
  body: Record<string, unknown>
}

/** Replaces global fetch; returns the calls it received. */
export function mockFetch(respond: () => Response | Promise<Response>) {
  const calls: CapturedCall[] = []
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    calls.push({
      url: new URL(
        input instanceof Request ? input.url : input instanceof URL ? input.href : input,
      ),
      init: init ?? {},
      headers: { ...(init?.headers as Record<string, string>) },
      body: typeof init?.body === "string" ? JSON.parse(init.body) : {},
    })
    return respond()
  })
  return { calls, spy }
}

export async function collect(stream: AsyncIterable<string>): Promise<string> {
  let text = ""
  for await (const chunk of stream) text += chunk
  return text
}
