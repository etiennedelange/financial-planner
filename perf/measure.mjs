#!/usr/bin/env node
/**
 * Paint / hydration / interactive performance runner.
 *
 * Usage:
 *   node perf/measure.mjs [--url URL] [--out FILE] [--runs N] [--label L]
 *                         [--cpu N] [--mode cold|warm] [--scenario empty|interactive]
 *
 * Defaults:
 *   --url       http://localhost:3000/calculator
 *   --out       perf/baseline.json
 *   --runs      5
 *   --label     baseline
 *   --cpu       4            (CPU throttling multiplier via CDP — 1 = off)
 *   --mode      cold         (clears cache + cookies between runs)
 *   --scenario  empty        (empty = cold page, no accounts;
 *                             interactive = seeds a realistic portfolio so
 *                             the projection + Monte Carlo + chart work
 *                             actually runs during the measurement window)
 *
 * Prereq: a server already serving the URL. For apples-to-apples numbers run
 * a production build in another terminal:
 *
 *   pnpm build && pnpm start
 */

import { chromium } from '@playwright/test'
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// ---- arg parsing ---------------------------------------------------------

const argv = process.argv.slice(2)
const args = {}
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    args[argv[i].slice(2)] = argv[i + 1]
    i++
  }
}

const URL_ARG      = args.url      ?? 'http://localhost:3000/calculator'
const OUT_PATH     = resolve(args.out ?? 'perf/baseline.json')
const RUNS         = Number(args.runs ?? 5)
const LABEL        = args.label    ?? 'baseline'
const CPU_THROTTLE = Number(args.cpu ?? 4)
const MODE         = args.mode     ?? 'cold'
const SCENARIO     = args.scenario ?? 'empty'

if (!['empty', 'interactive'].includes(SCENARIO)) {
  console.error(`Invalid --scenario: ${SCENARIO} (expected 'empty' or 'interactive')`)
  process.exit(1)
}

// ---- git context ---------------------------------------------------------

const safeGit = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf8' }).trim() } catch { return '' }
}
const git = {
  commit: safeGit('git rev-parse --short HEAD'),
  branch: safeGit('git rev-parse --abbrev-ref HEAD'),
  dirty:  safeGit('git status --porcelain').length > 0,
}

// ---- stats helpers -------------------------------------------------------

const pct = (arr, p) => {
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1)
  return sorted[idx]
}
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d

const stats = (samples) => {
  const clean = samples.filter((v) => typeof v === 'number' && !Number.isNaN(v))
  if (clean.length === 0) return null
  return {
    median: round(pct(clean, 0.5)),
    p75:    round(pct(clean, 0.75)),
    min:    round(Math.min(...clean)),
    max:    round(Math.max(...clean)),
    samples: clean.map((v) => round(v)),
  }
}

// ---- seed state for the interactive scenario ----------------------------
//
// Shape must match the output of Zustand's `persist` middleware using the
// store at lib/store/calculator-store.ts (name: "retirement-calculator-storage").
// Three accounts gives the projection + Monte Carlo realistic work to do.

const SEED_STATE = {
  state: {
    accounts: [
      {
        id: 'perf-acc-1',
        name: 'Discovery RA',
        provider: 'Discovery',
        type: 'retirement_annuity',
        currentBalance: 850000,
        monthlyContribution: 5500,
        expectedReturn: 11,
        annualFees: 1.25,
        contributionEscalation: 6,
      },
      {
        id: 'perf-acc-2',
        name: 'Company Pension',
        provider: 'Alexander Forbes',
        type: 'pension_fund',
        currentBalance: 1200000,
        monthlyContribution: 8500,
        expectedReturn: 10.5,
        annualFees: 0.95,
        contributionEscalation: 5,
      },
      {
        id: 'perf-acc-3',
        name: 'TFSA',
        provider: 'EasyEquities',
        type: 'tfsa',
        currentBalance: 320000,
        monthlyContribution: 3000,
        expectedReturn: 12,
        annualFees: 0.5,
        contributionEscalation: 0,
      },
    ],
    personalInfo: { currentAge: 42, retirementAge: 65, lifeExpectancy: 90, annualIncome: 950000 },
    retirementGoals: { desiredMonthlyIncome: 45000, inflationRate: 5.5, legacyAmount: 0 },
    assumptions: {
      equityReturn: 11,
      bondReturn: 8,
      cashReturn: 6.5,
      equityVolatility: 16.5,
      bondVolatility: 6,
      inflationRate: 5.5,
      compoundingMethod: 'nominal',
    },
    drawdownConfig: {
      strategy: 'fixed_percentage',
      initialWithdrawalRate: 3.5,
      minimumWithdrawal: 15000,
      maximumWithdrawal: 60000,
    },
    displayMode: 'nominal',
  },
  version: 0,
}

// ---- single measurement --------------------------------------------------

