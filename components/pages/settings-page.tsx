"use client"

import { Button } from "@/components/ui/button"
import { PageCard } from "@/components/ui/page-card"
import { AccountSettings } from "@/components/auth/account-settings"
import { useAuth } from "@/components/supabase-provider"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { exportPlan, parsePlanFile } from "@/lib/utils/plan-io"
import { exportProjectionCsv } from "@/lib/utils/export-csv"
import { useTheme } from "next-themes"
import {
  Download,
  FileSpreadsheet,
  Moon,
  Printer,
  RotateCcw,
  Sun,
  SunMoon,
  Upload,
} from "lucide-react"
import { useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import type { ProjectionResult } from "@/types"
import { toast } from "@/lib/hooks/use-toast"

interface SettingsPageProps {
  projection: ProjectionResult | null
}

export function SettingsPage({ projection }: SettingsPageProps) {
  const {
    personalInfo,
    retirementGoals,
    assumptions,
    drawdownConfig,
    displayMode,
    accounts,
    setAssumptions,
    setDisplayMode,
    resetToDefaults,
    loadPlan,
  } = useCalculatorStore(
    useShallow((state) => ({
      personalInfo: state.personalInfo,
      retirementGoals: state.retirementGoals,
      assumptions: state.assumptions,
      drawdownConfig: state.drawdownConfig,
      displayMode: state.displayMode,
      accounts: state.accounts,
      setAssumptions: state.setAssumptions,
      setDisplayMode: state.setDisplayMode,
      resetToDefaults: state.resetToDefaults,
      loadPlan: state.loadPlan,
    }))
  )

  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [resetPending, setResetPending] = useState(false)

  const handleExportPlan = () => {
    exportPlan(personalInfo, retirementGoals, assumptions, drawdownConfig, displayMode, accounts)
    toast({ title: "Plan exported" })
  }

  const handleImportPlan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setImportError(null)
    setImporting(true)
    try {
      const { plan } = await parsePlanFile(file)
      loadPlan(plan)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.")
    } finally {
      setImporting(false)
    }
  }

  const handleExportCsv = () => {
    if (!projection) return
    exportProjectionCsv(projection.yearlyProjections)
  }

  const handleReset = () => {
    if (!resetPending) {
      setResetPending(true)
      return
    }
    resetToDefaults()
    setResetPending(false)
    toast({ title: "Reset to defaults" })
  }

  return (
    <div className="space-y-6">
      <input ref={importInputRef} type="file" accept=".json" className="sr-only" aria-label="Import plan file" onChange={handleImportPlan} />
      {/* Display */}
      <PageCard label="Display" contentClassName="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Display Mode</p>
            <div className="flex gap-2">
              <Button
                variant={displayMode === "real" ? "default" : "outline"}
                size="sm"
                onClick={() => setDisplayMode("real")}
              >
                Today&apos;s Value (Real)
              </Button>
              <Button
                variant={displayMode === "nominal" ? "default" : "outline"}
                size="sm"
                onClick={() => setDisplayMode("nominal")}
              >
                Future Value (Nominal)
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Compounding Method</p>
            <div className="flex gap-2">
              <Button
                variant={assumptions.compoundingMethod === "nominal" ? "default" : "outline"}
                size="sm"
                onClick={() => setAssumptions({ compoundingMethod: "nominal" })}
              >
                Nominal (Excel-compatible)
              </Button>
              <Button
                variant={assumptions.compoundingMethod === "compound" ? "default" : "outline"}
                size="sm"
                onClick={() => setAssumptions({ compoundingMethod: "compound" })}
              >
                Compound (Actuarially correct)
              </Button>
            </div>
          </div>
      </PageCard>

      {/* Appearance */}
      <PageCard label="Appearance" contentClassName="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Dark Mode</p>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
              >
                <Sun className="mr-1.5 h-3.5 w-3.5" data-icon="inline-start" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
              >
                <Moon className="mr-1.5 h-3.5 w-3.5" data-icon="inline-start" />
                Dark
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("system")}
              >
                <SunMoon className="mr-1.5 h-3.5 w-3.5" data-icon="inline-start" />
                System
              </Button>
            </div>
          </div>
      </PageCard>

      {/* Plan */}
      <PageCard label="Plan" contentClassName="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open("/print", "_blank")}>
              <Printer className="mr-2 h-4 w-4" data-icon="inline-start" />
              Print / Save PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!projection}>
              <FileSpreadsheet className="mr-2 h-4 w-4" data-icon="inline-start" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPlan}>
              <Download className="mr-2 h-4 w-4" data-icon="inline-start" />
              Export Plan
            </Button>
            <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()} disabled={importing}>
              <Upload className="mr-2 h-4 w-4" data-icon="inline-start" />
              {importing ? "Importing…" : "Import Plan"}
            </Button>
          </div>
          {importError && (
            <p className="text-sm text-destructive">{importError}</p>
          )}
      </PageCard>

      {/* Reset Plan Data: local plan state (distinct from account deletion below) */}
      <PageCard label="Reset Plan Data" labelVariant="destructive" className="border-destructive/40" contentClassName="space-y-3">
          {resetPending ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                This will reset all accounts, personal info, goals, and assumptions to defaults. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={handleReset}>
                  Yes, reset everything
                </Button>
                <Button variant="outline" size="sm" onClick={() => setResetPending(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={handleReset} className="border-destructive/40 text-destructive hover:bg-destructive/10">
              <RotateCcw className="mr-2 h-4 w-4" data-icon="inline-start" />
              Reset to Defaults
            </Button>
          )}
      </PageCard>

      {/* Account (signed-in users only) */}
      {user && <AccountSettings user={user} />}
    </div>
  )
}
