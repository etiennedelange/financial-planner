---
target: /calculator/charts Charts page
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
p2_count: 2
timestamp: 2026-08-10T10-36-19Z
slug: app-calculator-charts-page-tsx
---
# Impeccable Critique — `/calculator/charts` (Charts page)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | MC chart never populates on direct load; placeholder says "Add accounts and run simulation" even when accounts exist; "Future Value" toggle silently affects only 2 of 6 charts |
| 2 | Match System / Real World | 3 | Excellent SA domain language; intro copy promises curation that doesn't exist; MC description omits the drawn 90th-percentile band |
| 3 | User Control and Freedom | 3 | Free navigation, no traps; no way to run/refresh simulation from this page |
| 4 | Consistency and Standards | 3 | Strong internal system; cost-of-delay sign differs across pages, duplicate H1s, unconditional green check |
| 5 | Error Prevention | 3 | Read-only surface; misleading placeholder copy when accounts exist |
| 6 | Recognition Rather Than Recall | 3 | Tooltips + legend on scenario chart; tornado bars and MC bands have no key |
| 7 | Flexibility and Efficiency | 2 | No export, no data-table view, no drill-down, fixed 3 presets |
| 8 | Aesthetic and Minimalist Design | 3 | Clean, restrained craft; 6 equal-weight cards with zero hierarchy |
| 9 | Error Recovery | 2 | Worker error → silent console log, chart falls back to wrong placeholder message |
| 10 | Help and Documentation | 3 | Good per-chart descriptions; no contextual help for percentile bands or tornado computation |
| **Total** | | **27/40** | **Acceptable** |

## Design Specificity Verdict

**Authored content, generic composition.** The content layer is unmistakably this product: R-currency, RA/TFSA semantics, "Retire 65" reference lines, life-expectancy-90 horizon, Plex Mono financial values, single teal accent, and a bespoke Monte Carlo "whisper" band concept (tight 25–75 band over faint 10–90 tail). The ghost-chart empty states (faint curve + dashed retirement line behind a real message) are the most product-specific flourish — they teach the chart's shape before data exists.

But the composition layer is category-interchangeable: six equal-weight cards in a 2-column grid is the default SaaS "insights dashboard" template. The scenario-comparison grouped bar with dual Y-axes and cost-of-delay bar trio could ship in any analytics product unchanged. Specificity lives in tokens and data, not information design.

**Deterministic scan:** CLI detector (`detect.mjs`) ran clean — exit 0, no findings. Browser overlay found `undersized-ui-text` ×14, `clipped-overflow-container` ×2, `low-contrast` ×1, `line-length` ×1. False positives: undersized-text on sidebar wordmark + SectionLabels (DESIGN.md-blessed micro-labels) and clipped-overflow on app-shell containers. Real: `low-contrast` 4.4:1 (intro paragraph, light theme, fails AA by 0.1) and `line-length` ~155 chars (intro paragraph, full 1088px width).

**Visual overlays:** Assessment B confirmed mutable injection and ran the detector overlay in-page; console reported the findings above. The overlay ran against a seeded populated state.

## Overall Impression

A clean, disciplined instrument page that honors the design system beautifully — but it opens with a dead high-stakes chart and tells users they can "curate" something that doesn't exist. The single biggest opportunity: make "Will It Last?" the page's owner — real data, real run affordance, real hierarchy — instead of one of six identical cards.

## What's Working

1. **Ghost-chart empty states** (`portfolio-growth-chart.tsx:49-88`, `monte-carlo-chart.tsx:57-83`) — each placeholder draws the shape of the data that will arrive behind a real message. Authored for this product; turns dead states into teaching moments.
2. **Monte Carlo band encoding** (`monte-carlo-chart.tsx:164-193`) — single teal median inside a tight 25–75 band, 10–90 range as an opacity "whisper." Restraint inside the data; honors the accessibility rule (opacity + shape, not hue alone).
3. **Consistent figure semantics** — every populated card is `role="figure"` with a precise, scenario-aware `aria-label`, and every area chart carries the same dashed "Retire 65" reference line.

## Priority Issues

