"use client"

import { useEffect, useState } from "react"
import { CommandPalette } from "@/components/command-palette/command-palette"
import { DebugWindow } from "@/components/debug/debug-window"
import { AppShell } from "@/components/layout/app-shell"
import { useAuth } from "@/components/supabase-provider"
import { CalculatorProvider, useCalculator } from "@/lib/context/calculator-context"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useExpensesStore } from "@/lib/store/expenses-store"

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <CalculatorProvider>
      <CalculatorShell>{children}</CalculatorShell>
    </CalculatorProvider>
  )
}

function CalculatorShell({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useAuth()
  const { projection, simulationResult, isDeferred } = useCalculator()
  const accounts = useCalculatorStore((s) => s.accounts)

  const [storeReady, setStoreReady] = useState(false)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    useCalculatorStore.persist.rehydrate()
    useExpensesStore.persist.rehydrate()
    setStoreReady(true)
  }, [])

  // Reveal content once store is rehydrated AND deferred values have caught up.
  // This prevents CLS: content stays invisible while the layout stabilises,
  // then fades in once projection/simulation values are final.
  // showContent never goes back to false, so subsequent input changes don't flash.
  useEffect(() => {
    if (showContent) return
    if (storeReady && !isDeferred) {
      setShowContent(true)
    }
  }, [storeReady, isDeferred, showContent])

  return (
    <>
      <AppShell accountCount={accounts.length} user={user} isLoaded={isLoaded}>
        <div
          style={{
            opacity: showContent ? 1 : 0,
            transition: showContent ? "opacity 0.15s ease" : "none",
          }}
        >
          {children}
        </div>
      </AppShell>
      <CommandPalette />
      <DebugWindow projection={projection} simulationResult={simulationResult} className="hidden md:block fixed bottom-4 right-4 z-50" />
    </>
  )
}
