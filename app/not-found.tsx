import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageCard } from "@/components/ui/page-card"
import { Compass } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <PageCard
        label="Page not found"
        leading={<Compass className="h-4 w-4 text-primary" />}
        className="w-full max-w-md"
        contentClassName="space-y-4"
      >
        <p className="text-sm text-muted-foreground pl-3">
          This page doesn&apos;t exist, or it was moved. Your plan data is safe.
        </p>
        <div className="flex items-center gap-2 pl-3">
          <Button size="sm" asChild>
            <Link href="/calculator">Back to the calculator</Link>
          </Button>
        </div>
      </PageCard>
    </div>
  )
}
