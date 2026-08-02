---
target: projections page
total_score: 25
p0_count: 0
p1_count: 2
p2_count: 3
p3_count: 1
timestamp: 2026-06-15T16-58-22Z
slug: projections-page
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | On-track/off-track banners and empty states work; no loading skeleton |
| 2 | Match System / Real World | 3 | SA-specific terms correct; "Discret." header abbreviation is opaque |
| 3 | User Control and Freedom | 2 | No export, no copy, no way to share or drill into per-account projections |
| 4 | Consistency and Standards | 2 | Mixed hardcoded colors (`text-green-600`) and semantic tokens (`text-primary`) throughout |
| 5 | Error Prevention | 3 | Good empty states; on-track banner proactively surfaces the gap |
| 6 | Recognition Rather Than Recall | 2 | 10-column drawdown table requires schema recall; footnote explaining column colors is easy to miss |
| 7 | Flexibility and Efficiency | 2 | Fixed accordion order, no export, no column hide, no keyboard jump-to-section |
| 8 | Aesthetic and Minimalist Design | 2 | Four identical-weight stacked cards; numbered sections; hero metric template in accumulation |
| 9 | Error Recovery | 3 | Empty states explain what to add; depletion rows highlighted in red |
| 10 | Help and Documentation | 3 | InfoTooltips on all Insights cards; Key Formulas section shows real math |
| **Total** | | **25/40** | **Acceptable — significant improvements needed** |

---

## Anti-Patterns Verdict

**Does this look AI-generated?** Partially yes — two specific tells.

**LLM assessment**: The numbered accordion sections (1. Input Summary, 2. Key Formulas … 8. RA/Pension Contribution Optimisation) are the clearest signal — this is the numbered-section-marker anti-pattern applied to every accordion item. A real precision instrument wouldn't label reference sections with ordinal scaffolding; it would distinguish them by icon, by purpose, by visual weight. The four identical-weight stacked `PageCard` components in InsightsPanel compound the issue: every card has a gold-border label, a leading icon, and a trailing tooltip, so nothing reads as more important than anything else. The "Portfolio at Retirement" callout inside the accordion uses `bg-primary/5 p-4` with big gold text — that's the hero-metric template applied to a single stat in a sub-panel. The design does many things right (SA-specific terminology is sharp, the formula display is genuinely useful, the Insights cards have good content) but the scaffolding reveals the generation.

**Deterministic scan**: The automated detector returned zero findings. No absolute-ban patterns (gradient text, glassmorphism, side-stripe borders > 1px) were detected in the markup.

**Visual overlays**: Browser automation was not invoked for this run; detector was run via CLI over source files.

---

## Overall Impression

