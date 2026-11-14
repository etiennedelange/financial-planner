import { providerFetch } from "@/lib/ai/providers/http"
import { readSseData } from "@/lib/ai/providers/sse"
import { ProviderError, type StreamRequest } from "@/lib/ai/providers/types"

export async function* streamOpenAI(req: StreamRequest): AsyncGenerator<string> {
  const response = await providerFetch("openai", "/v1/chat/completions", {
    headers: { Authorization: `Bearer ${req.apiKey}` },
    body: JSON.stringify({
      model: req.model,
      max_completion_tokens: req.maxOutputTokens,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.prompt },
      ],
      stream: true,
    }),
    signal: req.signal,
  })

  for await (const data of readSseData(response.body!)) {
    if (data === "[DONE]") return
    let chunk: { error?: unknown; choices?: { delta?: { content?: string | null } }[] }
    try {
      chunk = JSON.parse(data)
    } catch {
      continue
    }
    if (chunk.error) throw new ProviderError("unknown")
    const text = chunk.choices?.[0]?.delta?.content
    if (text) yield text
  }
}
