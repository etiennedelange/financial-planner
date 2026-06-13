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
  const { projection, simulationResult } = useCalculator()
  const accounts = useCalculatorStore((s) => s.accounts)

  const [storeReady, setStoreReady] = useState(false)

  useEffect(() => {
    useCalculatorStore.persist.rehydrate()
    useExpensesStore.persist.rehydrate()
    setStoreReady(true)
  }, [])

  return (
    <>
      <AppShell accountCount={accounts.length} user={user} isLoaded={isLoaded}>
        <div
          style={{
            opacity: storeReady ? 1 : 0,
            transition: storeReady ? "opacity 0.1s ease" : "none",
          }}
        >
          {children}
        </div>
      </AppShell>
      <CommandPalette />
      <DebugWindow projection={projection} simulationResult={simulationResult} className="fixed bottom-4 right-4 z-50" />
    </>
  )
}
