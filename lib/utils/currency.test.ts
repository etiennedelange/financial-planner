import { describe, expect, it } from "vite-plus/test"
import {
  formatCurrency,
  formatCurrencyCompact,
  NO_VALUE,
  toRealValue,
  zarFormatter,
} from "./currency"

/** Intl's en-ZA output uses non-breaking spaces; compare on plain spaces */
const plain = (s: string) => s.replace(/\s/g, " ")

describe("formatCurrency", () => {
  describe("Critical SA scenarios", () => {
    it("formats rands with en-ZA grouping and no decimals by default", () => {
      expect(plain(formatCurrency(1_250_000))).toBe("R 1 250 000")
    })

    it("puts the minus before the R", () => {
      expect(plain(formatCurrency(-1_250_000))).toBe("-R 1 250 000")
    })

    it("deflates to today's rands in real mode, with both call shapes agreeing", () => {
      // R1M in 10 years at 5.5% = R585,431 today
      expect(plain(formatCurrency(1_000_000, "real", 10, 0.055))).toBe("R 585 431")
      expect(
        formatCurrency(1_000_000, { displayMode: "real", yearsFromNow: 10, inflationRate: 0.055 }),
      ).toBe(formatCurrency(1_000_000, "real", 10, 0.055))
    })

    it("nominal mode ignores the years and rate", () => {
      expect(formatCurrency(1_000_000, "nominal", 10, 0.055)).toBe(formatCurrency(1_000_000))
    })
  })

  describe("Decimals and rounding", () => {
    it("honours the decimals option with a comma decimal separator", () => {
      expect(plain(formatCurrency(1234.567, { decimals: 2 }))).toBe("R 1 234,57")
    })

    it("rounds half up at 0 decimals", () => {
      expect(plain(formatCurrency(0.5))).toBe("R 1")
    })

    it("never shows a negative zero", () => {
      // Regression: −0.4 rendered "-R 0"
      expect(plain(formatCurrency(-0.4))).toBe("R 0")
      expect(plain(formatCurrency(-0.004, { decimals: 2 }))).toBe("R 0,00")
      expect(plain(formatCurrency(-0.006, { decimals: 2 }))).toBe("-R 0,01")
    })
  })

  describe("Compact notation", () => {
    it.each([
      [1_500_000_000, "R1.5B"],
      [2_500_000, "R2.5M"],
      [15_000, "R15K"],
      [999, "R 999"],
      [-2_500_000, "-R2.5M"],
      [-15_000, "-R15K"],
    ])("%d → %s", (value, expected) => {
      expect(plain(formatCurrency(value, { compact: true }))).toBe(expected)
    })

    it.each([
      // Regression: rounding at the smaller unit used to reach 1,000 of it
      [999.6, "R1K"],
      [999_600, "R1.0M"],
      [999_960_000, "R1.0B"],
      [999_400, "R999K"],
    ])("rounding at a unit boundary moves up a unit: %d → %s", (value, expected) => {
      expect(formatCurrency(value, { compact: true })).toBe(expected)
    })

    it("deflates before compacting in real mode", () => {
      expect(
        formatCurrency(1e9, {
          compact: true,
          displayMode: "real",
          yearsFromNow: 10,
          inflationRate: 0.055,
        }),
      ).toBe("R585.4M") // R1bn in 10 years at 5.5% = R585.4M today
    })
  })

  describe("Edge cases", () => {
    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
      "shows %d as the no-value dash, never RNaN or R∞",
      (value) => {
        expect(formatCurrency(value)).toBe(NO_VALUE)
        expect(formatCurrency(value, { compact: true })).toBe(NO_VALUE)
      },
    )

    it("zero balance formats as R 0", () => {
      expect(plain(formatCurrency(0))).toBe("R 0")
      expect(plain(formatCurrency(0, { compact: true }))).toBe("R 0")
    })

    it("very large values keep full grouping", () => {
      expect(plain(formatCurrency(1e15))).toBe("R 1 000 000 000 000 000")
    })
  })
})

describe("formatCurrencyCompact", () => {
  describe("Critical SA scenarios", () => {
    it.each([
      [2_500_000, "R2.5M"],
      [15_000, "R15k"],
      [500, "R500"],
    ])("%d → %s", (value, expected) => {
      expect(formatCurrencyCompact(value)).toBe(expected)
    })

    it("deflates in real mode", () => {
      expect(formatCurrencyCompact(1_000_000, "real", 10)).toBe("R585k")
    })
  })

  describe("Edge cases", () => {
    it("compacts negatives with the sign first", () => {
      // Regression: −2.5M rendered "R-2500000"
      expect(formatCurrencyCompact(-2_500_000)).toBe("-R2.5M")
      expect(formatCurrencyCompact(-1500)).toBe("-R2k")
      expect(formatCurrencyCompact(-40)).toBe("-R40")
    })

    it("moves up a unit when rounding reaches 1,000", () => {
      // Regression: R999.60 rendered "R1000"
      expect(formatCurrencyCompact(999.6)).toBe("R1k")
      expect(formatCurrencyCompact(999_600)).toBe("R1.0M")
      expect(formatCurrencyCompact(999_400)).toBe("R999k")
    })

    it("never shows a negative zero", () => {
      expect(formatCurrencyCompact(-0.4)).toBe("R0")
    })

    it("shows the no-value dash for non-finite input", () => {
      expect(formatCurrencyCompact(Number.NaN)).toBe(NO_VALUE)
      expect(formatCurrencyCompact(Number.POSITIVE_INFINITY)).toBe(NO_VALUE)
    })
  })
})

describe("toRealValue", () => {
  it("is unchanged at 0 years, deflates forward and inflates backward", () => {
    expect(toRealValue(1000, 0, 0.055)).toBe(1000)
    expect(toRealValue(1000, 1, 0.055)).toBeCloseTo(1000 / 1.055, 10)
    expect(toRealValue(1000, -1, 0.055)).toBeCloseTo(1055, 10)
  })

  it("0% inflation leaves the value unchanged", () => {
    expect(toRealValue(1000, 30, 0)).toBe(1000)
  })
})

describe("zarFormatter cache", () => {
  it("reuses one formatter per decimals value", () => {
    expect(zarFormatter(0)).toBe(zarFormatter(0))
    expect(zarFormatter(2)).toBe(zarFormatter(2))
    expect(zarFormatter(0)).not.toBe(zarFormatter(2))
  })

  it("keeps output identical across repeated calls and decimals", () => {
    const first = formatCurrency(1234567.891)
    expect(formatCurrency(1234567.891)).toBe(first)
    expect(formatCurrency(1234567.891, { decimals: 2 })).toMatch(/,89$|\.89$/)
    expect(formatCurrency(1234567.891)).toBe(first)
  })
})
