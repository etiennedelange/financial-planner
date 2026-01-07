# Theming System

This document explains the complete theming architecture for the SA Retirement Calculator, including how color themes and dark mode work together with Tailwind CSS.

## Architecture Overview

The theming system consists of **four interconnected layers**:

1. **CSS Custom Properties** (`app/globals.css`) - Design tokens
2. **Tailwind Configuration** (`tailwind.config.ts`) - Maps tokens to utility classes
3. **React Context Providers** - Manage theme state
4. **UI Components** - Consume themes via Tailwind classes

## Layer 1: CSS Custom Properties (Design Tokens)

### Base Tokens (`app/globals.css`)

```css
:root {
  --primary: 221.2 83.2% 53.3%;
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  /* ... more tokens */
}
```

**Why HSL values without `hsl()`?**
- Values are stored as `H S% L%` triplets (e.g., `221.2 83.2% 53.3%`)
- Wrapped in `hsl()` function when used: `hsl(var(--primary))`
- This allows Tailwind to manipulate opacity: `hsl(var(--primary) / 0.5)`

### Color Theme Classes

Each theme overrides specific tokens:

```css
.theme-blue {
  --primary: 221.2 83.2% 53.3%;
  --ring: 221.2 83.2% 53.3%;
  --chart-1: 221.2 83.2% 53.3%;
}

.theme-green {
  --primary: 142 76% 36%;
  --ring: 142 76% 36%;
  --chart-1: 142 76% 36%;
}
```

### Dark Mode Variants

Each theme has a dark mode variant:

```css
.theme-blue.dark {
  --primary: 217.2 91.2% 59.8%;
  --ring: 224.3 76.3% 48%;
  --chart-1: 217.2 91.2% 59.8%;
}
```

**CSS Specificity:** `.theme-green.dark` is more specific than `.dark`, so theme colors override base dark mode colors.

## Layer 2: Tailwind Configuration

### Color Mapping (`tailwind.config.ts`)

Tailwind maps CSS variables to utility classes:

```typescript
colors: {
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))'
  },
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  // ...
}
```

**How it works:**

| Tailwind Class | CSS Output | Final Value (Blue Light) |
|----------------|------------|--------------------------|
| `bg-primary` | `background-color: hsl(var(--primary))` | `hsl(221.2 83.2% 53.3%)` |
| `text-primary` | `color: hsl(var(--primary))` | `hsl(221.2 83.2% 53.3%)` |
| `border-primary` | `border-color: hsl(var(--primary))` | `hsl(221.2 83.2% 53.3%)` |

**Opacity Support:**

```tsx
<div className="bg-primary/50"> {/* 50% opacity */}
```

Compiles to:
```css
background-color: hsl(var(--primary) / 0.5);
```

### Dark Mode Configuration

```typescript
darkMode: ["class"]
```

- Uses `.dark` class strategy (not `@media (prefers-color-scheme)`)
- Applied to `<html>` element by `next-themes`
- Enables `dark:` prefix: `dark:bg-background`

## Layer 3: React Context Providers

### Light/Dark Mode Provider

**File:** `components/theme-provider.tsx`

```tsx
<ThemeProvider attribute="class" defaultTheme="system">
  {children}
</ThemeProvider>
```

- Uses `next-themes` library
- Adds/removes `.dark` class on `<html>`
- Persists to localStorage as `theme: "light" | "dark" | "system"`

### Color Theme Provider

**File:** `components/color-theme-provider.tsx`

```tsx
<ColorThemeProvider defaultTheme="blue" storageKey="color-theme">
  {children}
</ColorThemeProvider>
```

**State Management:**

```typescript
const [colorTheme, setColorThemeState] = useState<ColorTheme>(
  () => localStorage.getItem('color-theme') || 'blue'
)

useEffect(() => {
  const root = document.documentElement
  root.classList.remove('theme-blue', 'theme-green', /* ... */)
  root.classList.add(`theme-${colorTheme}`)
}, [colorTheme])
```

**What happens when theme changes:**
1. User selects "Green" theme
2. `setColorTheme("green")` called
3. `useEffect` removes old theme class
4. Adds `theme-green` to `<html>`
5. CSS cascade updates all `--primary` references
6. Tailwind classes re-evaluate: `bg-primary` → new green color

## Layer 4: Component Usage

### Using Theme Colors in Components

```tsx
import { Button } from "@/components/ui/button"

export function MyComponent() {
  return (
    <Button>Click Me</Button> // Uses bg-primary internally
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

Charts use the same system via `--chart-1` through `--chart-5`:

```tsx
const chartConfig = {
  balance: {
    label: "Portfolio Balance",
    color: "hsl(var(--chart-1))", // Updates with theme
  },
}
```

## Complete Flow Example

**Scenario:** User switches to Green theme in Dark mode

### 1. Initial State
```html
<html class="dark theme-blue">
```

### 2. User Action
```tsx
<ColorThemeToggle />
// User clicks "Green"
setColorTheme("green")
```

### 3. DOM Update
```html
<html class="dark theme-green">
```

### 4. CSS Cascade
```css
/* Before */
.theme-blue.dark {
  --primary: 217.2 91.2% 59.8%; /* Blue */
}

