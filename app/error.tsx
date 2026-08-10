"use client"

import { ErrorFallback } from "@/components/error/error-fallback"

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
    />
  )
}
