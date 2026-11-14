import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test"
import { installFailingSetItem } from "@/lib/test-utils/failing-storage"
import {
  __resetVaultForTests,
  forget,
  forgetAll,
  getKey,
  getStatus,
  IDLE_LOCK_MS,
  lock,
  lockAll,
  MIN_PASSPHRASE_LENGTH,
  PBKDF2_ITERATIONS,
  saveEncrypted,
  saveSessionOnly,
  subscribeVault,
  unlock,
  validateApiKey,
  VAULT_PREFIX,
  VaultError,
} from "./key-vault"

const KEY = "sk-ant-api03-SECRET-KEY-VALUE-1234567890"
const PASS = "correct horse battery staple"

function expectVaultError(error: unknown, code: string) {
  expect(error).toBeInstanceOf(VaultError)
  expect((error as VaultError).code).toBe(code)
}

describe("key vault", () => {
  beforeEach(() => {
    localStorage.clear()
    __resetVaultForTests()
  })
  afterEach(() => vi.useRealTimers())

  describe("validateApiKey", () => {
    it("trims and accepts printable ASCII", () => {
      expect(validateApiKey(`  ${KEY}\n`)).toBe(KEY)
    })
    it.each([
      ["too short", "abc"],
      ["empty", ""],
      ["contains whitespace", "sk-abc def-ghi-jkl"],
      ["contains a newline (header injection)", "sk-abcdef\nX-Evil: 1"],
      ["contains non-ASCII", "sk-abcdéfgh"],
      ["absurdly long", "k".repeat(513)],
    ])("rejects a key that is %s", (_label, value) => {
      expect(() => validateApiKey(value)).toThrow(VaultError)
    })
  })

  describe("session-only mode", () => {
    it("keeps the key in memory and writes NOTHING to storage", () => {
      saveSessionOnly("anthropic", KEY)
      expect(getStatus("anthropic")).toBe("session")
      expect(getKey("anthropic")).toBe(KEY)
      expect(localStorage.length).toBe(0)
      expect(sessionStorage.length).toBe(0)
    })

    it("replacing a remembered key with a session key removes the encrypted blob", async () => {
      await saveEncrypted("anthropic", KEY, PASS)
      saveSessionOnly("anthropic", "sk-another-key-value-9999")
      expect(localStorage.getItem(`${VAULT_PREFIX}anthropic`)).toBeNull()
      expect(getStatus("anthropic")).toBe("session")
    })

    it("rejects an invalid key without storing anything", () => {
      expect(() => saveSessionOnly("openai", "bad")).toThrow(VaultError)
      expect(getStatus("openai")).toBe("none")
    })
  })

  describe("remembered (encrypted) mode", () => {
    it("never stores the key or passphrase in plaintext", async () => {
      await saveEncrypted("anthropic", KEY, PASS)
      const stored = localStorage.getItem(`${VAULT_PREFIX}anthropic`)!
      expect(stored).not.toContain(KEY)
      expect(stored).not.toContain("SECRET-KEY")
      expect(stored).not.toContain(PASS)
      // Nothing else in storage leaks it either.
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!
        expect(`${k}=${localStorage.getItem(k)}`).not.toContain("SECRET-KEY")
      }
    })

    it("stores a well-formed blob with a strong KDF", async () => {
      await saveEncrypted("openai", KEY, PASS)
      const blob = JSON.parse(localStorage.getItem(`${VAULT_PREFIX}openai`)!)
      expect(blob).toMatchObject({
        v: 1,
        provider: "openai",
        kdf: { name: "PBKDF2", hash: "SHA-256", iterations: PBKDF2_ITERATIONS },
      })
      expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000)
      expect(atob(blob.salt)).toHaveLength(16)
      expect(atob(blob.iv)).toHaveLength(12)
    })

    it("uses a fresh salt and IV every time (never reuses an IV under one key)", async () => {
      await saveEncrypted("anthropic", KEY, PASS)
      const a = JSON.parse(localStorage.getItem(`${VAULT_PREFIX}anthropic`)!)
      await saveEncrypted("anthropic", KEY, PASS)
      const b = JSON.parse(localStorage.getItem(`${VAULT_PREFIX}anthropic`)!)
      expect(a.salt).not.toBe(b.salt)
      expect(a.iv).not.toBe(b.iv)
      expect(a.ct).not.toBe(b.ct)
    })

    it("round-trips: lock, then unlock with the passphrase restores the key", async () => {
      await saveEncrypted("anthropic", KEY, PASS)
      expect(getStatus("anthropic")).toBe("unlocked")
      lock("anthropic")
      expect(getStatus("anthropic")).toBe("locked")
      expect(getKey("anthropic")).toBeNull()
      await unlock("anthropic", PASS)
      expect(getKey("anthropic")).toBe(KEY)
      expect(getStatus("anthropic")).toBe("unlocked")
    })

    it("rejects a weak passphrase and writes nothing", async () => {
      const short = "x".repeat(MIN_PASSPHRASE_LENGTH - 1)
      await expect(saveEncrypted("anthropic", KEY, short)).rejects.toMatchObject({
        code: "weak-passphrase",
      })
      expect(localStorage.length).toBe(0)
      expect(getStatus("anthropic")).toBe("none")
    })

    it("a wrong passphrase fails generically and leaves the vault locked", async () => {
      await saveEncrypted("anthropic", KEY, PASS)
      lock("anthropic")
      const error = await unlock("anthropic", "totally wrong passphrase").catch((e) => e)
      expectVaultError(error, "wrong-passphrase")
      expect((error as Error).message).not.toContain(KEY)
      expect(getStatus("anthropic")).toBe("locked")
      expect(getKey("anthropic")).toBeNull()
    })

    it.each(["ct", "iv", "salt"] as const)(
      "a tampered %s is indistinguishable from a wrong passphrase",
      async (field) => {
        await saveEncrypted("anthropic", KEY, PASS)
        lock("anthropic")
        const name = `${VAULT_PREFIX}anthropic`
        const blob = JSON.parse(localStorage.getItem(name)!)
        const bytes = atob(blob[field]).split("")
        bytes[0] = String.fromCharCode(bytes[0].charCodeAt(0) ^ 0xff)
        blob[field] = btoa(bytes.join(""))
        localStorage.setItem(name, JSON.stringify(blob))
        const error = await unlock("anthropic", PASS).catch((e) => e)
        expectVaultError(error, "wrong-passphrase")
      },
    )

    it("binds the ciphertext to its provider: a blob moved to another provider will not decrypt", async () => {
      await saveEncrypted("anthropic", KEY, PASS)
      const blob = JSON.parse(localStorage.getItem(`${VAULT_PREFIX}anthropic`)!)
      localStorage.setItem(`${VAULT_PREFIX}openai`, JSON.stringify({ ...blob, provider: "openai" }))
      const error = await unlock("openai", PASS).catch((e) => e)
      expectVaultError(error, "wrong-passphrase")
      expect(getKey("openai")).toBeNull()
    })

    it("ignores a blob with a hostile iteration count (DoS / weak KDF)", async () => {
      await saveEncrypted("anthropic", KEY, PASS)
      lock("anthropic")
      for (const iterations of [1, 2_000_000_000]) {
        const name = `${VAULT_PREFIX}anthropic`
        const blob = JSON.parse(localStorage.getItem(name)!)
        localStorage.setItem(name, JSON.stringify({ ...blob, kdf: { ...blob.kdf, iterations } }))
        const error = await unlock("anthropic", PASS).catch((e) => e)
        expectVaultError(error, "no-stored-key")
      }
    })

    it("treats a corrupt or foreign blob as absent", async () => {
      localStorage.setItem(`${VAULT_PREFIX}anthropic`, "not json")
      expect(getStatus("anthropic")).toBe("none")
      localStorage.setItem(`${VAULT_PREFIX}anthropic`, JSON.stringify({ v: 2 }))
      expect(getStatus("anthropic")).toBe("none")
      const error = await unlock("anthropic", PASS).catch((e) => e)
      expectVaultError(error, "no-stored-key")
    })

    it("reports storage-unavailable when the blob cannot be written, and keeps nothing", async () => {
      const restore = installFailingSetItem(new DOMException("full", "QuotaExceededError"))
      const error = await saveEncrypted("anthropic", KEY, PASS).catch((e) => e)
      restore()
      expectVaultError(error, "storage-unavailable")
      expect(getKey("anthropic")).toBeNull()
    })
  })

  describe("locking and forgetting", () => {
    it("lock() keeps the encrypted blob; forget() removes it", async () => {
      await saveEncrypted("anthropic", KEY, PASS)
      lock("anthropic")
      expect(localStorage.getItem(`${VAULT_PREFIX}anthropic`)).not.toBeNull()
      forget("anthropic")
      expect(localStorage.getItem(`${VAULT_PREFIX}anthropic`)).toBeNull()
      expect(getStatus("anthropic")).toBe("none")
    })

    it("forgetAll() wipes every provider; lockAll() only drops memory", async () => {
      await saveEncrypted("anthropic", KEY, PASS)
      saveSessionOnly("gemini", "AIza-some-session-key-123")
      lockAll()
      expect(getKey("anthropic")).toBeNull()
      expect(getKey("gemini")).toBeNull()
      expect(getStatus("anthropic")).toBe("locked")
      forgetAll()
      expect(getStatus("anthropic")).toBe("none")
      expect(localStorage.length).toBe(0)
    })

    it("a remembered key re-locks after the idle timeout; a session-only key does not", async () => {
      await saveEncrypted("anthropic", KEY, PASS)
      saveSessionOnly("openai", "sk-session-only-key-123456")
      vi.useFakeTimers()
      // Arm the timer under fake timers.
      expect(getKey("anthropic")).toBe(KEY)
      vi.advanceTimersByTime(IDLE_LOCK_MS + 1)
      expect(getKey("anthropic")).toBeNull()
      expect(getStatus("anthropic")).toBe("locked")
      expect(getKey("openai")).toBe("sk-session-only-key-123456")
    })

    it("using the key resets the idle timer", async () => {
      await saveEncrypted("anthropic", KEY, PASS)
      vi.useFakeTimers()
      getKey("anthropic")
      vi.advanceTimersByTime(IDLE_LOCK_MS - 1000)
      expect(getKey("anthropic")).toBe(KEY) // activity re-arms the timer
      vi.advanceTimersByTime(IDLE_LOCK_MS - 1000)
      expect(getKey("anthropic")).toBe(KEY)
    })

    it("locks when the page is restored from the back/forward cache", async () => {
      await saveEncrypted("anthropic", KEY, PASS)
      const off = subscribeVault(() => {})
      const event = new Event("pagehide") as PageTransitionEvent
      Object.defineProperty(event, "persisted", { value: true })
      window.dispatchEvent(event)
      expect(getKey("anthropic")).toBeNull()
      off()
    })

    it("a normal pagehide (tab closing) does not need to do anything", async () => {
      await saveEncrypted("anthropic", KEY, PASS)
      const off = subscribeVault(() => {})
      const event = new Event("pagehide") as PageTransitionEvent
      Object.defineProperty(event, "persisted", { value: false })
      window.dispatchEvent(event)
      expect(getKey("anthropic")).toBe(KEY)
      off()
    })
  })

  describe("subscriptions", () => {
    it("notifies listeners when status changes, and stops after unsubscribe", () => {
      const listener = vi.fn()
      const off = subscribeVault(listener)
      saveSessionOnly("anthropic", KEY)
      forget("anthropic")
      expect(listener).toHaveBeenCalledTimes(2)
      off()
      saveSessionOnly("anthropic", KEY)
      expect(listener).toHaveBeenCalledTimes(2)
    })
  })

  describe("unsupported environments", () => {
    it("explains that encrypted storage needs a secure context but session-only still works", async () => {
      const original = Object.getOwnPropertyDescriptor(globalThis, "crypto")!
      Object.defineProperty(globalThis, "crypto", {
        value: { getRandomValues: crypto.getRandomValues.bind(crypto) },
        configurable: true,
      })
      try {
        const error = await saveEncrypted("anthropic", KEY, PASS).catch((e) => e)
        expectVaultError(error, "unsupported")
        expect(() => saveSessionOnly("anthropic", KEY)).not.toThrow()
      } finally {
        Object.defineProperty(globalThis, "crypto", original)
      }
    })
  })
})
