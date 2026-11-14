import { providerFetch } from "@/lib/ai/providers/http"
import { readSseData } from "@/lib/ai/providers/sse"
import { ProviderError, type StreamRequest } from "@/lib/ai/providers/types"

const MODEL_ID = /^[A-Za-z0-9._-]+$/

export async function* streamGemini(req: StreamRequest): AsyncGenerator<string> {
  // The model id is part of the URL path, so it must be a plain identifier.
  if (!MODEL_ID.test(req.model)) throw new ProviderError("bad-request")

  const response = await providerFetch(
    "gemini",
    `/v1beta/models/${req.model}:streamGenerateContent?alt=sse`,
    {
      // The key goes in a header, NEVER the `?key=` query string — URLs end up in
      // browser history, proxies' logs and error reports.
      headers: { "x-goog-api-key": req.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.prompt }] }],
        generationConfig: { maxOutputTokens: req.maxOutputTokens },
      }),
      signal: req.signal,
    },
  )

  for await (const data of readSseData(response.body!)) {
    let chunk: { error?: unknown; candidates?: { content?: { parts?: { text?: string }[] } }[] }
    try {
      chunk = JSON.parse(data)
    } catch {
      continue
    }
    if (chunk.error) throw new ProviderError("unknown")
    for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
      if (part.text) yield part.text
    }
  }
}
