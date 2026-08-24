"use client"

import { Button } from "@/components/ui/button"
import { ErrorFallback } from "@/components/error/error-fallback"
import { RefreshCwIcon } from "@animateicons/react/lucide"
import { useAnimatedIcon } from "@/components/ui/animated-icon"

export default function CalculatorError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const { iconProps, controlProps } = useAnimatedIcon()

  return (
    <ErrorFallback
      error={error}
      retry={retry}
      title="Calculator error"
      description="An unexpected error occurred in the calculator. Your plan data is saved — you can retry safely."
      actions={
        <>
          <Button {...controlProps} size="sm" onClick={retry} className="gap-2">
            <RefreshCwIcon {...iconProps} size={14} data-icon="inline-start" />
            Try again
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </>
      }
    />
  )
}
