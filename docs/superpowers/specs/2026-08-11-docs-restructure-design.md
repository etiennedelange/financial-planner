# Docs Restructure & CLAUDE.md Documentation Rules — Design

**Date:** 2026-08-11
**Status:** Approved (user), implemented same day
**Scope:** Surgical — no folder reorganization beyond fixing the stray `docs/docs/` tree

## Problem

1. **Stray `docs/docs/history/` tree** — three history files were written to a nested
   `docs/docs/` path (an agent ran with the wrong working directory) and went unnoticed
   for weeks. Four backticked references pointed into it; one
   (`docs/docs/history/2026-07-11-multiagent-audit-...md`) referenced a file that was
   actually in the main `history/` — fully dead.
2. **`docs/project-phases.md` had become a 57KB monolith** — the old CLAUDE.md rule
   ("update 3 places after every meaningful change") never said what level of detail
   goes where, so each dated entry duplicated its history file in full.
3. **"Meaningful change" was undefined** — agents had to guess when documentation was
   required.
4. **Stale completed-era plan at top level** — `testing-and-validation-plan.md`
   (2026-01-05, status "Planning") described work long completed.
5. **No index** — nothing explained the docs layout or naming conventions.

## Decisions (with user)

- **Surgical scope** — no folder reorganization; existing links keep working.
- **Retrofit** — compress all 11 dated entries in `project-phases.md` to one-liners.
- **CLAUDE.md docs-rules section only** — no broader rewrite of the instructions.

## Design: tiered single-source-of-truth

Detail lives in exactly one place; every other tier links to it.

| Tier | File | Content |
|------|------|---------|
| 1 | `docs/history/YYYY-MM-DD-slug.md` | Full write-up (what, why, verification) |
| 2 | `docs/project-phases/<phase>.md` | Checkbox flips + pending lists, linking to tier 1 |
| 3 | `docs/project-phases.md` | One-line Recent Activity entry + status emoji |

**Cap:** Recent Activity keeps the latest 10 entries; the oldest rolls off (detail is
safe in `history/`).

**"Meaningful change" defined:** calculation/architecture/security change, completed
phase task, or bug fix touching >2 files. Typos, copy, comment-only changes exempt.

## Changes made

1. Moved 3 orphaned files `docs/docs/history/*.md` → `docs/history/`; deleted the
   stray tree.
2. Moved `docs/testing-and-validation-plan.md` →
   `docs/history/2026-01-05-testing-and-validation-plan.md` (completed-era plan).
3. Fixed stale path references: phase-9 teal-accent link, phase-1-6 dangling
   "Documentation" pointer (file never existed), phase-1-7 repointed to
   `2026-04-11-dependency-upgrade-to-latest.md`, 6 records in the 2026-01-05 history
   file updated to current paths.
4. Wrote `docs/README.md` — layout map, three-tier rule, conventions.
5. Retrofit `docs/project-phases.md` — 628 → ~95 lines; 11 entries compressed, each
   linking to its history file(s); maintenance sections replaced by a pointer to the
   README. No information lost: every compressed entry's detail already lived in a
   history file or phase doc (verified one by one).
6. Rewrote CLAUDE.md's "Phase Docs" section as "Documentation Rules" with the
   meaningful-change definition and per-tier instructions.

## Deliberately not changed

- The CLAUDE.md branch-coverage ⚠️ note (~72-76% vs 85% threshold) — verified against
  the 2026-07-26 entry; still accurate, kept.
- Historical narrative docs retain references to since-deleted files
  (`QUICK_START_TESTING.md`, `supabase-postgres-best-practices.md`,
  a planned `docs/MCP.md`, and a planned history file in the 2026-08-02 plan) — these
  are point-in-time records, not links.
- Phase statuses (2/5/9 "In Progress") — not audited; out of scope.
- Root-level docs (DESIGN.md, REQUIREMENTS.md, PRODUCT.md) and `superpowers/` layout.

## Verification

- Custom link checker (`/tmp/opencode/check-md-links.mjs`) over `docs/**/*.md` +
  CLAUDE.md: checks both clickable markdown links and backticked root-relative paths.
- Clickable links: 0 broken before and after.
- Backticked paths: 19 broken at baseline → only intentionally-preserved historical
  records remain broken (see above).
- No code touched; no test/coverage impact.
