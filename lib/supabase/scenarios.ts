import type { DrawdownConfig, MarketAssumptions, PersonalInfo, RetirementGoals } from "@/types"
import type { Json } from "@/types/supabase"
import { createClient } from "./client"

export interface ScenarioData {
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  assumptions: MarketAssumptions
  drawdownConfig: DrawdownConfig
  displayMode: 'nominal' | 'real'
}

export async function fetchScenario(sessionId: string): Promise<ScenarioData | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from("scenarios")
    .select("*")
    .eq("session_id", sessionId)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null // no rows
    throw error
  }

  return {
    personalInfo: data.personal_info as unknown as PersonalInfo,
    retirementGoals: data.retirement_goals as unknown as RetirementGoals,
    assumptions: data.assumptions as unknown as MarketAssumptions,
    drawdownConfig: data.drawdown_config as unknown as DrawdownConfig,
    displayMode: data.display_mode as 'nominal' | 'real',
  }
}

export async function upsertScenario(sessionId: string, scenario: ScenarioData): Promise<void> {
  const supabase = createClient()
  if (!supabase) return
  const { error } = await supabase
    .from("scenarios")
    .upsert(
      {
        session_id: sessionId,
        personal_info: scenario.personalInfo as unknown as Json,
        retirement_goals: scenario.retirementGoals as unknown as Json,
        assumptions: scenario.assumptions as unknown as Json,
        drawdown_config: scenario.drawdownConfig as unknown as Json,
        display_mode: scenario.displayMode,
      },
      { onConflict: "session_id" }
    )

  if (error) throw error
}
