import { useRef } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { isAllowedMonetaryInput, predictInsertedValue } from "@/lib/utils/monetary"

/**
 * Guard that physically blocks monetary input outside `[0, max]`.
 *
 * Two complementary layers:
 *
 * - **`onBeforeInput`** (primary): predicts the value that would result from the
 *   pending edit and calls `preventDefault()` when it would exceed the cap — the
 *   character never enters the DOM, so there is no visible flicker or "reset".
 *   Works for typing and paste, and falls back to the end-of-field position for
 *   `type="number"` inputs (which expose no caret API).
 * - **`onChange`** (fallback): for browsers without `beforeinput` (or edits the
 *   prediction can't see), rejects an out-of-range value by restoring the input
 *   to the exact last valid string, tracked in a ref. Because the ref is written
 *   only inside the handler (never during render), the revert target is always
 *   precise — never a stale value from an earlier render.
 *
 * Both accept empty strings so a field can be cleared. Valid values are
 * forwarded to `accept` (React Hook Form's `onChange` or a `setState`).
 */
export function useBoundedMonetary(value: string | number, max?: number) {
  const lastValid = useRef(normalize(value))

  const onChange = (
    e: ChangeEvent<HTMLInputElement>,
    accept: (e: ChangeEvent<HTMLInputElement>) => void
  ) => {
    const raw = e.target.value
    if (raw === "" || isAllowedMonetaryInput(raw, max)) {
      lastValid.current = raw
      accept(e)
    } else {
      e.target.value = lastValid.current
    }
  }

  const onBeforeInput = (e: FormEvent<HTMLInputElement>) => {
    const native = e.nativeEvent as InputEvent
    if (!native.data) return
    const target = e.currentTarget
    const candidate = predictInsertedValue(
      target.value,
      native.data,
      target.selectionStart,
      target.selectionEnd
    )
    if (candidate !== "" && !isAllowedMonetaryInput(candidate, max)) {
      e.preventDefault()
    }
  }

  return { onChange, onBeforeInput }
}

function normalize(value: string | number): string {
  if (value == null) return ""
  if (typeof value === "number") {
    return Number.isNaN(value) ? "" : String(value)
  }
  return value
}
