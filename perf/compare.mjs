#!/usr/bin/env node
/**
 * Diff two measure.mjs output files.
 *
 * Usage: node perf/compare.mjs <before.json> <after.json>
 */

import { readFileSync } from 'node:fs'

const [a, b] = process.argv.slice(2)
if (!a || !b) {
  console.error('Usage: node perf/compare.mjs <before.json> <after.json>')
  process.exit(1)
}

const before = JSON.parse(readFileSync(a, 'utf8'))
const after  = JSON.parse(readFileSync(b, 'utf8'))

// Metrics where lower is better (almost all of them).
const LOWER_IS_BETTER = new Set([
  'ttfb', 'fcp', 'lcp', 'domContentLoaded', 'loadEvent',
  'transferSize', 'encodedSize', 'jsBytes', 'cssBytes', 'resourceCount',
  'longTaskCount', 'longTaskMs', 'tbt', 'hydrationMeasure', 'renderMeasure',
  'wallClock',
])

// Formatting per metric — bytes vs ms vs count.
const BYTE_METRICS = new Set(['transferSize', 'encodedSize', 'jsBytes', 'cssBytes'])
const COUNT_METRICS = new Set(['resourceCount', 'longTaskCount'])

const fmt = (key, n) => {
  if (n == null) return '—'
  if (BYTE_METRICS.has(key))  return `${(n / 1024).toFixed(1)} KB`
  if (COUNT_METRICS.has(key)) return n.toFixed(0)
  return `${n.toFixed(1)} ms`
}

const rows = Object.keys(before.metrics).map((k) => {
  const b = before.metrics[k]?.median
  const a2 = after.metrics[k]?.median
  if (b == null || a2 == null) return null
  const delta = a2 - b
  const pct = b === 0 ? 0 : (delta / b) * 100
  return { metric: k, before: b, after: a2, delta, pct }
}).filter(Boolean)

const pad = (s, n) => String(s).padEnd(n)
const col = (s, n) => String(s).padStart(n)

console.log(`\n${before.label} (${before.git.commit}) → ${after.label} (${after.git.commit})`)
console.log(`${before.url}\n`)

console.log(
  pad('metric', 20),
  col('before', 14),
  col('after', 14),
  col('delta', 14),
  col('%', 8),
)
console.log('─'.repeat(72))

for (const r of rows) {
  const improved = LOWER_IS_BETTER.has(r.metric) ? r.delta < 0 : r.delta > 0
  const dir = r.delta === 0 ? '·' : improved ? '↓' : '↑'
  const tint = r.delta === 0 ? '' : improved ? '\x1b[32m' : '\x1b[31m'
  const reset = '\x1b[0m'
  const sign = r.pct >= 0 ? '+' : ''
  console.log(
    pad(r.metric, 20),
    col(fmt(r.metric, r.before), 14),
    col(fmt(r.metric, r.after), 14),
    col(`${tint}${dir} ${fmt(r.metric, Math.abs(r.delta))}${reset}`, 14 + tint.length + reset.length),
    col(`${tint}${sign}${r.pct.toFixed(1)}%${reset}`, 8 + tint.length + reset.length),
  )
}
console.log()
