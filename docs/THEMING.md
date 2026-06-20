# Theming System

This document explains the theming architecture for the SA Retirement Calculator: a single locked **gold accent** combined with a **light/dark mode** toggle, built on Tailwind CSS v4.

## Architecture Overview

The theming system consists of **two interconnected layers**:

1. **CSS Custom Properties** (`app/globals.css`) — design tokens, including the `@theme inline` block that replaces `tailwind.config.ts`
2. **`next-themes` Provider** (`components/theme-provider.tsx`) — manages light/dark mode state

> Tailwind v4 has no `tailwind.config.ts` in this project — token-to-utility mapping lives directly in `app/globals.css` via the `@theme inline` directive.

## Design Decision: Gold-Only Accent

The app previously supported six switchable color themes (gold/blue/green/rose/violet/orange) via a `ColorThemeProvider`. That was retired in favor of a single locked gold accent for design consistency — see the accounts page as the design benchmark. As a result:

- `:root` and `.dark` define the gold accent directly — there is no theme-switching class on `<html>`.
- `ColorThemeProvider`, `useColorTheme`, and `ColorThemeToggle` (`components/color-theme-provider.tsx`, `components/color-theme-toggle.tsx`) still exist in the repo but are **not used anywhere** — `ColorThemeProvider` is not mounted in `app/layout.tsx`. Treat them as dead code; don't build on them without first re-wiring and re-testing the whole multi-theme path.
- The `.theme-gold` class block in `app/globals.css` is also inert (its values just restate `:root`) since no component ever applies a `theme-*` class to `<html>`.

If color-theme switching is reintroduced in the future, either finish wiring `ColorThemeProvider` back into `app/layout.tsx` and add CSS overrides for each theme, or delete the dead files to avoid confusion.

## Layer 1: CSS Custom Properties (Design Tokens)

### Base Tokens (`app/globals.css`)

```css
:root {
  --background: 210 25% 98%;
  --foreground: 222 40% 10%;
  --primary: 43 85% 45%;      /* Gold */
  --ring: 43 85% 45%;
  --border: 214 20% 88%;
  /* ... more tokens */
}
```

**Why HSL values without `hsl()`?**
- Values are stored as `H S% L%` triplets (e.g., `43 85% 45%`)
- Wrapped in `hsl()` function when used: `hsl(var(--primary))`
- This allows Tailwind to manipulate opacity: `hsl(var(--primary) / 0.5)`

### Dark Mode Override

`.dark` overrides the same token set with a deep-navy + gold palette:

```css
.dark {
  --background: 222 47% 5%;
  --foreground: 210 20% 92%;
  --primary: 43 90% 52%;      /* Slightly brighter gold for contrast */
  --ring: 43 90% 52%;
  --border: 222 25% 18%;
  /* ... */
}
```

`--primary` itself doesn't change hue between light and dark (it's gold in both) — only lightness shifts slightly for contrast on the dark background.

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
| `bg-primary` | `background-color: hsl(var(--primary))` | `hsl(43 85% 45%)` (gold) |
| `text-primary` | `color: hsl(var(--primary))` | `hsl(43 85% 45%)` |
| `border-primary` | `border-color: hsl(var(--primary))` | `hsl(43 85% 45%)` |

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

## Layer 3: React Context Provider (Light/Dark Only)

**File:** `components/theme-provider.tsx`

```tsx
<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
  {children}
</ThemeProvider>
```

- Thin wrapper around `next-themes`
- Mounted in `app/layout.tsx`, wraps the whole app
- Adds/removes `.dark` class on `<html>`
- Persists to localStorage as `theme: "light" | "dark" | "system"`

### Toggle UI

**File:** `components/theme-toggle.tsx` — a single button that cycles `light ↔ dark` via `useTheme()` from `next-themes`. There is no color-accent toggle in the UI (the gold accent is fixed).

## Layer 4: Component Usage

### Using Theme Colors in Components

```tsx
import { Button } from "@/components/ui/button"

export function MyComponent() {
  return (
    <Button>Click Me</Button> // Uses bg-primary internally → gold
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

Charts use the same system via `--chart-1` through `--chart-5`. Only `--chart-1` aliases `--primary` (gold); `--chart-2..5` are fixed accent colors (teal, light gold, blue, red) that stay consistent regardless of mode:

```tsx
const chartConfig = {
  balance: {
    label: "Portfolio Balance",
    color: "hsl(var(--chart-1))", // Gold, matches --primary
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
--primary: 43 85% 45%;
--background: 210 25% 98%;

/* After (.dark) */
--primary: 43 90% 52%;
--background: 222 47% 5%;
```

### 5. Tailwind Classes Update
```tsx
// Component code doesn't change
<Button className="bg-primary">Save</Button>

// CSS output updates automatically:
// background-color: hsl(var(--primary))
// → hsl(43 90% 52%) — slightly brighter gold on dark background
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
| `--primary` | Accent (gold, locked) | `43 85% 45%` | `43 90% 52%` |
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
| `--accent` | Hover/highlight background | Hover states |
| `--destructive` | Danger/error | Delete buttons |
| `--warning` | Caution | Warning banners/badges |

### Chart Tokens

| Token | Purpose | Changes with mode? |
|-------|---------|---------------------|
| `--chart-1` | Primary chart color (aliases gold) | ✅ Lightness shifts |
| `--chart-2` | Teal accent | ✅ Lightness shifts |
| `--chart-3` | Light gold | ✅ Lightness shifts |
| `--chart-4` | Blue accent | ✅ Lightness shifts |
| `--chart-5` | Red accent | ✅ Lightness shifts |

## Best Practices

### ✅ Do

- Use Tailwind classes: `bg-primary`, `text-foreground`
- Let CSS variables cascade naturally
- Test every change in both light and dark mode
- Use semantic tokens (`primary`, `destructive`) over raw colors (`amber-500`)

### ❌ Don't

- Hardcode colors: `bg-amber-500` (bypasses theming)
- Inline styles with colors: `style={{ color: '#d4a017' }}`
- Re-introduce per-component color theming (the accent is intentionally locked to gold)
- Override `--primary` outside `app/globals.css` (defeats the design system)
- Build on `ColorThemeProvider`/`ColorThemeToggle` without first confirming you intend to re-enable multi-theme support — they're currently dead code

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
// → "43 90% 52%"
```

### View Applied Colors

```javascript
// Get final computed color
getComputedStyle(element).backgroundColor
// → "hsl(43, 90%, 52%)"
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
