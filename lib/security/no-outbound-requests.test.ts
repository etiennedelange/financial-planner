// Mechanical guards for the promises this app makes. A refactor that breaks one should
// fail here, loudly, rather than in a privacy review:
//   1. There is no account system or cloud database.
//   2. The app makes NO outbound network requests — nothing the user enters leaves the
//      browser. (The "Explain my plan" feature only builds a prompt for the user to copy.)
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vite-plus/test"

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

const offending = (pattern: RegExp) => files.filter((f) => pattern.test(f.text)).map((f) => f.path)

describe("no accounts, no cloud database", () => {
  it("nothing imports Supabase", () => {
    expect(offending(/@supabase\/|lib\/supabase|supabase-js/)).toEqual([])
  })

  it("nothing reads an auth session or user", () => {
    expect(offending(/\buseAuth\b|auth\.getUser|onAuthStateChange/)).toEqual([])
  })

  it("no API route handlers remain (the app has no server-side logic)", () => {
    expect(files.filter((f) => /^app\/.*route\.ts$/.test(f.path)).map((f) => f.path)).toEqual([])
  })
})

describe("no outbound network requests", () => {
  it("no fetch, XHR, WebSocket, EventSource or beacon calls anywhere in app source", () => {
    expect(offending(/\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|EventSource|sendBeacon/)).toEqual(
      [],
    )
  })

  it("no AI provider, analytics or telemetry client is referenced", () => {
    expect(
      offending(
        /api\.anthropic\.com|api\.openai\.com|generativelanguage|@vercel\/analytics|@vercel\/speed-insights|vercel-insights|@ai-sdk|from ["']ai["']/,
      ),
    ).toEqual([])
  })

  it("the CSP allows connecting to this site only", async () => {
    const { buildCsp } = await import("./headers")
    expect(buildCsp("n", false)).toContain("connect-src 'self';")
  })
})

describe("the prompt path stays local", () => {
  it("the copy-prompt code builds and copies text; it does not send it anywhere", () => {
    const copyFiles = files.filter(
      (f) => f.path === "lib/ai/copy-prompt.ts" || f.path === "components/ai/copy-prompt-panel.tsx",
    )
    expect(copyFiles).toHaveLength(2)
    expect(copyFiles.filter((f) => /\bfetch\s*\(|XMLHttpRequest|sendBeacon/.test(f.text))).toEqual(
      [],
    )
  })
})
