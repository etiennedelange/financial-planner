"use client"

import { ScenarioSwitcher } from "@/components/scenarios/scenario-switcher"
import { AuthModal } from "@/components/auth/auth-modal"
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
import { createClient } from "@/lib/supabase/client"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import type { User } from "@supabase/supabase-js"
import { LogOut, Search, Settings, TrendingDown, User as UserIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

const PAGE_TITLES: Record<string, string> = {
  overview: "Overview",
  accounts: "Accounts",
  plan: "Plan",
  expenses: "Expenses",
  projections: "Projections",
  charts: "Charts",
  settings: "Settings",
}

interface TopBarProps {
  user: User | null
}

export function TopBar({ user }: TopBarProps) {
  const pathname = usePathname()
  const section = pathname.split("/").pop() ?? ""
  const title = PAGE_TITLES[section] ?? ""
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const displayMode = useCalculatorStore((s) => s.displayMode)
  const setDisplayMode = useCalculatorStore((s) => s.setDisplayMode)

  const isSignedIn = user !== null

  async function handleSignOut() {
    await createClient().auth.signOut()
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-3 px-4 md:px-8">

      {/* Brand mark — mobile only (sidebar hidden on mobile) */}
      <div className="flex items-center gap-2 md:hidden shrink-0">
        <div className="h-6 w-6 rounded-sm bg-primary flex items-center justify-center">
          <span className="font-mono text-[8px] font-bold tracking-tight text-primary-foreground leading-none">SA</span>
        </div>
      </div>

      {/* Page title — the single H1 for the current section (content pages must not duplicate it) */}
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
        {/* Account — mobile only (the sidebar carries this on desktop) */}
        {isSignedIn ? (
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-full p-0"
                  aria-label="Account menu"
                  title={user.email ?? "Account"}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 border border-primary/25">
                    <UserIcon className="h-3 w-3 text-primary" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/calculator/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Manage Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setAuthModalOpen(true)}
            aria-label="Sign in to your account"
          >
            <UserIcon className="h-3.5 w-3.5" data-icon="inline-start" />
            <span>Sign in</span>
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="hidden md:flex h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          title="Open command palette (⌘K)"
        >
          <Search className="h-3.5 w-3.5" data-icon="inline-start" />
          <span className="font-mono text-[10px]">⌘K</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1.5">
              <TrendingDown className="h-3.5 w-3.5" data-icon="inline-start" />
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

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </header>
  )
}
