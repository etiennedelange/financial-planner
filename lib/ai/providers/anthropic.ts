import { providerFetch } from "@/lib/ai/providers/http"
import { readSseData } from "@/lib/ai/providers/sse"
import { ProviderError, type StreamRequest } from "@/lib/ai/providers/types"

export async function* streamAnthropic(req: StreamRequest): AsyncGenerator<string> {
  const response = await providerFetch("anthropic", "/v1/messages", {
    headers: {
      "x-api-key": req.apiKey,
      "anthropic-version": "2023-06-01",
      // Anthropic only answers browser (CORS) requests that opt in with this header.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: req.model,
      max_tokens: req.maxOutputTokens,
      system: req.system,
      messages: [{ role: "user", content: req.prompt }],
      stream: true,
    }),
    signal: req.signal,
  })

  for await (const data of readSseData(response.body!)) {
    let event: { type?: string; delta?: { type?: string; text?: string } }
    try {
      event = JSON.parse(data)
    } catch {
      continue
    }
    if (event.type === "error") throw new ProviderError("unknown")
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      if (event.delta.text) yield event.delta.text
    }
    if (event.type === "message_stop") return
  }
}
