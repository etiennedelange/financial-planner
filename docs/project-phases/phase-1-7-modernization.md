# Phase 1.7: Next 16 / React 19 / Tailwind v4 Modernization ✅ COMPLETE

**Goal:** Fully adopt the features shipped by the recent stack upgrade (Next 14 → 16, React 18 → 19.2, Tailwind 3 → 4, Zustand 4 → 5, Zod 3 → 4). Reduce boilerplate, fix real correctness issues uncovered during audit, and produce measurable deltas against the committed perf baselines.

**Scope note:** this phase is scoped to *modernization* — adopting features the new versions shipped — not general perf tuning. There is deliberate overlap with Phase 1.6 Phase 2 (e.g., Zustand selectors, form work) but the framing is different: 1.6 is "make it faster", 1.7 is "make it idiomatic for the current stack." Both eventually converge; do whichever the current refactor branch is closer to.

## Measurement methodology

Every step MUST be verified against the committed perf baselines added in commit `c359b81`:

```bash
pnpm build && pnpm start                  # in a separate terminal
pnpm perf:after                            # empty scenario
pnpm perf:after:interactive                # interactive scenario (3-account portfolio)
pnpm perf:compare                          # diff vs perf/baseline.json
pnpm perf:compare:interactive              # diff vs perf/baseline-interactive.json
```

Committed baselines at commit `ae8f18c` (Chromium headless, 4× CPU throttle, 5 runs median):

| metric       | empty  | interactive |
|--------------|-------:|------------:|
| fcp          |   88ms |        88ms |
| lcp          |   88ms |        88ms |
| tbt          |  166ms |       597ms |
| longTaskCount|      2 |           5 |
| longestTask  |  185ms |       314ms |
| jsBytes      |  409KB |       409KB |

For root-cause analysis on a regression or a metric that isn't moving as expected, use the `chrome-devtools-mcp` server registered in `.mcp.json` — it exposes full Chrome DevTools Protocol tracing (`performance_start_trace`, `performance_analyze_insight`, etc.) for interactive profiling sessions.

## Reference audit

Full technical design review with rationale per item is in the conversation record from 2026-04-11. Key findings that drive the steps below:
- Tailwind v4 running through the v3-compat bridge (`@config` directive)
- All 15 `components/ui/` files still use `React.forwardRef` (React 19 obsoletes this)
- `ColorThemeProvider` has a real hydration bug masked by `suppressHydrationWarning`
- `calculator/page.tsx` debounces Monte Carlo via `setTimeout` + `useRef`
- `.eslintrc.json` still legacy format; ESLint 10 installed

---

## Step 1: Metadata/viewport split + ESLint flat config ✅ DONE (commit 3640f93)

**Why now:** Unblocks tooling for later steps and clears standing build warnings.
- Next 15+ requires `viewport` as a separate export (currently warns on `next build`)
- ESLint 9+ uses flat config; `eslint-config-next@16` ships a flat-config entrypoint

**Files:**
- `app/layout.tsx:10-13` — split `metadata` + `viewport` exports
- `.eslintrc.json` → delete
- `eslint.config.mjs` → create

**Implementation sketch:**
```tsx
// app/layout.tsx
export const metadata: Metadata = { title: "...", description: "..." }
export const viewport: Viewport = { width: "device-width", initialScale: 1 }
```
```js
// eslint.config.mjs
import next from "eslint-config-next"
export default [...next()]
```

**Verification:**
- `pnpm build` — no viewport deprecation warning
- `pnpm lint` — passes on flat config
- Perf harness — expect no movement (this is a config change)

**Expected impact:** None on perf. Unblocks later tooling.

---

## Step 2: ColorThemeProvider hydration fix ✅ DONE (commit a3e860a)

**Why now:** Real correctness bug — `components/color-theme-provider.tsx:31-33` reads `localStorage` in `useState` initializer, causing a server→client mismatch that `suppressHydrationWarning` on `<html>` is currently masking. Also `defaultTheme="violet"` in the provider destructure (line 27) disagrees with `defaultTheme="blue"` passed by `app/layout.tsx:29` — dead fallback or actual bug depending on which one you trust.

**Files:**
- `components/color-theme-provider.tsx` — remove `localStorage` read from `useState` initializer
- `app/layout.tsx` — inject pre-hydration script into `<head>` (preferred) OR make server component read cookie

**Implementation approaches (pick one):**
1. **Pre-hydration script (preferred)**: mirrors how `next-themes` handles dark mode. Inline `<script>` in `<head>` reads `localStorage` and sets the `theme-*` class on `<html>` synchronously *before* React hydrates. Zero flash, zero mismatch.
2. **Cookie-backed**: write theme to cookie on change; read via `await cookies()` in the RSC layout (Next 15+ async API) and set the class server-side.

**Verification:**
- Remove `suppressHydrationWarning` temporarily — no hydration warnings in dev console
- Switch themes, hard reload — no flash of wrong theme
- Perf harness — no movement expected

**Expected impact:** None on headless metrics. Eliminates real-user FOUC on first load.