async function measureOnce(browser, runIndex) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const client = await context.newCDPSession(page)

  if (CPU_THROTTLE > 1) {
    await client.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE })
  }
  if (MODE === 'cold') {
    await client.send('Network.clearBrowserCache')
    await client.send('Network.clearBrowserCookies')
  }

  // Run BEFORE any page JS — installs a longtask observer that accumulates
  // entries into window.__longTasks. Also seeds Zustand state for the
  // interactive scenario so the app hydrates with a realistic portfolio.
  await page.addInitScript(
    ({ scenario, seed }) => {
      window.__longTasks = []
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            window.__longTasks.push({ startTime: e.startTime, duration: e.duration })
          }
        }).observe({ type: 'longtask', buffered: true })
      } catch { /* longtask not supported */ }

      if (scenario === 'interactive') {
        try {
          localStorage.setItem('retirement-calculator-storage', JSON.stringify(seed))
        } catch { /* private mode etc. */ }
      }
    },
    { scenario: SCENARIO, seed: SEED_STATE }
  )

  const start = Date.now()
  await page.goto(URL_ARG, { waitUntil: 'load', timeout: 30_000 })

  // Give React effects + the 300ms Monte Carlo debounce + the sim itself
  // room to run. Empty scenario has no work to wait for — keep it short.
  const settleMs = SCENARIO === 'interactive' ? 1500 : 300
  await page.waitForTimeout(settleMs)

  const wallClock = Date.now() - start

  const metrics = await page.evaluate(async () => {
    const nav = performance.getEntriesByType('navigation')[0] ?? {}
    const paint = performance.getEntriesByType('paint')

    // LCP via buffered PerformanceObserver.
    const lcp = await new Promise((res) => {
      const timeout = setTimeout(() => res(null), 2000)
      try {
        new PerformanceObserver((list) => {
          clearTimeout(timeout)
          const entries = list.getEntries()
          res(entries.at(-1)?.startTime ?? null)
        }).observe({ type: 'largest-contentful-paint', buffered: true })
      } catch {
        clearTimeout(timeout)
        res(null)
      }
    })

    // Prefer the pre-installed observer's data; fall back to getEntriesByType.
    const longTasks = window.__longTasks?.length
      ? window.__longTasks
      : performance.getEntriesByType('longtask').map((t) => ({ startTime: t.startTime, duration: t.duration }))

    const longTaskMs  = longTasks.reduce((s, t) => s + t.duration, 0)
    const tbt         = longTasks.reduce((s, t) => s + Math.max(0, t.duration - 50), 0)
    const longestTask = longTasks.reduce((m, t) => Math.max(m, t.duration), 0)

    // Next.js emits these performance.measure entries in dev mode only.
    const measures = performance.getEntriesByType('measure')
    const hydrationMeasure = measures.find((m) => m.name === 'Next.js-hydration')?.duration ?? null
    const renderMeasure    = measures.find((m) => m.name === 'Next.js-render')?.duration ?? null

    const resources = performance.getEntriesByType('resource')
    const byKind = (fn) => resources.filter(fn).reduce((s, r) => s + (r.transferSize || 0), 0)
    const jsBytes  = byKind((r) => r.initiatorType === 'script' || r.name.endsWith('.js'))
    const cssBytes = byKind((r) => r.initiatorType === 'link'   || r.name.endsWith('.css'))

    return {
      ttfb:             nav.responseStart ?? null,
      fcp:              paint.find((p) => p.name === 'first-contentful-paint')?.startTime ?? null,
      lcp,
      domContentLoaded: nav.domContentLoadedEventEnd ?? null,
      loadEvent:        nav.loadEventEnd ?? null,
      transferSize:     nav.transferSize ?? null,
      encodedSize:      nav.encodedBodySize ?? null,
      jsBytes,
      cssBytes,
      resourceCount:    resources.length,
      longTaskCount:    longTasks.length,
      longTaskMs,
      longestTask,
      tbt,
      hydrationMeasure,
      renderMeasure,
    }
  })

  metrics.wallClock = wallClock
  await context.close()

  process.stdout.write(
    `  run ${runIndex + 1}/${RUNS}  fcp=${round(metrics.fcp ?? 0)}ms  ` +
    `lcp=${round(metrics.lcp ?? 0)}ms  tbt=${round(metrics.tbt)}ms  ` +
    `tasks=${metrics.longTaskCount}  ` +
    `js=${round((metrics.jsBytes || 0) / 1024)}KB\n`
  )

  return metrics
}

// ---- driver --------------------------------------------------------------

async function main() {
  console.log(
    `▶ ${LABEL}: ${URL_ARG}\n` +
    `  runs=${RUNS}  cpu=×${CPU_THROTTLE}  mode=${MODE}  scenario=${SCENARIO}  ` +
    `commit=${git.commit}${git.dirty ? '*' : ''}`
  )

  const browser = await chromium.launch()
  const samples = []
  for (let i = 0; i < RUNS; i++) {
    try {
      samples.push(await measureOnce(browser, i))
    } catch (e) {
      console.log(`  run ${i + 1}/${RUNS}  FAILED: ${e.message}`)
    }
  }
  await browser.close()

  if (samples.length === 0) {
    console.error('\nNo successful runs — is the server running?')
    process.exit(1)
  }

  const keys = Object.keys(samples[0])
  const aggregated = Object.fromEntries(
    keys.map((k) => [k, stats(samples.map((s) => s[k]))])
  )

  const result = {
    label: LABEL,
    timestamp: new Date().toISOString(),
    git,
    url: URL_ARG,
    runs: samples.length,
    runsRequested: RUNS,
    cpuThrottle: CPU_THROTTLE,
    mode: MODE,
    scenario: SCENARIO,
    metrics: aggregated,
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2))
  console.log(`\n✓ wrote ${OUT_PATH}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
