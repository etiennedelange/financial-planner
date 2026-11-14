import { describe, expect, it, vi } from "vite-plus/test"
import { copyText } from "./copy"

describe("copyText", () => {
  describe("Critical scenarios", () => {
    it("writes the text and reports copied", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      await expect(copyText("abc", { writeText })).resolves.toBe("copied")
      expect(writeText).toHaveBeenCalledWith("abc")
    })

    it("reports failed, rather than throwing or staying silent, when the clipboard rejects", async () => {
      const writeText = vi.fn().mockRejectedValue(new Error("NotAllowedError"))
      await expect(copyText("abc", { writeText })).resolves.toBe("failed")
    })
  })

  describe("Edge cases", () => {
    it("reports failed when no clipboard API exists", async () => {
      // @ts-expect-error — a missing clipboard is the case under test; the type requires one
      await expect(copyText("abc", null)).resolves.toBe("failed")
    })

    it("copies an empty string without treating it as a failure", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      await expect(copyText("", { writeText })).resolves.toBe("copied")
    })
  })
})
