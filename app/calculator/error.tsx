"use client"

import { ErrorFallback } from "@/components/error/error-fallback"

export default function CalculatorError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <ErrorFallback
      error={error}
      retry={retry}
      title="Calculator error"
      description="An unexpected error occurred in the calculator. Your plan data is saved — you can retry safely."
    />
  )
}
