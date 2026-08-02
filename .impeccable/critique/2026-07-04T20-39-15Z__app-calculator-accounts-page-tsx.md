---
target: /accounts
total_score: 24
p0_count: 1
p1_count: 3
timestamp: 2026-07-04T20-39-15Z
slug: app-calculator-accounts-page-tsx
---
Method: dual-agent (A: critique-assessment-a · B: critique-assessment-b)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Add/edit/delete confirm via toast, but "Continue →" fails silently on invalid step 1 — no loading states either |
| 2 | Match Between System and Real World | 4 | RA/TFSA/Pension/escalation terms, rand formatting, TFSA lifetime-limit copy all correct for the SA audience |
| 3 | User Control and Freedom | 2 | Delete is irreversible, no Undo; add-wizard has Back/Cancel |
| 4 | Consistency and Standards | 3 | Two "Add Account" affordances (header + FAB); 5-color type-badge system fights the single-gold-accent rule |
| 5 | Error Prevention | 2 | Cancel autoFocus on delete is good, but Continue silently blocks with no error text; delete dialog hides the R-value at stake |
| 6 | Recognition Rather Than Recall | 3 | Inline tooltips carry SA benchmark ranges, reducing recall |
| 7 | Flexibility and Efficiency of Use | 2 | Returns/fees hidden behind per-row expand; 2-step wizard adds friction; duplicate CTAs cause hesitation |
| 8 | Aesthetic and Minimalist Design | 2 | Gold stripe on every card, 5-hex rainbow badges, "(unchanged)" noise rows |
| 9 | Help Recognize/Diagnose/Recover from Errors | 1 | Confirmed: empty Name/Provider + Continue → zero error text, reads as a broken button |
| 10 | Help and Documentation | 3 | InfoTooltips with SA benchmarks + TFSA "since 2015" explainer are genuinely useful |
| **Total** | | **24/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**Start here. Does this look AI-generated?** Yes, on two compounding counts.

**LLM assessment (Assessment A):** The side-stripe gold border (`border-l-2 border-primary` via `SectionLabel`) is stamped on every card — Portfolio + all three group cards — which is a textbook side-stripe-border tell AND a total collapse of this project's own "gold on ≤1 active element per view" rule (7+ gold elements visible at once: active nav item, 4 label stripes, header Add-Account, FAB Add-Account). Layered on top: a 5-hex rainbow (`#818cf8/#60a5fa/#2dd4bf/#4ade80/#fb923c`) for account-type badges — the "consumer fintech cheerfulness" the brand brief explicitly rejects. Tiny uppercase tracked mono eyebrows are also used as structural scaffolding on every section ("PORTFOLIO", "EXPECTED RETURN", "TFSA LIMITS", "PORTFOLIO IMPACT").

**Deterministic scan (Assessment B):** Static CLI scan (`detect.mjs`) on the accounts `.tsx` files came back clean (exit 0) — but this is a coverage gap, not a clean bill of health: the static engine only runs text/regex rules and doesn't parse Tailwind utilities or computed styles (verified with a probe file containing `bg-blue-500 shadow-2xl` that also returned empty). The **runtime browser detector** (computed-style aware) is where the real signal is — 7 anti-patterns:
- **low-contrast ×2**: white `#ffffff` on gold `#d49d11` = **2.4:1** (need 4.5:1) — the primary "Add Account" button, rendered in both the header (`accounts-page.tsx:127`) and the floating action bar, plus the dialog's "Continue" submit button. This is the single most significant finding — it hits every primary CTA in the flow.
- **low-contrast ×1**: muted `#6c7689` on `#f9fafb` = 4.4:1 (borderline) on the "ACCOUNTS" page-title H1 in shared `components/layout/top-bar.tsx:54`.
- **tiny-text ×1**: 10–11px text on `SectionLabel` (`components/ui/section-label.tsx:20`) and the detail labels "Expected return / Annual fees / Net return / Escalation" (`accounts-page.tsx:477,483,489,495`).
- **nested-cards ×3**: PageCard summary/group cards contain nested card-styled blocks, echoed inside the Add dialog.