---

## Step 3: Tailwind v4 full port ✅ DONE (commit d0aedc9)

**Why now:** Project is on `tailwindcss@4.2.2` but running through the v3-compat bridge via `@config "../tailwind.config.ts"` at `app/globals.css:2`. The bridge keeps the JS config alive and blocks v4's build-speed wins. `autoprefixer` and raw `postcss` devDeps are no longer needed — v4 uses Lightning CSS internally. `tailwindcss-animate` (v3-era JS plugin) has a CSS-first replacement, `tw-animate-css`.

**Files:**
- `app/globals.css` — convert to CSS-first `@theme` + `@custom-variant dark`
- `tailwind.config.ts` → delete
- `package.json` — remove `autoprefixer`, `postcss` from devDependencies
- `postcss.config.js` — verify only `@tailwindcss/postcss` plugin (already correct)
- Replace `@plugin "tailwindcss-animate"` with `@plugin "tw-animate-css"` and add as devDep

**Implementation template:**
```css
@import "tailwindcss";
@plugin "tw-animate-css";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* keep HSL var indirection so .theme-blue/green/rose/violet/orange overrides still work */
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  /* ... */

  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);

  --spacing-18: 4.5rem;
  --spacing-88: 22rem;
  --spacing-100: 25rem;

  --animate-accordion-down: accordion-down 0.2s ease-out;
  --animate-accordion-up:   accordion-up   0.2s ease-out;
}

@keyframes accordion-down { from { height: 0 } to { height: var(--radix-accordion-content-height) } }
@keyframes accordion-up   { from { height: var(--radix-accordion-content-height) } to { height: 0 } }
```

The `.theme-blue` / `.theme-green` etc. overrides in `globals.css:62-164` stay exactly as-is — they override the raw HSL CSS vars, not the Tailwind tokens.

**Verification:**
- Visual smoke test in all 5 color themes × light/dark (10 combinations)
- `pnpm build` succeeds
- Perf harness — **expect modest `cssBytes`/`jsBytes` reduction** (5–15 KB); faster build times

**Expected impact:** Small bundle reduction; 3–8× faster Tailwind builds. Primary win is maintainability and unlocking v4 features (`@theme inline`, `data-*` modifiers, container queries without plugin).

---

## Step 4: forwardRef → ref-as-prop across components/ui/ ✅ DONE (commit cf55c5d)

**Why now:** React 19 allows `ref` as a regular prop on function components, and `forwardRef` is documented as "will be deprecated in a future version." All 15 files in `components/ui/` use the old pattern (except `chart.tsx`, already ported in commit `ae8f18c`).

**Files (15):** `accordion.tsx`, `button.tsx`, `card.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `input.tsx`, `label.tsx`, `scroll-area.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`, `slider.tsx`, `table.tsx`, `tabs.tsx`, `tooltip.tsx`

**Port pattern (apply uniformly):**
```tsx
// Before
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => <button ref={ref} {...props} />
)
Button.displayName = "Button"

// After
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: React.Ref<HTMLButtonElement>
}
function Button({ className, ref, ...props }: ButtonProps) {
  return <button ref={ref} {...props} />
}
```

Drop `displayName` (React 19 synthesizes it from the function name). Can be done file-by-file or as one mechanical PR. Also migrate the 2 remaining `Context.Provider` usages found in the audit:
- `components/color-theme-provider.tsx:54` — `<ColorThemeProviderContext.Provider>` → `<ColorThemeProviderContext>`
- `components/ui/chart.tsx:60,75` — same rewrite

**Verification:**
- `pnpm test` — all existing tests pass
- `pnpm build` — type check passes
- Visual smoke test of forms, dialogs, dropdowns (ref-based focus management must still work)
- Perf harness — minor `jsBytes` reduction (a few KB)

**Expected impact:** ~2–5 KB bundle reduction, ~100 LOC deletion, one less pattern to remember when adding new UI components.

---

## Step 5: useDeferredValue replacing Monte Carlo debounce ✅ DONE (commit 2a602ec)

**Why now:** `app/calculator/page.tsx:49-113` debounces Monte Carlo via `setTimeout` + `useRef<NodeJS.Timeout>` + manual cleanup. React 19's `useDeferredValue` does this natively, prioritizes user input over background work, and keeps showing stale results during recompute instead of blanking the chart. This is a user-visible UX win *and* the step most likely to move the `longestTask` baseline.

**Files:**
- `app/calculator/page.tsx` — replace debounce logic with `useDeferredValue` + `useTransition`

**Implementation sketch:**
```tsx
const deferredInputs = useDeferredValue({
  accounts, personalInfo, retirementGoals, drawdownConfig, assumptions
})
const [isPending, startTransition] = useTransition()

