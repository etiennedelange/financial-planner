---
target: /calculator/charts Charts page
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
p2_count: 2
timestamp: 2026-08-10T12-40-49Z
slug: components-pages-charts-page-tsx
---
# Impeccable Critique — `/calculator/charts` (Charts page)

Method: dual-agent (A: ses_01483dff7ffe8hmh9zWsJ51Atp · B: ses_01483d1e8ffeyQ7blJxQeM9QyI)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | MC card has an excellent state machine (spinner/error/run count), but the gallery gives no page-level feedback and tooltips lie on two charts |
| 2 | Match System / Real World | 3 | SA terms strong ("Nest egg", "success rate"); "pt" jargon in tornado labels; MC aria promises "life expectancy" but axis ends at 89 |
| 3 | User Control and Freedom | 3 | Free navigation, no traps; nothing to undo, nothing destructive |
| 4 | Consistency and Standards | 2 | Card anatomy consistent, but tooltips break differently per chart; amber negative bars contradict DESIGN.md's red-for-negative rule |
| 5 | Error Prevention | 3 | MC "didn't complete — try again" handled; read-only surface, no input to misconfigure |
| 6 | Recognition Rather Than Recall | 1 | Tooltips fail to name series ("Age Portfolio Balance", "Age undefined", three unlabeled percentile amounts); only scenario chart has a legend |
| 7 | Flexibility and Efficiency | 1 | No shortcuts, no export, no print, no drill-down; hover is the only interaction on a data-heavy page |
| 8 | Aesthetic and Minimalist Design | 3 | Clean, dense, restrained dark surfaces; minor noise from duplicated title + amber outlier + dominant MC band |
| 9 | Error Recovery | 3 | MC retry path; no data-loss paths on a read-only surface |
| 10 | Help and Documentation | 2 | Display-mode toggle explains nominal vs real well; zero inline help for percentile bands, tornado levers, "what does success mean" |
| **Total** | | **23/40** | **Acceptable** |

## Design Specificity Verdict

**Authored content, generic composition.** The content layer is unmistakably this product: R-currency, "Nest egg", "Retire 65", RA/TFSA framing, the success-rate qualifier voice ("Excellent / Good / Fair / At Risk / Critical"), 1,000-scenario honesty line, and bespoke ghost-SVG empty states that foreshadow each chart's curve. The MC "whisper" band encoding (tight 25–75 over faint 10–90) honors the accessibility rule — opacity + shape, not hue alone.

But the page frame is the default analytics-gallery template: six equal-weight Recharts cards in a flat 2-column grid with no priority, no summary, no cross-reference. The tornado levers ("Expected return +1pt") and cost-of-delay bars could ship in any BI product. Specificity lives in the cards; the composition is a template.

**Deterministic scan:** CLI detector (`detect.mjs`) ran clean on all six chart components + page — exit 0, zero findings (validated against a deliberately bad fixture to confirm the scan is not silently broken).

**Browser overlay:** Assessment B confirmed mutable injection (document.title + script tag both succeeded), ran the live-server overlay in-page. Console reported **18 anti-patterns** (async scan: 19 — adds line-length + text-occlusion). Breakdown:
- `undersized-ui-text` ×15 — mostly **false positives on desktop**: 7 are mobile bottom-nav labels (9px, `md:hidden`, zero-size on desktop). Real visible small text: header wordmark (8–10px), ⌘K badge (10px), and chart SectionLabels (10px). These are DESIGN.md-blessed micro-labels, so largely false positives; the 10px chart labels are the only worth reviewing.
- `clipped-overflow-container` ×2 — **real** (containers clipping content).
- `line-length` (~90ch) ×1 — **real** (intro paragraph).
- `text-occlusion` ×1 — **real** (helper span covered by a heading).
Light theme showed the same findings — no theme-specific issues.

## Overall Impression

A disciplined instrument page that honors the design system — every card is a precise, accessible figure. But the page opens with six equally-weighted panels, and its only per-point readout (the tooltip) is broken on half of them, including a success rate that renders as **"R 100"** instead of "100%". For a tool whose entire brand is correctness, a lying tooltip is the highest-stakes defect on the page. Biggest opportunity: make the tooltips truthful first, then let "Will It Last?" own the page instead of being one of six identical cards.

## What's Working

1. **MC card state machine** (`monte-carlo-chart.tsx:56-106`) — running/error/empty/data branches with distinct icons and copy, plus run count and a qualitative success label in the header. The page's most trustworthy element, and the model for good system status.
2. **Accessible structural baseline** — every populated card is `role="figure"` with a scenario-aware aria-label; contrast passes AA in both themes (measured 5.09:1 dark / 5.28:1 light on muted-over-card).
3. **Ghost empty states** (`portfolio-growth-chart.tsx:49-82`) — a faint foreshadow curve + "Add accounts" CTA teaches the chart's shape before data arrives. Above category average.

## Priority Issues

1. **[P1] Tooltips are broken — and break differently per chart.**
   - **What:** (a) `portfolio-growth-chart.tsx:137`, `income-sustainability-chart.tsx:127`, `monte-carlo-chart.tsx:172` pass `labelFormatter={(age) => \`Age ${age}\`}`, but `ChartTooltipContent` (`chart.tsx:152-163`) feeds it `itemConfig.label`, not the x value → headers read "Age Portfolio Balance" and "Age undefined". (b) MC tooltip lists three unlabeled currency amounts (median/p25/p90 indistinguishable). (c) The scenario success rate renders as **"R 100"** instead of "100%" — the formatter checks `name === "success"` while the Bar is named `"Success rate"` (`scenario-comparison-chart.tsx:130-136,161`). Verified in live page and source.
   - **Why it matters:** this is a precision instrument; the tooltip is the only per-point readout and it actively lies on two of six charts. A "100% success" shown as "R 100" is a silent-wrong-value trap that erodes exactly the trust the brand is built on.
   - **Fix:** thread the raw x value into `labelFormatter` in `chart.tsx` (pass `label` through), make MC/income formatters emit the series name, and change the scenario check to `name === "Success rate"`. Add regression tests on the tooltip content.
   - **Suggested command:** `$impeccable harden`

