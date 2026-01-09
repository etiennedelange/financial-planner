"use client"

import { LucideIcon, ChevronDown } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"

interface CollapsibleSectionProps {
  id: string
  title: string
  icon: LucideIcon
  defaultOpen?: boolean
  badge?: string | number
  children: React.ReactNode
}

export function CollapsibleSection({
  id,
  title,
  icon: Icon,
  defaultOpen = false,
  badge,
  children,
}: CollapsibleSectionProps) {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? id : undefined}
      className="dashboard-section border-b border-border"
    >
      <AccordionItem value={id} className="border-0">
        <AccordionTrigger className="hover:bg-muted/50 px-4 py-4 rounded-lg transition-colors">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <h2 className="dashboard-section-title mb-0 text-lg md:text-xl font-semibold">
              {title}
            </h2>
            {badge && (
              <Badge variant="secondary" className="ml-2">
                {badge}
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 py-6">
          {children}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
