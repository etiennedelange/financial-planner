# 2026-08-24 — AnimateIcons icon motion: the instrument responds to touch

## What changed

Replaced static lucide icons with animated path-level icons from
[AnimateIcons](https://animateicons.in) (`@animateicons/react@0.4.3`, MIT, built on
`motion/react` — the same motion library the app already uses) on every
**interactive control** in the app. The icons animate at the SVG path level when
their control is hovered or focused.

**Motion thesis (Operate mode — "The Precision Instrument"):** the focal moment
is the navigation — sidebar and bottom-nav icons come alive when you reach for a
tab, like an instrument cocking when touched. Supporting feedback: every
converted icon sits on a real control (buttons, row actions, expand chevrons,
reset/retry/export) and acknowledges reach and keyboard focus. Informational
icons deliberately stay static: metric-card icons, chart-header icons,
alert/warning glyphs, `Info` tooltips, `Loader2` spinners, Radix-internal chrome
(dialog X, select/dropdown chevrons, accordion), and status toggles
(expense in-retirement Circle/CircleCheck). No page-load choreography, no
scattered decoration — motion only where it acknowledges an action.

## What was converted (13 files, ~30 icons)

| Surface | Icons |
|---|---|
| `components/layout/sidebar.tsx` | nav icons (LayoutDashboard, Wallet, SlidersHorizontal, Receipt, TrendingUp, ChartColumn) + Settings link |
| `components/layout/bottom-nav.tsx` | same 7 for mobile |
| `components/layout/top-bar.tsx` | Search (⌘K trigger), TrendingDown (display-mode trigger) |
| `components/theme-toggle.tsx` | Sun/Moon (AnimatePresence crossfade kept) |
| `components/dashboard/quick-actions-card.tsx` | Plus, Eye, Printer, FileSpreadsheet |
| `components/inputs/assumptions-form.tsx` | RotateCcw → RefreshCw (click-spin on reset kept) |
| `app/error.tsx`, `app/calculator/error.tsx` | RefreshCw (retry) |
| `components/auth/account-settings.tsx` | Download (export) |
| `components/pages/accounts-page.tsx` | Plus, Server (was Database), Pencil, Trash2, ChevronDown |
| `components/pages/expenses-page.tsx` | Plus, Trash2, Check, X, Pencil, ChevronDown/Right, Save/Cancel |
| `components/pages/settings-page.tsx` | Sun, Moon, SunMoon→Monitor, Printer, FileSpreadsheet, Download, Upload, RotateCcw→RefreshCw |
| `components/scenarios/scenario-switcher.tsx` | ChevronDown trigger, Pencil, Trash2, Plus |

Naming notes: the AnimateIcons lucide set uses current lucide names, so
`BarChart3` → `ChartColumnIcon`, `Database` → `ServerIcon`, `SunMoon` →
`MonitorIcon`, `RotateCcw` → `RefreshCwIcon` (RotateCcw doesn't exist there).
`User`/`LogOut` remain lucide (decorative avatar + menu chrome).

## Mechanism

Two new primitives:

- `components/ui/animated-icon.tsx` — `useAnimatedIcon()` returns
  `{ iconProps: { ref }, controlProps: { onMouseEnter/Leave, onFocus/Blur } }`.
  The ref attaches to the icon's imperative handle (`startAnimation()` /
  `stopAnimation()`); the control props go on the row/button so the **whole
  control** triggers the motion (the library's own hover detection only covers
  the icon box). Reduced-motion gate on top of the library's built-in
  `useReducedMotion` handling. Nav rows became small subcomponents
  (`NavItem`, `BottomNavItem`, `SettingsNavLink`, …) so each row owns one hook.
- `components/ui/animated-icon-button.tsx` — `AnimatedIconButton` (icon-only
  buttons: row actions, save/cancel, expand chevrons) wrapping shadcn `Button`
  with hover/focus-driven icons. Sizing moved from Tailwind `h-4 w-4` classes
  to the library's `size` prop (16/14/18px) because the icon renders a
  div-wrapped `<svg>`; `className` still flows to the wrapper div
  (`shrink-0`, `mr-2`, `rotate-180` chevron rotation all preserved).

Everything else (the library's per-icon authored keyframes: draw-in paths,
transform-origin wiggles, tick slides) is shipped by `@animateicons/react`.

## Verification

- `npm run test` — 990/990 pass
- `npm run typecheck` / `npm run lint` — clean (0 errors; 9 pre-existing
  warnings unrelated to this change)
- `npm run build` — clean
- `npm run shadscan:gate` — 93/100 (A), identical to HEAD (the CLAUDE.md "98"
  baseline is stale; verified by stashing and re-running on HEAD)
- Browser-verified (Playwright, dev server):
  - nav icon animates on row hover and keyboard focus (`LayoutDashboard`
    transform mid-flight: `scale(1.057) rotate(-1.37deg)`)
  - `prefers-reduced-motion: reduce` → no animation, verified live
  - all 4 main routes render with explicit icon sizes, zero button overflow,
    zero console errors; mobile bottom-nav renders 7 items at 18px
  - theme toggle crossfade + light mode work
- Repo e2e journeys (`npm run ui:doc`) show the same 33 failures on clean HEAD
  (auth/Supabase-environment dependent) — no regression from this change.

## Follow-up: trash lid clipped mid-swing

Reported after ship: the Delete icon on the accounts page looked cut off at the
top while animating. Root cause: `Trash2Icon` swings its lid `rotate: [0, -24,
-24, 0]` around the top-left origin, pushing the lid's right end ~3 viewBox
units above the top edge (~1.75px at 14px render), and SVG root elements clip
at their box by default. A scan of all converted icons showed the same class of
overshoot elsewhere (Plus 90° rotation, RefreshCw 360°, Server drawer travel,
X/Search scale bounces), so the fix is one scoped rule in `app/globals.css`
rather than per-site classes:

```css
div.inline-flex.items-center.justify-center > svg {
  overflow: visible;
}
```

The selector matches only the `@animateicons/react` wrapper div (nothing else
in the app renders that structure — the lucide avatar is `flex`, not
`inline-flex`); overshoots stay inside button padding (icons render at
10–18px in 28px+ buttons). Browser-verified mid-animation: the rule is applied
and the lid's bounding box paints ~1px above the svg box instead of clipping.

## Follow-up: house-rules review fixes

- Re-added the `data-icon="inline-start"` (and `inline-end` on the scenario
  trigger chevron) audit markers to all converted icon+text buttons, restoring
  the 2026-08-16 shadscan audit's documented coverage (the marker lands on the
  animateicons wrapper div via prop spread; browser-verified).
- `AnimatedIconProps`/`AnimatedIconHandle` in `components/ui/animated-icon.tsx`
  made module-internal (no external importers; only `AnimatedIconComponent`
  consumes them).

## Bundle cost (measured)

The package ships a single 509-icon ESM barrel that Turbopack does **not**
tree-shake: the app shell chunk grew by ~895 KB raw / **84.7 KB gzip** (verified
with a minimal one-icon page — all 509 icons land regardless). Accepted: it is
one shared, HTTP-cached chunk loaded once per session, and the runtime cost is
zero until the user actually hovers/focuses a control. Worth revisiting if a
future package version splits per-icon files.

## Files

- new: `components/ui/animated-icon.tsx`, `components/ui/animated-icon-button.tsx`
- modified: 13 files listed above + `package.json` / `pnpm-lock.yaml`
  (`@animateicons/react@0.4.3`)