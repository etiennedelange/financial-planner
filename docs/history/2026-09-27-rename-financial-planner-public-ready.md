# 2026-09-27 — Rename to financial-planner and prepare the repo to go public

## What changed

**Rename.** The project slug is now `financial-planner` and the display name is
"SA Financial Planner". The sidebar wordmark keeps the "SA" badge and now reads
"Financial / Planner".

| Area | Change |
|---|---|
| `package.json` | `sa-retirement-calculator` → `financial-planner` |
| Metadata | `app/layout.tsx` title + `appleWebApp.title`, `app/manifest.ts` name / `short_name` ("Fin Planner") / description, `app/opengraph-image.tsx`, `public/sw.js` offline page title |
| UI copy | `components/layout/sidebar.tsx` wordmark, print footer (`app/print/print-client.tsx`), debug window header |
| Download filenames | `financial-planner-export-<ts>.json` (account export, with its test), `financial-planner-recovery-codes.txt` |
| Tests/fixtures | `lib/utils/site-url.test.ts` example host → `sa-financial-planner.vercel.app` |
| Local Supabase | `supabase/config.toml` `project_id` → `financial-planner` |
| Devcontainer | `.devcontainer/post-create.sh` now resolves the repo path with `$(pwd)` instead of a hardcoded `/workspaces/retirement-calculator-claude`, so it keeps working whatever the clone folder is called |
| Design docs | `DESIGN.md`, `.impeccable/design.json`, `playwright.config.ts`, `e2e/` comments |

**Kept on purpose.** The `retirement-calculator-storage` localStorage key, with
its `:guest` and `:user:<id>` scoped variants, is **not** renamed. Renaming it
would make every existing browser drop its saved plan, and the legacy-scope
migration would then have to handle two generations of keys. Dated history and
plan docs are left as written because they are records of the past.

**Public-readiness.**
- `README.md` (new): overview, stack, layout, and local setup. It states that
  the repo is source-available, not open source.
- `LICENSE` (new): all rights reserved, with viewing and forking allowed under
  the GitHub Terms of Service. This fits the goal that people can look at the
  code but not reuse it.
- `SECURITY.md` (new): directs reports to GitHub private vulnerability
  reporting and marks the published local-dev keys as out of scope.
- `.github/workflows/ci.yml`: adds `permissions: contents: read`, so the
  workflow token is least-privilege, including for pull requests from forks.

## Secret audit (full history, before going public)

- Ran gitleaks 8.28.0 over all 356 commits (`--log-opts=--all`). It reported 4
  findings, all false positives:
  - `ci.yml`, `.env.example`, and the removed `.env.development`: Supabase's
    published local demo anon JWT (`iss: supabase-demo`, URL `127.0.0.1:54321`)
    and the default local `sb_publishable_ACJW…` key.
- Also grepped the history for token prefixes (`sk-ant-`, `ghp_`,
  `github_pat_`, `sb_secret_`, `vercel_`, `*.supabase.co` project refs). The
  only hit was `sk-ant-oat01-…` placeholder help text in the vendored impeccable
  skill, not a real token. No production Supabase project ref appears anywhere.
- `.claude/settings.local.json` was tracked from 2026-01-01 until it was removed
  on 2026-05-30. Every historical version holds only permission allowlists, with
  no tokens or credentials.
- `.mcp.json` interpolates the GitHub token from `${GITHUB_COPILOT_API_KEY}`
  rather than embedding it.

**Conclusion:** the history does not need rewriting before the repo goes public.

## Out-of-repo steps (manual)

These happen in GitHub, Vercel, Supabase, and Cloudflare, and are listed in the
session summary. They cover renaming the GitHub repo and the Vercel project,
adding `sa-financial-planner.vercel.app`, updating the Supabase Auth Site URL and
redirect allowlist and the Turnstile hostname allowlist, and turning on
GitHub secret scanning and push protection before the repo is made public.

**Done 2026-09-27 via the Vercel API:** the Vercel project was renamed to
`financial-planner` (id `prj_Lx2SIrcdlmRi5g4JD0P5CiojOh17`). The address
`financial-planner.vercel.app` could not be used because another Vercel account
owns it, so `sa-financial-planner.vercel.app` was added instead. The old
`retirement-calculator-claude.vercel.app` address stays live. It becomes a 308
redirect only after Supabase Auth and Turnstile accept the new hostname.

## Verification

- `npm run typecheck`: clean
- `npm run test`: 1003/1003 passing
- `npm run lint`: clean
- `npm run build`: succeeds
- `npm run shadscan:gate`: 93/100, the same score as before this change (checked
  by stashing the changes and re-running)
