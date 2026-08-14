import { MAX_MONETARY_AMOUNT } from "@/lib/constants/limits"

/**
 * Clamp a monetary input to the range `[0, MAX_MONETARY_AMOUNT]`.
 *
 * Non-finite values (NaN / ±Infinity) collapse to 0 so an empty or garbled field
 * never injects a non-number into the store. Values above the cap are pinned to
 * the cap, mirroring the `max` validation applied to the form fields. Absurd
 * pasted figures (e.g. a 40-digit number far beyond `Number.MAX_SAFE_INTEGER`)
 * are thus rejected before they can reach any calculation.
 */
export function clampMonetaryAmount(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > MAX_MONETARY_AMOUNT) return MAX_MONETARY_AMOUNT
  return value
}

/**
 * Whether a raw input string is an acceptable monetary value.
 *
 * Empty strings are allowed (the field may be cleared). Commas and spaces are
 * stripped before parsing so formatted input like `R 1 000` or `1,000` passes
 * the same way the commit handlers parse it. Anything non-finite, negative, or
 * above `max` is rejected so an absurd value can never be typed or pasted.
 */
export function isAllowedMonetaryInput(raw: string, max = MAX_MONETARY_AMOUNT): boolean {
  if (raw.trim() === "") return true
  const n = Number(raw.replace(/[\s,]/g, ""))
  return Number.isFinite(n) && n >= 0 && n <= max
}

/**
 * Predict the input value that would result from inserting `insertedData` at the
 * current selection. `type="number"` inputs expose no caret API (`selectionStart`
 * is null), so the insertion is assumed to land at the end of the field.
 */
export function predictInsertedValue(
  currentValue: string,
  insertedData: string,
  selectionStart: number | null,
  selectionEnd: number | null
): string {
  const start = selectionStart ?? currentValue.length
  const end = selectionEnd ?? currentValue.length
  return currentValue.slice(0, start) + insertedData + currentValue.slice(end)
}
