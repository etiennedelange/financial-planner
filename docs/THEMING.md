# Theming System

This document explains the theming architecture for the SA Retirement Calculator: a single locked **teal accent** combined with a **light/dark mode** toggle, built on Tailwind CSS v4.

## Architecture Overview

The theming system consists of **two layers**:

1. **CSS Custom Properties** (`app/globals.css`) — design tokens, including the `@theme inline` block that replaces `tailwind.config.ts`
2. **`next-themes` Provider** (`components/theme-provider.tsx`) — manages light/dark mode state

> Tailwind v4 has no `tailwind.config.ts` in this project — token-to-utility mapping lives directly in `app/globals.css` via the `@theme inline` directive.

## Design Decision: One Locked Accent

The app has **exactly one accent color** — teal — across light and dark mode. There is no user-facing color-theme switcher (an earlier gold/teal-yellow dual-theme experiment was retired in favor of this single locked accent, matching the "Precision Instrument" philosophy: authority through restraint, not choice paralysis).

- `:root` and `.dark` define backgrounds, foregrounds, and the teal accent tokens directly — no theme-name classes on `<html>`
- `ThemeToggle` only cycles Light ↔ Dark (`next-themes`); it does not touch color
- `next-themes` already ships its own pre-hydration script, so there is no flash-of-wrong-theme on reload

## Layer 1: CSS Custom Properties (Design Tokens)

### Base Tokens (`app/globals.css`)

```css
:root {
  --background: 210 25% 98%;
  --foreground: 222 40% 10%;
  --primary: 162 70% 34%;      /* Teal */
  --ring: 162 70% 34%;
  --border: 214 20% 88%;
  /* ... more tokens */
}
```

**Why HSL values without `hsl()`?**
- Values are stored as `H S% L%` triplets (e.g., `162 70% 34%`)
- Wrapped in `hsl()` function when used: `hsl(var(--primary))`
- This allows Tailwind to manipulate opacity: `hsl(var(--primary) / 0.5)`

### Dark Mode Override

`.dark` overrides the same token set with a deep-navy + brighter-teal palette:

```css
.dark {
  --background: 222 47% 5%;
  --foreground: 210 20% 92%;
  --primary: 162 70% 55%;      /* Brighter teal for contrast on dark bg */
  --ring: 162 70% 55%;
  --border: 222 25% 18%;
  /* ... */
}
```

`--primary` keeps the same hue (162°) between light and dark — only lightness/saturation shift for contrast on the darker background.

## Layer 2: Tailwind v4 Token Mapping

### `@theme inline` (`app/globals.css`)

Tailwind v4 maps CSS variables to utility classes directly in CSS, no `tailwind.config.ts` needed:

```css
@theme inline {
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-warning: hsl(var(--warning));
  --color-chart-1: hsl(var(--chart-1));
  /* ...border, card, popover, secondary, muted, accent, destructive, chart-2..5 */

  --font-sans: var(--font-ibm-sans), system-ui, sans-serif;
  --font-mono: var(--font-ibm-mono), ui-monospace, monospace;
  --radius-lg: var(--radius);
}
```

**How it works:**

| Tailwind Class | CSS Output | Final Value (Light) |
|----------------|------------|----------------------|
| `bg-primary` | `background-color: hsl(var(--primary))` | `hsl(162 70% 34%)` (teal) |
| `text-primary` | `color: hsl(var(--primary))` | `hsl(162 70% 34%)` |
| `border-primary` | `border-color: hsl(var(--primary))` | `hsl(162 70% 34%)` |

**Opacity Support:**

```tsx
<div className="bg-primary/50"> {/* 50% opacity */}
```

Compiles to:
```css
background-color: hsl(var(--primary) / 0.5);
```

### Dark Mode Strategy

```css
@custom-variant dark (&:is(.dark, .dark *));
```

- Tailwind v4 custom variant, equivalent to the old `darkMode: ["class"]` config
- `.dark` class is applied to `<html>` by `next-themes`
- Enables the `dark:` prefix: `dark:bg-background`

## Layer 3: React Context Provider

### Light/Dark Mode Provider

**File:** `components/theme-provider.tsx`

```tsx
<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
  {children}
</ThemeProvider>
```

- Thin wrapper around `next-themes`
- Adds/removes `.dark` class on `<html>`
- Persists to localStorage as `theme: "light" | "dark" | "system"`
- Handles its own pre-hydration script — no custom `<script>` needed in `app/layout.tsx`

### Toggle UI

**File:** `components/theme-toggle.tsx` — a single button that flips between Light (Sun icon) and Dark (Moon icon).

## Layer 4: Component Usage

### Using Theme Colors in Components

```tsx
import { Button } from "@/components/ui/button"

export function MyComponent() {
  return (
    <Button>Click Me</Button> // Uses bg-primary internally → teal
  )
}
```

