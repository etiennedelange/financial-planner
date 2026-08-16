# Styling Checklist

Read when the diff touches `components/`, `app/**/*.tsx`, or `app/globals.css`.

Sources: CLAUDE.md "UI Components" + "Common Pitfalls", `docs/THEMING.md`,
`docs/project-phases/phase-9-site-improvement.md`,
`docs/history/2026-07-06-teal-accent-migration.md`,
`docs/history/2026-08-16-shadscan-accessibility-audit.md`

---

## S1 — Section cards must use the canonical components

Every card section uses `PageCard`; standalone labels use `SectionLabel`. The raw Tailwind
string is never written inline.

- `components/ui/page-card.tsx` — `Card` + `CardContent` with a built-in `SectionLabel` header
- `components/ui/section-label.tsx` — for chart cards needing a custom `CardContent` structure

**Check:** any raw `<p className="text-[10px] font-mono uppercase...">`. That is a
`SectionLabel` written by hand and will drift from it.

**Check:** `Card` + `CardHeader` + `CardTitle` used for a section card. Banned —
`CardTitle` renders `text-2xl font-semibold`, which violates the design system outright.

**Check:** `shadow-none` present on every card. The `dashboard-card` utility has `shadow-sm`
baked in, so a chart `Card` using `dashboard-card` **must** also carry `shadow-none`.
`PageCard` applies it automatically; hand-rolled chart `Card`s do not.

**Check:** label variant. The default is a plain muted mono label
(`text-muted-foreground`, no border). Teal is reserved for primary actions, never section
headers. `labelVariant="destructive"` is the only variant that renders a border
(`border-l-2 border-destructive`) and is for danger zones only.

Correct shapes:

```tsx
<PageCard label="Personal Information" contentClassName="space-y-4">…</PageCard>

<PageCard label="Optimal Contribution"
  leading={<Target className="h-4 w-4 text-primary" />}
  trailing={<InfoTooltip … />} contentClassName="space-y-3">…</PageCard>

<PageCard label="Danger Zone" labelVariant="destructive"
  className="border-destructive/40" contentClassName="space-y-3">…</PageCard>
```

---

## S2 — Semantic tokens, never raw colors

The app has exactly one accent — teal — locked across light and dark. There is no
color-theme switcher; an earlier gold/teal-yellow dual-theme experiment was retired in
favour of the single locked accent ("authority through restraint, not choice paralysis").

**Check:** hardcoded Tailwind palette colors — `bg-blue-500`, `bg-emerald-500`,
`text-amber-600`. Use `bg-primary`, `text-foreground`, `border-border`, `text-destructive`,
`bg-warning`. Hardcoding bypasses theming entirely and will be wrong in one of the two modes.

**Check:** inline color styles — `style={{ color: '#1a936f' }}`. Same problem, harder to find.
`#1a936f` in particular is not just off-palette: it is the **pre-audit `--primary` value**
(hsl 162 70% 34%) retired by the 2026-08-16 accessibility audit
(`docs/history/2026-08-16-shadscan-accessibility-audit.md`). A hardcoded retired token value
regresses the audit itself — say so when you see it.

**Check:** `--primary` or `--accent` overridden outside `app/globals.css`. That defeats the
design system.

**Check:** a new token added without defining it in **both** the `:root` and `.dark` blocks
of `app/globals.css`, and mapping it in `@theme inline`. A token defined once is broken in
the other mode.

**Not a finding:** raw HSL triplets inside `app/globals.css`. That is where they belong.
Values are stored as `H S% L%` without the `hsl()` wrapper so Tailwind can do
`hsl(var(--primary) / 0.5)` for opacity.

**Note:** there is no `tailwind.config.ts`. Tailwind v4 maps tokens to utilities in
`app/globals.css` via `@theme inline`. A diff that adds a Tailwind config file is a finding.

---

## S3 — Chart colors

`--chart-1` aliases `--primary` (teal). `--chart-2` (deep teal-blue) and `--chart-3` (mint)
are drawn from the same palette family so charts read as an extension of the accent.
`--chart-4` (blue) and `--chart-5` (red) are fixed, unrelated hues reserved for projection
bands and negative/error values respectively.

**Check:** a chart series using a literal color instead of `hsl(var(--chart-N))`.

**Check:** `--chart-5` (red) used for anything that is not negative or an error, or
`--chart-4` (blue) for anything that is not a projection band. These carry meaning.

---

## S4 — Currency and formatting

**Check:** a locally defined `formatCurrency`. Import from `lib/utils/currency`. A local copy
drifts on locale, symbol, and rounding — and money that renders inconsistently across tabs
destroys trust in the projection.

---

## S5 — Accessibility

An accessibility audit landed 2026-08-16
(`docs/history/2026-08-16-shadscan-accessibility-audit.md`). Do not regress it.

**Check:** interactive elements without an accessible name — icon-only buttons need
`aria-label` or visually-hidden text.

**Check:** focus states removed (`outline-none` with no replacement). The `--ring` token
matches `--primary` and exists for this.

**Check:** color used as the *only* signal of state — i.e. the state is not also conveyed by
text or an icon. A pill that renders the state as text (`On track` / `Behind target`) is not
colour-only; flagging it as such is a false positive. Both modes shift lightness; a
red/green-only distinction fails for a colorblind user in either.

**Check:** hardcoded foreground/background pairs that fail WCAG AA contrast. As measured in
the 2026-08-16 audit: `bg-emerald-500`/`text-white` is 2.54:1 and `bg-red-500`/`text-white`
is 3.76:1 — both fail the 4.5:1 AA bar. New hardcoded pill/chip colors need the same
measurement, not a guess.

**Check:** new dialogs, dropdowns, and selects keeping their Radix semantics.
`components/ui/dialog.tsx`, `dropdown-menu.tsx`, and `select.tsx` are shared by every
consumer in the app — changes there are higher blast radius than a one-off page.

---

## S6 — Both modes

**Check:** does the change read correctly in light *and* dark? `--primary` keeps hue 162°
across modes; only lightness and saturation shift (34% light → 55% dark) for contrast.
A value tuned by eye against one background is usually wrong against the other.

Cannot be verified by reading alone. If the change is visual and non-trivial, say in the
report that both modes need a browser check rather than asserting it is fine — the project
has a `run-retirement-calculator` skill and Playwright/Chrome DevTools MCP available.
