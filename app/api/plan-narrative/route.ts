import { streamText } from "ai"
import { buildPlanNarrativePrompt, type PlanNarrativePayload } from "@/lib/ai/plan-narrative-prompt"
import { MODEL_TIERS, DEFAULT_MODEL_TIER, type ModelTier } from "@/lib/ai/model-tiers"

interface PlanNarrativeRequestBody extends PlanNarrativePayload {
  tier?: string
}

function resolveModel(tier: string | undefined): string {
  if (tier && tier in MODEL_TIERS) {
    return MODEL_TIERS[tier as ModelTier]
  }
  return MODEL_TIERS[DEFAULT_MODEL_TIER]
}

export async function POST(request: Request) {
  const body = (await request.json()) as PlanNarrativeRequestBody
  const { tier, ...payload } = body
  const { system, prompt } = buildPlanNarrativePrompt(payload)

  const result = streamText({
    model: resolveModel(tier),
    system,
    prompt,
  })

  return result.toTextStreamResponse()
}
