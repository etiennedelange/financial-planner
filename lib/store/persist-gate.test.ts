import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test"
import { createGatedPersistStorage } from "./persist-gate"
import { getStorageHealth, resetStorageHealth } from "./storage-health"

// A fake localStorage whose writes can be made to fail per key, so each test controls
// exactly which store's save hits the quota.
function fakeStorage(failingKeys: () => ReadonlySet<string>) {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => {
      if (failingKeys().has(key)) throw new DOMException("full", "QuotaExceededError")
      data.set(key, value)
    },
  }
}

describe("createGatedPersistStorage — per-key storage health", () => {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage")
  let failing = new Set<string>()

  beforeEach(() => {
    resetStorageHealth()
    failing = new Set()
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: fakeStorage(() => failing),
    })
  })
  afterEach(() => {
    if (original) Object.defineProperty(window, "localStorage", original)
  })

  it("keeps the plan's quota failure visible when a smaller expenses save succeeds", () => {
    // The plan is too big for the quota; the expenses store is small and still fits.
    failing = new Set(["plan-key"])
    const plan = createGatedPersistStorage<unknown>()!
    const expenses = createGatedPersistStorage<unknown>()!
    plan.release()
    expenses.release()

    plan.setItem("plan-key", { state: {}, version: 4 })
    expenses.setItem("expenses-key", { state: {}, version: 2 })

    expect(getStorageHealth()).toBe("quota")
  })

  it("clears the failure once the SAME key saves successfully", () => {
    failing = new Set(["plan-key"])
    const plan = createGatedPersistStorage<unknown>()!
    plan.release()

    plan.setItem("plan-key", { state: {}, version: 4 })
    expect(getStorageHealth()).toBe("quota")

    failing = new Set()
    plan.setItem("plan-key", { state: {}, version: 4 })
    expect(getStorageHealth()).toBe("ok")
  })

  it("drops writes until released, so pre-hydration defaults never reach storage", () => {
    const plan = createGatedPersistStorage<unknown>()!
    plan.setItem("plan-key", { state: { x: 1 }, version: 4 })
    expect(window.localStorage.getItem("plan-key")).toBeNull()
  })
})
