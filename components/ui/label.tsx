"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
)

/** Quiet label used above every form field, so text, number and select fields line up. */
const FIELD_LABEL_CLASS = "text-[0.8125rem] text-muted-foreground"

function Label({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>) {
  return <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
}
Label.displayName = LabelPrimitive.Root.displayName

export { Label, FIELD_LABEL_CLASS }
