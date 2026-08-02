---
target: Projections page
total_score: 25
p0_count: 0
p1_count: 4
timestamp: 2026-06-15T18-07-01Z
slug: components-pages-projections-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No loading state while projection calculates; null projection returns nothing silently |
| 2 | Match System / Real World | 4 | SA terminology (RA, TFSA, Section 11F, Go-Go/Slow-Go) used correctly throughout |
| 3 | User Control and Freedom | 2 | Read-only page; no quick links from insight callouts back to the relevant input fields |
| 4 | Consistency and Standards | 2 | Hardcoded Tailwind colors in projection-summary vs. semantic tokens everywhere else; `font-mono` on table cells but not metric values |
| 5 | Error Prevention | 3 | Null checks throughout; graceful empty states; depletion rows highlighted in red |
| 6 | Recognition Rather Than Recall | 3 | InfoTooltips explain calculations; accordions are labelled clearly; RA section cross-references "Planning Inputs" by name only |
| 7 | Flexibility and Efficiency | 1 | No export, no keyboard accordion navigation, no quick-jump to sections, no clipboard copy for payslip values |
| 8 | Aesthetic and Minimalist Design | 2 | Standalone empty `PageCard` before accordion adds noise; all 5 metric cards carry equal weight despite vastly different stakes |
| 9 | Error Recovery | 2 | Empty states ("Add accounts to see…") exist but give no link or path to fix |
| 10 | Help and Documentation | 3 | InfoTooltips well-done; formula section is excellent for power users |
| **Total** | | **25/40** | **Acceptable — significant improvements needed** |

---

## Anti-Patterns Verdict

**Does this look AI-generated?**

**LLM assessment**: Not egregiously, but there are tells. The `ProjectionSummary` 5-card grid is a near-perfect instance of the "hero-metric template" ban: icon top-right, `text-2xl font-bold` value, small muted label, repeated × 5 in a responsive grid. The metric cards all carry identical visual weight — no differentiation between "Portfolio at Retirement" (interesting but derivative) and "Plan Success Rate" (the number the user came to see). The page structure (metrics → insights → breakdown) is sensible; it's the component-level choices that feel generated.

**Deterministic scan**: `detect.mjs` returned `[]` — the bundled detector found zero absolute-ban violations. The primary issues (hardcoded Tailwind colors, missing mono font, tonal depth) are design-system-specific and not caught by the generic ruleset.

---

## Overall Impression

The page is data-dense and genuinely useful — the accordion breakdown is thorough, the RA optimization section is a standout feature. The biggest single problem is that the most important number on the page (Plan Success Rate — the one number that answers "will I be okay?") is treated as the 5th card in a row of equals. A user landing here doesn't immediately know what to focus on. Fix the hierarchy and resolve the design-system inconsistencies, and this page becomes excellent.

---

## What's Working

1. **RA Contribution Optimisation section** — The carry-forward credit explanation, utilisation bar, and tax-saving callout are precise and genuinely useful. Showing the Section 11F mechanics with actual numbers is exactly what this audience needs.

2. **InfoTooltips on every insight** — Each of the 4 insight cards has a well-written tooltip explaining the calculation methodology. This is contextual help done right — right information, right place, no modal.

3. **Tax-optimal withdrawal sequence** — The drawdown table column order (TFSA → Discretionary → Pension) correctly reflects the tax-efficient sequencing, and the footnote `TFSA (tax-free) → Discretionary (CGT only) → Pension/RA (full income tax)` makes it explicit. Domain-correct and instructional.

---

## Priority Issues

### [P1] Hardcoded Tailwind colors in `ProjectionSummary` break the design system and both themes

**What**: `getSuccessConfig()` in `projection-summary.tsx:35–60` returns hardcoded Tailwind class strings: `border-green-500`, `text-green-600 dark:text-green-400`, `border-emerald-500`, `border-yellow-500`, `text-orange-500`, `border-red-500`, etc. The "Portfolio Depletion" warning uses `border-orange-500` and `text-orange-500`.

**Why it matters**: These bypass the design system's semantic color vocabulary entirely. They won't respond correctly to theme changes, light/dark mode, or future token updates. The design system defines `text-chart-2` (teal, for positive), `text-warning` (amber), `text-destructive` (red) — this component ignores all of them. The "Excellent" success rate border in the light theme is a raw green that doesn't match any established chart or status color.

