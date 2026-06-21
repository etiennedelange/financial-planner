---
name: SA Retirement Calculator
description: Sharp financial planning tool for South African retirement modelling
colors:
  analyst-gold: "#F3B416"
  warm-gold-light: "#D49D11"
  vault-black: "#070A13"
  surface-dark: "#0C111D"
  surface-raised: "#171D2B"
  near-white: "#E6EBEF"
  ink-dark: "#0F1524"
  paper-white: "#F9FAFB"
  ghost-text: "#6C7589"
  subtle-border: "#222939"
  signal-red: "#DC2828"
  chart-teal: "#1EB88A"
  chart-blue: "#5184EC"
typography:
  display:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.02em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.analyst-gold}"
    textColor: "{colors.vault-black}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "#DDA312"
    textColor: "{colors.vault-black}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.near-white}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ghost-text}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "#F3B41619"
    textColor: "{colors.analyst-gold}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  nav-item-default:
    backgroundColor: "transparent"
    textColor: "{colors.ghost-text}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.near-white}"
    rounded: "{rounded.lg}"
    padding: "24px"
  metric-card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.near-white}"
    rounded: "{rounded.md}"
    padding: "12px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.near-white}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: SA Retirement Calculator

## 1. Overview

**Creative North Star: "The Precision Instrument"**

This is a calibrated tool, not a dashboard. The SA Retirement Calculator surfaces exact financial projections for users who understand what they're looking at — RA contribution limits, TFSA tax treatment, Monte Carlo success rates, compounding methods. Every element exists to reduce the distance between the user and their number. Nothing decorates; everything informs.

The default theme is dark: deep navy that recedes so the data leads, with a single gold accent that marks the thing that matters — the primary value, the active state, the number you came here for. IBM Plex Sans and IBM Plex Mono carry the voice: technical, neutral, precise. The monospace logotype sets the register immediately — this is a calculation environment, not a consumer app.

This system explicitly rejects: the cheerful nudge-culture of consumer fintech (Mint, PocketSmith); the navy-and-gold SaaS cliché with hero metric gradients and identical icon-card grids; the corporate beige stiffness of bank and insurance portals. It also rejects the opposite failure — terminal-for-its-own-sake density, or brutalism that sacrifices readability for aesthetic posture. The system earns its precision through restraint and correctness, not through decorative austerity.

**Key Characteristics:**
- Dark-first, Vault Black background with tonal surface layering (no shadows as structure)
- Single accent: Analyst Gold, used sparingly — active states, primary values, key CTAs only
- IBM Plex Sans body + IBM Plex Mono for the logotype, metric values, and code-adjacent labels
- Component chrome is minimal (borders over fills, ghost hover states, no cards-in-cards)
- Data visualization carries the visual weight; UI elements step back
- Both dark and light themes meet WCAG AA independently

## 2. Colors: The Vault and the Signal

One accent, used precisely. Everything else is depth and separation through tonal steps — never decoration for its own sake.

### Primary
- **Analyst Gold** (`#F3B416`, dark / `#D49D11`, light): The signal color. Used on active navigation states, primary action buttons, the ring on focused inputs, and the primary chart series. Appears in exactly one place per screen; its scarcity is its authority. The dark variant is slightly warmer and brighter to read clearly against Vault Black.

### Neutral — Dark Theme
- **Vault Black** (`#070A13`): Body background in dark mode. Not pure black — a 5% lightness navy that prevents eye fatigue during long sessions. Forms the deepest layer of the tonal stack.
- **Surface Dark** (`#0C111D`): Card and panel surfaces. One tonal step above Vault Black — enough to separate a card from the page without needing a border.
- **Surface Raised** (`#171D2B`): Secondary and muted backgrounds. Metric cards, input fills, hovered menu items. The third tonal step.
- **Near White** (`#E6EBEF`): Primary foreground text on dark surfaces. Slightly cool to harmonize with the navy cast.
- **Ghost Text** (`#6C7589`): Muted foreground — descriptions, secondary labels, placeholder text. Must pass 4.5:1 against Surface Dark; test before use.
- **Subtle Border** (`#222939`): Dividers, card outlines, input strokes. Separates surfaces without calling attention.

### Neutral — Light Theme
- **Paper White** (`#F9FAFB`): Body background in light mode. Nearly white but with a faint cool cast.
- **Ink Dark** (`#0F1524`): Primary foreground in light mode. Deep navy, not black — carries the same hue family as the dark theme.

### Status
- **Signal Red** (`#DC2828`): Destructive actions, error states, negative deltas.
- **Chart Teal** (`#1EB88A`): Positive scenarios, success rate visualisation, the second chart series.
- **Chart Blue** (`#5184EC`): The fourth chart series; projections, Monte Carlo percentile bands.

