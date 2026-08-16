# Best Practices Checklist

Always applies. Sources: CLAUDE.md, `docs/README.md`,
`docs/project-phases/phase-1-5-testing-validation.md`.

---

## B1 — The two critical rules

CLAUDE.md opens with two rules marked critical, and they are the ones most often skipped
because they feel like paperwork:

1. **All calculation code changes MUST include unit tests. No exceptions.**
2. **After every meaningful change, update phase docs without being asked.**

**Check rule 1:** any diff to `lib/calculations/`, `lib/monte-carlo/`, or
`lib/constants/tax-year.config.ts` with no corresponding `.test.ts` change. Tests go in the
mirrored file — `projection.ts` → `projection.test.ts`. Report this as **High**: it is a
stated absolute, and R1 in `regression.md` is what happens when the suite is not trusted.

**Check rule 2:** see B3.

---

## B2 — Verification gates

CLAUDE.md's pre-commit list, and why each exists:

| Command | Catches what nothing else does |
|---|---|
| `npm run test` | behavioural regressions |
| `npm run test:coverage` | >90% on modified calculation files |
| `npm run build` | production TS errors |
| `npm run typecheck` | **test-file** type errors — `next build` skips them, which is how 44 accumulated unnoticed |
| Debug Window check | compounding method correct + values consistent across tabs |

**Check:** a claim in the diff, commit message, or conversation that something passes,
without evidence. Run the command. The project's own history contains a task logged from a
stale doc note without verification, and the correction is recorded in
`phase-1-5-testing-validation.md`.

`npm run build` passing is **not** evidence that `npm run typecheck` passes. They are
different gates.

---

## B3 — Documentation tiers

A **meaningful change** = calculation, architecture, or security change; a completed phase
task; or a bug fix touching >2 files. Typos, copy, and comment-only changes are exempt.

Detail lives in exactly **one** place. All three tiers update together:

1. **`docs/history/YYYY-MM-DD-<slug>.md`** — the ONLY full write-up: what changed, why, how
   verified
2. **`docs/project-phases/<phase>.md`** — flip checkboxes, update the pending list, link to
   the history file; do not repeat its content
3. **`docs/project-phases.md`** — one-line Recent Activity entry (date + title + history
   link). Keep the latest 10, drop the oldest. Status emoji (✅ complete · 🔄 in progress ·
   📋 planned) changes **only** when a phase's status actually changes.

**Check:** a meaningful change with no `docs/history/` entry.

**Check:** detail duplicated across tiers. A phase doc that restates the history file has
created two things that will disagree later.

**Check:** Recent Activity longer than 10 entries, or an emoji flipped on an entry that did
not change phase status.

**Check:** doc paths. They are relative to the **repo root** (`docs/history/...`); markdown
links from inside `project-phases/` need a `../` prefix. A stray `docs/docs/` tree once went
unnoticed for weeks because of exactly this.

**Check:** filename convention — `YYYY-MM-DD-short-slug.md`, lowercase, hyphens.

---

## B4 — Architecture boundaries

**Check:** `expenses-store.ts` is **global**, not scenario-tied — it reflects real current
spending. `calculator-store.ts` is per-scenario. A diff that moves expense state into a
scenario inverts a deliberate design decision.

**Check:** calculations respect `assumptions.compoundingMethod` — see R3 in `regression.md`.

**Check:** `lib/calculations/utils/projection.ts` remains the single source of truth for
`projectFinalSavings`.

**Check:** tax limits come from `lib/constants/tax-year.config.ts`. An inline rand threshold
is a finding even when the number is right — it will be wrong next tax year, and nobody will
know where to look.

**Check:** routes live under `app/calculator/{overview,plan,projections,settings,accounts,expenses,charts}/page.tsx`
with the fixed sidebar + sticky top bar shell.

---

## B5 — Dead code

Phase 11 is open for dead-code cleanup (`docs/project-phases/phase-11-dead-code-cleanup.md`).

**Check:** newly orphaned code — a component, util, or export the diff stops using but
leaves behind.

**Careful:** not everything unreferenced is dead. Phase 11 records a case where deleting an
apparently unused file "would silently drop a type-safety check". If you flag dead code,
confirm it is not a compile-time assertion, a test harness, or a deliberate pin — and say
which you checked.

---

## B6 — Scope discipline

**Check:** does the diff do something the task did not ask for? Unrelated refactors bundled
into a behavioural change make the real change impossible to review and impossible to
revert cleanly. Note it as **Medium** and name which files look unrelated.

**Check:** the `<!-- BEGIN:nextjs-agent-rules -->` block in CLAUDE.md is written and re-added
by `next dev`. Removing it from a diff only re-creates the uncommitted change. Committing it
alongside real work is correct and **not** a finding.
