"use client"

import { useImperativeHandle, useLayoutEffect, useRef, useState } from "react"
import type { ChangeEvent, KeyboardEvent, Ref } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { NO_AUTOFILL_PROPS } from "@/lib/utils/no-autofill"
import {
  caretAfterReformat,
  exceedsHardMax,
  formatNumberValue,
  parseNumberText,
  sameFieldValue,
  sanitizeNumberText,
  stepNumber,
} from "@/lib/utils/number-field"

export interface NumberInputProps {
  id?: string
  name?: string
  /** The value; NaN means an empty field. */
  value: number
  onValueChange: (value: number) => void
  onBlur?: () => void
  /** Runs first. Call `preventDefault()` to stop the arrow-key stepping. */
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  inputRef?: Ref<HTMLInputElement>
  /** Unit shown inside the field before the value, e.g. "R". */
  prefix?: string
  /** Unit shown inside the field after the value, e.g. "yrs", "%", "/ year". */
  suffix?: string
  /** Maximum fraction digits. Default 0 (integers). */
  decimals?: number
  /** Group thousands ("600 000"). Default false. */
  group?: boolean
  /**
   * Reject keystrokes that would push the value above this. Use for absurd-value
   * protection (see `MAX_MONETARY_AMOUNT`); ordinary range rules belong in the schema,
   * which explains the problem instead of silently ignoring the key.
   */
  hardMax?: number
  /** Bounds for the stepper and arrow keys only. They are not enforced while typing. */
  min?: number
  max?: number
  /** Arrow-key and stepper increment. Shift multiplies it by 10. Default 1. */
  step?: number
  /** Show the up/down stepper buttons. Arrow keys work either way. */
  stepper?: boolean
  /** Name for the stepper buttons ("Increase <label>"). Falls back to the input's aria-label. */
  stepperLabel?: string
  /** `md` is the form size; `sm` is for inline editors inside table rows and lists. */
  size?: "md" | "sm"
  /** Right-align the value (amounts in a list). */
  alignEnd?: boolean
  invalid?: boolean
  disabled?: boolean
  placeholder?: string
  "aria-label"?: string
  "aria-describedby"?: string
  /** Classes for the bordered control box (set its width here). */
  className?: string
}

/**
 * The numeric control without a label: bordered box, in-field units, formatted text and
 * optional stepper. Use `NumberField` for a labelled form field; use this directly only
 * where the label is supplied elsewhere (inline editors, table cells) via `aria-label`.
 *
 * It shows formatted text ("600 000") but speaks numbers: NaN stands for an empty field.
 */
export function NumberInput({
  id,
  name,
  value,
  onValueChange,
  onBlur,
  onKeyDown,
  inputRef,
  prefix,
  suffix,
  decimals = 0,
  group = false,
  hardMax,
  min,
  max,
  step = 1,
  stepper = false,
  stepperLabel,
  size = "md",
  alignEnd = false,
  invalid,
  disabled,
  placeholder,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  className,
}: NumberInputProps) {
  const format = { decimals, group }

  const innerRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(inputRef, () => innerRef.current as HTMLInputElement)

  const [text, setText] = useState(() => formatNumberValue(value, format))
  const pendingCaret = useRef<number | null>(null)

  // The form changed the value from outside (scenario switch, reset to defaults, store
  // hydration). Typing never trips this: what was typed always parses back to `value`.
  if (!sameFieldValue(parseNumberText(text), value)) {
    setText(formatNumberValue(value, format))
  }

  // Restore the caret after React commits the reformatted text.
  useLayoutEffect(() => {
    const input = innerRef.current
    if (pendingCaret.current !== null && input && document.activeElement === input) {
      try {
        input.setSelectionRange(pendingCaret.current, pendingCaret.current)
      } catch {
        // Some input types expose no selection API; the caret simply stays put.
      }
    }
    pendingCaret.current = null
  })

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const next = sanitizeNumberText(raw, format)
    const parsed = parseNumberText(next)
    if (exceedsHardMax(parsed, hardMax)) return // React restores the previous text

    pendingCaret.current = caretAfterReformat(raw, e.target.selectionStart ?? raw.length, next)
    setText(next)
    onValueChange(parsed)
  }

  const commitStep = (direction: 1 | -1, multiplier = 1) => {
    const next = stepNumber(parseNumberText(text), direction, {
      step: step * multiplier,
      min,
      max,
    })
    if (exceedsHardMax(next, hardMax)) return
    setText(formatNumberValue(next, format))
    onValueChange(next)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e)
    if (e.defaultPrevented) return
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault()
      commitStep(e.key === "ArrowUp" ? 1 : -1, e.shiftKey ? 10 : 1)
    }
  }

  const small = size === "sm"
  const buttonName = stepperLabel ?? ariaLabel ?? "value"

  return (
    <div
      className={cn(
        "flex min-w-0 items-center border bg-background transition-[border-color,box-shadow]",
        small ? "h-8 rounded-md" : "h-9 rounded-lg",
        "border-input hover:border-muted-foreground",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20",
        invalid &&
          "border-destructive hover:border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
        disabled && "opacity-50",
        className,
      )}
    >
      {prefix && (
        <span
          aria-hidden="true"
          className={cn(
            "select-none text-muted-foreground",
            small ? "pl-2 text-sm" : "pl-3 text-base sm:text-sm",
          )}
        >
          {prefix}
        </span>
      )}
      <input
        ref={innerRef}
        id={id}
        name={name}
        type="text"
        inputMode={decimals > 0 ? "decimal" : "numeric"}
        {...NO_AUTOFILL_PROPS}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={ariaDescribedBy}
        onChange={handleChange}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent font-medium tabular-nums outline-hidden",
          "placeholder:font-normal placeholder:text-muted-foreground/70 disabled:cursor-not-allowed",
          // 14px beside the body copy; 16px on phones, where iOS zooms into smaller inputs
          small ? "text-sm" : "text-base sm:text-sm",
          alignEnd && "text-right",
          prefix ? (small ? "pl-1 pr-2" : "pl-1.5 pr-2") : small ? "pl-2 pr-1.5" : "pl-3 pr-1",
        )}
      />
      {suffix && (
        <span
          aria-hidden="true"
          className={cn(
            "select-none whitespace-nowrap font-mono text-xs text-muted-foreground",
            stepper ? "pr-1" : small ? "pr-2" : "pr-3",
          )}
        >
          {suffix}
        </span>
      )}
      {stepper && !disabled && (
        <div className="ml-1 flex h-full flex-col border-l border-border">
          <StepButton label={`Increase ${buttonName}`} onClick={() => commitStep(1)} up />
          <StepButton label={`Decrease ${buttonName}`} onClick={() => commitStep(-1)} />
        </div>
      )}
    </div>
  )
}

function StepButton({ label, onClick, up }: { label: string; onClick: () => void; up?: boolean }) {
  const Icon = up ? ChevronUp : ChevronDown
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex w-6 flex-1 items-center justify-center text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        up ? "rounded-tr-[7px]" : "rounded-br-[7px] border-t border-border",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
    </button>
  )
}
