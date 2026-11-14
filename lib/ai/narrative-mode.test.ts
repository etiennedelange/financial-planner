import { describe, expect, it } from "vite-plus/test"
import { DEFAULT_NARRATIVE_MODE, isNarrativeMode, NARRATIVE_MODES } from "./narrative-mode"

describe("narrative mode", () => {
  it("defaults to the mode that needs no key and sends nothing anywhere", () => {
    expect(DEFAULT_NARRATIVE_MODE).toBe("copy")
  })
  it("recognises exactly the two modes", () => {
    expect([...NARRATIVE_MODES].sort()).toEqual(["copy", "key"])
    for (const m of NARRATIVE_MODES) expect(isNarrativeMode(m)).toBe(true)
    for (const bad of ["", "COPY", "local", "cloud", null, undefined, 1, {}]) {
      expect(isNarrativeMode(bad)).toBe(false)
    }
  })
})
