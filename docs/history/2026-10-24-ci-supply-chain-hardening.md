# 2026-10-24 — CI supply-chain hardening; Next.js 16.4.3 for two critical RCEs

## What changed

| Area | Change |
|---|---|
| `.github/workflows/ci.yml` | `actions/checkout`, `pnpm/action-setup` and `actions/setup-node` pinned to full commit SHAs (v7.0.1, v6.1.0, v7.1.0; were `@v4` tags). Checkout no longer leaves the token in `.git/config` (`persist-credentials: false`). |
| `.github/workflows/audit.yml` (new) | `pnpm audit --prod --audit-level high` on lockfile changes and every Monday. |
| `.github/workflows/zizmor.yml` (new) | Static analysis of the workflows and `dependabot.yml` on changes under `.github/`. |
| `.github/dependabot.yml` (new) | Weekly npm and monthly Actions/devcontainer updates, minor+patch grouped, 7-day cooldown. |
| `package.json`, `pnpm-lock.yaml` | `next`, `eslint-config-next` and `@next/bundle-analyzer` 16.3.x → 16.4.3; `zod` ^4.6.7; lockfile refresh takes `sharp` to 0.35.5, `undici` to 7.30.1 and `source-map-js` to 1.2.2 for the app's production tree. |
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
- `pnpm audit --prod` first reported 2 critical and 6 high advisories, including two
  unauthenticated RCEs in Next.js ≤16.4.0 (GHSA-2464-fhr4-w9xw in image optimisation,
  GHSA-673q-mjm6-r5xr in `use cache`). This app ran Next 16.3.6 with `cacheComponents` and an
  `images` config, so both applied. Fixed in a second commit (below); the audit is now clean.

### After the dependency upgrade

- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `npm run typecheck`, `npm run lint`: clean.
- `npm run test`: 1012/1012 passed (62 files).
- `npm run build`: passes with the CI env values (Next 16.4.3, Turbopack). Locally it needs
  `NEXT_PUBLIC_SUPABASE_*` set, as in CI, because `/api/account/export` is prerendered.
- `npm run shadscan:gate`: 93/100 (A), unchanged.
- No source files changed, so coverage on modified files is unchanged; `test:coverage` wasn't re-run.
