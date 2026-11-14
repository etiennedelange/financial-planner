import { z } from "zod"
import type {
  Account,
  AccountType,
  DrawdownConfig,
  MarketAssumptions,
  PersonalInfo,
  RetirementGoals,
} from "@/types"
import type { Expense, ExpenseGroup } from "@/types/expenses"
import { ACCOUNT_TYPE_LABELS, isInvestmentType } from "@/types"
import { sanitizePlan } from "@/lib/store/calculator-store"
import { sanitizeExpenses } from "@/lib/store/expenses-store"

// v1: plan only. v2: plan + expenses. With no server copy this file is the user's
// ONLY backup, so it must cover everything they entered. v1 files still import.
export const PLAN_VERSION = 2
const SUPPORTED_VERSIONS = [1, 2]

/** Largest backup we will even try to parse — a real one is a few KB. */
const MAX_BACKUP_BYTES = 5 * 1024 * 1024

export const LAST_BACKUP_KEY = "rc-last-backup-at"

export interface PlanData {
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  assumptions: MarketAssumptions
  drawdownConfig: DrawdownConfig
  displayMode: "nominal" | "real"
  accounts: Account[]
}

export interface ExpensesData {
  groups: ExpenseGroup[]
  expenses: Expense[]
  monthlyIncome: number
}

export interface PlanExport {
  version: number
  exportedAt: string
  plan: PlanData
  /** Absent in v1 files. */
  expenses?: ExpensesData
}

/** Pure: assembles the backup document. */
export function buildBackup(plan: PlanData, expenses: ExpensesData, now = new Date()): PlanExport {
  return { version: PLAN_VERSION, exportedAt: now.toISOString(), plan, expenses }
}

// Runtime shape of every record in an untrusted backup. Field presence and types are
// checked here so a malformed record fails with a clear message instead of a TypeError
// (a `null` account) or an impossible value entering the store. Numeric RANGES are not
// checked here: sanitizePlan / sanitizeExpenses clamp them, as they do for persisted data.
const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as [AccountType, ...AccountType[]]
const accountRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string().default(""),
  type: z.enum(ACCOUNT_TYPES),
  currentBalance: z.number().finite(),
  monthlyContribution: z.number().finite(),
  expectedReturn: z.number().finite(),
  annualFees: z.number().finite(),
  contributionEscalation: z.number().finite(),
  tfsaContributionsToDate: z.number().finite().nullish(),
  // Checked leniently below: an unrecognised value imports as untyped, not as an error.
  investmentType: z.unknown().optional(),
})
const groupRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  sortOrder: z.number().finite(),
})
const expenseRecordSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  name: z.string(),
  amount: z.number().finite(),
  inRetirement: z.boolean(),
  sortOrder: z.number().finite(),
})

/**
 * Pure: parses and SANITISES backup text. Throws a user-facing Error on bad input.
 * Imported numbers go through the same clamps as persisted data (sanitizePlan /
 * sanitizeExpenses) — a hand-edited file must not be able to smuggle in values the
 * input forms would reject.
 */
export function parseBackupText(text: string): PlanExport {
  if (text.length > MAX_BACKUP_BYTES) throw new Error("That file is too large to be a plan backup.")
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error("Could not parse file — make sure it's a valid JSON plan.")
  }
  const doc = raw as Partial<PlanExport> | null
  if (!doc?.version || !doc?.plan) {
    throw new Error("Invalid plan file — missing version or plan data.")
  }
  if (!SUPPORTED_VERSIONS.includes(doc.version)) {
    throw new Error(`Unsupported plan version ${doc.version}.`)
  }
  const plan = doc.plan as Partial<PlanData>
  if (
    !plan.personalInfo ||
    !plan.retirementGoals ||
    !plan.assumptions ||
    !plan.drawdownConfig ||
    !Array.isArray(plan.accounts)
  ) {
    throw new Error("Plan file is missing required fields.")
  }

  const accountRecords = z.array(accountRecordSchema).safeParse(plan.accounts)
  if (!accountRecords.success) {
    throw new Error("Plan file has an invalid account record — check each account's fields.")
  }
  // investmentType is optional (older files lack it); an unrecognised value is
  // dropped so the account imports as untyped rather than carrying a bad string
  const accounts = accountRecords.data.map((acc) =>
    acc.investmentType === undefined || isInvestmentType(acc.investmentType)
      ? acc
      : { ...acc, investmentType: undefined },
  ) as Account[]
  const cleaned = sanitizePlan({ ...plan, accounts } as PlanData)

  const result: PlanExport = {
    version: doc.version,
    exportedAt: doc.exportedAt ?? new Date().toISOString(),
    plan: { ...cleaned, displayMode: plan.displayMode === "real" ? "real" : "nominal" },
  }

  if (doc.version >= 2) {
    const exp = doc.expenses
    if (!exp || !Array.isArray(exp.groups) || !Array.isArray(exp.expenses)) {
      throw new Error("Backup is missing its expenses section.")
    }
    const groups = z.array(groupRecordSchema).safeParse(exp.groups)
    const expenses = z.array(expenseRecordSchema).safeParse(exp.expenses)
    if (!groups.success || !expenses.success) {
      throw new Error("Backup has an invalid expense or group record — check each entry.")
    }
    result.expenses = sanitizeExpenses({
      groups: groups.data as ExpenseGroup[],
      expenses: expenses.data as Expense[],
      monthlyIncome: exp.monthlyIncome,
    }) as ExpensesData
  }
  return result
}

function download(filename: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Downloads a full backup (plan + expenses) and records when, for the backup nudge. */
export function exportPlan(plan: PlanData, expenses: ExpensesData): void {
  const now = new Date()
  const payload = buildBackup(plan, expenses, now)
  download(
    `retirement-plan-${now.toISOString().split("T")[0]}.json`,
    JSON.stringify(payload, null, 2),
  )
  try {
    window.localStorage.setItem(LAST_BACKUP_KEY, now.toISOString())
  } catch {
    // Non-essential — the nudge just keeps showing.
  }
}

export function readLastBackupAt(): Date | null {
  try {
    const value = window.localStorage.getItem(LAST_BACKUP_KEY)
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

export function parsePlanFile(file: File): Promise<PlanExport> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_BACKUP_BYTES) {
      reject(new Error("That file is too large to be a plan backup."))
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const result = e.target?.result
        resolve(parseBackupText(typeof result === "string" ? result : ""))
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(new Error("Failed to read file."))
    reader.readAsText(file)
  })
}
