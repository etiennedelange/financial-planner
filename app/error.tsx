"use client"

import { Button } from "@/components/ui/button"
import { ErrorFallback } from "@/components/error/error-fallback"
import { RefreshCw } from "lucide-react"

export default function RootError({
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
      description="An unexpected error occurred while rendering the page. You can retry, or reload to start again."
      actions={
        <>
          <Button size="sm" onClick={retry} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" data-icon="inline-start" />
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