Where the two assessments agree: gold overuse, low-contrast/tiny text, and nested cards were flagged independently by both the design director read and the runtime detector — strong signal, not a single reviewer's opinion. One nuance the detector caught that the LLM read as a lesser note: the two "Add Account" low-contrast hits are the *same* defect counted twice (two rendered instances of one component), not two distinct bugs.

**False positives / context caveats:** The `text-[10px]` `SectionLabel` tiny-text flag is a deliberate, CLAUDE.md-mandated pattern (canonical `PageCard`/`SectionLabel` usage) — a real legibility tradeoff, but intentional system-wide, not accidental drift. The borderline H1 contrast issue (4.4 vs 4.5) originates in shared `top-bar.tsx`, not in accounts-specific code.

**Visual overlays:** Browser-based live overlay injection succeeded (mutation preflight passed, `detect.js` injected into a fresh tab); no persistent `[Human]`-labeled tab was left open for you since the live-server helper was stopped after evidence collection, per the isolation protocol. The console output is summarized above with exact file:line locations.

## Overall Impression

The Accounts page has real substance underneath the decoration problem: the live PortfolioImpactStrip and SA-specific tooltip guidance show genuine product thinking. But the surface is fighting the brand's own rules — a "single warm gold accent, ≤1 active element" system that's actually spending gold on 7+ elements per view, plus a primary CTA that fails WCAG AA contrast outright (2.4:1) on every "Add Account" button in the app. The single biggest opportunity: strip the gold stripe from section labels and fix the button contrast in one pass — it simultaneously fixes the AI-slop verdict, the accessibility score, and the brand-consistency heuristic.

## What's Working

1. **Live PortfolioImpactStrip** (`components/accounts/portfolio-impact-strip.tsx`) — recomputes the whole-portfolio ripple against the store's other accounts in real time, and its "changed" check compares formatted display strings rather than raw deltas (lines 84–87), so sub-rounding noise doesn't falsely flag a change. Smart, honest, reduces working memory for a numbers-literate user.
2. **Domain-literate guidance** — tooltips carry real SA benchmark ranges ("SA equity 10–12% | Balanced 7–10%"), and the TFSA block explicitly explains "cumulative since 2015, not current balance" to reinforce the R500k lifetime limit. This respects the audience instead of talking down to them.
3. **Safe destructive default** — `AlertDialogCancel autoFocus` (`accounts-page.tsx:519`) means a reflexive Enter on the delete confirmation cancels rather than deletes.

## Priority Issues

**[P0] Primary CTA fails WCAG AA contrast (2.4:1, need 4.5:1).** White text on gold (`#ffffff` on `#d49d11`) on the header "Add Account" button, the FloatingActionBar's duplicate, and the dialog's "Continue" submit button — confirmed by the runtime detector, not a static-analysis guess. This is the single most-used interactive element in the flow and it's illegible for a meaningful slice of users. **Fix:** darken the button's foreground to the vault-black/ink-dark token already defined in DESIGN.md for gold-on-gold text pairing (button-primary already specifies `textColor: vault-black` — the live component has drifted from its own token). **Suggested command:** `/impeccable audit` (contrast pass) or `/impeccable harden`.

**[P1] Silent validation failure on "Continue →".** Empty Name/Provider fields + Continue produces nothing — no error text renders (confirmed via the a11y tree, not just visually). `Step1.handleContinue`'s `trigger([...])` blocks progression but `errors.*` never surface to the DOM. Reads as a broken/frozen button, and both Assessment A and the Riley/Alex personas flagged it independently. **Fix:** switch RHF to `mode: "onTouched"` or explicitly render field errors after a failed `trigger()`, and focus the first invalid field. **Suggested command:** `/impeccable clarify`.

