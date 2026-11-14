import { describe, it, expect, vi, beforeEach } from "vite-plus/test"
import {
  buildBackup,
  exportPlan,
  LAST_BACKUP_KEY,
  parseBackupText,
  parsePlanFile,
  PLAN_VERSION,
  readLastBackupAt,
  type ExpensesData,
  type PlanData,
} from "./plan-io"
import type {
  Account,
  DrawdownConfig,
  MarketAssumptions,
  PersonalInfo,
  RetirementGoals,
} from "@/types"

const personalInfo: PersonalInfo = {
  currentAge: 39,
  retirementAge: 65,
  lifeExpectancy: 90,
  annualIncome: 1200000,
}

const retirementGoals: RetirementGoals = {
  desiredMonthlyIncome: 35000,
  inflationRate: 5.5,
  legacyAmount: 0,
}

const assumptions: MarketAssumptions = {
  equityReturn: 11,
  bondReturn: 8,
  cashReturn: 6.5,
  equityVolatility: 16.5,
  bondVolatility: 6,
  inflationRate: 5.5,
  compoundingMethod: "compound",
}

const drawdownConfig: DrawdownConfig = {
  strategy: "fixed_amount_inflation_adjusted",
  initialWithdrawalRate: 3.5,
  minimumWithdrawal: 15000,
  maximumWithdrawal: 60000,
  lumpSumPercentage: 10,
}

const accounts: Account[] = [
  {
    id: "acc-1",
    name: "My RA",
    provider: "Sanlam",
    type: "retirement_annuity",
    currentBalance: 1750000,
    monthlyContribution: 14500,
    expectedReturn: 11,
    annualFees: 1,
    contributionEscalation: 6,
  },
  {
    id: "acc-2",
    name: "TFSA",
    provider: "EasyEquities",
    type: "tfsa",
    currentBalance: 80000,
    monthlyContribution: 2000,
    expectedReturn: 12,
    annualFees: 1,
    contributionEscalation: 6,
    tfsaContributionsToDate: 80000,
  },
]

const plan: PlanData = {
  personalInfo,
  retirementGoals,
  assumptions,
  drawdownConfig,
  displayMode: "nominal",
  accounts,
}

const expensesData: ExpensesData = {
  groups: [{ id: "g1", name: "Housing", color: "#fca5a5", sortOrder: 0 }],
  expenses: [
    { id: "e1", groupId: "g1", name: "Rent", amount: 12000, inRetirement: true, sortOrder: 0 },
  ],
  monthlyIncome: 56500,
}

function makePlanFile(content: unknown, filename = "plan.json"): File {
  const blob = new Blob([JSON.stringify(content)], { type: "application/json" })
  return new File([blob], filename, { type: "application/json" })
}

describe("exportPlan", () => {
  beforeEach(() => {
    // Mock DOM APIs used by exportPlan
    const anchor = {
      href: "",
      download: "",
      click: vi.fn(),
      style: {},
    } as unknown as HTMLAnchorElement
    vi.spyOn(document, "createElement").mockReturnValue(anchor)
    vi.spyOn(document.body, "appendChild").mockImplementation(() => anchor)
    vi.spyOn(document.body, "removeChild").mockImplementation(() => anchor)
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
  })

  it("triggers a download", () => {
    exportPlan(plan, expensesData)
    expect(document.createElement).toHaveBeenCalledWith("a")
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock")
  })

  it("sets filename with today's date", () => {
    const anchor = { href: "", download: "", click: vi.fn() } as unknown as HTMLAnchorElement
    vi.spyOn(document, "createElement").mockReturnValue(anchor)
    exportPlan(plan, expensesData)
    expect(anchor.download).toMatch(/^retirement-plan-\d{4}-\d{2}-\d{2}\.json$/)
  })
})

