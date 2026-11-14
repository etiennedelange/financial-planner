/**
 * WCAG 2.x contrast helpers for the HSL design tokens in `app/globals.css`.
 *
 * Tokens are stored as bare `H S% L%` triplets (see docs/THEMING.md), so the
 * helpers take those triplets directly and work out the rendered colours.
 */

export type Rgb = readonly [number, number, number]

/** Parse an `H S% L%` triplet (as stored in globals.css) into 0–1 sRGB channels. */
export function hslTripletToRgb(triplet: string): Rgb {
  const parts = triplet.trim().split(/\s+/)
  if (parts.length !== 3) throw new Error(`Not an HSL triplet: "${triplet}"`)
  const h = Number.parseFloat(parts[0])
  const s = Number.parseFloat(parts[1]) / 100
  const l = Number.parseFloat(parts[2]) / 100
  if ([h, s, l].some((n) => Number.isNaN(n))) throw new Error(`Not an HSL triplet: "${triplet}"`)

  const a = s * Math.min(l, 1 - l)
  const channel = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [channel(0), channel(8), channel(4)]
}

/** WCAG relative luminance of an sRGB colour (0–1 channels). */
export function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG contrast ratio between two colours, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * The colour produced by painting `top` at `alpha` over `bottom`, which is how
 * Tailwind's `bg-x/10` and similar opacity utilities render.
 */
export function blend(top: Rgb, bottom: Rgb, alpha: number): Rgb {
  return [
    top[0] * alpha + bottom[0] * (1 - alpha),
    top[1] * alpha + bottom[1] * (1 - alpha),
    top[2] * alpha + bottom[2] * (1 - alpha),
  ]
}

/**
 * Pull `--token: value;` declarations out of the first `selector { … }` block in a
 * stylesheet. Values are returned as raw strings (e.g. "38 90% 30%").
 */
export function parseTokenBlock(css: string, selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const block = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)
  if (!block) throw new Error(`Selector "${selector}" not found`)

  const tokens: Record<string, string> = {}
  for (const decl of block[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[decl[1]] = decl[2].trim()
  }
  return tokens
}
