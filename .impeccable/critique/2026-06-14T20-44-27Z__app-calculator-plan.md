---
target: plan page
total_score: 26
p0_count: 0
p1_count: 0
p2_count: 0
p3_count: 3
timestamp: 2026-06-14T20-44-27Z
slug: app-calculator-plan
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live feedback throughout; still no autosave or calculation-in-progress indicator |
| 2 | Match System / Real World | 3 | Split two-line hint scans faster; description orients goals card; inputs still show raw integers |
| 3 | User Control and Freedom | 2 | No undo; no reset-to-SA-defaults; instant state commits on every keystroke |
| 4 | Consistency and Standards | 3 | Four cards, each with accurate description; border-t rhythm break in Market Assumptions |
| 5 | Error Prevention | 3 | Cross-field validation catches retirement age / life expectancy inversions |
| 6 | Recognition Rather Than Recall | 3 | All sections labelled; strategy linked via htmlFor; Retirement Goals description adds context |
| 7 | Flexibility and Efficiency | 2 | Tab order correct; no keyboard shortcuts, no reset-to-defaults quick action |
| 8 | Aesthetic and Minimalist Design | 3 | Orphaned grid resolved; inflation field clean; descriptions add information without visual noise |
| 9 | Error Recovery | 2 | Inline Zod errors present; messages still mechanical |
| 10 | Help and Documentation | 2 | Tooltips substantive; no searchable docs |
| **Total** | | **26/40** | **Both P2s resolved; only P3s remain — surface is structurally sound** |

---

## Anti-Patterns Verdict

**LLM assessment**: No AI-slop signals. The compact inflation input with inline helper text and border-t separator reads as a deliberate design decision, not a copy-paste artefact. The two-line hint in Retirement Goals is the correct density for a calculation tool: precise without being noisy.

**Deterministic scan**: Clean. Zero findings.

---

## Overall Impression

The page has reached structural maturity. Both previous P2 issues are gone: the orphaned grid in Market Assumptions is resolved with a compact inline layout, and Retirement Goals now has a description that orients users before they interact. The page reads as a coherent four-card planning sequence. What remains are P3 polish items — none of them block a user from accomplishing their goal.

---

## What's Working

1. **The inflation field treatment is correct.** Compact input + inline helper text + border-t separator creates a deliberate visual break between Volatility and Inflation without needing a fourth sub-section label. The border-t communicates "related but distinct" without adding noise.
2. **Two-line hint scans as two facts.** "Today: R 18 756 / month" / "At retirement (30 yrs): R 93 479 / month" gives the user the current anchor and the projection as separate, scannable data points — not one long sentence they have to parse.
3. **Every card has a purpose statement.** Personal Information, Retirement Goals, Market Assumptions, and Drawdown Strategy each now have a description that accurately predicts their contents. No card is ambiguous at a glance.

---

## Remaining Issues (P3 only)

### [P3] Redundant "PLAN" label in content area

The `PageHeader` renders "PLAN" in the content area beneath the topbar, which already shows "PLAN" in the breadcrumb/title slot. Two labels, same word, no added information.

**Fix**: Either remove the content-area `PageHeader` entirely (the topbar already establishes context), or change it to something more descriptive — e.g. "Retirement Plan" or a scenario name.

---

### [P3] No "reset to SA defaults" action on Market Assumptions

Users doing sensitivity analysis can't quickly restore default SA parameters after experimenting.

**Fix**: Add a ghost button `Reset to defaults` in the `PageCard`'s `trailing` slot. On click: `setAssumptions(defaultAssumptions)` and `setRetirementGoals({ inflationRate: SA_DEFAULTS_DISPLAY.inflation })`.

---

### [P3] Annual Income hint hidden at 0

The "R 600 000 / year" hint disappears when the field is cleared to 0. For a field where 0 is never a real value, the hint vanishing creates a "did something break?" moment.

**Fix**: Show the hint unconditionally, or at minimum show "R 0 / year — income is required for tax calculations" when the value is 0. The tax deduction context makes 0 meaningful to flag.

---

## Persona Check

**Piet (SA Financially Literate Planner)**
- Reads Retirement Goals description, understands the card's scope before touching anything. ✅
- Sees "Today: R 18 756 / month / At retirement (30 yrs): R 93 479 / month" — both values scan instantly. ✅
- Changes equity return from 11% to 18%, wants to reset — no reset button, must recall defaults. ⚠️
- Notices "PLAN" twice on the page. Harmless but sloppy for a precision tool. ⚠️

**Riley (Stress Tester)**
- Expected Inflation: types 25 (above max 20) — Zod validation fires after submit, not inline on input for number fields (browser behavior). Input accepts the keystrokes but rejects on watch subscription. Behaviorally correct, just not instant feedback.
- Clears Annual Income to 0 — hint disappears, no warning that 0 affects tax calculations.

---

## Questions to Consider

- "The page currently has no visible scenario context — a user with multiple scenarios doesn't know which one they're editing without navigating away. Should the scenario name appear in the Plan header?"
- "Reset-to-defaults is a power-user feature. Is a ghost button the right pattern, or would a context menu on the card label be less disruptive to the visual hierarchy?"
