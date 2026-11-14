import { describe, expect, it } from "vite-plus/test"
import {
  caretAfterReformat,
  exceedsHardMax,
  formatNumberValue,
  GROUP_SEPARATOR,
  parseNumberText,
  sameFieldValue,
  sanitizeNumberText,
  stepNumber,
} from "./number-field"

const MONEY = { decimals: 0, group: true }
const AGE = { decimals: 0, group: false }
const RATE = { decimals: 2, group: false }
const g = (s: string) => s.replace(/ /g, GROUP_SEPARATOR)

describe("sanitizeNumberText", () => {
  describe("Critical SA scenarios", () => {
    it("groups rands in thousands as they are typed", () => {
      expect(sanitizeNumberText("600000", MONEY)).toBe(g("600 000"))
      expect(sanitizeNumberText("1000000000000", MONEY)).toBe(g("1 000 000 000 000"))
    })

    it("accepts pasted formatted rands", () => {
      expect(sanitizeNumberText("R 600 000", MONEY)).toBe(g("600 000"))
      expect(sanitizeNumberText("R1,250,000", MONEY)).toBe(g("1 250 000"))
    })

    it("treats a comma as the decimal point for rates", () => {
      expect(sanitizeNumberText("5,5", RATE)).toBe("5.5")
    })
  })

  describe("Edge cases", () => {
    it("returns empty text for empty or non-numeric input", () => {
      expect(sanitizeNumberText("", MONEY)).toBe("")
      expect(sanitizeNumberText("abc", MONEY)).toBe("")
    })

    it("keeps a single zero but strips leading zeros", () => {
      expect(sanitizeNumberText("0", MONEY)).toBe("0")
      expect(sanitizeNumberText("000", MONEY)).toBe("0")
      expect(sanitizeNumberText("007", AGE)).toBe("7")
    })

    it("drops negative signs", () => {
      expect(sanitizeNumberText("-5", AGE)).toBe("5")
    })

    it("cuts integer fields at the first decimal point instead of merging digits", () => {
      expect(sanitizeNumberText("12.5", AGE)).toBe("12")
      expect(sanitizeNumberText("600000.99", MONEY)).toBe(g("600 000"))
    })

    it("keeps one decimal point and limits fraction digits", () => {
      expect(sanitizeNumberText("5.123", RATE)).toBe("5.12")
      expect(sanitizeNumberText("5.1.2", RATE)).toBe("5.12")
      expect(sanitizeNumberText("5.", RATE)).toBe("5.")
    })

    it("restores a leading zero for a bare decimal point", () => {
      expect(sanitizeNumberText(".5", RATE)).toBe("0.5")
      expect(sanitizeNumberText(".", RATE)).toBe("0.")
    })

    it("does not group fields that opt out", () => {
      expect(sanitizeNumberText("123456", AGE)).toBe("123456")
    })
  })
})

describe("parseNumberText", () => {
  it("reads grouped and decimal text", () => {
    expect(parseNumberText(g("600 000"))).toBe(600_000)
    expect(parseNumberText("5.5")).toBe(5.5)
    expect(parseNumberText("0")).toBe(0)
  })

  it("treats an empty or incomplete field as NaN, never 0", () => {
    expect(parseNumberText("")).toBeNaN()
    expect(parseNumberText(".")).toBeNaN()
  })

  it("reads a trailing decimal point as the whole number", () => {
    expect(parseNumberText("5.")).toBe(5)
  })
})

describe("formatNumberValue", () => {
  it("formats stored numbers for display", () => {
    expect(formatNumberValue(600_000, MONEY)).toBe(g("600 000"))
    expect(formatNumberValue(35, AGE)).toBe("35")
    expect(formatNumberValue(5.5, RATE)).toBe("5.5")
    expect(formatNumberValue(0, MONEY)).toBe("0")
  })

  it("rounds float noise and extra precision away", () => {
    expect(formatNumberValue(0.1 + 0.2, RATE)).toBe("0.3")
    expect(formatNumberValue(5.678, RATE)).toBe("5.68")
  })

  it("shows NaN and non-finite values as an empty field", () => {
    expect(formatNumberValue(NaN, MONEY)).toBe("")
    expect(formatNumberValue(Infinity, MONEY)).toBe("")
    expect(formatNumberValue(1e30, MONEY)).toBe("")
  })

  it("round-trips through parse", () => {
    for (const v of [0, 1, 35, 999, 1000, 600_000, 1_000_000_000_000]) {
      expect(parseNumberText(formatNumberValue(v, MONEY))).toBe(v)
    }
    expect(parseNumberText(formatNumberValue(5.55, RATE))).toBe(5.55)
  })
})

