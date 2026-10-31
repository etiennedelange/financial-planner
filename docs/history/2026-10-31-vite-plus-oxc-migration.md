---
type: History Entry
title: "2026-10-31 — Lint, format and tests moved to Vite+ (Oxlint, Oxfmt, Vitest 5)"
description: "ESLint replaced by Oxlint and the repo formatted with Oxfmt, all through Vite+ 1.4.0 (vp check); Vitest 4 to 5; the money-time guard ported to a local Oxlint plugin."
date: 2026-10-31
tags: [tooling]
---

# 2026-10-31 — Lint, format and tests moved to Vite+ (Oxlint, Oxfmt, Vitest 5)

Plan: [../superpowers/plans/2026-10-31-vite-plus-oxc-migration.md](../superpowers/plans/2026-10-31-vite-plus-oxc-migration.md).
Next.js still owns `dev`, `build` and `start`; Vite+ (`vp`) owns test, lint and format.

## What changed

| Area | Change |
|---|---|
| `vite.config.ts` (new) | One config for `test` (was `vitest.config.ts`), `lint` (was `eslint.config.mjs`) and `fmt`. The migrator's ~965-line browser globals list became `env: { browser, node }`. |
| `lint/money-time-plugin.mjs` (new) | The money-time guard as an Oxlint JS plugin rule, `money-time/no-hand-rolled-inflation`, with the same two patterns, messages and exemptions. Oxlint has no `no-restricted-syntax`, and the migrator dropped it with only a warning. |
| Tests | 64 files import from `vite-plus/test`. Vitest 4 → 5.0.5 (bundled with Vite+ 1.4.0). The Monte Carlo benchmark uses the v5 `bench` test fixture. |
| `package.json`, `pnpm-workspace.yaml` | `eslint`, `eslint-config-next`, `@eslint/compat` removed, plus their `allowBuilds.unrs-resolver` and `trustPolicyExclude` entries. Vite+ catalog and `vite@*` override; the AUTH-004 rationale is kept on it. New `check` script; `lint`/`test*` run through `vp`. |
| Lint findings | `app/print/print-client.tsx` read the clock during render (React Compiler `purity`); it now reads it once in a lazy `useState`. `eslint-disable` comments became `oxlint-disable`; the four for the unimplemented `@next/next/no-location-assign-relative-destination` became plain comments. `jsx-a11y/prefer-tag-over-role` off (deliberate roles on styled divs). |
| Formatting | `vp fmt` once, in its own commit `316c99b` (236 files), listed in `.git-blame-ignore-revs`. |
| CI, dev container | CI runs `pnpm check` (replacing `npm run lint`) and `pnpm docs:check`. Dev container: `oxc.oxc-vscode` replaces the ESLint and Prettier extensions. |

## Why

Personal tooling preference: one toolchain, one config, fewer dependencies (personal-context
`technologies/tooling.md`, `learnings/vite-plus.md`).

## Decisions and deviations from the plan

- **Version 1.4.0**, not the 1.0.0 the notes were tested on. 1.4.0 was 8 days old, so no
  `minimumReleaseAgeExclude` is needed; the migrator's exclusion list was removed. 1.4 bundles
  Vitest 5, which the earlier migrations (notes, gitr: 1.1–1.2) never went through.
- **Migrator output not taken as-is.** It reformatted 68 files with default style
  (semicolons, 2-space). Those were restored and only the import and disable-comment changes
  redone, so the formatting lands in one reviewable commit.
- **`clearMocks: false` dropped.** The migrator adds it for v4 compatibility; the suite passes
  without it.
- **Style: double quotes, no semicolons, `printWidth: 100`.** The repo was split (167 source files
  double-quote/no-semi, 153 single-quote/semicolon), so roughly half was going to change either
  way. Measured on a copy: 80 → 257 files / +14.6k −8.0k lines; 100 → 237 / +9.8k −7.8k;
  120 → 239 / +8.1k −9.1k. 100 touches the fewest files.
- **Not formatted:** tool-owned folders (`.agents`, `.claude`, `.impeccable`), generated
  `types/supabase.ts`, Markdown, and `supabase/templates/**` (hand-laid-out email HTML).
- **Lint scope:** `.agents/`, `.claude/`, `.impeccable/` are ignored; 572 of the first run's 664
  findings were in vendored skill scripts.

## Verification

Baseline is `main` at `fdc5c16`; the build needs CI's dummy Supabase/Turnstile env vars locally.

| Check | Before | After |
|---|---|---|
| `pnpm test` | 62 files, 1012 passed | 63 files, 1026 passed (+14 rule tests) |
| `pnpm test:coverage` (stmts / branches / funcs / lines) | 90.75 / 81.51 / 89.05 / 91.52 — **fails** thresholds | 90.78 / 81.83 / 89.15 / 91.56 — same files covered, same failure |
| `pnpm typecheck` | pass | pass |
| `pnpm lint` / `pnpm check` | ESLint pass | 0 errors, 78 warnings |
| `pnpm build` | pass | pass |
| `pnpm shadscan` | 93/100 | 93/100 |
| `pnpm docs:check` | pass | pass |

- **Money-time guard:** a probe file in `lib/calculations/` with `Math.pow(1 + inflationRate, years)`
  and `(1 + inflationRate) ** years` failed `vp lint` with both messages; the same code in a
  `.test.ts` passed; `money-time.ts` itself is not flagged. `lint/money-time-plugin.test.mjs`
  covers 9 valid and 5 invalid cases with `RuleTester`.
- **Coverage thresholds still enforced:** `test:coverage` exits non-zero on the pre-existing gap
  (functions 89% < 90, branches 82% < 85), as on `main`. CI does not run `test:coverage`, which
  is how that gap went unnoticed; it is not fixed here.
- **Not tested:** the dev container change (needs a rebuild).

## Follow-ups

- 78 lint warnings, mostly unused variables. Worth a look: `no-base-to-string` on `age` in three
  chart tooltips (could print `[object Object]`), `await-thenable` in `account-form-dialog.tsx`,
  `no-floating-promises` in `reset-password/page.tsx` and `scenario-switcher.tsx`.
- The pre-existing coverage-threshold failure, and whether CI should run `test:coverage`.
