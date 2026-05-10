import type { Account, DrawdownConfig, MarketAssumptions, PersonalInfo, RetirementGoals } from "@/types"

export interface ShareablePlan {
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  assumptions: MarketAssumptions
  drawdownConfig: DrawdownConfig
  displayMode: "nominal" | "real"
  accounts: Account[]
}

export function encodeShareToken(plan: ShareablePlan): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(plan))))
}

export function decodeShareToken(token: string): ShareablePlan | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(token)))) as ShareablePlan
  } catch {
    return null
  }
}

export function buildShareUrl(plan: ShareablePlan): string {
  const token = encodeShareToken(plan)
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  return `${origin}/calculator?share=${token}`
}

export async function copyShareUrl(plan: ShareablePlan): Promise<void> {
  const url = buildShareUrl(plan)
  await navigator.clipboard.writeText(url)
}
