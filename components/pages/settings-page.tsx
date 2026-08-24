"use client"

import { Button, type ButtonProps } from "@/components/ui/button"
import { PageCard } from "@/components/ui/page-card"
import { AccountSettings } from "@/components/auth/account-settings"
import { useAuth } from "@/components/supabase-provider"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { exportPlan, parsePlanFile } from "@/lib/utils/plan-io"
import { exportProjectionCsv } from "@/lib/utils/export-csv"
import { useTheme } from "next-themes"
import {
  DownloadIcon,
  FileSpreadsheetIcon,
  MonitorIcon,
  MoonIcon,
  PrinterIcon,
  RefreshCwIcon,
  SunIcon,
  UploadIcon,
} from "@animateicons/react/lucide"
import { useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import type { ProjectionResult } from "@/types"
import { toast } from "@/lib/hooks/use-toast"
import { useAnimatedIcon } from "@/components/ui/animated-icon"
import type { AnimatedIconComponent } from "@/components/ui/animated-icon"

interface SettingsPageProps {
  projection: ProjectionResult | null
}

function IconLabelButton({
  icon: Icon,
  iconSize = 16,
  iconClassName = "mr-2",
  ...props
}: ButtonProps & {
  icon: AnimatedIconComponent
  iconSize?: number
  iconClassName?: string
}) {
  const { iconProps, controlProps } = useAnimatedIcon()

  return (
    <Button {...controlProps} {...props}>
      <Icon {...iconProps} size={iconSize} className={iconClassName} data-icon="inline-start" />
      {props.children}
    </Button>
  )
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
              <IconLabelButton
                icon={SunIcon}
                iconSize={14}
                iconClassName="mr-1.5"
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
              >
                Light
              </IconLabelButton>
              <IconLabelButton
                icon={MoonIcon}
                iconSize={14}
                iconClassName="mr-1.5"
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
              >
                Dark
              </IconLabelButton>
              <IconLabelButton
                icon={MonitorIcon}
                iconSize={14}
                iconClassName="mr-1.5"
                variant={theme === "system" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("system")}
              >
                System
              </IconLabelButton>
            </div>
          </div>
      </PageCard>

      {/* Plan */}
      <PageCard label="Plan" contentClassName="space-y-2">
          <div className="flex flex-wrap gap-2">
            <IconLabelButton
              icon={PrinterIcon}
              variant="outline"
              size="sm"
              onClick={() => window.open("/print", "_blank")}
            >
              Print / Save PDF
            </IconLabelButton>
            <IconLabelButton
              icon={FileSpreadsheetIcon}
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={!projection}
            >
              Export CSV
            </IconLabelButton>
            <IconLabelButton
              icon={DownloadIcon}
              variant="outline"
              size="sm"
              onClick={handleExportPlan}
            >
              Export Plan
            </IconLabelButton>
            <IconLabelButton
              icon={UploadIcon}
              variant="outline"
              size="sm"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? "Importing…" : "Import Plan"}
            </IconLabelButton>
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
            <IconLabelButton
              icon={RefreshCwIcon}
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              Reset to Defaults
            </IconLabelButton>
          )}
      </PageCard>

      {/* Account (signed-in users only) */}
      {user && <AccountSettings user={user} />}
    </div>
  )
}
