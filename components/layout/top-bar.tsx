"use client"

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
import { useCalculatorStore } from "@/lib/store/calculator-store"
import type { User } from "@supabase/supabase-js"
import { Search, TrendingDown } from "lucide-react"
import { usePathname } from "next/navigation"

const PAGE_TITLES: Record<string, string> = {
  overview: "Overview",
  accounts: "Accounts",
  plan: "Plan",
  expenses: "Expenses",
  projections: "Projections",
  settings: "Settings",
}

interface TopBarProps {
  user: User | null
}

export function TopBar({ user }: TopBarProps) {
  const pathname = usePathname()
  const section = pathname.split("/").pop() ?? ""
  const title = PAGE_TITLES[section] ?? ""

  const displayMode = useCalculatorStore((s) => s.displayMode)
  const setDisplayMode = useCalculatorStore((s) => s.setDisplayMode)

  const isSignedIn = user && !user.is_anonymous

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-3 px-4 md:px-8">

      {/* Brand mark — mobile only (sidebar hidden on mobile) */}
      <div className="flex items-center gap-2 md:hidden shrink-0">
        <div className="h-6 w-6 rounded-sm bg-primary flex items-center justify-center">
          <span className="font-mono text-[8px] font-bold tracking-tight text-primary-foreground leading-none">SA</span>
        </div>
      </div>

      {/* Page title */}
      <h1 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h1>

      {/* Scenario switcher — desktop only */}
      <div className="flex-1 hidden md:flex justify-center">
        {isSignedIn && <ScenarioSwitcher />}
      </div>

      {/* Spacer on mobile */}
      <div className="flex-1 md:hidden" />

      {/* Right controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="hidden md:flex h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          title="Open command palette (⌘K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="font-mono text-[10px]">⌘K</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1.5">
              <TrendingDown className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{displayMode === "real" ? "Today's Value" : "Future Value"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Display Values As</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDisplayMode("nominal")}
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
              onClick={() => setDisplayMode("real")}
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
      </div>
      </div>
    </header>
  )
}
