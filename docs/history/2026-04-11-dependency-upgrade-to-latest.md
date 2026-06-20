# Dependency Upgrade to Latest Versions

**Date:** 2026-04-11
**Author:** Claude
**Files Changed:**
- `package.json`
- `postcss.config.js`
- `next.config.js`
- `tailwind.config.ts`
- `app/globals.css`
- `components/ui/chart.tsx`

## Summary

Upgraded all dependencies to their latest versions as of April 2026. This included several major version bumps requiring breaking-change fixes across the build system, CSS pipeline, and chart component types.

---

## Package Changes

| Package | Before | After | Type |
|---|---|---|---|
| `next` | 14.2.5 | 16.2.3 | major |
| `react` / `react-dom` | 18.3.1 | 19.2.5 | major |
| `eslint` | 8.57.1 | 10.2.0 | major |
| `eslint-config-next` | 14.2.5 | 16.2.3 | major |
| `tailwindcss` | 3.4.19 | 4.2.2 | major |
| `typescript` | 5.9.3 | 6.0.2 | major |
| `recharts` | 2.15.4 | 3.8.1 | major |
| `lucide-react` | 0.562.0 | 1.8.0 | major |
| `@vercel/analytics` | 1.6.1 | 2.0.1 | major |
| `@types/node` | 20.19.39 | 25.6.0 | major |
| `@types/react` / `@types/react-dom` | 18.x | 19.x | major |
| `@tailwindcss/postcss` | _(new)_ | 4.2.2 | added |

Packages with no breaking changes (`zod`, `zustand`, `react-hook-form`, `@hookform/resolvers`, `next-themes`, `tailwind-merge`, `clsx`, `class-variance-authority`, `vitest`, `@vitest/*`, `radix-ui/*`, `@playwright/test`, `postcss`, `autoprefixer`, `happy-dom`) were already at latest or had no version bump.

---

## Breaking Change 1: Next.js 16 — Turbopack Default

### Problem
Next.js 16 enables Turbopack as the default bundler for production builds. The existing `next.config.js` had a `webpack` customisation block (setting `resolve.fallback` for `fs`, `net`, `tls`). Next.js 16 treats a `webpack` config alongside no `turbopack` config as a hard error to force explicit migration.

```
ERROR: This build is using Turbopack, with a `webpack` config and no `turbopack` config.
```

### Fix
Removed the `webpack` callback and replaced it with an empty `turbopack: {}` declaration. The `resolve.fallback` entries (`fs: false`, `net: false`, `tls: false`) are unnecessary under Turbopack — it handles Node.js built-in exclusions from client bundles automatically.

```js
// Before
webpack: (config, { isServer }) => {
  if (!isServer) {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false }
  }
  return config
},

// After
turbopack: {},
```

### What Next.js 15/16 also introduced
- Async `cookies()`, `headers()`, `params`, `searchParams` in server components (not used in this app, so no changes needed)
- `fetch` requests are no longer cached by default (opt-in caching)
- React 19 as minimum peer dependency

---

## Breaking Change 2: Tailwind CSS 4 — CSS-First Architecture

### Problem
Tailwind 4 rearchitected its pipeline. The old `tailwindcss` PostCSS plugin no longer exists; it was split into a separate `@tailwindcss/postcss` package. The `@tailwind base/components/utilities` directives in CSS were replaced with a single `@import "tailwindcss"`. Plugins registered via `require()` in `tailwind.config.ts` must now be declared with `@plugin` in CSS instead.

### Changes

**`postcss.config.js`** — switched to the new PostCSS package:
```js
// Before
plugins: { tailwindcss: {}, autoprefixer: {} }

// After
plugins: { '@tailwindcss/postcss': {} }
```
Note: `autoprefixer` was removed — Tailwind 4's Oxide engine handles vendor prefixing internally.

**`app/globals.css`** — replaced directives and moved `tailwindcss-animate` plugin:
```css
/* Before */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* After */
@import "tailwindcss";
@config "../tailwind.config.ts";
@plugin "tailwindcss-animate";
```

The `@config` directive loads the existing `tailwind.config.ts` (theme extensions, custom spacing, keyframes) without requiring a full rewrite of the config file.

**`tailwind.config.ts`** — removed the plugin entry now declared in CSS, and fixed `darkMode` type:
```ts
// Before
darkMode: ["class"],
plugins: [require("tailwindcss-animate")],

// After
darkMode: ["class", ".dark"],
plugins: [],
```

