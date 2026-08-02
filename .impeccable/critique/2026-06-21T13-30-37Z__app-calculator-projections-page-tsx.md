---
target: Projections page (app/calculator/projections/page.tsx)
total_score: 28
p0_count: 0
p1_count: 1
timestamp: 2026-06-21T13-30-37Z
slug: app-calculator-projections-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Monte Carlo Web Worker result has no loading/error state — `isSimulating` exists in `calculator-context.tsx` but is never read by `ProjectionSummary` or `projections-page.tsx`. If the worker stalls or errors (`use-monte-carlo-worker.ts:81` only `console.error`s), the hero "Plan Success Rate" card just never appears, indistinguishable from "intentionally not shown." |
| 2 | Match System / Real World | 4 | n/a — SA terminology (TFSA, RA, lump sum commutation, Section 11F, Go-Go/Slow-Go/No-Go) is precise and correctly used throughout. |
| 3 | User Control and Freedom | 3 | Accordion `type="multiple"` allows independent expand/collapse, but no "expand all" control on an 8-section page, and no deep-linking into a specific section. |
| 4 | Consistency and Standards | 2 | `CalculationsBreakdown` uses a parallel, undocumented card pattern (`<AccordionItem className="border rounded-lg px-4">` at lines 189/312/416/475/692/751/911/1019) instead of the canonical `PageCard`/`SectionLabel` used one component over in `InsightsPanel`. Two different "section card" visual languages on one page. |
| 5 | Error Prevention | 3 | Empty state (no accounts) is handled gracefully with a CTA to Accounts. No error boundary surfaces a failed Monte Carlo run to the user. |
| 6 | Recognition Rather Than Recall | 3 | Account Depletion Timeline cards are excellent plain-language summaries. The 10-column Drawdown table requires holding a TFSA→Discretionary→Pension mental model that's only explained in a trailing caption below 25+ scrollable rows. |
| 7 | Flexibility and Efficiency of Use | 3 | Genuine power-user value (exposed formulas, exact Monte Carlo parameters) — correctly aimed at expert users. No keyboard/URL shortcut to a specific accordion section. |
| 8 | Aesthetic and Minimalist Design | 3 | Generally restrained, no decorative chrome. But three major page regions (summary cards, insights, breakdown accordion) have zero visual separation — reads as one long undifferentiated scroll. |
| 9 | Help Users Recognize/Diagnose/Recover from Errors | 2 | "Still computing," "failed," and "intentionally hidden" all render identically (nothing). Drawdown rows that hit zero balance get `bg-destructive/5` highlighting but no accompanying next-step or link. |
| 10 | Help and Documentation | 3 | `InfoTooltip` gives strong contextual reasoning at point of need, but every instance shares the same generic `aria-label="More information"` (`info-tooltip.tsx:28`) with no static fallback for non-hover contexts. |
| **Total** | | **28/40** | **Good — solid foundation, two systemic gaps (async status, card-pattern consistency) keep it out of Excellent** |

## Anti-Patterns Verdict

**LLM assessment:** This page does not read as AI-generated template sludge — no gradient text, no glassmorphism, no identical card grids, no decorative numbered eyebrows. The one real violation is `CalculationsBreakdown`'s raw `AccordionItem` pattern bypassing the canonical `PageCard`/`SectionLabel` components used everywhere else on the page — a project-standard violation (CLAUDE.md explicitly bans "write the raw Tailwind string inline" patterns) rather than a generic-AI-slop tell. The colored full-borders on the hero/warning metric cards in `ProjectionSummary` (`border-chart-2`, `border-warning`, `border-destructive`) are a defensible state indicator, not the banned decorative side-stripe — flagging only because it sits visually adjacent to a banned pattern.

**Deterministic scan:** `detect.mjs --json` against all 7 page/component files returned `[]` with exit code 0 — clean, no automated findings, verified twice (including a `--no-config` re-run to rule out suppressed rules). No `.impeccable/config.json` exists to mask findings either. The detector's clean result and the LLM's "largely clean" verdict agree.

**Visual overlays:** Not available this run. Browser automation failed at launch in this sandbox ("Missing X server to start the headful browser") before any page could open or be screenshotted. **Note:** Assessment A's report described specific live-browser observations (light/dark mode, a 390px mobile screenshot showing truncated currency values, precise pixel measurements on the Drawdown table). Given Assessment B hit a hard browser-launch failure using the same tooling, those specific visual/pixel claims could not be independently verified and should be treated as unconfirmed — the underlying *code-level* risks they point to (no `truncate` handling or responsive type scaling on `font-mono text-2xl/3xl` metric values in `projection-summary.tsx:126-127`; a 10-column table with no scroll-affordance styling in `calculations-breakdown.tsx:519-579`) are real and verifiable from source, independent of whether the screenshot itself was genuinely captured.