2. **[P1] Chart SVGs are keyboard-focusable with no visible focus and no keyboard interaction.**
   - **What:** Recharts surfaces carry `tabindex="0"` + `role="application"`; `chart.tsx:65` strips `outline` (`[&_.recharts-surface]:outline-none`). Live measurement: 86 focusable elements on the page, each chart's 421×260 SVG is a tab stop with zero focus indicator and hover-only data. Verified in browser.
   - **Why it matters:** WCAG 2.4.7 / keyboard parity failure on a data-heavy surface — keyboard users land on an invisible dead element and can never read the data.
   - **Fix:** remove `tabindex` from chart surfaces (or gate it behind real keyboard handlers), and add a per-card keyboard-accessible data summary or table.
   - **Suggested command:** `$impeccable audit`

3. **[P1] No visual hierarchy across the gallery.**
   - **What:** six cards, identical weight, no reading order, no page-level summary (`charts-page.tsx:91-142` is a flat map). The only emphasized number is the success %.
   - **Why it matters:** cognitive-load failure — the user can't tell which chart answers "does my plan hold?" without reading all six panels. PRODUCT.md's core promise ("walk away knowing whether the plan holds") has no single answer surface.
   - **Fix:** order by decision impact (Will It Last? → Income → Cost of Delay), add a one-line page-level verdict strip, or give each group a section label.
   - **Suggested command:** `$impeccable layout`

4. **[P2] Amber for negative deltas conflicts with DESIGN.md.**
   - **What:** `sensitivity-tornado-chart.tsx:134` and `cost-of-delay-chart.tsx:132` use `--warning` (amber) for negative bars; DESIGN.md reserves Signal Red for "negative deltas" and the chart palette has no amber.
   - **Why it matters:** breaks the locked-palette discipline; a second semantic hue dilutes the one-accent system and the red-for-danger convention.
   - **Fix:** use `--destructive` for negative, or formally document `--warning` as an approved token in DESIGN.md.
   - **Suggested command:** `$impeccable colorize`

5. **[P2] Duplicated page title + promise of a curation feature that doesn't exist.**
   - **What:** the sticky topbar renders the H1 "Charts" (`top-bar.tsx:55`); `charts-page.tsx:84` re-renders a "Charts" title div (and the empty state via `PageCard label="Charts"`). The intro copy still says "curate which of these appear on the main pages" — no such control exists.
   - **Why it matters:** redundant chrome against the system's own rule, and a false affordance breaks trust.
   - **Fix:** drop the in-content title, keep the intro paragraph; rewrite or implement the "curate" promise.
   - **Suggested command:** `$impeccable clarify`

## Persona Red Flags

**Alex (Power User):**
- Tooltip "Age undefined" and unlabeled percentile rows make precise reads slower, not faster.
- No keyboard, export, print, or batch compare — hover is the only data interaction on a six-chart analytics page.
- "R 100" for a 100% success rate reads as an obvious, trust-eroding defect to anyone who checks numbers.

**Sam (Accessibility-Dependent):**
- Tab focus lands on invisible SVG focus targets (`tabindex=0`, `outline: none`) with no data reachable via keyboard — hard stop on every chart.
- Tooltip content is hover-only; no alternative data table or aria-live readout.
- Recommended scenario in the comparison chart is encoded by teal-vs-muted **color alone**, with no legend note (`scenario-comparison-chart.tsx:147-156`).

**Riley (Stress Tester):**
- The currency-rendered success rate ("R 100") is a silent-wrong-value trap.
- MC aria-label promises "to life expectancy" but the axis tops at 89.
- Tornado tooltip reads "Expected return -1 pt" while the axis says "-1pt" — inconsistent unit spacing.

## Minor Observations

- Only the scenario chart renders a legend; portfolio/MC/income/tornado rely on subtitle + color recall.
- Scenario card never labels which bar is "Recommended" — teal vs muted goes unexplained.
- Income card's "Retire 65" reference line is redundant when the x-axis starts at 65.
- Success % uses fjord (`text-chart-2`) while the median line uses teal — two hues for two "important" numbers on one card.
- MC y-axis max wobbles between desktop (R1.6B) and mobile (R1.8B) — recharts auto-domain.
- Cost-of-delay tooltip `(11.8%)` is the *only* tooltip that works correctly — the reference implementation to copy.
- `clipped-overflow-container` ×2 and a `text-occlusion` finding from the overlay are worth a glance on mobile widths.

## Questions to Consider

1. What would this page become with one headline verdict per scenario ("Your plan holds: 100% success, R400M median") instead of six equal panels?
2. Should "Will It Last?" lead the page, or does the grid's neutrality deliberately serve a different read?
3. The median line is the number the audience came for — is the current band-to-median proportion (p90 band spans nearly the full plot) serving the brief or defeating it?
4. Why is the success rate fjord while the median is teal, when DESIGN.md says teal is for "the number you came here for"?
5. Is the Future/Today's Value toggle discoverable buried in the topbar, or does it belong per-chart where the deflation is visible?
