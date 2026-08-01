import { streamText } from "ai"
import { buildPlanNarrativePrompt, type PlanNarrativePayload } from "@/lib/ai/plan-narrative-prompt"

export async function POST(request: Request) {
  const payload = (await request.json()) as PlanNarrativePayload
  const { system, prompt } = buildPlanNarrativePrompt(payload)

  const result = streamText({
    model: "anthropic/claude-sonnet-5",
    system,
    prompt,
  })

  return result.toTextStreamResponse()
}
