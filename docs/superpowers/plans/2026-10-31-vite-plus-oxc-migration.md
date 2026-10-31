---
type: Implementation Plan
title: "Vite+ and Oxc Migration — Handoff Plan"
description: "Handoff for moving linting, formatting and testing from ESLint, Prettier and bare Vitest to Vite+ (vp) with Oxlint and Oxfmt, including the blocker, preflight, ordered steps and risks."
date: 2026-10-31
tags: [tooling]
---

# Vite+ and Oxc Migration — Handoff Plan

Status: **done 2026-10-31** on branch `chore/vite-plus-oxc-migration`; outcome and deviations in
[../../history/2026-10-31-vite-plus-oxc-migration.md](../../history/2026-10-31-vite-plus-oxc-migration.md).
The plan below is kept as written.

## Blocker (resolve first)

`registry.npmjs.org` does not resolve in the Claude Code cloud container, so `pnpm install`,
`pnpm view` and `vp migrate` all fail. Etienne must allow it: environment menu in the session
title bar, Edit, then either broaden Network access or add `registry.npmjs.org` under Allowed
domains with "Allow package managers" ticked
(https://code.claude.com/docs/en/cloud-environments#network-access). Check with
`curl -sS -o /dev/null -w '%{http_code}' https://registry.npmjs.org/vite-plus` (expect 200).
Alternatively run the migration locally in the dev container, where the registry works.

## Where things stand

- Branch `docs/okf-bundle` on `etiennedelange/financial-planner`, two commits ahead of `main`:
  `b035208` (docs frontmatter, `log.md`, `docs:check`) and `c805b13` (generated OKF indexes
  removed after an A/B test). No PR is open. Write-up:
  [../../history/2026-10-30-docs-okf-bundle.md](../../history/2026-10-30-docs-okf-bundle.md).
- `node_modules` is not installed in the container; run `pnpm install --frozen-lockfile` first.
- Branch the migration off `docs/okf-bundle` (it needs `docs:check` and the new log rules), so
  the PR stacks on the docs one. If the docs PR has merged by then, branch off `main` instead.

## Why, and what Etienne's own notes say

Preference (personal-context `technologies/tooling.md`): Vite+ (`vp`) as the JS/TS toolchain,
Oxlint and Oxfmt rather than ESLint and Prettier, `oxc.oxc-vscode` in the dev container.
Practical notes are in personal-context `learnings/vite-plus.md` (tested on Vite+ 1.0.0). Read
it before starting. Expected gain is one tool, one config and fewer dependencies, not speed.

## What does not change

Next.js stays. `vp` replaces ESLint, Prettier and the Vitest invocation; it does not replace
`next dev`, `next build` or `next start`. pnpm stays (`packageManager: pnpm@12.6.0`).

## Findings from the repo survey (2026-10-31)

| Area | Fact | Consequence |
|---|---|---|
| Lint config | `eslint.config.mjs` = `eslint-config-next/core-web-vitals` via `@eslint/compat`, plus one custom `no-restricted-syntax` rule with AST selectors banning `Math.pow(1 + <inflation>, n)` and `(1 + <inflation>) ** n` outside `lib/calculations/utils/money-time.ts` and tests | Unknown whether Oxlint can enforce selector rules. **Test this first** (step 4) |
| Tests | 63 files import from `'vitest'`; `vitest.config.ts` sets `globals: true`, `happy-dom`, alias `@`, v8 coverage with thresholds 90/90/85/90, excludes `e2e/**` and `docs/history/**` | Imports become `vite-plus/test`; coverage thresholds must still be enforced afterwards |
| Format | No Prettier config. Source is no-semicolon, double-quote (`vitest.config.ts` is the odd one out) | Set `fmt` options before the first format, or the whole repo reformats to semicolons |
| Suppressions | 11 `eslint-disable` comments in `lib/`, `components/`, `app/` | Need Oxlint equivalents or removal |
| CI | `.github/workflows/ci.yml` line 57 runs `npm run lint`; actions are pinned to SHAs; zizmor and audit workflows exist | Update the lint step; keep the SHA pins |
| pnpm policy | `pnpm-workspace.yaml` has `minimumReleaseAge: 1440`, `trustPolicy: no-downgrade`, `strictDepBuilds`, `overrides: vite: ">=8.0.16"`, `allowBuilds` incl. `unrs-resolver` (only for the ESLint import resolver) | The migrator will edit this; review every change |
| Dev container | `.devcontainer/devcontainer.json` uses `dbaeumer.vscode-eslint` and `esbenp.prettier-vscode`, `editor.codeActionsOnSave: source.fixAll.eslint` | Switch to `oxc.oxc-vscode` |

## Steps

1. **Baseline.** `pnpm install --frozen-lockfile`, then record: `pnpm test` (1012 tests at last
   count), `pnpm test:coverage`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm shadscan`
   (93/100 baseline), `pnpm docs:check`. Paste the numbers into the history entry later.
2. **Pick the version.** `pnpm view vite-plus version`. 1.0.0 is the tested one. Must be at least
   24 hours old to satisfy `minimumReleaseAge`.
3. **Run the migrator** from a clean tree (it installs dependencies and reformats files it
   rewrites; it is not a dry run):
   `pnpm dlx --package=vite-plus@<version> vp migrate --no-interactive --no-hooks --no-agent --no-editor`.
   Then read the whole diff before accepting anything. If it reformatted files you did not mean to
   touch, `git checkout` them and redo only the import changes.
4. **Money-time rule (the real risk).** Check whether the migrated `lint` block kept the
   inflation-exponent ban. Prove it with a deliberate violation in a non-exempt file, e.g.
   `Math.pow(1 + inflationRate, years)` in `lib/calculations/`, and confirm `vp lint` fails; then
   remove it. If Oxlint cannot enforce it, in order of preference: (a) an Oxlint JS plugin or
   equivalent rule if available, (b) a Vitest test that scans non-exempt `lib/` source files for the
   two patterns and fails with the existing message (keep the same exemptions: `money-time.ts`,
   `money-time.test.ts`, all tests), (c) keep ESLint for that one rule only. Do not drop the guard:
   it exists because of two P0 bugs (see `docs/history/2026-07-26-phase-10-calculation-simplification.md`).
5. **Set formatting.** In `vite.config.ts` `fmt`: `semi: false`, double quotes (the default), and a
   `printWidth` matching existing code (check `.vscode/settings.json` and `.editorconfig`; measure
   by counting lines over 80 and 100 columns in `lib/`). Add tool-owned or deliberately compact
   files to `fmt.ignorePatterns` (generated JSON, `app/globals.css` if its layout is deliberate)
   and carry over any comments the migrator drops.
6. **Tests.** Make sure every test import is `vite-plus/test` (the `vite-plus/prefer-vite-plus-imports`
   rule can autofix). Keep `vitest.config.ts` settings: `globals`, `happy-dom`, alias `@`, coverage
   thresholds and excludes. Confirm thresholds are still enforced: temporarily lower a covered file's
   tests or raise a threshold and see `test:coverage` fail.
7. **Lint parity.** Compare rule coverage with `eslint-config-next/core-web-vitals`: `@next/next/*`
   (e.g. `no-img-element`), `react-hooks` (including the React Compiler rules), `jsx-a11y`. Port or
   rewrite the 11 `eslint-disable` comments. Expect new findings (whole rule categories are on,
   type-aware linting adds `no-floating-promises`); fix real ones, turn off noisy ones with a comment
   explaining why, as `jsx-a11y/prefer-tag-over-role` was in other repos.
8. **Remove ESLint.** Delete `eslint.config.mjs`; drop `eslint`, `eslint-config-next`,
   `@eslint/compat` and anything only they needed. In `pnpm-workspace.yaml`: review the
   `minimumReleaseAgeExclude` the migrator adds (it bypasses the 24h wait for Vite+ packages),
   the `vite` override against the aliasing, and prune `allowBuilds.unrs-resolver` and the
   `eslint-import-resolver-typescript@3.10.1` `trustPolicyExclude` entry if nothing else needs them.
9. **Scripts.** `package.json`: `lint` → `vp lint`, add `check` → `vp check`, `test` → `vp test`
   (keep `test:watch`, `test:coverage`, `test:ui` working or drop `test:ui` if `@vitest/ui` goes).
   Use `vp check` (format + lint + types), not `vp lint`, before pushing: `vp lint` does not check
   formatting. Keep `typecheck` (`tsc --noEmit`) since CLAUDE.md requires it for test files; confirm
   `vp check` reports the same errors.
10. **Reformat commit.** Run `vp fmt` once, commit it alone with a message saying it is formatting
    only, then add its hash to a new `.git-blame-ignore-revs` and note
    `git config blame.ignoreRevsFile .git-blame-ignore-revs` in `docs/README.md` or the history entry.
11. **CI.** In `.github/workflows/ci.yml` replace the `npm run lint` step with `vp check` (via
    pnpm), keep the SHA-pinned actions and `persist-credentials: false`, and let zizmor validate
    the change. Consider adding `pnpm docs:check` as its own step.
12. **Dev container.** In `.devcontainer/devcontainer.json`: replace the ESLint and Prettier
    extensions and settings with `oxc.oxc-vscode`, `"editor.defaultFormatter": "oxc.oxc-vscode"`,
    and an Oxc fix-on-save action. Cannot be tested in the cloud container; say so.
13. **Verify** (all must pass, compare to step 1): tests green with the same count, coverage
    thresholds, `pnpm typecheck`, `vp check`, `pnpm build`, `pnpm shadscan` (not below 90, baseline
    93), `pnpm docs:check`, and the deliberate-violation check from step 4.
14. **Docs** (CLAUDE.md rule 2): new `docs/history/2026-MM-DD-vite-plus-oxc-migration.md` (what,
    why, verification, the step 4 outcome), a line at the top of `docs/log.md`, update
    `CLAUDE.md` (Dev Commands, "Before committing", any ESLint mentions) and grep
    `.claude/` and `docs/` for `eslint`/`prettier`. No phase fits this work; either add it under
    `docs/project-phases/future-enhancements.md` as completed or ask Etienne. Run `pnpm docs:check`.
15. **Ship.** Commit in this order: migration, reformat-only, blame-ignore + docs. Push the branch.
    Do not open a PR unless Etienne asks.

## Risks and rollback

- Biggest risk is silently losing the money-time guard (step 4). Second is coverage thresholds
  no longer being enforced (step 6). Third is a noisy first lint run hiding real findings.
- The reformat commit touches most of the repo's 517 tracked source files if style is set wrong;
  check `git diff --stat` after step 5 before running `vp fmt`.
- Rollback is `git revert` of the migration commits or deleting the branch; nothing else depends on it.

## Other outstanding items from the same session

- Port `gitr`'s `docs/bug-ledger.md` convention (symptom, root cause, fix, regression test per fix)
  into this repo's docs and rules. Not started; Etienne has not confirmed.
- `notes`' `docs/ENHANCEMENTS.md` deferred-ideas backlog: optional, overlaps
  `docs/project-phases/future-enhancements.md`.
- Dev container: `.devcontainer/post-create.sh` and `mounts` install OpenCode by hand, but the
  `dev-setup` feature (already in use) has an `opencode` option with its own volume. Set
  `"opencode": true` and delete the manual install and mounts. Untestable in the cloud container.
- Offered but not done: add `pnpm docs:check` to CI; open a PR for `docs/okf-bundle`.
- Cleanup, only if Etienne wants: archive the two A/B test sessions
  (`session_017G4PfbHtDiiPWuGaZadGaK`, `session_017G4PfagWy5paqBibUr6dsw`); the spec clone at
  `/home/user/googlecloudplatform/knowledge-catalog` is disposable.

## Worth telling Etienne for personal-context (suggestions only)

- Learning: a docs bundle with generated indexes gave no measurable benefit in an A/B test
  (4 vs 7 tool calls, $0.19 vs $0.40, one run each); agents grepped regardless. Frontmatter
  descriptions and a link checker were kept.
- Learning: the Claude Code cloud container blocks `registry.npmjs.org` by default, so
  JS dependency work needs the network policy changed first.
