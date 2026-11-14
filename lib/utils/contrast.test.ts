import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vite-plus/test"
import {
  blend,
  contrastRatio,
  hslTripletToRgb,
  parseTokenBlock,
  relativeLuminance,
} from "./contrast"

// Tests run from the project root (`npm run test`), so resolve from there.
const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8")
const themes = {
  light: parseTokenBlock(css, ":root"),
  dark: parseTokenBlock(css, ".dark"),
}

const rgb = (token: string, theme: Record<string, string>) => {
  const value = theme[token]
  if (!value) throw new Error(`Missing token --${token}`)
  return hslTripletToRgb(value)
}

describe("contrast helpers", () => {
  describe("hslTripletToRgb", () => {
    it("converts pure white and black", () => {
      expect(hslTripletToRgb("0 0% 100%")).toEqual([1, 1, 1])
      expect(hslTripletToRgb("0 0% 0%")).toEqual([0, 0, 0])
    })

    it("converts a saturated primary (red, green, blue)", () => {
      const [r, g, b] = hslTripletToRgb("0 100% 50%")
      expect(r).toBeCloseTo(1)
      expect(g).toBeCloseTo(0)
      expect(b).toBeCloseTo(0)
    })

    it("rejects malformed triplets", () => {
      expect(() => hslTripletToRgb("162 70%")).toThrow()
      expect(() => hslTripletToRgb("a b c")).toThrow()
    })
  })

  describe("contrastRatio", () => {
    it("gives 21:1 for black on white and 1:1 for identical colours", () => {
      expect(contrastRatio([0, 0, 0], [1, 1, 1])).toBeCloseTo(21, 1)
      expect(contrastRatio([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])).toBeCloseTo(1, 5)
    })

    it("is symmetric", () => {
      const a = hslTripletToRgb("162 70% 30%")
      const b = hslTripletToRgb("210 25% 98%")
      expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10)
    })
  })

  describe("relativeLuminance", () => {
    it("is 0 for black and 1 for white", () => {
      expect(relativeLuminance([0, 0, 0])).toBe(0)
      expect(relativeLuminance([1, 1, 1])).toBeCloseTo(1, 5)
    })
  })

  describe("blend", () => {
    it("returns the bottom colour at alpha 0 and the top at alpha 1", () => {
      const top: [number, number, number] = [1, 0, 0]
      const bottom: [number, number, number] = [0, 0, 1]
      expect(blend(top, bottom, 0)).toEqual([0, 0, 1])
      expect(blend(top, bottom, 1)).toEqual([1, 0, 0])
    })
  })

  describe("parseTokenBlock", () => {
    it("reads the :root and .dark token blocks", () => {
      expect(themes.light.primary).toBe("162 70% 30%")
      expect(themes.dark.primary).toBe("162 70% 55%")
    })

    it("throws when the selector is missing", () => {
      expect(() => parseTokenBlock(css, ".no-such-theme")).toThrow()
    })
  })
})

/**
 * Text tokens must reach WCAG AA (4.5:1) on every surface they are rendered on.
 * Each pair is "text on surface"; `.dark` is checked the same way.
 */
const TEXT_PAIRS: Array<[string, string]> = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["primary", "background"],
  ["primary", "card"],
  ["destructive", "background"],
  ["destructive", "card"],
  ["warning", "background"],
  ["warning", "card"],
  ["success", "background"],
  ["success", "card"],
  ["primary-foreground", "primary"],
  ["destructive-foreground", "destructive"],
  ["warning-foreground", "warning"],
  ["success-foreground", "success"],
]

/**
 * Non-text UI boundaries (WCAG 1.4.11): an input's edge must reach 3:1 against the
 * surface it sits on, or a field is invisible to people with low vision.
 */
const BOUNDARY_PAIRS: Array<[string, string]> = [
  ["input", "background"],
  ["input", "card"],
]

describe("theme token contrast (app/globals.css)", () => {
  for (const themeName of ["light", "dark"] as const) {
    describe(`${themeName} theme`, () => {
      const theme = themes[themeName]

      for (const [fg, bg] of TEXT_PAIRS) {
        it(`--${fg} on --${bg} reaches 4.5:1`, () => {
          const ratio = contrastRatio(rgb(fg, theme), rgb(bg, theme))
          expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
        })
      }

      for (const [fg, bg] of BOUNDARY_PAIRS) {
        it(`--${fg} boundary on --${bg} reaches 3:1`, () => {
          const ratio = contrastRatio(rgb(fg, theme), rgb(bg, theme))
          expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
        })
      }

      // Tinted status panels (`bg-warning/10 text-warning`, `bg-success/10 text-success`)
      // render the text over a 10% wash of the status colour, which is paler than the
      // token itself, so the wash must be checked as its own surface.
      for (const status of ["warning", "success"] as const) {
        for (const surface of ["background", "card"] as const) {
          it(`text-${status} on bg-${status}/10 over --${surface} reaches 4.5:1`, () => {
            const wash = blend(rgb(status, theme), rgb(surface, theme), 0.1)
            const ratio = contrastRatio(rgb(status, theme), wash)
            expect(ratio, `${status} tint = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
          })
        }
      }
    })
  }
})