describe("parsePlanFile", () => {
  it("parses a valid plan file", async () => {
    const file = makePlanFile({
      version: 1,
      exportedAt: new Date().toISOString(),
      plan: {
        personalInfo,
        retirementGoals,
        assumptions,
        drawdownConfig,
        displayMode: "real",
        accounts,
      },
    })
    const result = await parsePlanFile(file)
    expect(result.plan.personalInfo).toEqual(personalInfo)
    expect(result.plan.accounts).toHaveLength(2)
    expect(result.plan.displayMode).toBe("real")
  })

  it("preserves TFSA contributions to date", async () => {
    const file = makePlanFile({
      version: 1,
      exportedAt: new Date().toISOString(),
      plan: {
        personalInfo,
        retirementGoals,
        assumptions,
        drawdownConfig,
        displayMode: "nominal",
        accounts,
      },
    })
    const result = await parsePlanFile(file)
    const tfsa = result.plan.accounts.find((a) => a.type === "tfsa")
    expect(tfsa?.tfsaContributionsToDate).toBe(80000)
  })

  const planWith = (accs: unknown[]) =>
    makePlanFile({
      version: 1,
      exportedAt: new Date().toISOString(),
      plan: {
        personalInfo,
        retirementGoals,
        assumptions,
        drawdownConfig,
        displayMode: "real",
        accounts: accs,
      },
    })

  it("preserves a valid investment type", async () => {
    const result = await parsePlanFile(planWith([{ ...accounts[0], investmentType: "balanced" }]))
    expect(result.plan.accounts[0].investmentType).toBe("balanced")
  })

  it("imports a file without investment types (older exports) as untyped", async () => {
    const result = await parsePlanFile(planWith(accounts))
    result.plan.accounts.forEach((a) => expect(a.investmentType).toBeUndefined())
  })

  it("drops an unrecognised investment type so the account imports as untyped", async () => {
    const result = await parsePlanFile(planWith([{ ...accounts[0], investmentType: "crypto" }]))
    expect(result.plan.accounts[0].investmentType).toBeUndefined()
    expect(result.plan.accounts[0].name).toBe(accounts[0].name)
  })

  it("rejects a file missing the plan key", async () => {
    const file = makePlanFile({ version: 1 })
    await expect(parsePlanFile(file)).rejects.toThrow("missing version or plan data")
  })

  it("rejects a file missing the version key", async () => {
    const file = makePlanFile({ plan: {} })
    await expect(parsePlanFile(file)).rejects.toThrow("missing version or plan data")
  })

  it("rejects an unsupported version", async () => {
    const file = makePlanFile({ version: 99, plan: {} })
    await expect(parsePlanFile(file)).rejects.toThrow("Unsupported plan version 99")
  })

  it("rejects a plan missing required fields", async () => {
    const file = makePlanFile({
      version: 1,
      plan: { personalInfo, retirementGoals },
    })
    await expect(parsePlanFile(file)).rejects.toThrow("missing required fields")
  })

  it("rejects malformed JSON", async () => {
    const blob = new Blob(["not json {{{"], { type: "application/json" })
    const file = new File([blob], "bad.json")
    await expect(parsePlanFile(file)).rejects.toThrow("Could not parse file")
  })
})

describe("backup v2 (plan + expenses)", () => {
  it("builds a v2 document containing both plan and expenses", () => {
    const doc = buildBackup(plan, expensesData, new Date("2026-11-14T10:00:00Z"))
    expect(doc.version).toBe(PLAN_VERSION)
    expect(PLAN_VERSION).toBe(2)
    expect(doc.exportedAt).toBe("2026-11-14T10:00:00.000Z")
    expect(doc.plan.accounts).toHaveLength(2)
    expect(doc.expenses?.expenses[0].name).toBe("Rent")
  })

  it("round-trips: parse(serialise(build(x))) equals x", () => {
    const text = JSON.stringify(buildBackup(plan, expensesData))
    const parsed = parseBackupText(text)
    expect(parsed.plan.accounts).toEqual(accounts)
    expect(parsed.plan.personalInfo).toEqual(personalInfo)
    expect(parsed.expenses).toEqual(expensesData)
  })

  it("still imports a v1 file, with no expenses section", () => {
    const parsed = parseBackupText(JSON.stringify({ version: 1, plan }))
    expect(parsed.expenses).toBeUndefined()
    expect(parsed.plan.accounts).toHaveLength(2)
  })

  it("rejects a v2 file that lacks its expenses section", () => {
    expect(() => parseBackupText(JSON.stringify({ version: 2, plan }))).toThrow(
      "missing its expenses section",
    )
  })

  it("rejects an unsupported version and non-object JSON", () => {
    expect(() => parseBackupText(JSON.stringify({ version: 3, plan }))).toThrow("Unsupported")
    expect(() => parseBackupText("null")).toThrow("missing version or plan data")
    expect(() => parseBackupText("[1,2,3]")).toThrow("missing version or plan data")
  })

  it("rejects an oversized file before parsing", () => {
    expect(() => parseBackupText("x".repeat(5 * 1024 * 1024 + 1))).toThrow("too large")
  })
})

