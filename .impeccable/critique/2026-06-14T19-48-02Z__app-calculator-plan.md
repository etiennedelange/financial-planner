---
target: plan page
total_score: 25
p0_count: 0
p1_count: 2
p2_count: 2
p3_count: 1
timestamp: 2026-06-14T19-48-02Z
slug: app-calculator-plan
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live derived feedback (years to retirement, inflation-adjusted income, lump sum value) is excellent; no autosave/calculation status indicator |
| 2 | Match System / Real World | 3 | SA-specific terminology is accurate; raw unformatted numbers (18756, 600000) break the real-world expectation that monetary values look like money |
| 3 | User Control and Freedom | 2 | No undo, no "reset to defaults"; instant update means any typo is immediately committed to state |
| 4 | Consistency and Standards | 3 | PageCard + SectionLabel applied consistently; Market Assumptions card bundles two conceptually distinct domains in one container |
| 5 | Error Prevention | 2 | Per-field min/max constraints exist; no cross-field validation (retirement age can be set below current age); no confirmation on large value changes |
| 6 | Recognition Rather Than Recall | 3 | Good labeling and tooltip coverage; Medical Aid/Dependants pair inside Drawdown Strategy section lacks its own sub-label for context |
| 7 | Flexibility and Efficiency | 2 | Tab order works; no keyboard shortcuts; no "use SA defaults" or "reset" quick-action for power users who want to start fresh |
| 8 | Aesthetic and Minimalist Design | 3 | Generally clean; Market Assumptions card carries 10 form controls across 4 sub-sections, violating the working memory limit |
| 9 | Error Recovery | 2 | Zod error messages appear inline near the field but messages are mechanical ("String must contain at least X characters"); no plain-language recovery copy |
| 10 | Help and Documentation | 2 | Contextual InfoTooltips are substantive and SA-specific; no broader searchable docs or "what does this affect?" flow links |
| **Total** | | **25/40** | **Acceptable — significant improvements needed before financially literate users fully trust it** |

---

## Anti-Patterns Verdict

**Does this look AI-generated?**

**LLM assessment**: No, this doesn't trigger the strongest AI-slop signals. There's no gradient text, no hero-metric template, no identical icon-card grids, no glassmorphism. The section label pattern (gold left-border mono all-caps) is an intentional system choice from the design language, not an eyebrow reflex — the labels are the card titles, not decorative scaffolding above a heading. The dark-first palette and IBM Plex stack feel deliberate and domain-appropriate. The strongest remaining "generic AI" read is the empty dead space below the last card and the unformatted numeric inputs — both break the "calculation instrument" register the design system promises.

**Deterministic scan (detect.mjs)**: Clean. Exit code 0, no flagged violations in the four source files. The detector did not catch absolute-ban patterns. No false positives.

**Visual overlays**: Browser screenshot was captured directly — dev server at localhost:3000/calculator/plan. No overlay injection was needed; visual evidence was captured via screenshot.

---

## Overall Impression

