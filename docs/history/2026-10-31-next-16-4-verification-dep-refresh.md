---
type: History Entry
title: "2026-10-31 — Next.js 16.4 re-verified; in-range dependency refresh; pnpm audit clean"
description: "Re-ran every check on Next.js 16.4.3 after the October Dependabot wave, refreshed deps within range, fixed the dev-only undici and zod advisories, and found the Playwright journeys stale."
date: 2026-10-31
tags: [security, tooling, dependencies]
---

# 2026-10-31 — Next.js 16.4 re-verified; in-range dependency refresh; pnpm audit clean

Closes [issue #9](https://github.com/etiennedelange/financial-planner/issues/9) (upgrade to
Next.js 16.4). The upgrade itself landed on 2026-10-24
([history](2026-10-24-ci-supply-chain-hardening.md), commit `90ae176`); `16.4.3` is still npm's
`latest`. About 30 dependency bumps have merged since, so the whole suite was re-run.

## What changed

- `pnpm update` within existing ranges: `ai` 7.0.157, `lucide-react` 1.65.0, `motion` 14.8.0,
  `@hookform/resolvers` 5.9.2, `wrangler` 4.156.0, `knip` 6.44.0, `postcss` 8.5.32,
  `@types/node` 26.6.6. No major bumps (`typescript` 7, `@hookform/resolvers` 6 left alone).
- `pnpm audit` went from 9 findings (5 high, 4 moderate) to none. All were dev-only:
  - `undici <7.30.1` via `wrangler > miniflare`: fixed by the `wrangler` refresh.
  - `zod <4.6.6` via `@shadscan/cli` 0.17.0, which pins `zod@4.1.13` exactly and is still the
    latest release: fixed with a scoped override `"@shadscan/cli>zod": "^4.6.7"` in
    `pnpm-workspace.yaml`. Drop it once shadscan depends on `zod >=4.6.6`.
- `pnpm audit --prod` was already clean.

## Verification

Run on the updated tree (and on `main` first as a baseline; results identical):

| Check | Result |
| --- | --- |
| `check`, `typecheck` | pass |
| `test` | 1026/1026 |
| `build` (with CI's env values) | pass |
| `shadscan:gate` | 93/100 (A) |
| `docs:check` | pass |
| `test:coverage` | **fails thresholds, pre-existing on `main`**: functions 89.15% (<90), branches 81.83% (<85) |

### Playwright journeys (`e2e/journeys`)

Not runnable as a pass/fail signal today, on `main` or on this branch:

- The 7 journeys that need no auth (01, 02-multi-account, 03–07) all fail the same way on both:
  they look for the pre-redesign UI (an "Add first account" button, charts on first load), and
  the seeded localStorage state no longer shows on Overview since the
  SupabaseProvider bootstrap change (2026-08-15). The app itself renders and navigates.
- 02-password-reset, 08-two-factor and 09-bootstrap-data-ownership need a local Supabase
  (`supabase start`) and Mailpit; not run.
- Container notes: `@playwright/test` 1.64.1 wants browser build 1248 and ffmpeg 1013; the
  container has 1243 and 1011, so runs used a throwaway config with
  `executablePath: "/opt/pw-browsers/chromium"` and `video: "off"`.

The journeys need rewriting against the current UI before they can gate anything.
