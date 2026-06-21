---
target: Projections page (app/calculator/projections/page.tsx)
total_score: 27
p0_count: 0
p1_count: 3
timestamp: 2026-06-21T13-50-40Z
slug: app-calculator-projections-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | `isSimulating` is computed in `calculator-context.tsx:62` but never read by `app/calculator/projections/page.tsx` or `ProjectionSummary` — the hero "Plan Success Rate" card just appears/disappears with no loading, error, or stale-input affordance during the 1,000-iteration Monte Carlo run. |
| 2 | Match System / Real World | 4 | Excellent, precise SA terminology throughout (RA, TFSA, s11F, lump-sum commutation, Go-Go/Slow-Go/No-Go). |
| 3 | User Control and Freedom | 3 | Accordions expand/collapse independently and a display-mode toggle exists, but there's no expand-all/collapse-all across 7-8 sections and no deep link into a specific section. |
| 4 | Consistency and Standards | 2 | Two confirmed violations: (a) currency values render `font-mono` in `projection-summary.tsx`/`calculations-breakdown.tsx` but plain `font-semibold` sans in `insights-panel.tsx` (verified at lines 175/181/187/210/221/232/326/332/338/347) — breaks the project's own Mono Reserve Rule; (b) `InsightsPanel` uses the canonical `PageCard`/`SectionLabel` while `CalculationsBreakdown` uses raw `AccordionItem` styling for all its sections — two competing "section card" languages on one page. |
| 5 | Error Prevention | 3 | Empty states (no accounts) degrade gracefully with a CTA. No confirmed gap in this page specifically — input validation lives upstream. |
| 6 | Recognition Rather Than Recall | 3 | Strong inline formulas and tooltips. The 10-column Drawdown table sits in an `overflow-auto` container, so its column-header mental model (Yr/TFSA/Discretionary/Pension) can scroll out of view while reading 25+ rows. |
| 7 | Flexibility and Efficiency of Use | 2 | No keyboard shortcuts, no expand/collapse-all, no export/print of the projection tables or payslip — a page this data-dense gives power users nothing extra. |
| 8 | Aesthetic and Minimalist Design | 2 | Confirmed: every `SectionLabel` instance renders a literal `border-l-2 border-primary` gold stripe (`section-label.tsx:23`) — roughly 7 of them stack in this view alone. Confirmed: the metric grid simultaneously colors 5 cards (teal/gold/amber/red/blue depending on success tier) in a `lg:grid-cols-5` layout, exceeding the 4-item chunking guideline and using the explicitly-banned hero-metric template (`isHero` → `text-3xl` + tinted `successBg`). |
| 9 | Error Recovery | 2 | Loading, failure, and "not applicable" states for the simulation are visually identical (nothing renders) — there's no way for a user to tell "still computing" from "broke" from "intentionally not shown." |
| 10 | Help and Documentation | 4 | Genuinely the page's best aspect — substituted-number formulas, tax-bracket footnotes, log-normal explanation inline. Minor accessibility ding only (every `InfoTooltip` shares the same generic `aria-label="More information"`, noted below under Sam). |
| **Total** | | **27/40** | **Acceptable, bordering on Good — strong domain trust and documentation undercut by an async-status gap and a design-system rule the page itself violates repeatedly.** |

## Anti-Patterns Verdict

**LLM assessment:** Not generic AI-slop in the usual sense — no gradient text, no glassmorphism, no identical icon-card grids, no decorative eyebrows, and the SA-domain depth (substituted formulas, real tax brackets) is the opposite of templated. The real tell is narrower but more damaging: this is the project's *own* design system being violated by its own canonical component. `SectionLabel` (used everywhere in the app, not just this page) renders the literal side-stripe DESIGN.md calls "the absolute ban," and `ProjectionSummary`'s success-rate card is, verbatim, the "hero-metric template" the same doc rejects (`isHero` flag, `text-3xl`, tinted background wash). A Linear/Stripe-fluent user wouldn't flag this as "AI made this" — they'd flag it as "the design system isn't being enforced."

**Deterministic scan:** `detect.mjs --json` ran clean (exit 0, `[]`) against all four relevant source files (`projections-page.tsx`, `calculations-breakdown.tsx`, `insights-panel.tsx`, `projection-summary.tsx`). The automated detector doesn't catch the side-stripe or hero-metric violations above — those are project-specific DESIGN.md rules, not generic slop patterns, so this is an expected gap rather than a missed bug. No false positives to report since there were no findings.

