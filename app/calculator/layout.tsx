"use client"

import { useEffect, useReducer } from "react"
import { CommandPalette } from "@/components/command-palette/command-palette"
import { DebugWindow } from "@/components/debug/debug-window"
import { AppShell } from "@/components/layout/app-shell"
import { useAuth } from "@/components/supabase-provider"
import { CalculatorProvider, useCalculator } from "@/lib/context/calculator-context"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useExpensesStore } from "@/lib/store/expenses-store"
import { Toaster } from "@/components/ui/toaster"

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
  const { user, isLoaded } = useAuth()
  const { projection, simulationResult, isDeferred } = useCalculator()
  const accounts = useCalculatorStore((s) => s.accounts)

  const [shell, dispatch] = useReducer(shellReducer, shellInitialState)

  useEffect(() => {
    // Mark stores ready once rehydrate() has settled; the reveal effect below
    // then unlocks content once deferred projection/simulation values land.
    let active = true
    void Promise.all([
      useCalculatorStore.persist.rehydrate(),
      useExpensesStore.persist.rehydrate(),
    ]).then(() => {
      if (active) dispatch({ type: "STORES_READY" })
    })
    return () => { active = false }
  }, [])

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
        <div
          style={{
            opacity: shell.showContent ? 1 : 0,
            transition: shell.showContent ? "opacity 0.15s ease" : "none",
          }}
        >
          {children}
        </div>
      </AppShell>
      <CommandPalette />
      <DebugWindow projection={projection} simulationResult={simulationResult} className="hidden md:flex fixed bottom-4 right-4 z-50" />
      <Toaster />
    </>
  )
}