## Overall Impression

This is the densest, most power-user-facing page in the app, and it mostly earns that density honestly — real formulas with real numbers substituted in, exact Monte Carlo internals, SA-specific tax mechanics explained correctly. The gut-check issue isn't decoration, it's **trust under async uncertainty and consistency under scale**: the page's single most important number (Plan Success Rate) can vanish silently with no distinction between "loading," "broken," and "not applicable," and the page's section-card visual grammar splits into two competing idioms exactly where the page gets densest. The single biggest opportunity is wiring the existing `isSimulating` flag into a real loading/error state for the hero card — it's a few lines of plumbing for the page's highest-trust-impact gap.

## What's Working

1. **Optimal Contribution card** (`insights-panel.tsx:146-196`) — correct hierarchy: status banner ("on track" / "consider increasing") before numbers, then the actual recommendation, then methodology footnote. The best-composed card on the page and a template the rest of the page should match.
2. **Account Depletion Timeline** (`calculations-breakdown.tsx:616-685`) — per-account progress bars with full `role="progressbar"` + `aria-value*` attributes, color-differentiated by account type, translating a 25-year table into one scannable visual per account. Genuinely accessible and genuinely clear.
3. **Key Formulas accordion** (`calculations-breakdown.tsx:311-413`) — showing actual substituted math (e.g. `R 35 000 × (1 + 5.50%)^20 = R 102 122`) rather than abstract formulas. This is exactly the kind of transparency that earns a financially literate user's trust.

## Priority Issues

**[P1] Async Monte Carlo failure/loading is indistinguishable from "no result"**
- **Why it matters:** `ProjectionSummary` returns `null` if `!projection`, and the hero success-rate card only renders when `simulationResult` is truthy (`projection-summary.tsx:29-31, 87-101`) — there's no skeleton or error state, just silent absence. `calculator-context.tsx` already computes `isSimulating` (line 62) but neither `projections-page.tsx` nor `ProjectionSummary` consumes it, and `use-monte-carlo-worker.ts:81`'s `onerror` only logs to console — never reaches the UI. For a page whose entire point is "how confident should I be," the headline number silently disappearing reads as "the app has nothing to tell me" rather than "still working" or "something broke."
- **Fix:** Thread `isSimulating` through to `ProjectionSummary` for a skeleton/pulse state on the hero card, and surface the worker's `onerror` as a distinct "Simulation unavailable — retry" state instead of a console-only log.
- **Suggested command:** `/impeccable harden` (this is exactly the "errors, edge cases, production-ready" lane).

**[P2] Two parallel section-card visual languages on one page**
- **Why it matters:** `InsightsPanel` uses the canonical `PageCard` (gold-bar mono-uppercase label) throughout. `CalculationsBreakdown`, one scroll away, uses raw `<AccordionItem className="border rounded-lg px-4">` + plain bold `AccordionTrigger` text for all 8 sections (lines 189, 312, 416, 475, 692, 751, 911, 1019) — never touching `PageCard`/`SectionLabel`. This is the literal "raw Tailwind string inline" pattern CLAUDE.md's component rule exists to prevent, and it's visible in a single scroll: Insights cards get the gold accent, Calculations Breakdown sections get none.
- **Fix:** Either restyle `AccordionTrigger` content with `SectionLabel`'s visual language so accordion headers match card headers, or make the distinction (cards vs. accordions) an explicit documented decision rather than an apparent oversight.
- **Suggested command:** `/impeccable polish` (consistency cleanup against an existing design system, not new design work).

**[P2] Drawdown Phase table (10 columns) has no scroll affordance and pushes past comfortable chunking on any narrow viewport**
- **Why it matters:** The table at `calculations-breakdown.tsx:519-579` (Yr/Age/Start/Growth/Phase/TFSA/Discretionary/Pension/Tax/End) sits inside `max-h-96 overflow-auto` with no visual cue that it scrolls horizontally, and at 10 columns it exceeds the cognitive-load chunking guideline (≤4 per group) substantially. The most important column (End balance) is the one most likely to be clipped at narrow widths.
- **Fix:** Add a scroll-shadow/fade-mask on the table's edges when content overflows, and below `sm:` consider collapsing to a card-per-year layout — the same pattern already proven on the Account Depletion Timeline cards directly below this table.
- **Suggested command:** `/impeccable adapt` (responsive/device-specific fix) followed by `/impeccable layout` for the chunking.

