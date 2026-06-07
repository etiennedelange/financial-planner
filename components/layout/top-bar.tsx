"use client"

import { ColorThemeToggle } from "@/components/color-theme-toggle"
import { ScenarioSwitcher } from "@/components/scenarios/scenario-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { User } from "@supabase/supabase-js"
import { TrendingDown } from "lucide-react"
import type { NavPage } from "./sidebar"

const PAGE_TITLES: Record<NavPage, string> = {
  overview: "Overview",
  accounts: "Accounts",
  plan: "Plan",
  expenses: "Expenses",
  projections: "Projections",
  settings: "Settings",
}

interface TopBarProps {
  activePage: NavPage
  user: User | null
  displayMode: "nominal" | "real"
  onSetDisplayMode: (mode: "nominal" | "real") => void
}

export function TopBar({ activePage, user, displayMode, onSetDisplayMode }: TopBarProps) {
  const isSignedIn = user && !user.is_anonymous

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-4 px-8">
      {/* Page title */}
      <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {PAGE_TITLES[activePage]}
      </span>

      {/* Scenario switcher */}
      <div className="flex-1 flex justify-center">
        {isSignedIn && <ScenarioSwitcher />}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
              <TrendingDown className="h-3.5 w-3.5" />
              {displayMode === "real" ? "Today's Value" : "Future Value"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Display Values As</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onSetDisplayMode("nominal")}
              className="flex flex-col items-start gap-1 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${displayMode === "nominal" ? "bg-primary" : "bg-muted"}`} />
                <span className="font-medium">Future Value (Nominal)</span>
              </div>
              <span className="text-xs text-muted-foreground pl-4">
                Show values in future Rands. R1M at retirement will actually be R1M then.
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSetDisplayMode("real")}
              className="flex flex-col items-start gap-1 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${displayMode === "real" ? "bg-primary" : "bg-muted"}`} />
                <span className="font-medium">Today&apos;s Value (Real)</span>
              </div>
              <span className="text-xs text-muted-foreground pl-4">
                Adjust all values to today&apos;s purchasing power. Easier to understand long-term values.
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              This affects how monetary values are displayed across all tabs.
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />
        <ColorThemeToggle />
      </div>
      </div>
    </header>
  )
}