**The One Signal Rule.** Analyst Gold is used on ≤1 active element per view at a time. Applying it to multiple concurrent elements — two active nav items, a highlighted card plus a CTA — breaks the signal. If more than one element needs to assert priority, the hierarchy is wrong; fix the hierarchy, not the accent budget.

## 3. Typography

**Primary Font:** IBM Plex Sans (weights 300, 400, 500, 600)
**Mono Font:** IBM Plex Mono (weights 400, 500, 600)

**Character:** IBM Plex Sans is neutral-technical with just enough warmth to avoid terminal coldness. Plex Mono in the logotype and metric values signals calculation without cosplaying a CLI. The pairing needs no decorative intervention — the fonts carry the register on their own. Do not add serif display type; it breaks the technical register.

### Hierarchy

- **Display** (600, clamp(1.75rem → 2.25rem), 1.1 lh, −0.02em): Page titles and the primary projection headline. Rare — one per page maximum.
- **Headline** (600, 1.25rem, 1.25 lh, −0.01em): Section headings, card titles, modal headers. The primary title within a content block.
- **Title** (500, 0.9375rem, 1.4 lh): Sub-section labels, metric labels, form group headers.
- **Body** (400, 0.875rem, 1.6 lh): Descriptions, help text, table content. Cap at 65–75ch.
- **Label** (IBM Plex Mono 500, 0.75rem, 1.3 lh, 0.02em tracking): Currency values in metric cards, percentage outputs, monospace-appropriate data. The mono face grounds financial numbers in a calculation context.

**The Mono Reserve Rule.** IBM Plex Mono is reserved for financial output values (formatted currency, percentages, ages) and the wordmark logotype. It is not a decorative choice — applying it to UI labels or prose creates false technical emphasis. Body text and navigation items stay in IBM Plex Sans.

## 4. Elevation

This system is flat by default. Depth is expressed through tonal layering (Vault Black → Surface Dark → Surface Raised) rather than shadows. A `shadow-sm` exists on standard cards but it is ambient and nearly invisible against the dark background — its role is subtle separation, not structural signaling.

**The Tonal Stack Rule.** Never exceed three tonal steps in a single view hierarchy (page → card → metric card). A fourth step means something has been nested that should not be. Nested cards (`bg-card` inside `bg-card`) are prohibited; use `bg-muted` or `bg-accent` for inner surfaces instead.

### Shadow Vocabulary
- **Ambient** (`box-shadow: 0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)`): The single shadow level — on `<Card>` components. Provides the lightest separation on dark surfaces. Not used for hover effects; use tonal shift instead.

## 5. Components

### Buttons

The chrome disappears; the action leads.

- **Shape:** Gently rounded (6px / `rounded-md`). Not pill, not sharp — a contained, precise gesture.
- **Primary (`bg-primary`):** Analyst Gold background, Vault Black text. `px-4 py-2` (16px/8px). Hover: `/90` opacity tint (`bg-primary/90`). Used for save, confirm, and calculate actions — one per view.
- **Outline:** Transparent background, `border-input` stroke, `bg-accent` on hover. For secondary actions where the primary is already occupied.
- **Ghost:** No border, no background. `bg-accent` on hover. Navigation triggers, icon buttons, sidebar settings link. The lightest presence.
- **Destructive:** `bg-destructive` (Signal Red) text background. Sign out, delete account. Never used in a group with primary — too much assertion.
- **Focus ring:** 2px `ring-ring` (Analyst Gold) with 2px offset. Visible on all variants; WCAG AA keyboard target.

### Cards / Containers

