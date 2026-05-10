"use client"

import { Plus, Eye, Printer, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {onAddAccount && (
          <Button onClick={onAddAccount} variant="outline" className="w-full justify-start">
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        )}
        {onViewInsights && (
          <Button onClick={onViewInsights} variant="outline" className="w-full justify-start">
            <Eye className="mr-2 h-4 w-4" />
            View Insights
          </Button>
        )}
        {onPrintReport && (
          <Button onClick={onPrintReport} variant="outline" className="w-full justify-start">
            <Printer className="mr-2 h-4 w-4" />
            Print / Save PDF
          </Button>
        )}
        {onExportCsv && (
          <Button onClick={onExportCsv} variant="outline" className="w-full justify-start">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        )}

      </CardContent>
    </Card>
  )
}
