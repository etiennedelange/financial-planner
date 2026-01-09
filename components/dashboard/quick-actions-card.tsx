"use client"

import { Plus, Eye, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface QuickActionsCardProps {
  onAddAccount?: () => void
  onViewInsights?: () => void
  onExportReport?: () => void
}

export function QuickActionsCard({
  onAddAccount,
  onViewInsights,
  onExportReport,
}: QuickActionsCardProps) {
  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {onAddAccount && (
          <Button
            onClick={onAddAccount}
            variant="outline"
            className="w-full justify-start"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        )}
        {onViewInsights && (
          <Button
            onClick={onViewInsights}
            variant="outline"
            className="w-full justify-start"
          >
            <Eye className="mr-2 h-4 w-4" />
            View Insights
          </Button>
        )}
        {onExportReport && (
          <Button
            onClick={onExportReport}
            variant="outline"
            className="w-full justify-start"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
