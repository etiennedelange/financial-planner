import { describe, it, expect, beforeEach, vi } from "vite-plus/test"
import { installFailingSetItem } from "@/lib/test-utils/failing-storage"
import {
  getStorageHealth,
  probeStorage,
  reportStorageFailure,
  reportStorageSuccess,
  resetStorageHealth,
  subscribeStorageHealth,
} from "./storage-health"

describe("storage health", () => {
  beforeEach(() => resetStorageHealth())

  it("starts ok", () => expect(getStorageHealth()).toBe("ok"))

  it("classifies quota errors (standard and Firefox names, legacy codes)", () => {
    reportStorageFailure(new DOMException("x", "QuotaExceededError"))
    expect(getStorageHealth()).toBe("quota")
    resetStorageHealth()
    reportStorageFailure(new DOMException("x", "NS_ERROR_DOM_QUOTA_REACHED"))
    expect(getStorageHealth()).toBe("quota")
  })

  it("classifies anything else as unavailable (private mode, blocked site data)", () => {
    reportStorageFailure(new DOMException("denied", "SecurityError"))
    expect(getStorageHealth()).toBe("unavailable")
    resetStorageHealth()
    reportStorageFailure(new Error("boom"))
    expect(getStorageHealth()).toBe("unavailable")
  })

  it("recovers after a later successful write, notifying subscribers only on change", () => {
    const listener = vi.fn()
    subscribeStorageHealth(listener)
    reportStorageFailure(new Error("x"))
    reportStorageFailure(new Error("x")) // no change
    reportStorageSuccess()
    reportStorageSuccess() // no change
    expect(listener).toHaveBeenCalledTimes(2)
    expect(getStorageHealth()).toBe("ok")
  })

  it("probeStorage reports ok when storage works and unavailable when it throws", () => {
    expect(probeStorage()).toBe("ok")
    const restore = installFailingSetItem(new DOMException("denied", "SecurityError"))
    expect(probeStorage()).toBe("unavailable")
    restore()
  })

  it("a successful save under one key does not clear another key's failure", () => {
    reportStorageFailure(new DOMException("full", "QuotaExceededError"), "plan")
    reportStorageSuccess("expenses")
    expect(getStorageHealth()).toBe("quota")
    reportStorageSuccess("plan")
    expect(getStorageHealth()).toBe("ok")
  })

  it("reports the worst outstanding failure across keys", () => {
    reportStorageFailure(new DOMException("full", "QuotaExceededError"), "plan")
    reportStorageFailure(new Error("blocked"), "expenses")
    expect(getStorageHealth()).toBe("unavailable")
    reportStorageSuccess("expenses")
    expect(getStorageHealth()).toBe("quota")
  })

  it("unsubscribe stops notifications", () => {
    const listener = vi.fn()
    const off = subscribeStorageHealth(listener)
    off()
    reportStorageFailure(new Error("x"))
    expect(listener).not.toHaveBeenCalled()
  })
})
