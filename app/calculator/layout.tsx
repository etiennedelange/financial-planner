"use client"

import { useEffect, useReducer } from "react"
import { DebugWindow } from "@/components/debug/debug-window"
import { AppShell } from "@/components/layout/app-shell"
import { useAuth } from "@/components/supabase-provider"
import { Button } from "@/components/ui/button"
import { CalculatorProvider, useCalculator } from "@/lib/context/calculator-context"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { Loader2 } from "lucide-react"

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <CalculatorProvider>
      <CalculatorShell>{children}</CalculatorShell>
    </CalculatorProvider>
  )
}

type ShellAction = { type: "STORES_READY" } | { type: "REVEAL" }
interface ShellState {
  storeReady: boolean
  showContent: boolean
}

const shellInitialState: ShellState = { storeReady: false, showContent: false }

function shellReducer(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case "STORES_READY":
      return state.storeReady ? state : { ...state, storeReady: true }
    case "REVEAL":
      return state.showContent ? state : { ...state, showContent: true }
  }
}

function CalculatorShell({ children }: { children: React.ReactNode }) {
  const { user, isLoaded, error } = useAuth()
  const { projection, simulationResult, isDeferred } = useCalculator()
  const accounts = useCalculatorStore((s) => s.accounts)

  const [shell, dispatch] = useReducer(shellReducer, shellInitialState)

  // SupabaseProvider is the single bootstrap owner: hydration (guest scope,
  // and user scope after identity resolves) and server sync all settle before
  // `isLoaded` flips true. No store rehydrate() is called from the layout.
  useEffect(() => {
    if (isLoaded) dispatch({ type: "STORES_READY" })
  }, [isLoaded])

  // Reveal content once the store is rehydrated AND deferred values have caught
  // up. This prevents CLS: content stays invisible while the layout stabilises,
  // then fades in once projection/simulation values are final. showContent
  // never goes back to false, so subsequent input changes don't flash.
  useEffect(() => {
    if (shell.storeReady && !isDeferred) dispatch({ type: "REVEAL" })
  }, [shell.storeReady, isDeferred])

  return (
    <>
      <AppShell accountCount={accounts.length} user={user} isLoaded={isLoaded}>
        <div className="relative">
          {!isLoaded && !error ? (
            <div
              role="status"
              aria-live="polite"
              className="absolute inset-0 z-10 flex items-center justify-center py-24"
            >
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Loading your plan…
                </p>
              </div>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="absolute inset-0 z-10 flex items-center justify-center py-24"
            >
              <div className="max-w-sm space-y-3 text-center">
                <p className="text-sm font-semibold">We couldn&apos;t load your plan.</p>
                <p className="text-xs text-muted-foreground">{error.message}</p>
                <Button size="sm" onClick={() => window.location.reload()}>
                  Reload
                </Button>
              </div>
            </div>
          ) : null}
          <div
            style={{
              opacity: shell.showContent ? 1 : 0,
              transition: shell.showContent ? "opacity 0.15s ease" : "none",
            }}
          >
            {children}
          </div>
        </div>
      </AppShell>
      <DebugWindow projection={projection} simulationResult={simulationResult} className="hidden md:flex fixed bottom-4 right-4 z-50" />
    </>
  )
}
