// Mechanical guards for the two promises this app makes:
//   1. There is no account system / cloud database any more.
//   2. The user's API key stays inside lib/ai/key-vault.ts and the narrow set of
//      callers that need it — it can never ride along in persisted state, exports,
//      or the stores. A refactor that breaks either should fail here, loudly.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { beforeEach, describe, expect, it } from "vite-plus/test"
import { __resetVaultForTests, saveEncrypted, saveSessionOnly } from "./key-vault"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useExpensesStore } from "@/lib/store/expenses-store"
import { buildBackup } from "@/lib/utils/plan-io"

const ROOT = join(__dirname, "..", "..")
const SOURCE_DIRS = ["app", "components", "lib"]

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

const files = SOURCE_DIRS.flatMap((d) => sourceFiles(join(ROOT, d))).map((f) => ({
  path: relative(ROOT, f),
  text: readFileSync(f, "utf8"),
}))

describe("no accounts, no cloud database", () => {
  it("nothing imports Supabase", () => {
    const offenders = files.filter((f) => /@supabase\/|lib\/supabase|supabase-js/.test(f.text))
    expect(offenders.map((f) => f.path)).toEqual([])
  })

  it("nothing reads an auth session or user", () => {
    const offenders = files.filter((f) =>
      /\buseAuth\b|auth\.getUser|onAuthStateChange/.test(f.text),
    )
    expect(offenders.map((f) => f.path)).toEqual([])
  })

  it("no API route handlers remain (the app has no server-side logic)", () => {
    const routes = files.filter((f) => /^app\/.*route\.ts$/.test(f.path))
    expect(routes.map((f) => f.path)).toEqual([])
  })
})

describe("the API key stays inside the vault's callers", () => {
  const importers = files
    .filter((f) => /from ["']@\/lib\/ai\/key-vault["']|from ["']\.\/key-vault["']/.test(f.text))
    .map((f) => f.path)
    .sort()

  it("is imported only by the AI layer and its settings/unlock UI", () => {
    expect(importers).toEqual([
      "components/ai/ai-key-settings.tsx",
      "components/ai/unlock-form.tsx",
      "lib/ai/stream-narrative.ts",
      "lib/hooks/use-llm-key.ts",
    ])
  })

  it("is never reachable from the stores, calculations, utils or persistence code", () => {
    const forbidden = importers.filter((p) =>
      /^lib\/(store|calculations|utils|monte-carlo|constants)\//.test(p),
    )
    expect(forbidden).toEqual([])
  })

  it("provider clients receive the key as an argument rather than importing the vault", () => {
    const providerFiles = files.filter((f) => f.path.startsWith("lib/ai/providers/"))
    expect(providerFiles.length).toBeGreaterThan(0)
    expect(providerFiles.filter((f) => /key-vault/.test(f.text))).toEqual([])
  })

  it("nothing logs request data to the console", () => {
    const offenders = files
      .filter((f) => f.path.startsWith("lib/ai/") || f.path.startsWith("components/ai/"))
      .filter((f) => /console\.(log|info|debug|warn|error)/.test(f.text))
    expect(offenders.map((f) => f.path)).toEqual([])
  })
})

describe("the key never lands in storage or exports", () => {
  const KEY = "sk-ant-api03-ISOLATION-CHECK-0123456789"

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    __resetVaultForTests()
  })

  function everythingStored(): string {
    const all: string[] = []
    for (const storage of [localStorage, sessionStorage]) {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i)!
        all.push(`${k}=${storage.getItem(k)}`)
      }
    }
    return all.join("\n")
  }

  it("session-only: not in localStorage, sessionStorage, the plan stores or a backup", async () => {
    await useCalculatorStore.persist.rehydrate()
    await useExpensesStore.persist.rehydrate()
    saveSessionOnly("anthropic", KEY)
    useCalculatorStore.getState().setPersonalInfo({ currentAge: 44 })
    useExpensesStore.getState().setMonthlyIncome(70000)

    expect(everythingStored()).not.toContain("ISOLATION-CHECK")
    const s = useCalculatorStore.getState()
    const e = useExpensesStore.getState()
    const backup = JSON.stringify(
      buildBackup(
        { ...s, displayMode: s.displayMode },
        { groups: e.groups, expenses: e.expenses, monthlyIncome: e.monthlyIncome },
      ),
    )
    expect(backup).not.toContain("ISOLATION-CHECK")
    expect(JSON.stringify(s)).not.toContain("ISOLATION-CHECK")
    expect(JSON.stringify(e)).not.toContain("ISOLATION-CHECK")
  })

  it("remembered: only ciphertext is stored, under the vault prefix", async () => {
    await saveEncrypted("anthropic", KEY, "a sufficiently long passphrase")
    const stored = everythingStored()
    expect(stored).not.toContain("ISOLATION-CHECK")
    expect(stored).not.toContain("sufficiently long passphrase")
    expect(stored).toContain("rc-llm-key-v1:anthropic=")
  })
})