**Button internals:**
```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  {children}
</button>
```

### Chart Theming

Charts use the same system via `--chart-1` through `--chart-5`. `--chart-1` aliases `--primary` (teal); `--chart-2` and `--chart-3` are drawn from the same palette family (a deeper blue-teal and a lighter mint) so the chart reads as a cohesive extension of the accent; `--chart-4` (blue) and `--chart-5` (red) stay fixed, unrelated hues reserved for projection bands and negative/error values respectively:

```tsx
const chartConfig = {
  balance: {
    label: "Portfolio Balance",
    color: "hsl(var(--chart-1))", // Teal, matches --primary
  },
}
```

## Complete Flow Example

**Scenario:** User toggles from Light to Dark mode

### 1. Initial State
```html
<html class="">
```

### 2. User Action
```tsx
<ThemeToggle />
// User clicks the icon
setTheme("dark")
```

### 3. DOM Update
```html
<html class="dark">
```

### 4. CSS Cascade
```css
/* Before (:root) */
--primary: 162 70% 34%;
--background: 210 25% 98%;

/* After (.dark) */
--primary: 162 70% 55%;
--background: 222 47% 5%;
```

### 5. Tailwind Classes Update
```tsx
// Component code doesn't change
<Button className="bg-primary">Save</Button>

// CSS output updates automatically:
// background-color: hsl(var(--primary))
// → hsl(162 70% 55%) — brighter teal on dark background
```

### 6. Persistence
```javascript
localStorage.setItem('theme', 'dark') // next-themes storage key
```

## Design Tokens Reference

### Core Tokens

| Token | Purpose | Light | Dark |
|-------|---------|-------|------|
| `--background` | Page background | Near-white | Deep navy |
| `--foreground` | Primary text | Near-black | Near-white |
| `--primary` | Accent (teal, locked) | `162 70% 34%` | `162 70% 55%` |
| `--primary-foreground` | Text on primary | White | Deep navy |
| `--border` | Border color | Light gray | Dark navy-gray |
| `--ring` | Focus ring | Matches primary | Matches primary |

### Semantic Tokens

| Token | Purpose | Use Case |
|-------|---------|----------|
| `--card` | Card background | Slightly different from page background |
| `--popover` | Popover/dropdown background | Menus, tooltips |
| `--secondary` | Secondary surfaces | Subdued backgrounds |
| `--muted` | Muted background | Disabled states |
| `--accent` | Hover/highlight background | Hover states (neutral — not a second brand color) |
| `--destructive` | Danger/error | Delete buttons |
| `--warning` | Caution | Warning banners/badges |

### Chart Tokens

| Token | Purpose | Changes with mode? |
|-------|---------|---------------------|
| `--chart-1` | Primary chart color (aliases teal) | ✅ Lightness shifts |
| `--chart-2` | Deep teal-blue accent | ✅ Lightness shifts |
| `--chart-3` | Mint accent | ✅ Lightness shifts |
| `--chart-4` | Blue accent | ✅ Lightness shifts |
| `--chart-5` | Red accent | ✅ Lightness shifts |

## Best Practices

### ✅ Do

- Use Tailwind classes: `bg-primary`, `text-foreground`
- Let CSS variables cascade naturally
- Test every change in both light/dark mode
- Use semantic tokens (`primary`, `destructive`) over raw colors (`amber-500`)

### ❌ Don't

- Hardcode colors: `bg-emerald-500` (bypasses theming)
- Inline styles with colors: `style={{ color: '#1a936f' }}`
- Override `--primary` or `--accent` outside `app/globals.css` (defeats the design system)
- Reintroduce a color-theme switcher — this system is intentionally single-accent
- Add new theme tokens without updating `app/globals.css` CSS blocks for both light and dark

## Debugging Themes

### Check Active Mode

```javascript
// Browser console
document.documentElement.className
// → "dark" (or "" for light)
```

### Inspect CSS Variables

```javascript
// Get computed value of --primary
getComputedStyle(document.documentElement)
  .getPropertyValue('--primary')
// → "162 70% 55%"
```

### View Applied Colors

```javascript
// Get final computed color
getComputedStyle(element).backgroundColor
// → "hsl(162, 70%, 55%)"
```

## Performance Considerations

- **CSS Variables are fast**: Browser-native, no JavaScript needed for repaints
- **Class switching is instant**: Changing `<html>` class re-triggers CSS cascade
- **No re-renders**: Components don't re-render when mode changes (CSS only)
- **Storage is async**: localStorage writes don't block rendering

## Browser Support

- CSS Custom Properties: All modern browsers (IE11 not supported)
- `hsl()` function: All browsers
- CSS class cascade: Universal support