- **Corner Style:** Uniformly rounded (8px / `rounded-lg`). The standard surface container.
- **Background:** `bg-card` (#0C111D dark / white light). One tonal step above the page background.
- **Shadow:** Ambient `shadow-sm` only. Does not increase on hover — tonal shift or border highlight preferred.
- **Border:** `border border-border` by default. The subtle-border (#222939) is near-invisible on dark, providing only tactile structure.
- **Internal Padding:** `p-6` (24px) standard; `p-3` (12px) for compact metric cards.
- **Nesting:** Metric cards inside dashboard cards use `bg-muted` or `bg-accent` — never `bg-card` again. The tonal stack has three levels; the card boundary is level two.

### Inputs / Fields

- **Style:** `border-input` stroke, `bg-background` (transparent on dark), `rounded-md` (6px), `px-3 py-2`.
- **Focus:** 2px `ring-ring` (Analyst Gold), 2px offset. No border-color change — the ring does the work.
- **Placeholder:** `text-muted-foreground` (Ghost Text, #6C7589). Must pass 4.5:1 against the input background; verify in both themes.
- **Error:** `border-destructive` (Signal Red). Focus ring remains gold — the border communicates the error, the ring communicates the focus state.
- **Disabled:** `opacity-50`, `cursor-not-allowed`. No structural change needed.

### Navigation (Sidebar)

- **Structure:** Fixed 220px left sidebar. `bg-background`, `border-r border-border`. Three zones: wordmark header, nav items, bottom utility.
- **Nav item default:** `text-muted-foreground`, transparent background. `hover:bg-accent hover:text-foreground`.
- **Nav item active:** `bg-primary/10` (Analyst Gold at 6% opacity), `text-primary`. A 2px `bg-primary` left-edge indicator (`absolute left-0 inset-y-1 w-[2px]`). The indicator is the only solid gold use in the sidebar.
- **Typography:** `text-sm font-medium`, `tracking-wide`. Not uppercase; not tracked aggressively. Calm, readable.
- **Wordmark:** IBM Plex Mono logotype — "Retirement" in 10px semibold uppercase with 0.18em tracking, "Calculator" in 8px regular uppercase with 0.14em tracking. The only place where heavy tracking is intentional.

### Charts (Recharts)

- **Series colors:** Analyst Gold (primary series), Chart Teal (#1EB88A), pale Gold (#F3B416 at 70%), Chart Blue (#5184EC), Signal Red (#DC2828). Ordered by importance, not by hue distance.
- **The Accessibility Rule.** Color alone never encodes data series. Each series must also differ by shape (solid vs. dashed line), pattern, or direct label. Monte Carlo confidence bands use opacity layering (10%/50%/90%) — the opacity step, not just the color, encodes the confidence level.

## 6. Do's and Don'ts

### Do:
- **Do** use Analyst Gold on exactly one active element per view, not counting `SectionLabel`'s structural left-border accent (a fixed, repeating chrome element, not a per-view signal). Rarity is authority for the signal use; the structural use is a constant.
- **Do** use IBM Plex Mono for formatted financial values (currency, percentages) and the wordmark. Mono = calculation context.
- **Do** layer depth tonally: Vault Black → Surface Dark → Surface Raised. Three steps maximum.
- **Do** use `ghost` or `outline` button variants for secondary actions when a `primary` is already present in the view.
- **Do** use `text-wrap: balance` on Display and Headline headings to prevent awkward single-word orphans.
- **Do** verify muted foreground text (Ghost Text #6C7589) at 4.5:1 contrast against its background before shipping any new surface.
- **Do** label every chart series with a text label or legend entry — color alone does not carry information.
- **Do** respect SA-specific account type labels (RA, TFSA, Pension Fund, Preservation Fund) exactly — these are not interchangeable and their specificity is a feature.

### Don't:
- **Don't** nest `bg-card` inside `bg-card` — use `bg-muted` or `bg-accent` for inner surfaces. Nested cards are always wrong.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, list items, or callouts. This is the absolute ban. Rewrite with full borders, background tints, or nothing. **Exception:** the canonical `SectionLabel` component (mono-uppercase section headers) keeps a 2px gold (or red, for `destructive`) left-border accent — this is the one sanctioned use of the pattern, a deliberate identity choice for section eyebrows specifically. Don't extend the exception to any other component.
- **Don't** apply gradient text (`background-clip: text` with a gradient). Financial values must read with the same weight as the rest of the text.
- **Don't** use IBM Plex Mono for UI labels, navigation, or prose copy. Mono is reserved for financial output and the wordmark — it signals "this is a number," not "this is interesting."
- **Don't** use Analyst Gold on more than one concurrent element. Two gold nav items, a gold card border, and a gold CTA button in the same view collapse the accent hierarchy.
- **Don't** add glassmorphism (backdrop-filter blur) decoratively. This system's surfaces are opaque; glass effects introduce visual noise on a data-dense layout.
- **Don't** create a fourth tonal depth step. If you need a new surface level, consolidate the hierarchy rather than adding another `bg-*` layer.
- **Don't** use consumer-fintech UI patterns: no gamified progress bars with cheerful copy, no pastel metric cards, no rounded pill buttons with emoji-adjacent icons. See PRODUCT.md anti-references.
- **Don't** use the hero-metric template: large number + small label + gradient accent behind it. The metrics grid uses flat tonal cards, not lifted hero cards with color washes.
- **Don't** genericise SA account type names for "clarity." RA, TFSA, Pension Fund: these are the correct terms for the users of this tool.