The page is information-rich and technically correct — the SA-specific calculations, Go-Go/Slow-Go spending phases, Section 11F carry-forward, and tax breakdown are genuinely valuable. But the page has an orientation problem: a user landing here gets dropped directly into "Optimal Contribution" with no anchor — no headline number, no summary of what the projection says. The biggest opportunity is to put the `ProjectionSummary` (which already exists but isn't rendered here) at the top, then let the Insights and Calculations follow as supporting detail.

---

## What's Working

1. **InfoTooltips on every Insights card.** Each card has a `trailing` tooltip that explains the methodology (Monte Carlo iterations, 9% medical inflation, compounding method). This is exactly right for a financially literate audience who wants to verify the math, not just trust it.

2. **SA-specific terminology throughout.** RA, TFSA, Pension Fund, Preservation Fund, Section 11F, Go-Go/Slow-Go/No-Go, the lump sum tax brackets (`R550k tax-free; R550k–R770k @ 18%...`) — these are correct and build trust with the target user. They're never genericised.

3. **Key Formulas accordion section.** Showing the actual formulas (`logMean = ln(1 + return) - 0.5 × volatility²`) and the full spending phase table in `<code>` blocks lets the user audit the engine. This is the right call for this audience.

---

## Priority Issues

**[P1] No headline projection summary at the top of the page**
- **What**: The page renders `InsightsPanel` then `CalculationsBreakdown` with no entry-point orientation. The `ProjectionSummary` component (5-metric grid: Portfolio at Retirement, Monthly Income, Depletion Age, Final Balance, Success Rate) exists in `components/results/projection-summary.tsx` but is not used in `ProjectionsPage`.
- **Why it matters**: Users navigate to Projections to see their number. Without the summary grid, they land on "Optimal Contribution" — a derived insight — before knowing what the projection actually produced. This is equivalent to opening a report to the recommendations page before the executive summary.
- **Fix**: Add `<ProjectionSummary>` as the first element in `ProjectionsPage`, passing the `projection` prop already available. Consider adding a page heading ("Projections") above it.
- **Suggested command**: `/impeccable layout projections page`

**[P1] Numbered accordion sections are the primary AI tell**
- **What**: Accordion items are labelled "1. Input Summary", "2. Key Formulas", "3. Accumulation Phase (X years)", "4. Drawdown Phase (Y years planned)", "5. Monte Carlo Simulation", "6. Retirement Tax Analysis", "7. Sample Retirement Payslip", "8. RA/Pension Contribution Optimisation". This is the numbered-section-marker anti-pattern applied to all 8 items.
- **Why it matters**: The numbers carry zero information — users don't read the accordion in order 1-8. The ordinal prefix is visual noise that screams "AI scaffold." A precision instrument uses icons and concise labels to convey content type, not sequential numbering.
- **Fix**: Remove the number prefixes. Assign a distinct icon per section (e.g. `BarChart2` for accumulation, `TrendingDown` for drawdown, `Shuffle` for Monte Carlo, `Receipt` for tax, `FileText` for payslip, `Percent` for RA optimization). The accordion trigger label stands on its own: "Input Summary", "Key Formulas", "Accumulation Phase", etc.
- **Suggested command**: `/impeccable polish projections page`

**[P2] Hardcoded color palette in tables and depletion cards**
- **What**: Throughout `calculations-breakdown.tsx` and the InsightsPanel scenarios section: `text-green-600 dark:text-green-400` (contributions, growth, TFSA), `text-blue-600 dark:text-blue-400` (discretionary, accumulation contributions), `text-orange-700 dark:text-orange-400` (pension), `bg-green-50 dark:bg-green-950`, `bg-blue-50 dark:bg-blue-950`, `bg-orange-50 dark:bg-orange-950` — all hardcoded Tailwind colors bypassing the design token system.
- **Why it matters**: These colors are inconsistent between dark and light themes, can't be changed via theme switching, and don't match the DESIGN.md color vocabulary (`chart-teal: #1EB88A`, `chart-blue: #5184EC`). The semantic token for TFSA is Chart Teal; the token for pension-type accounts would map to Analyst Gold. Hardcoding green/blue/orange creates a parallel color system alongside the token system.
- **Fix**: Map account types to CSS variables using the existing design token palette. Replace `text-green-600 dark:text-green-400` with `text-[hsl(var(--chart-teal))]` or a Tailwind class alias; use `text-chart-blue` for discretionary. For table cell row backgrounds, use `bg-destructive/5` for depletion rows instead of `bg-red-50 dark:bg-red-950`.
- **Suggested command**: `/impeccable colorize projections page`

**[P2] Color is the only differentiator in table columns**
- **What**: The accumulation table colors contributions blue and growth green with no other distinguishing signal. The drawdown table colors TFSA green, Discretionary blue, Pension orange — all via `font-mono text-sm text-[color]` with the only context being the column header abbreviation ("TFSA", "Discret.", "Pension").
- **Why it matters**: Color alone cannot carry information per WCAG 1.4.1. A color-blind user (8% of males) cannot distinguish the blue/green pair. A screen reader user hears the numbers without color context — the column headers help, but "Discret." is barely descriptive.
- **Fix**: (1) Expand "Discret." to "Discretionary" or add a title attribute. (2) Add currency symbols or type indicators to TFSA/Discretionary/Pension column headers. (3) For screen readers, the table structure (headers → cells) already provides context, but consider adding `aria-label` to the colored cell spans.
- **Suggested command**: `/impeccable audit projections page`

**[P2] InsightsPanel cards have uniform visual weight**
- **What**: Four `PageCard` components in `space-y-4` — Optimal Contribution, Cost of Delay, Investment Scenarios, Medical Cost Projection — are identical in visual weight. Every card has a gold-border label, a leading icon (all `text-primary`), and a trailing InfoTooltip.
- **Why it matters**: Optimal Contribution is the most actionable insight — it's either a green "on track" or an amber "increase by R X/month." Investment Scenarios is secondary reference. Medical Costs is important but tertiary. Equal visual weight forces the user to read all four before knowing which one demands action.
- **Fix**: Give Optimal Contribution primary treatment: larger internal spacing, the on-track/off-track status more prominent (not buried inside `contentClassName`). Treat the other three as secondary cards — same structure but reduced visual emphasis (a lighter left-border variant, or grouping them in a 2-column grid on desktop).
- **Suggested command**: `/impeccable layout projections page`

---

## Persona Red Flags

**Alex (Power User — SA financial professional):**
- Cannot export the projection table to CSV or copy numbers to clipboard. For a tool where trust comes from verifiable numbers, there's no escape hatch to a spreadsheet.
- The drawdown table has `max-h-96 overflow-auto` inside an already-scrollable page — nested scroll areas are disorienting on trackpads. Alex will lose their place when scrolling the inner table.
- Accordion items can't be reordered, so the accumulation table (section 3) can't be jumped to without scrolling past Input Summary and Key Formulas, which are always open by default. A "jump to section" mechanism (or collapsible-all button) would help.

**Sam (Accessibility-Dependent User):**
- The progress bars in Account Depletion Timeline and RA utilization bar have no `role="progressbar"` or `aria-valuenow`/`aria-valuemax` attributes. A screen reader hears nothing useful from those elements.
- The accumulation table cells colored blue/green for contributions/growth have no `aria-label` or accessible name beyond the column header — which is adequate for a sighted user who sees "Contributions" in the header, but the color-only reinforcement (the cell text is already colored blue) adds no value for Sam.
- The 10-column drawdown table with abbreviated headers ("Yr", "Discret.") will be confusing when announced by a screen reader navigating cell by cell.

---

## Minor Observations

- **`border-2 border-primary` on the payslip card** (`calculations-breakdown.tsx` line 884) — a thick 2px primary-colored border on a card is the closest this page gets to the side-stripe ban. A `border border-primary/30` (standard weight, reduced opacity) reads as "important" without being loud.
- **`text-xl font-bold` for Retirement Income Breakdown h3** (payslip section, line 887) — this is one of the few places in the app that uses a heading size above `text-base font-semibold`. It's appropriate for a payslip simulation, but the value isn't wrapped in a semantic heading hierarchy (it's an `h3` but there's no `h1` or `h2` above it in this accordion section).
- **`bg-secondary/60`** is used in two places (Drawdown initial withdrawal card, Lifetime Tax Summary) — this works but `bg-muted` would be more explicit per the design system.
- **`formatPercent(drawdownConfig.initialWithdrawalRate)` without converting** — the withdrawal rate is passed as a percentage value (e.g. 4.0), so `formatPercent(4.0)` → `"4.00%"`. This is correct, but the consistency with `formatPercent(calculations.netReturn * 100)` (which multiplies by 100) means one caller uses raw percentages and the other uses decimals. Worth a comment or renamed helper.
- **The `ProjectionSummary` component in `components/results/projection-summary.tsx` is not imported anywhere** in the current projections page. It's orphaned code. Either integrate it (as P1 above) or remove it.

---

## Questions to Consider

- "What if Projections led with three numbers — portfolio value, monthly income net of tax, and success rate — before any insight cards? Would users still need the InsightsPanel to feel oriented?"
- "The accordion numbering implies a reading order that users don't follow. If you removed all the numbers, would anything break — or would it feel better immediately?"
- "The payslip section (section 7) is the most emotionally engaging content on the page — a concrete answer to 'what will my retirement look like?' Should it be higher up, not buried after 6 other accordion items?"

---

**Trend for `projections-page` (last 5 runs): 25** — First run for this target, no trend yet.
