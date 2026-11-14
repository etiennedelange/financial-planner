---
type: History Entry
title: "2026-11-14 — Risk page worker errors from a stale service-worker cache"
description: "Production Risk page failed with 'Cannot read properties of undefined (reading randomSeed / currentAge)' for users who had visited before the single-worker-entry fix: the cache-first service worker kept serving an old worker script. Fixed by bumping the asset cache to v2 and making the worker name the keys it received on a malformed request."
date: 2026-11-14
tags: [bug, service-worker, monte-carlo]
---

# Stale service-worker cache broke the Risk workers

## What happened
On production (`main`), `/calculator/risk` showed "Simulation didn't complete" and the console logged
`Cannot read properties of undefined (reading 'randomSeed')` (Monte Carlo worker) and `(reading 'currentAge')`
(scenario worker). Source and a local production build were correct. Unregistering the service worker
fixed it, so a newer page was talking to an older cached worker script (request shapes had changed in #38).

## Fix
- `public/sw.js`: `ASSET_CACHE` `static-assets-v1` → `v2`; the existing `activate` handler deletes every
  other cache, so affected users recover on their next visit. Bump it again if this recurs.
- `simulation.worker.ts`: `handleWorkerMessage` throws a descriptive error naming the keys received when a
  request has no `configs` / `params` or is not an object.

## Verification
`simulation.worker.test.ts` (3 malformed-request cases) and `sw.test.ts` (v2 name). Root cause confirmed by the
user: works after unregistering the service worker.

## Still open
The cache-first strategy can recur whenever a worker URL is reused across deploys. Consider network-first for
worker scripts.
