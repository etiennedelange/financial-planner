# house-rules — Eval Iteration 2 + 3 (2026-08-16)

Follows `iteration-1-report.md`. Iteration 1's harness could not discriminate
(27/27 both arms; assertions restated CLAUDE.md, fixtures handed over the
answers). Iterations 2 and 3 rebuild the harness and close the skill gaps it
exposed.

## Iteration 2 — rebuilt harness

Fixture changes:
- **Eval 0 now keeps the suite GREEN** (985/985): the fixture also weakens
  INV-007 and regenerates the golden snapshot against the broken engine, so
  the 75f68f7-shaped regression is only findable by reading the diff. No
  vitest output hands over the citation or the values anymore.
- **Eval 1 fixture now compiles**: the `@/lib/types` import typo that gave
  both arms a free Critical in iteration 1 is fixed.
- Assertions rewritten: 27 → 35 (31 discriminating + 4 guardrails). New
  categories: falsifiable paired-regression claims, reachability insight,
  "commit-blocking" instead of label-coupled severity, remediation
  requirements (no UPDATE_GOLDEN / no relaxing invariants / delete the
  duplicate in favour of the shared function), negative assertions
  (reproducible numbers, no advice about nonexistent files, no fabricated
  repo claims, verification-scope honesty, no colour-only false positive),
  and skill-only knowledge (SEC4 third-call-site rule, MFA-gate bypass,
  retired-token provenance, WCAG contrast).

### Scoreboard (guardrails excluded)

| Eval | without_skill | with_skill |
|---|---|---|
| 0 weakened-test-regression | 7/7 | 7/7 |
| 1 duplicated-engine-logic | 7/7 | 7/7 |
| 2 unprotected-api-route | 9/9 | 9/9 |
| 3 design-system-violations | 6/8 | 6/8 |
| **Total** | **29/31** | **29/31** |

All quantitative claims in every report were re-verified by the graders
against the repo's own functions (figures recomputed to the rand; WCAG ratios
recomputed; typecheck re-run).

### What iteration 2 found — three real skill defects

1. **Retired-token provenance not in the skill.** Both arms failed "identifies
   `#1a936f` as the pre-audit `--primary` (hsl 162 70% 34%) retired by the
   2026-08-16 accessibility audit". The fact exists only in
   `docs/history/2026-08-16-shadscan-accessibility-audit.md`; the skill's
   styling checklist called the hex merely "off-palette". A reviewer can find
   it by luck; the skill should make it load-bearing.
2. **WCAG AA contrast not in the skill.** Both arms missed that
   `bg-emerald-500`/`text-white` (2.54:1) and `bg-red-500`/`text-white`
   (3.76:1) fail AA — the highest-severity real finding of the fixture, and a
   direct regression of the same-day audit.
3. **The skill's colour-only check over-applied — a precision regression.**
   The with_skill run flagged the status pill as "signalled by colour alone"
   even though it renders `On track` / `Behind target` as text. The S5 check
   lacked an observable predicate; the baseline arm correctly declined.

### Skill fixes applied (RED → GREEN)

- `references/security.md` SEC4: added the RLS-based 2FA enforcement gate
  check (`public.mfa_satisfied()` — the project's single enforcement point,
  which service-role clients bypass). Iteration 1 showed the with_skill arm
  missed exactly this; the iteration-2 with_skill run found it.
- `references/security.md` SEC6 and `references/styling.md` S5:
  de-temporalized stale "the diff currently touches …" phrasing.
- `references/styling.md` S2: `#1a936f` documented as the retired pre-audit
  `--primary` value that regresses the audit.
- `references/styling.md` S5: colour-only check keyed to an observable
  predicate (state not conveyed by text or icon — a pill that renders text is
  not colour-only); WCAG AA contrast numbers added.

## Iteration 3 — verification of the fixes (eval 3 only)

| Eval | without_skill | with_skill |
|---|---|---|
| 3 design-system-violations | **8/8** | **8/8** |

Both arms now identify the retired token, give correct contrast ratios
(2.54:1 / 3.76:1, independently recomputed by the grader), and decline the
colour-only false positive. The with_skill arm's precision failure from
iteration 2 is gone.

## Verdict

The harness now discriminates: iteration 2's harder fixture set turned up
three real skill defects, all fixed and verified in iteration 3. The
headline-scores caveat stands — on this repo, with its unusually complete
CLAUDE.md, a competent reviewer without the skill still finds most rules by
reading the project files; the skill's measured contribution is precision
(no colour-only false positive after the fix), provenance discipline, lane
structure, and the two checks that live only in its reference files
(SEC4 third-call-site rule, MFA gate, retired-token provenance, WCAG
numbers). That is the honest ceiling for a conformance skill on a
well-documented repo.

## Artifacts

- Harness: session scratchpad
  `house-rules-workspace/{iteration-1,iteration-2,iteration-3}/` — 8+2 runs,
  all `grading.json`, fixtures (`apply_fixtures.py`, `apply_fixtures_v2.py`)
- Assertions: `evals/evals.json` (iteration 2, 35 assertions)
- Reports: `evals/iteration-1-report.md`, this file
