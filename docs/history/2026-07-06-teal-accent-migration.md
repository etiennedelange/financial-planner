# 2026-07-06 — Locked Accent Migration: Gold → Teal

## Context

The app briefly carried a dual-theme experiment (`feat: implement teal & yellow theme alongside gold theme`, 2026-07-05): a `ColorThemeProvider` cycling between a gold theme (default) and a teal-and-yellow alternate, toggled via `ThemeToggle`. This contradicted the project's original design philosophy — a single locked accent, documented in `CLAUDE.md` as "Locked gold accent + light/dark mode (no color-theme switching)" — which the code no longer matched.

Requested change: replace the gold accent with teal, using a specific 5-color source palette:

| Hex | HSL | Role assigned |
|---|---|---|
| `#1A936F` | `162 70% 34%` | **Primary** (light mode) |
| `#3CDDAC` (derived, same hue) | `162 70% 55%` | **Primary** (dark mode) |
| `#114B5F` | `195 70% 22%` | Chart-2 ("Fjord Teal") |
| `#88D498` | `133 47% 68%` | Chart-3 ("Glacier Mint") |
| `#C6DABF` | `104 27% 80%` | Reserved — not wired to a token |
| `#F3E9D2` | `42 58% 89%` | Reserved — not wired to a token |

Decision, after clarifying with the user: **full replacement, not a new default alongside gold.** The theme switcher is retired entirely, returning to the original single-locked-accent architecture — just with teal instead of gold.

## What changed

- **`app/globals.css`** — `:root`/`.dark` `--primary`, `--ring`, `--chart-1/2/3` recolored. `--chart-4` (blue, `220°`) and `--chart-5` (red, `0°`) intentionally left untouched — they're fixed semantic hues (Monte Carlo bands, negative/error) unrelated to the "gold accent" being replaced. All neutral tokens (`--background`, `--foreground`, `--card`, `--border`, etc.) also left untouched — this is a surgical accent swap, not a neutral-palette overhaul.
- **`.theme-gold` / `.theme-teal-yellow` CSS blocks removed.**
- **Deleted:** `components/color-theme-context.tsx` (the wired-in gold/teal-yellow provider), plus `components/color-theme-provider.tsx` and `components/color-theme-toggle.tsx` — a second, unrelated 6-color-picker experiment (gold/blue/green/rose/violet/orange) that was already dead code, never imported anywhere.
- **`app/layout.tsx`** — removed `ColorThemeProvider` wrap and the custom pre-hydration `<script>` that applied `theme-gold`/`theme-teal-yellow` classes before hydration. `next-themes` already ships its own no-flash script for light/dark, so nothing replaces it.
- **`components/theme-toggle.tsx`** — back to a single Sun/Moon 2-state toggle (was a 4-state Light-Gold/Dark-Gold/Light-Teal/Dark-Teal cycle).
- **Docs regenerated:** `docs/THEMING.md`, root `DESIGN.md` (+ `.impeccable/design.json` sidecar), `CLAUDE.md`'s theming line, `docs/project-phases/phase-9-site-improvement.md` (resolved the stale "Color theme parity" item, which referred to the now-retired switcher).

## Why chart-2/chart-3 use deep-teal and mint instead of the reserved sage/cream

Sage (`#C6DABF`) and cream (`#F3E9D2`) are both low-chroma, high-lightness tones (`L 80%`/`L 89%`) — too washed out to read as distinct chart lines against either background. Deep-teal (`#114B5F`) and mint (`#88D498`) give better contrast in both directions (dark line on light bg, light fill on dark bg) while staying inside the same palette family as the new primary. Sage/cream are recorded in `DESIGN.md` as reserved tones rather than silently dropped, in case future light-mode surface work wants to draw from the same anchor points.

## Verification

- `npm run build` — clean, no TS errors
- `npm run test` — full suite passing
- Browser-checked in both light and dark mode: no flash of the old accent on reload, focus rings and nav-active indicator render in teal, contrast holds on body text and ghost text in both themes
