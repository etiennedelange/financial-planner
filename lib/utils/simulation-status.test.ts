import { describe, expect, it } from "vite-plus/test"
import { noRangeCaption } from "./simulation-status"

describe("noRangeCaption", () => {
  describe("Critical scenarios", () => {
    it("says the simulation failed when the worker errored and nothing is running", () => {
      expect(noRangeCaption(false, true)).toMatch(/failed/i)
    })
    it("never reports a failure as 'Waiting for simulation'", () => {
      expect(noRangeCaption(false, true)).not.toMatch(/waiting/i)
    })
  })

  describe("Edge cases", () => {
    it("shows progress while a run is in flight, even if an earlier one errored", () => {
      expect(noRangeCaption(true, true)).toBe("Simulating…")
      expect(noRangeCaption(true, false)).toBe("Simulating…")
    })
    it("waits quietly when nothing has run and nothing failed", () => {
      expect(noRangeCaption(false, false)).toBe("Waiting for simulation")
    })
  })
})
