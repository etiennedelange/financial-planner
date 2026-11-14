import { describe, it, expect, beforeEach } from "vite-plus/test"
import { installFailingSetItem } from "@/lib/test-utils/failing-storage"
import { migrateToLocalOnlyStorage, purgeLegacyAuthCookies } from "./storage-migration"

const CALC = "financial-planner-storage"
const EXP = "expenses-store-v2"

describe("migrateToLocalOnlyStorage", () => {
  beforeEach(() => localStorage.clear())

  it("moves :guest data to the plain key", () => {
    localStorage.setItem(`${CALC}:guest`, '{"state":{"a":1},"version":3}')
    localStorage.setItem(`${EXP}:guest`, '{"state":{"b":2},"version":2}')
    const result = migrateToLocalOnlyStorage(localStorage)
    expect(localStorage.getItem(CALC)).toBe('{"state":{"a":1},"version":3}')
    expect(localStorage.getItem(EXP)).toBe('{"state":{"b":2},"version":2}')
    expect(localStorage.getItem(`${CALC}:guest`)).toBeNull()
    expect(localStorage.getItem(`${EXP}:guest`)).toBeNull()
    expect(result.migrated.sort()).toEqual([CALC, EXP].sort())
  })

  it("the :guest copy wins over a stale un-suffixed key (it is the newer one)", () => {
    localStorage.setItem(CALC, '{"stale":true}')
    localStorage.setItem(`${CALC}:guest`, '{"fresh":true}')
    migrateToLocalOnlyStorage(localStorage)
    expect(localStorage.getItem(CALC)).toBe('{"fresh":true}')
  })

  it("leaves an existing plain key alone when there is no :guest copy", () => {
    localStorage.setItem(CALC, '{"keep":true}')
    migrateToLocalOnlyStorage(localStorage)
    expect(localStorage.getItem(CALC)).toBe('{"keep":true}')
  })

  it("purges every account-related key but keeps unrelated ones", () => {
    localStorage.setItem(`${CALC}:user:abc`, "someone's financial data")
    localStorage.setItem(`${EXP}:user:abc`, "someone's expenses")
    localStorage.setItem(`${CALC}:legacy-backup:abc`, "backup")
    localStorage.setItem("rc-pending-claim-scenario-id:abc", "x")
    localStorage.setItem("rc-legacy-ambiguous:financial-planner-storage", "x")
    localStorage.setItem("sb-project-auth-token", "token")
    localStorage.setItem("theme", "dark")
    localStorage.setItem("plan-narrative-model-tier", "fast")
    const result = migrateToLocalOnlyStorage(localStorage)
    expect(result.purged).toHaveLength(6)
    expect(localStorage.getItem("theme")).toBe("dark")
    expect(localStorage.getItem("plan-narrative-model-tier")).toBe("fast")
    expect(localStorage.length).toBe(2)
  })

  it("is idempotent", () => {
    localStorage.setItem(`${CALC}:guest`, "v")
    localStorage.setItem(`${CALC}:user:u`, "x")
    migrateToLocalOnlyStorage(localStorage)
    const second = migrateToLocalOnlyStorage(localStorage)
    expect(second).toEqual({ migrated: [], purged: [] })
    expect(localStorage.getItem(CALC)).toBe("v")
  })

  it("keeps the :guest key (loses nothing) when the new key cannot be written", () => {
    localStorage.setItem(`${CALC}:guest`, "precious")
    const restore = installFailingSetItem(
      new DOMException("full", "QuotaExceededError"),
      (key) => key === CALC,
    )
    try {
      migrateToLocalOnlyStorage(window.localStorage)
      expect(window.localStorage.getItem(`${CALC}:guest`)).toBe("precious")
    } finally {
      restore()
    }
  })
})

describe("purgeLegacyAuthCookies", () => {
  it("expires only sb-* cookies", () => {
    const writes: string[] = []
    const doc = {
      get cookie() {
        return "sb-abc-auth-token=1; theme=dark; sb-abc-auth-token.0=2"
      },
      set cookie(value: string) {
        writes.push(value)
      },
    }
    const purged = purgeLegacyAuthCookies(doc)
    expect(purged).toEqual(["sb-abc-auth-token", "sb-abc-auth-token.0"])
    expect(writes.every((w) => w.includes("Max-Age=0"))).toBe(true)
    expect(writes.some((w) => w.startsWith("theme"))).toBe(false)
  })

  it("does nothing when there are no cookies", () => {
    expect(purgeLegacyAuthCookies({ cookie: "" })).toEqual([])
  })
})