/* After */
.theme-green.dark {
  --primary: 142 71% 45%; /* Green */
}
```

### 5. Tailwind Classes Update
```tsx
// Component code doesn't change
<Button className="bg-primary">Save</Button>

// CSS output updates automatically:
// background-color: hsl(var(--primary))
// → hsl(142 71% 45%) ✓ Green!
```

### 6. Persistence
```javascript
localStorage.setItem('color-theme', 'green')
localStorage.setItem('theme', 'dark') // Separate key!
```

## Theme Independence

Color theme and dark mode are **completely independent**:

| Color Theme | Dark Mode | Result |
|-------------|-----------|--------|
| Blue | Light | Blue colors on white background |
| Blue | Dark | Blue colors on dark background |
| Green | Light | Green colors on white background |
| Green | Dark | Green colors on dark background |

**HTML classes combine:**
- `theme-green` → overrides `--primary`
- `dark` → overrides `--background`, `--foreground`, etc.
- `theme-green.dark` → overrides both for optimal contrast

## Adding New Themes

### 1. Add CSS Variables (`app/globals.css`)

```css
/* Light mode */
.theme-cyan {
  --primary: 188 94% 43%;
  --ring: 188 94% 43%;
  --chart-1: 188 94% 43%;
}

/* Dark mode */
.theme-cyan.dark {
  --primary: 188 86% 53%;
  --ring: 188 86% 53%;
  --chart-1: 188 86% 53%;
}
```

### 2. Update Type (`components/color-theme-provider.tsx`)

```typescript
type ColorTheme = "blue" | "green" | "rose" | "violet" | "orange" | "cyan"
```

### 3. Add to Toggle (`components/color-theme-toggle.tsx`)

```typescript
const themes = [
  // ...existing themes
  { name: "Cyan", value: "cyan", color: "bg-cyan-500" },
]
```

That's it! No component changes needed.

## Design Tokens Reference

### Core Tokens (Always Required)

| Token | Purpose | Example |
|-------|---------|---------|
| `--background` | Page background | White / Dark blue |
| `--foreground` | Primary text | Black / White |
| `--primary` | Accent color | Blue / Green / Rose |
| `--primary-foreground` | Text on primary | White |
| `--border` | Border color | Gray |
| `--ring` | Focus ring | Matches primary |

### Semantic Tokens

| Token | Purpose | Use Case |
|-------|---------|----------|
| `--card` | Card background | Slightly different from page |
| `--muted` | Muted background | Disabled states |
| `--destructive` | Danger/error | Delete buttons |
| `--accent` | Secondary accent | Hover states |

### Chart Tokens

| Token | Purpose | Theme Override |
|-------|---------|----------------|
| `--chart-1` | Primary chart color | ✅ Changes with theme |
| `--chart-2` | Secondary green | ❌ Stays consistent |
| `--chart-3` | Tertiary green | ❌ Stays consistent |
| `--chart-4` | Yellow | ❌ Stays consistent |
| `--chart-5` | Orange | ❌ Stays consistent |

## Best Practices

### ✅ Do

- Use Tailwind classes: `bg-primary`, `text-foreground`
- Let CSS variables cascade naturally
- Test all themes in both light and dark mode
- Use semantic tokens (`primary`, `destructive`) over colors (`blue-500`)

### ❌ Don't

- Hardcode colors: `bg-blue-500` (bypasses theming)
- Inline styles with colors: `style={{ color: '#3b82f6' }}`
- Create theme-specific components (use tokens instead)
- Override `--primary` in component CSS (defeats theming)

## Debugging Themes

### Check Active Theme

```javascript
// Browser console
document.documentElement.className
// → "dark theme-green"
```

### Inspect CSS Variables

```javascript
// Get computed value of --primary
getComputedStyle(document.documentElement)
  .getPropertyValue('--primary')
// → "142 71% 45%"
```

### View Applied Colors

```javascript
// Get final computed color
getComputedStyle(element).backgroundColor
// → "hsl(142, 71%, 45%)"
```

## Performance Considerations

- **CSS Variables are fast**: Browser-native, no JavaScript needed for repaints
- **Class switching is instant**: Changing `<html>` class re-triggers CSS cascade
- **No re-renders**: Components don't re-render when theme changes (CSS only)
- **Storage is async**: localStorage writes don't block rendering

## Browser Support

- CSS Custom Properties: All modern browsers (IE11 not supported)
- `hsl()` function: All browsers
- CSS class cascade: Universal support

This architecture provides a scalable, performant, and maintainable theming system that separates concerns and leverages CSS cascade effectively.
