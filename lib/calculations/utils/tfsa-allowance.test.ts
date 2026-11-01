import { describe, expect, it } from "vite-plus/test"
import { TFSA_LIMITS_CONFIG } from "@/lib/constants/tax-year.config"
import type { Account } from "@/types"
import { admitTfsaContribution, createTfsaAllowance, startTfsaYear } from "./tfsa-allowance"

const tfsa = (id: string, tfsaContributionsToDate?: number): Account => ({
  id,
  name: `TFSA ${id}`,
  provider: "",
  type: "tfsa",
  currentBalance: 0,
  monthlyContribution: 0,
  expectedReturn: 10,
  annualFees: 0.5,
  contributionEscalation: 0,
  tfsaContributionsToDate,
})

describe("TFSA allowance", () => {
  describe("Critical SA scenarios", () => {
    it("the annual R46,000 limit is shared by every TFSA the taxpayer holds", () => {
      const allowance = createTfsaAllowance([tfsa("a"), tfsa("b")])
      let admitted = 0
      // Two accounts at R4,000/month each for a year = R96,000 intended
      for (let m = 0; m < 12; m++) {
        admitted += admitTfsaContribution(allowance, 4000).admitted
        admitted += admitTfsaContribution(allowance, 4000).admitted
      }
      expect(admitted).toBe(TFSA_LIMITS_CONFIG.annualLimit)
    })

    it("lifetime usage is seeded from every TFSA's contributions to date", () => {
      const allowance = createTfsaAllowance([tfsa("a", 300_000), tfsa("b", 190_000)])
      expect(allowance.lifetimeUsed).toBe(490_000)
      // Only R10,000 of lifetime room remains, below the annual limit
      expect(admitTfsaContribution(allowance, 46_000)).toEqual({ admitted: 10_000, excess: 36_000 })
      startTfsaYear(allowance)
      expect(admitTfsaContribution(allowance, 1000)).toEqual({ admitted: 0, excess: 1000 })
    })

    it("ignores non-TFSA accounts and negative contributions-to-date", () => {
      const ra: Account = { ...tfsa("ra", 999_999), type: "retirement_annuity" }
      expect(createTfsaAllowance([ra, tfsa("t", -5000)]).lifetimeUsed).toBe(0)
    })
  })

  describe("Edge cases", () => {
    it("the annual counter resets each year; the lifetime counter does not", () => {
      const allowance = createTfsaAllowance([tfsa("a")])
      expect(admitTfsaContribution(allowance, 50_000).admitted).toBe(46_000)
      startTfsaYear(allowance)
      expect(admitTfsaContribution(allowance, 50_000).admitted).toBe(46_000)
      expect(allowance.lifetimeUsed).toBe(92_000)
    })

    it("R0 and negative contributions admit nothing and report no excess", () => {
      const allowance = createTfsaAllowance([tfsa("a")])
      expect(admitTfsaContribution(allowance, 0)).toEqual({ admitted: 0, excess: 0 })
      expect(admitTfsaContribution(allowance, -100)).toEqual({ admitted: 0, excess: 0 })
    })

    it("limits are nominal and never indexed: the R500,000 lifetime cap binds in year 11", () => {
      const allowance = createTfsaAllowance([tfsa("a")])
      const admittedByYear: number[] = []
      for (let year = 0; year < 30; year++) {
        startTfsaYear(allowance)
        admittedByYear.push(admitTfsaContribution(allowance, 100_000).admitted)
      }
      expect(admittedByYear[0]).toBe(46_000)
      expect(admittedByYear[9]).toBe(46_000)
      expect(admittedByYear[10]).toBe(40_000) // 500,000 − 10 × 46,000
      expect(admittedByYear.slice(11).every((a) => a === 0)).toBe(true)
      expect(allowance.lifetimeUsed).toBe(TFSA_LIMITS_CONFIG.lifetimeLimit)
    })
  })
})