**Visual overlays: confirmed, via a workaround outside the chrome-devtools MCP.** The chrome-devtools MCP itself is unavailable in this sandbox (`new_page` fails with "Missing X server to start the headful browser"), which is what the detector agent hit and what I initially confirmed myself. The design-review agent worked around this by manually starting `Xvfb` and driving `google-chrome --headless=new` directly via Bash — I verified this independently by viewing the resulting screenshot files (`/tmp/proj-desktop.png`, `/tmp/proj-mobile.png`): both genuinely show the live empty-state page, with the gold `border-l-2` stripe visible on "INSIGHTS" and "CALCULATIONS BREAKDOWN" labels at desktop (1440px) and the bottom-tab mobile nav at 390px, exactly as described. The agent could not seed the populated state (no way to inject localStorage pre-navigation in headless), so all populated-state findings above remain source-derived, as flagged. The gold-stripe finding is now confirmed by both source code and live rendering.

## Overall Impression

This page earns real trust through domain accuracy and transparency — substituted formulas, correct SA tax mechanics, no decorative filler. But it's fighting its own design system: the canonical `SectionLabel` component bakes in the one pattern DESIGN.md bans outright (colored side-stripes), and the headline metric card is the literal hero-metric template the same doc rejects. Layer onto that a real trust gap — the page's single most important number (Plan Success Rate) can silently vanish with no distinction between "computing," "broken," and "not applicable" — and the biggest opportunity isn't more polish, it's enforcement: fix `SectionLabel` once and every page that uses it improves, wire up the `isSimulating` flag that's already computed and already sitting unused.

## What's Working

