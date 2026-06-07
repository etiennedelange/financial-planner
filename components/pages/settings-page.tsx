"use client"

import { useColorTheme } from "@/components/color-theme-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { exportPlan, parsePlanFile } from "@/lib/utils/plan-io"
import { exportProjectionCsv } from "@/lib/utils/export-csv"
import { useTheme } from "next-themes"
import {
  Download,
  FileSpreadsheet,
  Moon,
  Palette,
  Printer,
  RotateCcw,
  Sun,
  SunMoon,
  Upload,
} from "lucide-react"
import { useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import type { ProjectionResult } from "@/types"
import { cn } from "@/lib/utils"

const COLOR_THEMES = [
  { name: "Blue", value: "blue", color: "bg-blue-500" },
  { name: "Green", value: "green", color: "bg-green-500" },
  { name: "Rose", value: "rose", color: "bg-rose-500" },
  { name: "Violet", value: "violet", color: "bg-violet-500" },
  { name: "Orange", value: "orange", color: "bg-orange-500" },
] as const

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
  const { colorTheme, setColorTheme } = useColorTheme()
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [resetPending, setResetPending] = useState(false)

  const handleExportPlan = () => {
    exportPlan(personalInfo, retirementGoals, assumptions, drawdownConfig, displayMode, accounts)
  }

  const handleImportPlan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setImportError(null)
    try {
      const { plan } = await parsePlanFile(file)
      loadPlan(plan)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.")
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
  }

  return (
    <div className="max-w-2xl space-y-6">
      <input ref={importInputRef} type="file" accept=".json" className="sr-only" onChange={handleImportPlan} />

      {/* Display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Color Theme</p>
            <div className="flex gap-2 flex-wrap">
              {COLOR_THEMES.map((t) => (
                <button
                  key={t.value}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onClick={() => setColorTheme(t.value as any)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                    colorTheme === t.value
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border hover:bg-accent"
                  )}
                >
                  <span className={cn("h-3 w-3 rounded-full", t.color)} />
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Dark Mode</p>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
              >
                <Sun className="mr-1.5 h-3.5 w-3.5" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
              >
                <Moon className="mr-1.5 h-3.5 w-3.5" />
                Dark
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("system")}
              >
                <SunMoon className="mr-1.5 h-3.5 w-3.5" />
                System
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open("/print", "_blank")}>
              <Printer className="mr-2 h-4 w-4" />
              Print / Save PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!projection}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPlan}>
              <Download className="mr-2 h-4 w-4" />
              Export Plan
            </Button>
            <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Import Plan
            </Button>
          </div>
          {importError && (
            <p className="text-sm text-destructive">{importError}</p>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Defaults
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
