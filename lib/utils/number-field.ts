/**
 * Pure text <-> number helpers behind `NumberField`.
 *
 * The field shows formatted text ("600 000", "5.5") while the form holds a number.
 * Keeping the rules here, rather than inline in the component, means they are
 * unit-tested and cannot drift between the Plan forms.
 */

/** Non-breaking space: groups thousands without letting the number wrap mid-digit. */
export const GROUP_SEPARATOR = " "

export interface NumberTextFormat {
  /** Maximum fraction digits accepted. 0 means integers only. */
  decimals: number
  /** Group the integer part in thousands ("600 000"). */
  group: boolean
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR)
}

/**
 * Clean whatever was typed or pasted into canonical display text.
 *
 * - Anything that is not a digit or a decimal point is dropped (spaces, `R`, `%`, letters).
 * - A comma counts as the decimal point when decimals are allowed ("5,5" -> "5.5"), and is
 *   ignored as a thousands separator otherwise ("1,000" -> "1 000").
 * - Only the first decimal point survives, and fraction digits are cut to `decimals`.
 * - Leading zeros are removed ("007" -> "7") but "0.5" keeps its zero.
 * - Negative signs are dropped: no field on the Plan page can be negative.
 */
export function sanitizeNumberText(raw: string, { decimals, group }: NumberTextFormat): string {
  let intPart = ""
  let fracPart = ""
  let seenPoint = false

  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      if (seenPoint) fracPart += ch
      else intPart += ch
    } else if (!seenPoint && (ch === "." || (ch === "," && decimals > 0))) {
      // Integer fields stop at the first decimal point: "12.5" -> "12", not "125".
      if (decimals === 0) break
      seenPoint = true
    }
  }

  fracPart = fracPart.slice(0, decimals)
  intPart = intPart.replace(/^0+(?=\d)/, "")
  if (intPart === "" && seenPoint) intPart = "0"

  const shownInt = group ? groupThousands(intPart) : intPart
  return seenPoint ? `${shownInt}.${fracPart}` : shownInt
}

/** The number a piece of display text stands for. Empty or incomplete text is NaN. */
export function parseNumberText(text: string): number {
  const cleaned = text.replace(/[\s ]/g, "")
  if (cleaned === "" || cleaned === ".") return NaN
  return Number(cleaned)
}

/** Display text for a stored number. NaN and non-finite values show as an empty field. */
export function formatNumberValue(value: number, format: NumberTextFormat): string {
  if (!Number.isFinite(value) || Math.abs(value) >= 1e21) return ""
  // Number() drops trailing zeros and float noise: 5.50 -> "5.5", 0.1 + 0.2 -> "0.3".
  const rounded = Number(value.toFixed(format.decimals))
  return sanitizeNumberText(String(rounded), format)
}

/** Two numbers are the same field value; NaN (an empty field) equals NaN. */
export function sameFieldValue(a: number, b: number): boolean {
  return Object.is(a, b) || (Number.isNaN(a) && Number.isNaN(b)) || a === b
}

const isSignificant = (ch: string) => (ch >= "0" && ch <= "9") || ch === "."

/**
 * Where the caret belongs after the text was reformatted. Grouping spaces appear and
 * disappear as digits are typed, so the caret is placed after the same number of digits
 * (and decimal points) it followed before, not at the same character offset.
 */
export function caretAfterReformat(before: string, caret: number, after: string): number {
  let significantBefore = 0
  for (let i = 0; i < Math.min(caret, before.length); i++) {
    if (isSignificant(before[i])) significantBefore++
  }
  if (significantBefore === 0) return 0

  let seen = 0
  for (let i = 0; i < after.length; i++) {
    if (isSignificant(after[i])) seen++
    if (seen === significantBefore) return i + 1
  }
  return after.length
}

export interface StepOptions {
  step: number
  min?: number
  max?: number
}

/**
 * Value after pressing up (`direction` 1) or down (-1). An empty field starts from `min`
 * (or 0), the result is clamped into `[min, max]`, and float noise is rounded away so
 * stepping 0.1 ten times lands on 1, not 0.9999999999999999.
 */
export function stepNumber(
  value: number,
  direction: 1 | -1,
  { step, min = -Infinity, max = Infinity }: StepOptions,
): number {
  const base = Number.isFinite(value) ? value : Number.isFinite(min) ? min : 0
  const next = Number((base + direction * step).toFixed(10))
  return Math.min(max, Math.max(min, next))
}

/** True when an edit would push the value above the hard ceiling and must be rejected. */
export function exceedsHardMax(value: number, hardMax: number | undefined): boolean {
  return hardMax !== undefined && Number.isFinite(value) && value > hardMax
}
