"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface ChartDataColumn<K extends string> {
  key: K
  label: string
  /** Optional formatter for cell values. Defaults to String(). */
  format?: (value: number | string) => string
  /** Right-align numeric columns so decimals line up. */
  align?: "left" | "right"
}

interface ChartDataTableProps<K extends string> {
  columns: ChartDataColumn<K>[]
  rows: Array<Record<K, number | string>>
  caption: string
  defaultOpen?: boolean
}

/**
 * Collapsible data table for charts.
 *
 * Recharts' SVG has an accessibility layer (focus + arrow keys + live region),
 * but the Phase 9.3 audit flagged that no *visible* data table exists. This is
 * that table: a quiet, closed-by-default <details>-style disclosure under the
 * chart so keyboard and screen-reader users get exact values without the table
 * dominating the visual.
 */
export function ChartDataTable<K extends string>({
  columns,
  rows,
  caption,
  defaultOpen = false,
}: ChartDataTableProps<K>) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="px-2 pb-2 md:px-6 md:pb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      >
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform duration-150", open && "rotate-180")}
          aria-hidden="true"
        />
        {open ? "Hide data table" : "Show data table"}
      </button>

      {open && (
        <div className="mt-2 rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn("h-8 px-3 text-xs font-medium", col.align === "right" && "text-right")}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        "px-3 py-1.5 text-xs tabular-nums",
                        col.align === "right" ? "text-right font-mono" : "text-muted-foreground"
                      )}
                    >
                      {col.format ? col.format(row[col.key]) : String(row[col.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground/70">
            {caption}
          </p>
        </div>
      )}
    </div>
  )
}
