import { describe, it, expect, beforeEach } from "vitest"
import { createGatedPersistStorage } from "./persist-gate"
import { setScope } from "./persistence-scope"

const KEY = "gate-test-key"

describe("createGatedPersistStorage", () => {
  beforeEach(() => {
    localStorage.clear()
    setScope({ kind: "guest" })
  })

  it("drops writes until released so pre-hydration state can never clobber persisted data", () => {
    const storage = createGatedPersistStorage<{ n: number }>()!
    storage.setItem(KEY, { state: { n: 1 }, version: 2 })
    expect(localStorage.getItem(KEY)).toBeNull()

    storage.release()
    storage.setItem(KEY, { state: { n: 2 }, version: 2 })
    expect(JSON.parse(localStorage.getItem(`${KEY}:guest`)!)).toEqual({ state: { n: 2 }, version: 2 })
  })

  it("reads persisted values regardless of gate state", () => {
    localStorage.setItem(`${KEY}:guest`, JSON.stringify({ state: { n: 9 }, version: 2 }))
    const storage = createGatedPersistStorage<{ n: number }>()!
    expect(storage.getItem(KEY)).toEqual({ state: { n: 9 }, version: 2 })
  })

  it("supports removeItem", () => {
    localStorage.setItem(`${KEY}:guest`, JSON.stringify({ state: { n: 9 }, version: 2 }))
    const storage = createGatedPersistStorage<{ n: number }>()!
    storage.removeItem(KEY)
    expect(localStorage.getItem(`${KEY}:guest`)).toBeNull()
  })

  it("writes to the user-scoped key when the active scope is a user", () => {
    setScope({ kind: "user", userId: "user-a" })
    const storage = createGatedPersistStorage<{ n: number }>()!
    storage.release()
    storage.setItem(KEY, { state: { n: 3 }, version: 2 })

    expect(localStorage.getItem(`${KEY}:user:user-a`)).not.toBeNull()
    expect(localStorage.getItem(`${KEY}:guest`)).toBeNull()
  })

  it("re-closes the gate when the scope switches, then opens it after re-release", () => {
    const storage = createGatedPersistStorage<{ n: number }>()!
    storage.release()
    storage.setItem(KEY, { state: { n: 1 }, version: 2 })
    expect(localStorage.getItem(`${KEY}:guest`)).not.toBeNull()

    // The coordinator switches scope before the user-scoped rehydrate; a write
    // in that window must be dropped (guest state leaking into the user key is
    // exactly the pre-hydration clobber bug, reintroduced by two-phase hydration).
    setScope({ kind: "user", userId: "user-a" })
    storage.setItem(KEY, { state: { n: 2 }, version: 2 })
    expect(localStorage.getItem(`${KEY}:user:user-a`)).toBeNull()

    // Only after this scope's own rehydrate settles (release) may writes land.
    storage.release()
    storage.setItem(KEY, { state: { n: 3 }, version: 2 })
    expect(localStorage.getItem(`${KEY}:user:user-a`)).not.toBeNull()
  })

  it("returns undefined when localStorage is unavailable (SSR fallback)", () => {
    const original = window.localStorage
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("no localStorage")
      },
    })
    try {
      expect(createGatedPersistStorage<{ n: number }>()).toBeUndefined()
    } finally {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: original,
      })
    }
  })
})