useEffect(() => {
  if (deferredInputs.accounts.length === 0) { setSimulationResult(null); return }
  startTransition(() => {
    setSimulationResult(runMonteCarloSimulation(
      deferredInputs.accounts, deferredInputs.personalInfo,
      deferredInputs.retirementGoals, deferredInputs.drawdownConfig,
      { numberOfRuns: 1000 }, deferredInputs.assumptions,
    ))
  })
}, [deferredInputs])
```

Delete `simulationTimeoutRef`, delete `isSimulating` state (replace with `isPending`).

**Verification:**
- Type rapidly into any input (e.g., retirement age slider): chart should show stale result during recompute, not blank
- Perf harness `pnpm perf:compare:interactive` — **expect `longestTask` to shrink**, `tbt` to redistribute across more smaller tasks (same total work, better scheduling)
- Baseline `longestTask` is 314ms; target <150ms

**Expected impact:** Baseline `longestTask` 314ms → target <150ms. `tbt` may stay similar (same total work) but distribution improves. Keystroke responsiveness noticeably improves.

**Related work (not in scope here):** moving Monte Carlo to a Web Worker is the larger win — that eliminates the work from the main thread entirely rather than just scheduling it better. Owned by Phase 1.6 Phase 2. This step is the prerequisite that makes the Web Worker version not regress UX during the transition window.

---

## Step 6: Zustand useShallow for the big destructure ✅ DONE (commit 6e45ed3)

**Why now:** `app/calculator/page.tsx:37-47` destructures 9 values from `useCalculatorStore()`. Without shallow comparison, *any* store change re-runs the subscriber — which is the top-level calculator component and its entire subtree. Zustand 5 ships `useShallow` for exactly this case.

**Files:**
- `app/calculator/page.tsx:37-47` — wrap in `useShallow`
- `lib/store/calculator-store.ts:119-153` — `useAccountsSummary` recomputes `totalBalance`/`weightedReturn`/`weightedFees` on every subscriber render; wrap in `useShallow` or move to derived store state

**Implementation sketch:**
```tsx
import { useShallow } from "zustand/react/shallow"

const {
  accounts, personalInfo, retirementGoals, assumptions, drawdownConfig, displayMode,
  setAssumptions, setDisplayMode, resetToDefaults,
} = useCalculatorStore(
  useShallow((s) => ({
    accounts: s.accounts,
    personalInfo: s.personalInfo,
    retirementGoals: s.retirementGoals,
    assumptions: s.assumptions,
    drawdownConfig: s.drawdownConfig,
    displayMode: s.displayMode,
    setAssumptions: s.setAssumptions,
    setDisplayMode: s.setDisplayMode,
    resetToDefaults: s.resetToDefaults,
  }))
)
```

**Verification:**
- Temporary `console.log('render')` at top of `CalculatorPage` — toggling `displayMode` should trigger exactly 1 render, not a cascade
- Perf harness interactive — modest `tbt` reduction from fewer wasted renders
- `pnpm test` passes

**Expected impact:** ~5–10% `tbt` reduction in interactive baseline. Larger wins when combined with React Compiler enablement (deferred).

---

## Deferred from this phase — ✅ COMPLETED (2026-04-11)

All five deferred items resolved:

- **Remove vestigial `turbopack: {}` in `next.config.js`** ✅ — removed empty `turbopack: {}` block
- **`@types/node@25` → `@types/node@20`** ✅ — downgraded to `^20.0.0` to match devcontainer Node 20 LTS; `pnpm install` resolved to `20.19.39`
- **Zod 3 → 4 API migration** ✅ — already fully on Zod 4.3.6 classic mode; grep confirmed no deprecated patterns (`.errors`, `.strict()`, `.loose()`, `z.email()`) present
- **React Compiler verification + manual memoization cleanup** ✅ — installed `babel-plugin-react-compiler@1.0.0` (kept as peer dep); enabled `reactCompiler: true`, measured, then **reverted**: the compiler injects `useMemoCache` scaffolding into every client component adding +23KB (+5.7%) to the JS bundle and +287ms TBT (+54%) vs the Phase 1.7 production baseline. Cold-load cost outweighs the re-render benefit here because all expensive computations are already guarded by explicit `useMemo`. Re-evaluate after Web Workers offload Monte Carlo off the main thread (Phase 1.6 Phase 2), at which point TBT headroom will be available. Memoization audit: 5 `useMemo` calls found — all kept (Monte Carlo ×1000, projection engine, optimal contribution + scenario analysis, projection breakdown loop, chart tooltip).
- **RSC split of `calculator/page.tsx`** ✅ — split into server shell (`page.tsx`, 14 lines) + client island (`calculator-client.tsx`, 413 lines `"use client"`); server shell documents the Supabase data-fetch hook point for Phase 2; no perf regression, build clean

---

## Status

**Documentation:** See `docs/history/2026-04-11-dependency-upgrade-to-latest.md` for the full audit findings, step ordering rationale, and production perf comparison tables.

**Status:** ✅ Complete (2026-04-11). All 6 steps landed. Production perf result vs baseline: interactive TBT **597ms → 533ms (-10.7%)**, longTaskMs **847ms → 783ms (-7.6%)**. No regression on empty-scenario metrics. See `perf/after-prod-interactive.json` for full numbers.
