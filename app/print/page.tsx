import { Suspense } from "react"
import { PrintClient } from "./print-client"

export const metadata = { title: "Retirement Plan Report" }

function PrintFallback() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6" aria-busy="true" aria-label="Loading report">
      <div className="h-8 w-56 animate-pulse rounded bg-muted" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted/70" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-md border border-border bg-muted/40" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-md border border-border bg-muted/40" />
      <p className="text-sm text-muted-foreground">Preparing your retirement plan report…</p>
    </div>
  )
}

export default function PrintPage() {
  return (
    <Suspense fallback={<PrintFallback />}>
      <PrintClient />
    </Suspense>
  )
}
