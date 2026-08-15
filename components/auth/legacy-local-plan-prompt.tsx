"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { SectionLabel } from "@/components/ui/section-label"
import type { AmbiguousLegacyState } from "@/lib/store/legacy-scope-migration"

interface LegacyLocalPlanPromptProps {
  open: boolean
  states: AmbiguousLegacyState[]
  onUseLocalPlan: () => void
  onKeepAccountData: () => void
}

/**
 * Explicit user choice for ambiguous legacy local state.
 *
 * A legacy (pre-scoping) payload with `sessionId: null` cannot be attributed to
 * any account — it must not be silently claimed by whoever signs in next. The
 * prompt offers the user the decision instead:
 *
 * - "Use this local plan": the payload is adopted as guest-scoped state and the
 *   normal guest→account claim path takes over on sign-in.
 * - "Keep account data": the legacy payload is discarded; server data wins.
 *
 * The prompt never claims data merely because a user signed in.
 */
export function LegacyLocalPlanPrompt({
  open,
  states,
  onUseLocalPlan,
  onKeepAccountData,
}: LegacyLocalPlanPromptProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onKeepAccountData()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Found a local plan</DialogTitle>
        <div className="space-y-3">
          <SectionLabel>Legacy local data</SectionLabel>
          <p className="text-sm text-muted-foreground">
            This browser has a saved plan from before account scoping. It could not be
            linked to an account automatically, so nothing has been loaded or overwritten.
          </p>
          <p className="text-sm text-muted-foreground">
            {states.length} saved {states.length === 1 ? "state" : "states"} found in this
            browser. What would you like to do?
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={onUseLocalPlan}>Use this local plan</Button>
            <Button variant="outline" onClick={onKeepAccountData}>
              Keep account data
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
