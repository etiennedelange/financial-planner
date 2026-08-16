---
name: house-rules
description: On-demand code review of the current changes against the rules this project has already written down — regressions, styling/design-system violations, security issues, and documented best practices. Use whenever the user asks to review, check, or sanity-check their code, work, changes, or diff; asks "did I break anything", "is this safe to commit", "does this follow our conventions", "review before I commit/push/merge"; or finishes a chunk of work and wants a second pass. Also use before committing calculation, auth, store, or UI changes even if the user does not say the word "review".
---

# House Rules Review

Review the current changes against the conventions, pitfalls, and incidents this project
has already documented — then report. Do not fix anything.

## Why this skill exists

This project has paid for its rules. A calculation regression shipped here with 100% line
coverage and a green suite. `projectFinalSavings` was copy-pasted into three files and the
engines drifted. 44 type errors accumulated in test files because `next build` does not
typecheck them. A `docs/docs/` tree went unnoticed for weeks.

Every rule you enforce here traces to an incident recorded in `docs/`. That provenance is
what makes a finding land: "this duplicates engine logic, which is how the deterministic
and Monte Carlo engines silently modelled different plans in Phase 10" persuades, where
"consider extracting a helper" does not. **Always cite the rule's source.**

This is the *conformance* lane. Two neighbours exist — send the user to them rather than
half-doing their job:

| Their question | Send them to |
|---|---|
| Is this formula mathematically right? Are these SA tax figures current? | `/audit` (dispatches `mathematics-auditor`, `tax-auditor`, `sa-retirement-calc-validator`) |
| Generic correctness bugs in the diff, unrelated to project convention | `/code-review` |
| Does this violate what we decided and wrote down? | **this skill** |

## Step 1 — Scope

Default to the uncommitted working tree. That is what "review my changes" almost always
means.

```bash
git status --porcelain
git diff --stat
git diff
git diff --cached
```

Untracked files (`??`) count as changed — read them in full, since `git diff` will not show
them. If the working tree is clean, say so and ask whether to review the last commit or the
branch diff instead of silently widening scope.

If the user named a path, area, or PR, scope to that instead.

## Step 2 — Classify what changed, load only what applies

Each reference file is a checklist with provenance. Read the ones the diff actually touches;
reading all four on a CSS-only change wastes context and produces off-lane noise.

| Changed paths | Read |
|---|---|
| `lib/calculations/`, `lib/monte-carlo/`, `lib/constants/`, `lib/store/`, any `*.test.ts` | `references/regression.md` |
| `components/`, `app/**/*.tsx`, `app/globals.css` | `references/styling.md` |
| `app/api/`, `app/auth/`, `lib/auth/`, `lib/supabase/`, `lib/security/`, `supabase/migrations/`, `proxy.ts` | `references/security.md` |
| Anything at all | `references/best-practices.md` |

`references/best-practices.md` always applies — it carries the testing bar, the
documentation tiers, and the pre-commit verification gates that govern every change.

## Step 3 — Verify before you report

The project has been bitten by unverified claims: a task was logged as "zero tests on the
Zustand stores", copied from a stale CLAUDE.md note, when both stores had 52 passing tests
between them. The correction is recorded in `docs/project-phases/phase-1-5-testing-validation.md`.

So: **read the actual code before asserting anything about it.** A grep hit is a lead, not
a finding.

- Claiming a function is duplicated? Open both copies and confirm they compute the same thing.
- Claiming a test is tautological? Read the assertion and show why it cannot fail.
- Claiming a token is hardcoded? Confirm it is not inside `app/globals.css`, where raw
  values are correct by design.
- Claiming coverage or test counts? Run the command. Do not quote a doc.

When a regression claim depends on types, run `npm run typecheck` — it is the only gate that
sees test files, and it is cheap. If you assert "this breaks the build", you must have run it.

Discard any finding you could not verify. A short, verified report beats a long, speculative one.

## Step 4 — Report

Rank strictly by user impact — how much money or how many years of a real retiree's plan
ride on it — not by how confident you feel or how easy the fix is. A hardcoded hex value and
a silently wrong withdrawal calculation are not peers.

```markdown
## Verdict
[One line: is this safe to commit? If not, what is the blocking item?]

## Findings

### [Severity] Title
- **Where:** `file.ts:line`
- **Rule:** [the rule, stated plainly]
- **Source:** [`docs/...` or CLAUDE.md — where this rule is written down]
- **Why it matters:** [the concrete failure, ideally the incident this rule came from]
- **Fix:** [what to change]

## Clean
[Lanes checked that came back clean — name them, so the user knows the coverage]

## Not checked
[Anything out of scope, and which neighbour covers it]
```

Severities: **Critical** (wrong money, security hole, data loss) · **High** (real defect,
narrower blast radius) · **Medium** (convention violation that will cause drift) ·
**Low** (cosmetic, mechanical).

Give Critical and High full detail. Collapse Medium and Low to one line each — a wall of
Low findings buries the item that actually matters.

Report zero findings as zero findings. Padding a clean review with speculative nits trains
the user to skim, which costs them the one real finding next time.

## Step 5 — Hand off

Close with what this review did *not* cover:

- Calculation changes → recommend `/audit` for mathematical and SA-tax verification
- Missing tests on calculation code → note that CLAUDE.md rule 1 makes them mandatory, and
  that `test-generator` writes them
- Meaningful change with no doc updates → note CLAUDE.md rule 2 and the three-tier
  requirement in `references/best-practices.md`

Do not fix anything during the review. Report first; the user decides what to act on.

## Keeping this skill honest

These checklists are distilled from `docs/` at a point in time. When conventions change,
they go stale — and a stale reviewer is worse than none, because it asserts with confidence.
`references/refreshing.md` explains how to re-derive them. Re-run it after any phase that
adds conventions, and if you notice a rule here contradicting current `docs/` or CLAUDE.md
while reviewing, say so in the report rather than enforcing the stale version.
