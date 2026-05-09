import type { Account, DrawdownConfig, MarketAssumptions, PersonalInfo, RetirementGoals } from "@/types"

const PLAN_VERSION = 1

export interface PlanExport {
  version: number
  exportedAt: string
  plan: {
    personalInfo: PersonalInfo
    retirementGoals: RetirementGoals
    assumptions: MarketAssumptions
    drawdownConfig: DrawdownConfig
    displayMode: "nominal" | "real"
    accounts: Account[]
  }
}

export function exportPlan(
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
  assumptions: MarketAssumptions,
  drawdownConfig: DrawdownConfig,
  displayMode: "nominal" | "real",
  accounts: Account[]
): void {
  const payload: PlanExport = {
    version: PLAN_VERSION,
    exportedAt: new Date().toISOString(),
    plan: { personalInfo, retirementGoals, assumptions, drawdownConfig, displayMode, accounts },
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `retirement-plan-${new Date().toISOString().split("T")[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function parsePlanFile(file: File): Promise<PlanExport> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string)
        if (!raw?.version || !raw?.plan) {
          reject(new Error("Invalid plan file — missing version or plan data."))
          return
        }
        if (raw.version !== PLAN_VERSION) {
          reject(new Error(`Unsupported plan version ${raw.version}.`))
          return
        }
        const { plan } = raw as PlanExport
        if (
          !plan.personalInfo ||
          !plan.retirementGoals ||
          !plan.assumptions ||
          !plan.drawdownConfig ||
          !Array.isArray(plan.accounts)
        ) {
          reject(new Error("Plan file is missing required fields."))
          return
        }
        resolve(raw as PlanExport)
      } catch {
        reject(new Error("Could not parse file — make sure it's a valid JSON plan."))
      }
    }
    reader.onerror = () => reject(new Error("Failed to read file."))
    reader.readAsText(file)
  })
}