1. **Substituted-number formulas** (`calculations-breakdown.tsx`'s Key Formulas section) — showing `R 35 000 × (1 + 5.50%)^20 = R 102 122` instead of an abstract formula is exactly the transparency a financially literate SA user needs to trust the output.
2. **Empty states** — both Insights and Calculations Breakdown degrade to a clear "Add accounts" CTA instead of blank/NaN output, a graceful and well-considered entry point.
3. **Account Depletion Timeline progress bars** — per-account `role="progressbar"` with full `aria-value*` attributes, genuinely accessible and a pattern the rest of the page (e.g. the RA Optimisation utilization bar) should be matched to.

## Priority Issues

**[P1] `SectionLabel`'s gold side-stripe violates the project's own absolute ban — and it's repo-wide, not page-specific**
- **Why it matters:** DESIGN.md states "Don't use `border-left` or `border-right` greater than 1px as a colored accent... this is the absolute ban" and "Analyst Gold ≤1 active element per view." `section-label.tsx:23` does exactly this (`border-l-2 border-primary pl-2`), and this one page stacks roughly 7 instances of it. Because every page imports this same component, the accent that's supposed to mean "the one number that matters" instead decorates every section header app-wide.
- **Fix:** Drop the `border-l-2` from `SectionLabel`'s default variant; let the mono-uppercase-muted treatment alone carry the "eyebrow" role, and reserve gold for the one value per view that should actually draw the eye.
- **Suggested command:** `/impeccable polish` (a one-file fix against an existing, documented design system rule).

**[P1] Async Monte Carlo status has no visibility — failure, loading, and "not applicable" all look identical**
- **Why it matters:** `isSimulating` is computed in `calculator-context.tsx:62` but isn't read anywhere in the projections route or `ProjectionSummary`. On input change, the headline Plan Success Rate card simply swaps values (or disappears) with zero feedback. For a page whose entire premise is "how confident should I be in this plan," a silently-changing or silently-absent confidence number actively undermines the trust the rest of the page works hard to earn.
- **Fix:** Thread `isSimulating` into `ProjectionSummary` for a skeleton/pulse state on the hero card; surface the worker's error path (if any) as a distinct "Simulation unavailable" state rather than nothing.
- **Suggested command:** `/impeccable harden`.

**[P1] `ProjectionSummary`'s success-rate card is the explicitly-banned hero-metric template, and the grid runs 5 simultaneous accent colors**
- **Why it matters:** DESIGN.md bans "big number + small label + gradient/tint accent... SaaS cliché" by name. `projection-summary.tsx`'s `isHero` flag does precisely this (`text-3xl` + `successBg` wash), and when a simulation exists the grid renders 5 cards at once carrying teal, gold, amber, red, or blue depending on tier — collapsing the "one accent, used precisely" rule and pushing past the 4-item chunking guideline in the same gesture.
- **Fix:** Flatten all metric cards to the same uniform tonal treatment (no per-card border/background tint); encode the success tier with the text label and a small inline indicator instead of a full-card color wash; let exactly one card (or value) carry gold.
- **Suggested command:** `/impeccable quieter`, then `/impeccable layout` for the resulting 5-card grid rhythm.

**[P2] Currency values inconsistently use mono vs. sans across components**
- **Why it matters:** The project's own Mono Reserve Rule says financial output values should always render in IBM Plex Mono. `insights-panel.tsx` renders currency in plain `font-semibold` sans (confirmed at 8+ call sites) while `projection-summary.tsx` and `calculations-breakdown.tsx` correctly use `font-mono`. Same data type, two different visual signals for "this is a calculated number."
- **Fix:** Apply `font-mono` to every currency/percentage value in `InsightsPanel` to match the rest of the page.
- **Suggested command:** `/impeccable typeset`.

**[P2] Two parallel section-card visual languages on one page**
- **Why it matters:** `InsightsPanel` uses the canonical `PageCard`/`SectionLabel` pattern; `CalculationsBreakdown`, one scroll away, uses raw `AccordionItem` styling for all of its 8 sections, never touching the shared components. CLAUDE.md explicitly bans writing raw Tailwind section-header strings inline for exactly this reason — this page is the place it's currently happening.
- **Fix:** Restyle `CalculationsBreakdown`'s `AccordionTrigger` content to use `SectionLabel`'s visual language, or make the cards-vs-accordions split an explicit, documented decision.
- **Suggested command:** `/impeccable polish`.

## Persona Red Flags

**Alex (Power User):** No keyboard shortcuts, no expand-all/collapse-all across 7-8 accordion sections, no export of the projection tables or the Sample Retirement Payslip. Must click through every section by hand to audit the numbers — slow for exactly the user who came here to verify a plan. The silent Monte Carlo failure/loading gap (P1 above) is the single worst thing this persona can hit: a vanished headline number with no explanation reads as broken, and Alex will distrust every other number on the page as a result.

**Sam (Accessibility-Dependent User):** Every `InfoTooltip` instance shares the same generic `aria-label="More information"` — a screen-reader user tabbing through hears it repeated with no way to tell the Optimal Contribution tooltip from the Medical Cost one until activating it. The Drawdown table's TFSA/Discretionary/Pension columns are color-coded (teal/blue/amber) and the header text does name each column, but the table scrolls in a fixed-height `overflow-auto` container — once the header scrolls out of view during a 25-row read, color is the only remaining cue distinguishing the columns for a low-vision or color-blind user. The Account Depletion Timeline's `role="progressbar"` + `aria-value*` implementation, by contrast, is genuinely solid and should be the template applied elsewhere.

## Minor Observations

- The page was already critiqued once today at 13:30 (`.impeccable/critique/2026-06-21T13-30-37Z__app-calculator-projections-page-tsx.md`, score 28/40) with a partially different focus — that run also flagged the accordion default-open ordering (low-stakes "Input Summary"/"Key Formulas" open by default while higher-stakes "Drawdown Phase"/"Tax Analysis" start collapsed) and the Drawdown table's lack of a scroll affordance at 10 columns. Both are still valid and unaddressed; see that file for full detail rather than duplicating here.
- "Sample Retirement Payslip" reintroduces a gold border (`border-primary/30`) at smaller scale — same accent-scarcity concern as the `SectionLabel` issue, worth fixing in the same pass.
- The page's `<h1>` renders at `text-lg`, well under the Display type tier DESIGN.md reserves for the page's primary heading — an unused hierarchy level.
- "Critical"/depletion messaging surfaces at the top of the page with the actionable fix (Optimal Contribution) in a separate panel further down — bad news arrives before its remedy is in view.

## Questions to Consider

- If gold is supposed to mark "the one number you came for," what *is* that number on this page — and would removing gold from every section label make it finally stand out?
- `SectionLabel` is used across the whole app, not just here — is this critique actually scoped to one component fix with an app-wide payoff, rather than a page-specific redesign?
- Would Alex trust this page more if the headline success-rate number had a visible "last updated" or "recalculating" state — even a one-word label — than if it's faster but silent?