The plan page follows the design system faithfully and the live feedback mechanisms are genuinely useful ("30 years until retirement | 25 years in retirement", the inflation-adjusted monthly income projection). The problem is structural: the Market Assumptions card is doing the work of two separate cards — market parameters (what returns will be) and drawdown configuration (how you'll withdraw). That bundling creates a 10-input card that violates working memory limits and buries the medical aid fields without a label. Fix the card split and add cross-field validation, and this page moves from "acceptable" to "solid."

---

## What's Working

1. **Live derived feedback is excellent.** The "30 years until retirement | 25 years in retirement" summary in Personal Information, the inflation-adjusted income projection in Retirement Goals, and the real-money lump sum figure on the slider all convert abstract inputs into immediate, meaningful output. This is the best UX pattern on the page.

2. **Tooltip content is substantive.** InfoTooltip copy is specific to SA regulations — RA/pension deduction rates, s6A tax credits, the one-third lump sum cap. This is not placeholder generic copy; it earns the tooltip icon next to each label.

3. **Design system compliance.** PageCard + SectionLabel applied correctly throughout. Shadow-none cards, gold left-border labels, shadow-none enforcement. The system is coherent and internally consistent across all three form cards.

---

## Priority Issues

### [P1] Market Assumptions card has two unrelated domains in one container

**What**: The `AssumptionsForm` card bundles market parameters (equity/bond/cash returns + volatility = 5 inputs) with drawdown configuration (strategy select, withdrawal rate slider, lump sum slider, medical aid input, dependants input = 5 controls). That's 10 form controls across 4 sub-sections in a single PageCard. The card's own description copy ("Reference values for asset class returns. Each account uses its own expected return setting.") only describes the first half — because the second half is conceptually a different thing.

**Why it matters**: Market parameters are world-state assumptions. Drawdown configuration is a behavioral decision. Users who come to adjust their withdrawal rate have to scroll past equity return inputs to get there. Users adjusting equity returns encounter drawdown sliders with no conceptual connection. The cognitive load score fails here: 10 concurrent controls far exceeds the 4-item working memory limit.

**Fix**: Split into two PageCards. Card 1: "Market Assumptions" — equity/bond/cash returns + volatility. Card 2: "Drawdown Strategy" — strategy select, withdrawal rate, lump sum, medical aid/dependants. The split also enables the "Drawdown Strategy" card to have a proper description that explains what that section controls.

**Command**: `/impeccable layout plan page`

---

### [P1] Monetary inputs display raw unformatted numbers

**What**: The Annual Income field shows "600000", Desired Monthly Income shows "18756", Legacy Goal shows "0". These are `type="number"` inputs, so browser formatting is limited during editing, but there is no affordance beyond the "(R)" unit in the label to signal that "600000" means R 600 000.

**Why it matters**: The design system promises "calculation instrument" precision. Unformatted raw integers break that register. A financially literate user scanning their Annual Income sees "600000" and has to mentally parse whether it's R600k or R6M — the opposite of a precision instrument. The inflation-adjusted income helper ("At retirement (30 years), this equals R 93 479 per month") already formats correctly; the inputs should match that register.

**Fix**: Add a formatted display hint below each monetary input showing the parsed value in currency format, similar to the inflation-adjusted hint already on the Desired Monthly Income field. Alternatively, show the formatted value as a readonly styled overlay when the field is not focused (CSS trick: hide the number input, show a formatted sibling div on blur, swap back on focus).

**Command**: `/impeccable harden plan page`

---

### [P2] No cross-field validation: retirement age can be set below current age

**What**: The Personal Information form validates each field independently (currentAge min 18, retirementAge min 40) but has no cross-field constraint enforcing retirementAge > currentAge. A user can enter currentAge=70, retirementAge=40, producing "−30 years until retirement | −25 years in retirement" in the summary panel. This is not caught by the schema.

**Why it matters**: The downstream projection for negative years-to-retirement will produce incorrect or meaningless values. This is a silent correctness failure — the form accepts the state, the live feedback shows a clearly broken number, and the projections will compute garbage. For a financially literate user running real scenarios, this erodes trust in the tool's accuracy.

**Fix**: Add a Zod `.superRefine()` or `.refine()` at the schema level: `retirementAge must be greater than currentAge`. Show the error on the retirementAge field. Also enforce the same constraint between retirementAge and lifeExpectancy.

**Command**: `/impeccable harden plan page`

---

### [P2] Medical Aid and Dependants inputs have no sub-section label

**What**: Inside the Drawdown Strategy sub-section, there are 3 labeled sub-groups: "Drawdown Strategy" (select + sliders), but Medical Aid and Dependants appear after the Lump Sum slider with no label or grouping boundary. Every other input group on the page has a SectionLabel; these two inputs are orphaned.

**Why it matters**: Users scrolling through the Drawdown Strategy section encounter two inputs (Medical Aid R/month, Dependants) that appear visually disconnected from the controls above them. The tooltip content mentions "s6A tax credit" — a tax concept — which makes this a different concern (tax modelling) from the withdrawal rate above it (risk/drawdown). Without a label, the relationship between these inputs and the rest of the section is opaque.

**Fix**: Add a SectionLabel "Medical Aid & Tax Credits" above the Medical Aid/Dependants inputs. Move this group into its own visual cluster (consistent `space-y-4` block) inside the Drawdown Strategy section, after the sliders. This will be cleaner once the Market Assumptions card is split into two cards per the P1 fix.

**Command**: `/impeccable layout plan page`

---

### [P3] "Expected Inflation" lives in Retirement Goals rather than Market Assumptions

**What**: The `RetirementGoalsForm` contains an "Expected Inflation (%)" field. All other market parameters (equity returns, volatility) live in Market Assumptions. Conceptually, inflation is a market parameter, not a goal.

**Why it matters**: A user wanting to adjust inflation assumptions would look in Market Assumptions, not Retirement Goals. The placement makes sense mechanically (inflation adjusts the desired income projection) but breaks the mental model. The label "Expected Inflation" signals a world-state assumption, not a retirement goal.

**Fix**: Consider moving the inflation rate field to the Market Assumptions card, with the existing context — the inflation-adjusted income feedback can remain in the Retirement Goals card by sourcing it from the store value. Alternatively, rename the field within Goals to "Inflation assumption for income projection" to clarify its scoped purpose.

**Command**: `/impeccable clarify plan page`

---

## Persona Red Flags

**Piet (SA Financially Literate Planner)** *(project-specific — the target user per PRODUCT.md)*

Profile: Understands RA/TFSA/pension fund rules, has done Excel retirement modelling, opens this tool to run better Monte Carlo projections than a spreadsheet can.

- Sees "600000" in Annual Income — must parse mentally that it's R600k. Breaks precision-instrument register.
- Wants to quickly adjust withdrawal rate: must scroll past 5 market parameter inputs to reach the slider.
- Sets retirement age to 60 and current age to 62 testing edge cases — gets "−2 years until retirement" with no error. Trusts the tool less.
- Expects "reset to SA defaults" for market assumptions after experimenting — no quick action exists.

**Alex (Power User)**

- Tabs through Personal Information fields quickly — tab order is correct, works fine.
- Hits Market Assumptions and encounters a 10-input card — no way to collapse sub-sections or jump to Drawdown Strategy directly.
- Presses Escape in the Strategy dropdown — works (native select). Slider is keyboard-navigable via arrow keys — good.
- No keyboard shortcut to navigate between the three form cards.

**Riley (Stress Tester)**

- Sets currentAge=70, retirementAge=40: "−30 years until retirement | −25 years in retirement" — no validation error, passes to projection engine. Silent failure.
- Enters a large Legacy Goal (R99,999,999) — input accepts it without issue, produces a very large required nest egg, no warning.
- Tabs into Annual Income, types "abc" — number input silently ignores alpha chars, shows empty or last valid value. No error shown for the annualIncome field specifically (the schema validation only fires on actual number values).

---

## Minor Observations

- The page header shows "PLAN" as a small mono label above the description text, and "PLAN" also appears in the top navigation bar. The content-area "PLAN" is redundant — the page title in the topbar already identifies the section.
- The "Amount to leave behind" helper text below Legacy Goal is too obvious to earn its space. Remove it or replace with more useful context ("Includes estate duty implications at current limits").
- The Strategy dropdown is labeled "Strategy" with a generic `<Label>Strategy</Label>` — this label has no htmlFor attribute pointing to a specific id, so it's not linked to the Select component. Accessibility gap.
- The `inflationRate` field in Retirement Goals is duplicated in the store (`retirementGoals.inflationRate`) and also referenced from assumptions — worth auditing whether these are the same value or can drift.
- Significant empty space below the final card on the page. Once the Market Assumptions card is split, the page length should fill more naturally.

---

## Questions to Consider

- "What if the Market Assumptions and Drawdown Strategy cards were separate — would users know where to look for each?"
- "Should monetary number inputs show a formatted value below them (like the inflation-adjusted income already does), or should they stay as raw numbers because the user is actively editing them?"
- "The three cards are stacked with identical `space-y-6` rhythm — is there any visual signal that helps users understand the planning flow: personal facts → goals → model assumptions → drawdown rules?"