The `darkMode` array now requires an explicit selector as the second element (`.dark`). This makes the dark mode selector precise and composable — you could swap it for `[data-theme=dark]` if needed.

### What Tailwind 4 also introduced
- Rust-based Oxide engine: incremental CSS builds are 3–5× faster than v3
- CSS-first configuration via `@theme` blocks (not used here — existing `tailwind.config.ts` is preserved via `@config`)
- `@tailwindcss/postcss` as a standalone package decoupled from the CLI and Vite plugin release cycles

---

## Breaking Change 3: recharts 3 — Context-Provided Tooltip/Legend Props

### Problem
recharts 3 rewrote chart state management using a Redux store per chart instance. As a result, `payload`, `active`, `label`, and `coordinate` on `<Tooltip>` and `payload`, `verticalAlign` on `<Legend>` are now read from that internal store rather than accepted as user props. The TypeScript types reflect this via a `PropertiesReadFromContext` exclusion:

```ts
type PropertiesReadFromContext = 'viewBox' | 'active' | 'payload' | 'coordinate' | 'label' | 'accessibilityLayer'
export type TooltipProps = Omit<DefaultTooltipContentProps, PropertiesReadFromContext> & { ... }
```

`React.ComponentProps<typeof Tooltip>` (used in `ChartTooltipContent`) therefore no longer included `payload`, causing a type error at line 124 of `chart.tsx`.

A second error came from TypeScript 6's stricter `ReadonlyArray` enforcement: recharts 3's `ValueType` uses `ReadonlyArray<number | string>` and `DataKey<any>` can be a function — neither is assignable to React's `Key` type.

### Fix — `components/ui/chart.tsx`

**Imports** — added recharts internal types directly:
```ts
import type { TooltipProps } from "recharts"
import type { Payload, ValueType, NameType } from "recharts/types/component/DefaultTooltipContent"
import type { LegendPayload, VerticalAlignmentType } from "recharts/types/component/DefaultLegendContent"
```

**`ChartTooltipContent`** — replaced `React.ComponentProps<typeof Tooltip>` with a manually composed type that explicitly re-declares the context-provided props:
```ts
type ChartTooltipContentProps = TooltipProps<ValueType, NameType> &
  React.ComponentProps<"div"> & {
    active?: boolean
    payload?: Payload<ValueType, NameType>[]
    label?: string | number
    hideLabel?: boolean
    // ... other custom props
  }
```

**`ChartLegendContent`** — replaced `Pick<LegendProps, "payload" | "verticalAlign">` with explicit types:
```ts
{
  payload?: LegendPayload[]
  verticalAlign?: VerticalAlignmentType
  // ...
}
```

**`key` prop** — `item.dataKey` is now `DataKey<any>` (which can be a function); cast to `String(item.dataKey)` for use as a React list key.

### What recharts 3 also introduced
- New hooks: `useActiveTooltipDataPoints`, `useActiveTooltipLabel`, `useIsTooltipActive` — escape hatches for reading tooltip state outside the chart tree
- Better composability: chart state shared between charts via a parent store is now possible
- More precise types distinguishing user-configurable props from internally-managed state

---

## Other Notable Upgrades

### React 19
- React Compiler support (opt-in; not enabled in this project yet)
- `use()` hook for reading promises in render
- `ref` as a regular prop — `forwardRef` is now a legacy pattern (existing uses still work)
- `useFormStatus`, `useOptimistic` promoted to stable
- Improved hydration error messages

### TypeScript 6
- Stricter `ReadonlyArray` vs mutable array distinction (surfaced the recharts type issues)
- Stricter generic inference
- `--isolatedDeclarations` mode for parallel type-checking in monorepos
- Faster type-checking via a rewritten instantiation cache

### ESLint 10
- Flat config (`eslint.config.js`) is now the only supported format; `.eslintrc.*` files are fully removed
- This project had no ESLint config file, so `eslint-config-next` 16.x handles the flat config internally — no migration needed
- Peer dependency warnings from `eslint-plugin-import`, `eslint-plugin-react`, etc. are cosmetic — those plugins work with ESLint 10 but haven't yet updated their `peerDependencies` metadata

### lucide-react 1.0
- Stable API — 1.x commits to no breaking renames going forward
- React 19 `ref`-as-prop support
- Smaller per-icon bundle

### @vercel/analytics 2.0
- React 19 compatibility
- No API changes — `<Analytics />` usage in `layout.tsx` is unchanged