**Fix**: Replace with semantic tokens:
- 90%+ → `border-chart-2 text-chart-2` (teal — the "positive" semantic)
- 75%+ → `border-primary text-primary` (gold — "on track")
- 60%+ → `border-warning text-warning`
- 40%+ → `border-warning/60 text-warning`
- <40% → `border-destructive text-destructive`
- "Portfolio Depletion" warning: `border-warning text-warning`

**Suggested command**: `/impeccable polish`

---

### [P1] Metric card values not using IBM Plex Mono — violates the Mono Reserve Rule

**What**: `ProjectionSummary` renders metric values with `text-2xl font-bold` (`projection-summary.tsx:141`) — no `font-mono`. Every financial value (R5.2M, R28,400/mo) displays in IBM Plex Sans.

**Why it matters**: The design system's "Mono Reserve Rule" is explicit: IBM Plex Mono is reserved for financial output values (formatted currency, percentages) and the wordmark logotype. It signals "this is a number, from a calculation." The `calculations-breakdown.tsx` tables correctly use `font-mono` on every currency cell. The divergence between the hero metric values and table values is inconsistent and weakens the brand register.

**Fix**: Add `font-mono` to the value `<p>` in `ProjectionSummary`. The 2xl bold size will still read with authority; mono will add the calculation-context signal.

**Suggested command**: `/impeccable polish`

---

### [P1] Four simultaneous gold accent icons violate the One Signal Rule

**What**: `InsightsPanel` renders 4 `PageCard` components with `leading={<Icon className="h-4 w-4 text-primary flex-none" />}` — Target, Clock, PieChart, Heart — all in Analyst Gold simultaneously.

**Why it matters**: The design system's "One Signal Rule" is explicit: "Analyst Gold is used on ≤1 active element per view at a time. Applying it to multiple concurrent elements breaks the signal." Four gold icons in a single scroll view collapse the accent's authority. Gold stops meaning "primary" when everything is gold.

**Fix**: Use `text-muted-foreground` for the Clock, PieChart, and Heart icons. Reserve `text-primary` only for the Optimal Contribution section — which is the primary actionable insight. Or consider a different leading indicator (colored dots or a subtle type label) for the other three sections.

**Suggested command**: `/impeccable polish`

---

### [P1] Standalone empty `PageCard` header before the accordion creates a double-header

**What**: `CalculationsBreakdown` at line 185 renders `<PageCard label="Calculations Breakdown" description="Detailed view of all calculations and formulas used" />` as a content-less card immediately followed by the accordion. This floating card has no content — it's a header card that adds a visual gap and duplication.

**Why it matters**: The user sees a bordered card saying "Calculations Breakdown" followed immediately by another bordered container (the accordion). It reads as a mistake or empty state rather than intentional structure. The first accordion trigger already has a label + icon — the outer card adds noise without adding hierarchy.

**Fix**: Remove the standalone `PageCard`. Wrap the entire accordion in a `PageCard` instead, using `contentClassName="p-0"` to let the accordion items sit flush inside it, or simply remove the outer card and let the accordion items carry the section identity themselves.

**Suggested command**: `/impeccable polish`

---

### [P2] Metric card hierarchy is flat — the most important number is buried

**What**: All 5 metric cards in `ProjectionSummary` have identical visual weight: same card size, same `text-2xl font-bold`, same `text-sm text-muted-foreground` label, same layout. "Plan Success Rate" (the number that answers "will I be okay?") is card 5 of 5 — rightmost, no differentiation.

**Why it matters**: Financially literate users want the single most important signal first and loudest. Plan Success Rate is existential (am I on track at all?); "Final Balance at life expectancy" is a derived outcome. The current layout forces users to mentally process 5 equal-weight cards to find the one that matters most.

**Fix**: Give "Plan Success Rate" a primary visual role — larger value, or `bg-primary/5 border-primary` treatment when available. Consider moving it first in the card order. "Portfolio at Retirement" and "Monthly Income" are complementary and can be paired smaller. "Final Balance" is the least decision-relevant for most users.

**Suggested command**: `/impeccable layout`

---

## Persona Red Flags

### Alex (Power User — primary persona for this tool)

