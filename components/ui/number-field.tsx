"use client"

import { useId } from "react"
import type { ReactNode } from "react"
import { FieldError } from "@/components/ui/field-error"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { Label, FIELD_LABEL_CLASS } from "@/components/ui/label"
import { NumberInput, type NumberInputProps } from "@/components/ui/number-input"
import { cn } from "@/lib/utils"

/** Field widths follow the data they hold, not the width of the card. */
const WIDTHS = {
  /** Ages and percentages: 2-5 characters. */
  compact: "w-[9.25rem]",
  /** Rand amounts. */
  money: "w-64",
  full: "w-full",
} as const

export interface NumberFieldProps extends Omit<
  NumberInputProps,
  "aria-label" | "aria-describedby" | "invalid" | "size" | "alignEnd" | "stepperLabel" | "className"
> {
  /** Required: the label is the field's accessible name. */
  label: string
  /** Info icon shown next to the label. */
  tooltip?: ReactNode
  /** Width of the whole field, label and hint included. */
  width?: keyof typeof WIDTHS
  /**
   * Width of just the bordered control, for fields whose label or hint is longer than
   * the value (e.g. "Volatility for accounts without a type"). Use with `width="full"`.
   */
  controlClassName?: string
  /** Validation message. */
  error?: string
  /** Supporting text below the field. */
  hint?: ReactNode
  className?: string
}

/**
 * Labelled numeric form field: label (+ tooltip) above, unit inside the control, hint and
 * validation message below. The width follows the data.
 *
 * Holds a `number` (NaN = empty, so the schema can say "Enter a ...") and shows formatted
 * text. Wire it to react-hook-form with `<Controller>`.
 */
export function NumberField({
  label,
  tooltip,
  width = "compact",
  controlClassName,
  error,
  hint,
  id,
  className,
  ...inputProps
}: NumberFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ")

  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-1.5",
        WIDTHS[width],
        // On phones every field takes the full row.
        width !== "full" && "max-sm:w-full",
        className,
      )}
    >
      <div className="flex min-h-5 items-center gap-1.5">
        <Label htmlFor={inputId} className={FIELD_LABEL_CLASS}>
          {label}
        </Label>
        {tooltip && <InfoTooltip content={tooltip} side="right" className="h-3.5 w-3.5" />}
      </div>

      <NumberInput
        {...inputProps}
        id={inputId}
        stepperLabel={label}
        invalid={!!error}
        aria-describedby={describedBy || undefined}
        className={controlClassName}
      />

      <div id={errorId} className="empty:hidden">
        <FieldError message={error} />
      </div>
      {hint && (
        <div id={hintId} className="text-xs text-muted-foreground tabular-nums">
          {hint}
        </div>
      )}
    </div>
  )
}
