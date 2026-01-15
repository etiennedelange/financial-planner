"use client"

import { Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface InfoTooltipProps {
  content: string | React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  className?: string
}

/**
 * Reusable info icon with tooltip
 * Shows helpful information when hovering over the info icon
 */
export function InfoTooltip({ content, side = "top", className }: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info
            className={`inline-block h-4 w-4 text-muted-foreground hover:text-foreground cursor-help transition-colors ${className || ''}`}
            aria-label="More information"
          />
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
