"use client"

import { EyeIcon, FileSpreadsheetIcon, PlusIcon, PrinterIcon } from "@animateicons/react/lucide"
import { Button } from "@/components/ui/button"
import { PageCard } from "@/components/ui/page-card"
import { useAnimatedIcon } from "@/components/ui/animated-icon"

interface QuickActionsCardProps {
  onAddAccount?: () => void
  onViewInsights?: () => void
  onPrintReport?: () => void
  onExportCsv?: () => void
}

export function QuickActionsCard({
  onAddAccount,
  onViewInsights,
  onPrintReport,
  onExportCsv,
}: QuickActionsCardProps) {
  return (
    <PageCard label="Quick Actions" className="dashboard-card" contentClassName="space-y-2">
        {onAddAccount && (
          <ActionButton label="Add Account" icon={PlusIcon} onClick={onAddAccount} />
        )}
        {onViewInsights && (
          <ActionButton label="View Insights" icon={EyeIcon} onClick={onViewInsights} />
        )}
        {onPrintReport && (
          <ActionButton label="Print / Save PDF" icon={PrinterIcon} onClick={onPrintReport} />
        )}
        {onExportCsv && (
          <ActionButton label="Export CSV" icon={FileSpreadsheetIcon} onClick={onExportCsv} />
        )}

    </PageCard>
  )
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string
  icon: typeof PlusIcon
  onClick: () => void
}) {
  const { iconProps, controlProps } = useAnimatedIcon()

  return (
    <Button {...controlProps} onClick={onClick} variant="outline" className="w-full justify-start">
      <Icon {...iconProps} size={16} className="mr-2 shrink-0" data-icon="inline-start" />
      {label}
    </Button>
  )
}