import type { DrawdownConfig, MarketAssumptions, PersonalInfo, RetirementGoals } from "@/types"
import type { Json } from "@/types/supabase"
import { createClient } from "./client"

export interface ScenarioData {
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  assumptions: MarketAssumptions
  drawdownConfig: DrawdownConfig
  displayMode: "nominal" | "real"
}

export interface ScenarioMeta {
  id: string
  name: string
  updatedAt: string
}

export async function listScenarios(userId: string): Promise<ScenarioMeta[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("scenarios")
    .select("id, name, updated_at")
    .eq("session_id", userId)
    .order("updated_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, updatedAt: r.updated_at }))
}

export async function fetchScenario(scenarioId: string): Promise<ScenarioData | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("scenarios")
    .select("*")
    .eq("id", scenarioId)
    .single()
  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return {
    personalInfo: data.personal_info as unknown as PersonalInfo,
    retirementGoals: data.retirement_goals as unknown as RetirementGoals,
    assumptions: data.assumptions as unknown as MarketAssumptions,
    drawdownConfig: data.drawdown_config as unknown as DrawdownConfig,
    displayMode: data.display_mode as "nominal" | "real",
  }
}

export async function createScenario(
  userId: string,
  name: string,
  data: ScenarioData
): Promise<string> {
  const supabase = createClient()
  const { data: row, error } = await supabase
    .from("scenarios")
    .insert({
      session_id: userId,
      name,
      personal_info: data.personalInfo as unknown as Json,
      retirement_goals: data.retirementGoals as unknown as Json,
      assumptions: data.assumptions as unknown as Json,
      drawdown_config: data.drawdownConfig as unknown as Json,
      display_mode: data.displayMode,
    })
    .select("id")
    .single()
  if (error) throw error
  return row.id
}

export async function updateScenario(scenarioId: string, data: ScenarioData): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("scenarios")
    .update({
      personal_info: data.personalInfo as unknown as Json,
      retirement_goals: data.retirementGoals as unknown as Json,
      assumptions: data.assumptions as unknown as Json,
      drawdown_config: data.drawdownConfig as unknown as Json,
      display_mode: data.displayMode,
    })
    .eq("id", scenarioId)
  if (error) throw error
}

export async function renameScenario(scenarioId: string, name: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("scenarios")
    .update({ name })
    .eq("id", scenarioId)
  if (error) throw error
}

export async function deleteScenario(scenarioId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("scenarios").delete().eq("id", scenarioId)
  if (error) throw error
}