1. **[P1] The highest-stakes chart is routinely dead — and its message lies.**
   - **What:** "Will It Last?" is an empty placeholder on direct load of `/charts`; the MC worker is gated to `/calculator/overview` (`calculator-context.tsx:52`), so a fresh visit or reload yields `simulationResult = null`. The placeholder says **"Add accounts and run simulation" even when accounts exist.**
   - **Why it matters:** The one chart the user came to see shows nothing, and actively misleads. Breaks trust in a tool whose brand is correctness.
   - **Fix:** Run the worker on the charts route too (or persist last run); split placeholder into "no accounts yet" vs. a pending state with a real **Run simulation** affordance. `$impeccable harden`
2. **[P1] The "curate" promise is false.**
   - **What:** Intro copy says "Curate which of these appear on the main pages" — no curation control exists anywhere.
   - **Why it matters:** A false affordance breaks trust; users following the page's own instructions hit a wall.
   - **Fix:** Implement per-chart "Show on Overview" toggles, or rewrite the copy honestly. `$impeccable clarify`
3. **[P1] Success messaging is buried and unconditionally green.**
   - **What:** Success rate is a 12px footnote; `CheckCircle2` (`monte-carlo-chart.tsx:108`) is hardcoded teal regardless of value.
   - **Why it matters:** At the most anxiety-laden number on the page, a failing plan shows a green checkmark and no elevated weight — false reassurance, no hierarchy.
   - **Fix:** Drive icon/color off the success rate (CheckCircle ≥75 / warning 60–75 / destructive <60) and give the rate real presence. `$impeccable clarify` + `$impeccable bolder`
4. **[P2] Sub-AA contrast on both themes — detectors agree.**
   - **What:** Dark-mode section eyebrows (10px) and descriptions measure 4.37:1 against `#0C111D`; the light-mode intro paragraph measures 4.4:1 against `#f9fafb` (both below 4.5 AA that DESIGN.md mandates).
   - **Why it matters:** Sam gets low-contrast chrome across all six cards and the page intro — worst exactly where the numbers live.
   - **Fix:** Lighten dark `--muted-foreground` (≈`#7C8698`), drop `/70` on the success line, and cap the intro paragraph. `$impeccable audit`
5. **[P2] Structural a11y and recall gaps.**
   - **What:** Two H1s both titled "Charts" (sticky top bar + page content); Recharts wrappers expose `role="application"`; tooltips are hover-only so exact values are unreachable by keyboard; tornado bars and MC bands have no legend/key.
   - **Why it matters:** Broken heading outline, SR mode-switching on every chart, and keyboard-only users can't extract a single value.
   - **Fix:** One H1 per page; add a keyboard-reachable data table or `aria-valuetext`; tiny legend for tornado direction. `$impeccable audit`

## Persona Red Flags

**Alex (power user):** Lands on Charts and the one chart he came for is a placeholder with no Run button — must cross to Overview and back. The "curate" lead is false. No export, no data table, no drill-down; the "Future Value" toggle silently changes only 2 of 6 charts.

**Sam (accessibility):** Eyebrows (10px) and descriptions fail AA at 4.37:1 in dark; success line fails harder. Two identical H1s break the outline; `role="application"` forces SR mode-switches; chart values are hover-only, so keyboard-only users get summaries, never numbers. The green check misleads low-vision users who rely on icon+text.

**Riley (stress tester):** Silent failure — if the MC worker throws, the chart quietly falls back to the placeholder, no error state or retry. Misleading placeholder appears with accounts present on direct load. Success check identical at 20% and 100%. Cost-of-delay sign flips between pages (positive bars here, "−R 7.7M" on Projections). The 90th-percentile band is drawn but never described.

## Minor Observations

- `SuccessGauge` (`success-gauge.tsx`) is dead code — imported nowhere.
- Row-1 cards render 381px vs 361px elsewhere (MC success line adds header height); grid misalignment is minor but visible.
- Tooltip on cost-of-delay shows "R 31 802 016 (25.7%)" with no minus sign, understating a loss.
- "Will It Last?" description changes between states but never mentions the drawn 10–90 band.
- Fixed chart heights clip long tornado labels at narrow widths.
- The empty-MC ghost curve implies data before any exists — check it doesn't misread as real.

## Questions to Consider

- What if the Charts page opened with one decisive number (success rate) and let the six charts answer follow-up questions — instead of six equally-weighted cards?
- What if the empty Monte Carlo card carried its own "Run simulation" button, so the page owns the data it displays?
- What if "Will It Last?" and "Income Through Retirement" merged into a single life-long cashflow view, cutting the decision count from six to four?
- Would the recommended scenario read better labeled directly on the bars ("✓ Recommended") rather than only via teal fill?
