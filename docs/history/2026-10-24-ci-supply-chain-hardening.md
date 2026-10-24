# 2026-10-24 — CI and dependency supply-chain hardening

## What changed

| Area | Change |
|---|---|
| `.github/workflows/ci.yml` | `actions/checkout`, `pnpm/action-setup` and `actions/setup-node` pinned to full commit SHAs (v7.0.1, v6.1.0, v7.1.0; were `@v4` tags). Checkout no longer leaves the token in `.git/config` (`persist-credentials: false`). |
| `.github/workflows/audit.yml` (new) | `pnpm audit --prod --audit-level high` on lockfile changes and every Monday. |
| `.github/workflows/zizmor.yml` (new) | Static analysis of the workflows and `dependabot.yml` on changes under `.github/`. |
| `.github/dependabot.yml` (new) | Weekly npm and monthly Actions/devcontainer updates, minor+patch grouped, 7-day cooldown. |
| `pnpm-workspace.yaml` | Added `strictDepBuilds`, `minimumReleaseAge: 1440` and `trustPolicy: no-downgrade` next to the existing `blockExoticSubdeps`. |

## Why

Part of a cross-repo security pass. A tag like `@v4` can be repointed at different code; a SHA
can't. The pnpm settings refuse versions under a day old, unapproved install scripts and
packages whose publish provenance got weaker, which covers most npm account-takeover attacks.

`trustPolicy` flags three lockfile entries (`semver@6.3.1`, `undici-types@6.21.0`,
`eslint-import-resolver-typescript@3.10.1`). Each is a maintenance release on an older line,
published by its usual maintainer before that line had provenance, so they're listed in
`trustPolicyExclude` rather than treated as takeovers.

## Verification

- `pnpm install --frozen-lockfile` passes with the new settings (pnpm 12.6.0).
- zizmor 1.30.1 and actionlint: no findings.
- **The new audit workflow starts red.** `pnpm audit --prod` reports 2 critical and 6 high
  advisories, including two unauthenticated RCEs in Next.js ≤16.4.0 (GHSA-2464-fhr4-w9xw in
  image optimisation, GHSA-673q-mjm6-r5xr in `use cache`), and this app runs Next 16.3.6 with
  `cacheComponents` and an `images` config. Fixing them means upgrading Next to ≥16.4.1 and
  sharp to ≥0.35.5, which is a separate change with its own test run.
- No app code changed, so the test suite, build and shadscan weren't re-run.
