# house-rules — Eval Iteration 1 (2026-08-16)

Formal eval loop of the house-rules skill: 4 synthetic review scenarios ×
{with skill, without skill} = 8 runs, each graded against the evals.json
assertion set by an independent grader blind to the skill.

Session `36fb27a4-2bf9-4c91-910b-185385e1d8b0` died mid-loop on a monthly
spend limit with all 8 runs and all 8 grades on disk. This report completes
the synthesis.

## Scoreboard

| Eval | without_skill | with_skill | Discriminates? |
|---|---|---|---|
| 0 weakened-test-regression | 6/6 | 6/6 | No |
| 1 duplicated-engine-logic | 6/6 | 6/6 | No |
| 2 unprotected-api-route | 8/8 | 8/8 | No |
| 3 design-system-violations | 7/7 | 7/7 | No |
| **Total** | **27/27** | **27/27** | **No** |

## Verdict

**The iteration-1 eval cannot distinguish skill from no-skill.** All four
graders reached the same conclusion independently: the assertions measure
whether the reviewer read CLAUDE.md (auto-loaded in this repo) and the
vitest output, not whether the skill adds value. The skill did not fail — the
harness failed to test it. Two fixture confounds, three classes of
non-discriminating assertion, and four real quality differences that no
assertion covered.

## Why there is no signal

### Fixture confounds (both arms handed the answer)

1. **Eval 0 fixture leaves the suite red.** vitest prints INV-007's source,
   which literally contains `"collapses to 0 again — the 75f68f7 regression"`,
   plus the before/after `shortfallAmount` values from the golden failure.
   Four of six assertions (citation, explanation, severity, presence) are
   satisfiable by running the suite and paraphrasing the stack trace. The
   paired-weakening reasoning the eval exists to test is never required.
   Fix: fixture must keep the suite **green** (weaken INV-007 + refresh the
   golden snapshot in the same diff), forcing the regression to be found by
   reading the diff.
2. **Eval 1 fixture ships a broken import** (`@/lib/types` — path does not
   exist). It hands both arms a free mechanically-verifiable Critical and
   guarantees a "do not commit" verdict regardless of whether the duplication
   is noticed. Fix: make the fixture compile.

### Non-discriminating assertions

- **Eval 1 (4 of 6)** and **Eval 3 (5 of 7)**: the assertions are near-verbatim
  CLAUDE.md Common Pitfalls bullets. The baseline passed them by block-quoting
  CLAUDE.md — which is auto-loaded and contains the exact strings
  (`"single source of truth for projectFinalSavings"`, `"(3 copies, Phase 1.5)"`,
  the banned card pattern, `Don't hardcode monthlyReturn = annualReturn / 12`).
- **Eval 2 (6 of 8)**: generic security-review items any competent reviewer
  applies to a 25-line unauthenticated POST handler. The one project-specific
  assertion (cite AUTH-003) is satisfiable by grepping `docs/security/`.
- **"Rates the finding Critical or High" is label-coupled**: the baseline
  called the finding "Blocker 1/2/3" + "do not commit" — severity at or above
  Critical without the literal words. Graded on substance, but a literal
  grader would score it differently. Reword to "treats as commit-blocking".
- **"Connects … as a paired regression" is soft**: both runs passed on framing
  sentences while structuring the two as separate findings. Make it
  falsifiable: "states that the original assertion would fail against the new
  engine code".
- **Eval 0's "survive but underpay" wording points at the wrong case**: the
  severe case is the **depleted** plan (`finalBalance === 0`) reporting zero
  shortfall; a genuinely surviving plan already reported 0 correctly per the
  settled semantics. Reword to target the reachability insight.

### Real quality differences — all unasserted

| Observation | Direction | Impact |
|---|---|---|
| `#1a936f` traced to hsl(162 70% 34%) — the **pre-audit `--primary` retired by the 2026-08-16 accessibility audit** | with_skill only | skill wins |
| Pills `bg-emerald-500`/`text-white` at 2.54:1 fail WCAG AA; regression of same-day audit | both, unasserted | highest-severity real finding, never measured |
| Service-role client bypasses `public.mfa_satisfied()` — the project's **single 2FA enforcement point** (RLS, `20260802000100_mfa_rls.sql`) | **without_skill only**; with_skill explicitly cleared SEC3 | **baseline wins — a genuine skill blind spot** |
| Baseline's finding 4 inverts nominal/compound figures (R19.04m vs R21.22m), contradicting its own finding 7 | without_skill error, uncaught | no assertion penalizes wrong numbers |
| with_skill claims "plan-summary is the only route without a test" — false (`plan-narrative` has none) | with_skill error, uncaught | no negative assertion on repo claims |
| Baseline offered forward-looking advice about a tile that does not exist + claimed a "reproduction script available on request" that was never produced | without_skill | no scope-discipline assertion |

## What iteration 2 must change

1. **Fixtures**: eval 0 → suite stays green (weaken INV-007, refresh golden);
   eval 1 → fix the import so the file compiles.
2. **Assertions** (rewritten in `evals.json`):
   - Require the paired-regression finding via falsifiable mechanics
     ("original assertion would fail against new engine code")
   - Require the reachability insight ("false branch unreachable → shortfall
     zero on every path, including depleted plans")
   - Severity as "commit-blocking", not vocabulary
   - Citations from sources vitest does not print (green suite makes this real)
   - Add remediation assertions (revert engine + restore assertions; do NOT
     regenerate golden / relax INV-007; delete quick-estimate.ts in favour of
     importing projectFinalSavings)
   - Add negative assertions (no fabricated/inverted numbers, no advice about
     files that don't exist, no false "only route" claims, verification-scope
     honesty, no colour-only false positive)
   - Eval 2: assert SEC4's "key read in exactly two places; third call site
     needs justification" — skill-only knowledge — and the MFA-gate bypass
   - Eval 3: assert the retired-token provenance of `#1a936f` and the WCAG
     contrast regression
   - "Does not edit any file" stays as guardrail only, excluded from the
     discrimination count (free credit for a review-only prompt)
3. **Skill fixes** (the eval surfaced two):
   - `references/security.md`: the MFA/RLS enforcement gate
     (`public.mfa_satisfied()`) is not covered — with_skill missed the most
     project-specific finding of the eval. Add it.
   - Stale temporal phrasing in `references/security.md` SEC6 ("the diff
     currently touches both") and `references/styling.md` S5 ("the diff
     currently touches dialog/dropdown-menu/select").