- **Success Rate is card #5 in a row of equals.** Alex scans left-to-right; by the time they reach the most important number, they've already processed 4 other metrics. No visual cue that #5 is the primary judgment value.
- **Insight callouts reference other pages by name but don't link.** "Enter your Annual Income under Planning Inputs" (`calculations-breakdown.tsx:1026`) — Alex has to navigate there manually, remember the context, change the value, and navigate back. This breaks a single insight → action loop that should take one click.
- **No export or clipboard.** The Retirement Payslip section is printable-quality financial data. Alex wants to paste it into a memo or spreadsheet. There's no copy/export affordance anywhere on the page.
- **7 accordion sections, no quick-jump.** Alex wants the RA Optimization section immediately; they know it's there. Currently requires scrolling past 600px of content.

### Sam (Accessibility-Dependent User)

- **Metric card labels and values are not programmatically associated.** Each metric card uses `<p className="text-sm...">` for the label and `<p className="text-2xl...">` for the value (`projection-summary.tsx:139–149`). A screen reader reads these as separate, anonymous paragraphs — not as a labeled metric. Use `<dl><dt>/<dd>` pairs or `aria-labelledby` to associate label → value.
- **Success rate status is color-only.** The "Excellent/Good/Fair/Risky/Critical" label in `metric.description` is the only non-color signal, but it's positioned below the value in muted small text. When success rate is rendered, the card border color (green/orange/red) is the dominant indicator, which fails WCAG color-alone test.
- **Tables have no `summary` or `caption`.** The drawdown table with 10 columns and the accumulation table have no `<caption>` element. Screen readers announce "table" without context; adding a caption ("Yearly drawdown projections by retirement phase") would significantly improve navigation.
- **Progress bars use `role="progressbar"` correctly** ✅ — this is good; the `aria-label` on account depletion bars is explicit and correct.

### Kenji (SA Retirement Planner — project-specific)

Kenji is 45, has an RA and a TFSA, understands the 27.5% deduction limit, runs projections monthly to stress-test scenarios.

**Profile**: Deep SA retirement knowledge; uses this tool to verify calculations against their own spreadsheet; most interested in tax efficiency and Monte Carlo success rates.

**Red flags**:
- **The RA Optimization section is accordion #7** — Kenji's highest-value insight is buried at the end. The tax saving ("Save R28,400 in tax/year") is a headline-level call to action that should surface much earlier.
- **Investment Scenarios don't show the assumption inputs.** Kenji sees "Conservative: 7.0% return, 65% success." They immediately want to know what volatility assumption drives that success rate — which is the key variable they'd stress-test. The volatility values aren't shown per-scenario (only via the Monte Carlo accordion).
- **RA section shows deduction limit correctly but doesn't break down which accounts count.** If Kenji has both a Pension Fund and an RA, the combined contributions toward the R430k limit aren't itemized — just shown as a total. Kenji wants to see each account's contribution to verify the calculation.

---

## Minor Observations

- `CalculationsBreakdown`: The "Drawdown Phase" accordion has an inadvertent 4th tonal depth: page bg → accordion border card → `bg-muted` (inner card bg) → `bg-background/60` (within the RA section nested cards). Consolidate the innermost level.
- `ProjectionSummary`: On md breakpoint with 5 cards in `md:grid-cols-2`, one card sits alone on a row. When simulationResult is null (4 cards), `lg:grid-cols-5` creates 4 cards in a 5-column grid — the layout breaks. Consider `lg:grid-cols-4` as a fallback or use `auto-fit` + `minmax`.
- `InsightsPanel` empty state: `<PageCard label="Insights" description="Add accounts to see personalized insights" />` — no link or button to go add accounts. Add `<Button asChild><Link href="/calculator/accounts">Add account</Link></Button>` inside.
- The payslip section uses `border-primary/30` for its container border — this is a subtle accent that works, but the heading `text-xl font-bold` inside is strong enough to read as a heading without the border assistance.
- All accordion trigger icons use `text-muted-foreground`, which is consistent and correct — this is a good example of gold restrained to a single element.

---

## Questions to Consider

- "If a user could only see one number on this page before deciding whether to change their contributions, which number should it be? Does the layout make that obvious?"
- "The RA Optimization section is the most actionable insight on the page — why is it last and hidden in an accordion?"
- "What would the payslip section look like as a first-class feature instead of a collapsed accordion item? It's the most emotionally resonant content on the page — the actual number in their pocket."

---

Trend for `components-pages-projections-page-tsx` (last 5 runs): First run for this target, no trend yet.