**[P1] Gold-accent scarcity violated — the project's own "≤1 gold element per view" rule is broken 7×.** `border-l-2 border-primary` on every `SectionLabel`/`PageCard` (Portfolio + 3 group cards) is simultaneously an AI-slop tell (side-stripe border, explicitly banned) and a brand-consistency violation — gold appears on the active nav item, 4 label stripes, and 2 duplicate Add-Account buttons at once, destroying its "scarcity is its authority" premise. **Fix:** drop the gold stripe from section labels entirely (plain muted-mono label, no accent), and consolidate to a single primary Add-Account affordance (see next issue) so gold has exactly one home per view. **Suggested command:** `/impeccable quieter`.

**[P1] Duplicate Add/Seed CTAs.** "Add Account" + "Seed" live in both the Portfolio header and the persistent FloatingActionBar; on mobile these stack with the bottom tab nav (three overlapping action bars), and Alex-persona testing flagged real hesitation over "which one?" **Fix:** pick one location — keep the FAB for scroll-persistence and drop the header pair (or vice versa). **Suggested command:** `/impeccable distill`.

**[P2] Delete lacks money-context and recovery.** The confirm dialog names the account but never shows its rand value, and the resulting toast ("Account deleted") offers no Undo despite implying permanence — a real emotional valley at the end of a high-stakes flow (Riley and the emotional-journey read both flagged this). **Fix:** surface the balance in the dialog copy ("Delete RA — R 165 000?") and add an Undo action to the toast that re-inserts the removed account object for a few seconds. **Suggested command:** `/impeccable harden`.

## Persona Red Flags

**Alex (Power User):** The silent "Continue →" reads as a frozen app — no keyboard-detectable feedback on invalid submit. Returns/fees/escalation are hidden behind a per-row expand instead of a dense inline table, forcing extra clicks to compare accounts. Two identical "Add Account" buttons (header + FAB) cause a "which one?" pause instead of instant action. High abandonment risk on the wizard's step-2 friction alone.

**Sam (Accessibility-Dependent):** The FAB hint text at `text-[11px] text-muted-foreground/40` and the `text-[10px]` detail labels both fail size/contrast checks (runtime-overlay confirmed). The account row is `role="button"` wrapping nested Edit/Delete buttons — this muddies both tab order and screen-reader semantics (a composite reads as one run-on string: "RA qweqwe qweqw +R 5 000/mo 8.6% net R 165 000 Edit account Delete account"). Account-type identity leans on color coding (the 5-hex rainbow) with only a 10px short-code as the non-color cue.

**Riley (Deliberate Stress Tester):** Submitting the add-account form with empty required fields produces a dead button with zero feedback — "is this broken?" Number inputs accept arbitrarily large magnitudes with no soft caps or thousands-formatting while typing. Deleting a funded account (confirmed with real R165,000 balance in testing) is instant and irreversible with no way back.

## Minor Observations

- Edit-dialog labels "Expected Return (%)" / "Annual Fees (%)" wrap to two lines at `max-w-md` — ragged, avoidable with a narrower label or wider column.
- Each single-account group card wraps just one row — heavy card chrome (a 3rd nested card layer, per the detector) for a single item; consider a lighter treatment when a group has exactly one account.
- PortfolioImpactStrip shows three "(unchanged)" rows on open before any edit — hide rows until a value actually moves, to cut noise.
- Two Radix a11y console warnings during interaction: missing `DialogDescription`/`aria-describedby` on the account dialog, and a delete-confirm `AlertDialog` blocking `aria-hidden` on an element that retains focus (recommend `inert` instead).
- `useIsMobile` reads `window.innerWidth` once on mount with no resize listener — crossing the 640px breakpoint won't switch Dialog↔Drawer without a reload.

## Questions to Consider

1. If your users are "financially literate and want control, not hand-holding," why is adding an account a 2-step wizard that hides return/fees/escalation on step 2 — rather than one dense form they could scan at a glance?
2. The brand system says gold appears on ≤1 active element per view. Right now it's on roughly 7. If you could spend that single gold token on exactly one thing, what would it be — and doesn't that answer tell you everything else to strip?
3. Deleting an account wipes real projection money with no Undo. For a tool that calls itself a "precision instrument," is a confirm-dialog the right pattern, or should destructive removal be a reversible soft-delete (archive + Undo) instead?