describe("import sanitising (a hand-edited file must not bypass the input bounds)", () => {
  const TRILLION_PLUS = 5e15

  it("clamps absurd monetary amounts on accounts, goals, income and drawdown", () => {
    const text = JSON.stringify({
      version: 2,
      plan: {
        ...plan,
        personalInfo: { ...personalInfo, annualIncome: TRILLION_PLUS },
        retirementGoals: { ...retirementGoals, desiredMonthlyIncome: TRILLION_PLUS },
        drawdownConfig: { ...drawdownConfig, maximumWithdrawal: TRILLION_PLUS },
        accounts: [{ ...accounts[0], currentBalance: TRILLION_PLUS, monthlyContribution: -5 }],
      },
      expenses: {
        ...expensesData,
        monthlyIncome: TRILLION_PLUS,
        expenses: [{ ...expensesData.expenses[0], amount: TRILLION_PLUS }],
      },
    })
    const parsed = parseBackupText(text)
    const cap = 1e12
    expect(parsed.plan.personalInfo.annualIncome).toBeLessThanOrEqual(cap)
    expect(parsed.plan.retirementGoals.desiredMonthlyIncome).toBeLessThanOrEqual(cap)
    expect(parsed.plan.drawdownConfig.maximumWithdrawal).toBeLessThanOrEqual(cap)
    expect(parsed.plan.accounts[0].currentBalance).toBeLessThanOrEqual(cap)
    expect(parsed.plan.accounts[0].monthlyContribution).toBeGreaterThanOrEqual(0)
    expect(parsed.expenses?.monthlyIncome).toBeLessThanOrEqual(cap)
    expect(parsed.expenses?.expenses[0].amount).toBeLessThanOrEqual(cap)
  })

  it("resets an invalid market-assumption rate instead of importing it", () => {
    const text = JSON.stringify({
      version: 1,
      plan: { ...plan, assumptions: { ...assumptions, equityReturn: null } },
    })
    const parsed = parseBackupText(text)
    expect(Number.isFinite(parsed.plan.assumptions.equityReturn)).toBe(true)
  })

  it("coerces an unknown displayMode to nominal", () => {
    const parsed = parseBackupText(
      JSON.stringify({ version: 1, plan: { ...plan, displayMode: "banana" } }),
    )
    expect(parsed.plan.displayMode).toBe("nominal")
  })
})

describe("backup bookkeeping", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it("has no last-backup date until one is recorded", () => {
    expect(readLastBackupAt()).toBeNull()
  })

  it("records when a backup was downloaded", () => {
    const anchor = { href: "", download: "", click: vi.fn() } as unknown as HTMLAnchorElement
    vi.spyOn(document, "createElement").mockReturnValue(anchor)
    vi.spyOn(document.body, "appendChild").mockImplementation(() => anchor)
    vi.spyOn(document.body, "removeChild").mockImplementation(() => anchor)
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
    exportPlan(plan, expensesData)
    expect(readLastBackupAt()).toBeInstanceOf(Date)
  })

  it("ignores a corrupt stored date", () => {
    window.localStorage.setItem(LAST_BACKUP_KEY, "not-a-date")
    expect(readLastBackupAt()).toBeNull()
  })
})

describe("runtime validation of backup records", () => {
  const withAccounts = (list: unknown[]) =>
    JSON.stringify({ version: 2, plan: { ...plan, accounts: list }, expenses: expensesData })

  it("rejects a null account with a readable message, not a TypeError", () => {
    expect(() => parseBackupText(withAccounts([null]))).toThrow(/invalid account record/)
  })

  it("rejects an account of an unknown type rather than importing it", () => {
    expect(() =>
      parseBackupText(withAccounts([{ ...accounts[0], type: "crypto_wallet" }])),
    ).toThrow(/invalid account record/)
  })

  it("rejects a non-numeric balance", () => {
    expect(() =>
      parseBackupText(withAccounts([{ ...accounts[0], currentBalance: "lots" }])),
    ).toThrow(/invalid account record/)
  })

  it("defaults a missing provider to an empty string", () => {
    const { provider: _provider, ...noProvider } = accounts[0]
    const parsed = parseBackupText(withAccounts([noProvider]))
    expect(parsed.plan.accounts[0].provider).toBe("")
  })

  it("still imports numeric extremes (the clamps, not the schema, bound them)", () => {
    const parsed = parseBackupText(withAccounts([{ ...accounts[0], currentBalance: 5e15 }]))
    expect(parsed.plan.accounts[0].currentBalance).toBeLessThanOrEqual(1e12)
  })

  it("rejects a malformed expense record", () => {
    const text = JSON.stringify({
      version: 2,
      plan,
      expenses: { ...expensesData, expenses: [null] },
    })
    expect(() => parseBackupText(text)).toThrow(/invalid expense or group record/)
  })

  it("rejects a malformed group record", () => {
    const text = JSON.stringify({
      version: 2,
      plan,
      expenses: { ...expensesData, groups: [{ id: "g", name: 1 }] },
    })
    expect(() => parseBackupText(text)).toThrow(/invalid expense or group record/)
  })
})