describe("sameFieldValue", () => {
  it("treats NaN as equal to NaN so an empty field is not 'externally changed'", () => {
    expect(sameFieldValue(NaN, NaN)).toBe(true)
  })

  it("compares ordinary numbers", () => {
    expect(sameFieldValue(5, 5)).toBe(true)
    expect(sameFieldValue(5, 6)).toBe(false)
    expect(sameFieldValue(NaN, 0)).toBe(false)
  })
})

describe("caretAfterReformat", () => {
  it("keeps the caret after the same digit when grouping adds a separator", () => {
    // "6000|" typed one more 0 at the end -> "60000|" reformats to "60 000|"
    const after = g("60 000")
    expect(caretAfterReformat("60000", 5, after)).toBe(after.length)
  })

  it("keeps the caret in the middle of the number", () => {
    // caret after the first "6" of "600000" stays after the first "6" once grouped
    expect(caretAfterReformat("600000", 1, g("600 000"))).toBe(1)
    // caret after the 4th digit lands after the separator-adjusted position
    expect(caretAfterReformat("600000", 4, g("600 000"))).toBe(5)
  })

  it("places the caret at the start when nothing significant precedes it", () => {
    expect(caretAfterReformat("600000", 0, g("600 000"))).toBe(0)
  })

  it("counts the decimal point as significant", () => {
    expect(caretAfterReformat("5.", 2, "5.")).toBe(2)
  })

  it("falls back to the end when text shrank", () => {
    expect(caretAfterReformat("12345", 5, "12")).toBe(2)
  })
})

describe("stepNumber", () => {
  const ageOpts = { step: 1, min: 18, max: 100 }

  it("steps up and down", () => {
    expect(stepNumber(35, 1, ageOpts)).toBe(36)
    expect(stepNumber(35, -1, ageOpts)).toBe(34)
  })

  it("clamps at the bounds", () => {
    expect(stepNumber(100, 1, ageOpts)).toBe(100)
    expect(stepNumber(18, -1, ageOpts)).toBe(18)
  })

  it("starts an empty field from the minimum", () => {
    expect(stepNumber(NaN, 1, ageOpts)).toBe(19)
    expect(stepNumber(NaN, 1, { step: 1 })).toBe(1)
  })

  it("brings an out-of-range value back inside the bounds", () => {
    expect(stepNumber(150000, 1, ageOpts)).toBe(100)
    expect(stepNumber(2, 1, ageOpts)).toBe(18)
  })

  it("does not accumulate float error", () => {
    let v = 0
    for (let i = 0; i < 10; i++) v = stepNumber(v, 1, { step: 0.1 })
    expect(v).toBe(1)
  })

  it("steps R0 income up and never below zero", () => {
    expect(stepNumber(0, 1, { step: 10_000, min: 0 })).toBe(10_000)
    expect(stepNumber(0, -1, { step: 10_000, min: 0 })).toBe(0)
  })
})

describe("exceedsHardMax", () => {
  it("rejects only values strictly above the ceiling", () => {
    expect(exceedsHardMax(1_000_000_000_001, 1_000_000_000_000)).toBe(true)
    expect(exceedsHardMax(1_000_000_000_000, 1_000_000_000_000)).toBe(false)
  })

  it("never rejects when there is no ceiling or no number yet", () => {
    expect(exceedsHardMax(1e30, undefined)).toBe(false)
    expect(exceedsHardMax(NaN, 100)).toBe(false)
  })
})
