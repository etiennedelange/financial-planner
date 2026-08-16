"use client"

import { PageCard } from "@/components/ui/page-card"
import { AlertTriangle } from "lucide-react"

interface ErrorFallbackProps {
  error: Error & { digest?: string }
  retry: () => void
  title?: string
  description?: string
  /** Action buttons rendered in the error card's footer. */
  actions?: React.ReactNode
}

/**
 * Shared error-boundary fallback card for error.tsx files (Next 16.3).
 *
 * Next 16.3 replaced the old `reset` callback with `retry`, which re-fetches
 * the failed server-rendered children and swaps them back in if it succeeds.
 * Each error.tsx entry point renders its own retry controls via `actions` —
 * keep the wired <Button onClick={retry}> in the boundary file itself.
 */
export function ErrorFallback({
  error,
  retry,
  title = "Something went wrong",
  description = "An unexpected error occurred while rendering this page.",
  actions,
}: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <PageCard
        label={title}
        labelVariant="destructive"
        leading={<AlertTriangle className="h-4 w-4 text-destructive" />}
        className="w-full max-w-md border-destructive/40"
        contentClassName="space-y-4"
      >
        <p className="text-sm text-muted-foreground pl-3">{description}</p>
        {error.digest && (
          <p className="pl-3 font-mono text-[10px] text-muted-foreground/50">
            Error digest: {error.digest}
          </p>
        )}
        {actions && <div className="flex items-center gap-2 pl-3">{actions}</div>}
      </PageCard>
    </div>
  )
}
