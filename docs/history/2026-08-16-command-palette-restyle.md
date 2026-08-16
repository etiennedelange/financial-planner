# Command palette: restyled to pre-audit design on cmdk + account-search fix

Date: 2026-08-16

## What

The cmdk command palette (`components/command-palette/command-palette.tsx` +
`components/ui/command.tsx`) was restyled from the shadcn-default look back to
the pre-shadscan-audit design, while keeping cmdk as the engine. Two
behavioural changes rode along:

- **Account search fixed (P0).** Items used `value={`account-${acc.id}`}`
  where `acc.id` is a hex `crypto.randomUUID()`; cmdk matches the query only
  against `value`, so typing "tfsa", "pension", "ra", or any account name
  returned "No results found". Items now use `value={acc.name}` with
  `keywords={[ACCOUNT_TYPE_LABELS[acc.type]]}` — account names and SA type
  labels are searchable, restoring the old palette's label+subtext matching.
- **Teal focus line under the search input removed.** The
  `focus-within:border-ring/60` underline is gone; the subtle
  `focus-within:bg-muted/40` focus proxy remains so keyboard users still get a
  visible focus state.

## The restored old-design details

- Container: `max-w-[520px]`, `rounded-xl`, `shadow-2xl`, positioned at
  `top-[28%]` (not centered), `bg-background` surface (Command root made
  transparent so the dialog surface shows through — `--popover` is a raised
  step, the old design sat on the page surface).
- Search row: `px-4 py-3` with `gap-2.5`, full-opacity muted Search icon
  (was `opacity-50`), and the `×` clear button restored (query state is now
  controlled by the palette and passed to cmdk via `value`/`onValueChange`).
- Items: compact full-width rows (`px-4 py-2.5`, `gap-3`, no radius), label
  `font-medium`, selected row `bg-accent` with teal icon (`[&[data-selected=true]_svg]:text-primary`), trailing `↵` indicator (rendered as a real span
  toggled by `[&[data-selected=true]_[data-arrow]]:flex` — the `content-['↵']`
  utility does not compile in this Tailwind setup, so no `::after` content).
- Group headings: restored 10px uppercase `tracking-widest`
  `text-muted-foreground/50` micro-labels.
- Empty state: "No results for "query"" with the query in `font-medium
  text-foreground` (was a bare "No results found").
- List: `max-h-[360px]` with `py-1.5`.

## What was kept from the audit

- Focus-visible rings on items and the input-row focus proxy (the old design
  had no visible focus at all — those were real a11y fixes, not styling).
- `sr-only` DialogTitle, `aria-label` on the input, Escape/outside-click
  close, cmdk combobox ARIA and roving focus.

## Verification

- Account search verified live: typing "tfsa" now surfaces a seeded "My TFSA"
  account with its type + balance subtext.
- Old-design details verified live via computed styles: 520px/12px radius/
  top 28%/no transform; rows `10px 16px`; teal selected icon; 10px uppercase
  headings; `↵` visible only on the selected item; input underline stays
  `border-border` on focus; empty state + clear button functional.
- `npm run typecheck` clean, `npm run lint` 0 errors (10 pre-existing
  warnings, none in touched files), `npm run test` 985/985, `npm run build`
  clean, `npm run shadscan:gate` **98/100 (A)** — no score change.

## Notes / tradeoffs

- The 10px hint strip, `/70` balance subtext, and `/50` group headings are
  sub-AA contrast and were deliberately restored because the user prefers the
  old design; the shadscan score is unaffected (98/100 baseline retained).
- `/impeccable critique` previously scored this surface 24/40 (P0 search bug,
  contrast, modal surface, icon drift, no product actions). This change
  resolves the P0 and the surface decision (bg-background is the user's
  explicit preference); the remaining items stand unless the user opts in.