**[P3] Worst-news sections default collapsed while orientation sections default open**
- **Why it matters:** `defaultValue={["inputs", "formulas"]}` (`calculations-breakdown.tsx:187`) opens Input Summary and Key Formulas (input-restating, low-stakes) by default, while Drawdown Phase and Retirement Tax Analysis (the sections most likely to contain the actual answer to "will I be okay") start collapsed. This buries the page's most relevant content behind extra clicks, inconsistent with the "status first" principle already used correctly in the Optimal Contribution card.
- **Fix:** Conditionally include `"drawdown"` in `defaultValue` when `projection.portfolioDepletionAge` is non-null, surfacing risk without extra interaction.
- **Suggested command:** `/impeccable clarify` (information-order/priority fix).

**[P3] Generic, undifferentiated tooltip `aria-label` across all `InfoTooltip` instances**
- **Why it matters:** `info-tooltip.tsx:28` hardcodes `aria-label="More information"` on every instance (4+ uses across the page). A screen-reader user tabbing through hears "More information button" repeatedly with no way to distinguish the Optimal Contribution tooltip from the Medical Cost tooltip until they activate it.
- **Fix:** Accept a label prop per instance (e.g. `aria-label={`More information about ${label}`}`) so each tooltip announces what it's about.
- **Suggested command:** `/impeccable audit` (this is a straightforward a11y/technical-quality fix, not a design-judgment one).

## Persona Red Flags

**Alex (Power User):** Will notice the Drawdown table column clipping and the Insights-vs-Breakdown card-style mismatch immediately — both read as "unfinished" rather than "intentional," undermining the precision-brand trust this persona specifically came for. Wants to verify the math (a genuine strength — the Key Formulas section is built for exactly this) but has no copy/export affordance for the yearly projection tables, locked inside a small scroll div despite all the numeric transparency already on offer. The silent Monte Carlo failure is the single worst thing that can happen to this persona — Alex will reload, check console, and lose trust in every other number on the page if the headline metric just doesn't show up with no explanation.

**Sam (Accessibility-Dependent User):** Generic `aria-label="More information"` on every tooltip forces extra activation just to disambiguate which tooltip is which. The Drawdown table's `"—"` placeholder cells (for non-applicable account types, lines 561-567) carry no semantic differentiation for screen readers — read aloud as "dash" repeatedly across dozens of cells, which is pure noise; should be `aria-label="not applicable"` or excluded from the accessible tree. On the positive side, the Account Depletion Timeline's `role="progressbar"` implementation with full `aria-value*` attributes is genuinely solid and should be the template for the RA Optimisation utilization bar, which already follows the same pattern correctly.

## Minor Observations

- Inconsistent numeric precision conventions: `formatPercent` defaults to 2 decimals (producing "0.92%", "9.78%" in Input Summary) while the hero success-rate card uses 0 decimals (`successRate.toFixed(0)`) — no apparent shared rule across the page.
- Two independently-defined success-rate → color/label tiering systems exist: `getSuccessConfig`'s 5-tier system in `projection-summary.tsx:34-40` vs. the 3-tier `successProbability >= 75/50` logic in `insights-panel.tsx:284-291` — same underlying concept, two unrelated threshold sets.
- The standalone `SectionLabel` at the very top of `CalculationsBreakdown` (line 186) appears once for the whole section, then never again for any of the 8 sub-sections — visually demoting the inner headers, reinforcing the card-pattern inconsistency issue above.
- RA Optimisation's accordion trigger uniquely previews its headline finding inline ("Save Rxx,xxx in tax/year," line 1045-1049) — a good pattern that no other accordion section uses, making it feel like a one-off rather than a deliberate convention.

## Questions to Consider

- If Drawdown Phase and Tax Analysis are where the user's actual answer lives, why do the only two open-by-default sections restate inputs the user already typed in on the Plan page?
- Investment Scenarios computes success rates synchronously and renders instantly; the hero card depends on a Web Worker that can silently never resolve. Should there really be two Monte-Carlo-adjacent code paths with different reliability characteristics answering the same underlying question?
- This page treats "power user" as "expose more raw numbers." Would Alex actually prefer fewer, denser tables with computed deltas (e.g. "this scenario adds 6 years of runway over your current plan") over tables that require the reader to do the comparison by hand?
