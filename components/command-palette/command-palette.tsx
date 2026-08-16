"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { ACCOUNT_TYPE_LABELS } from "@/types"
import type { AccountType } from "@/types"
import { formatCurrency } from "@/lib/utils/currency"
import {
  BarChart2,
  BarChart3,
  DollarSign,
  LayoutDashboard,
  ListChecks,
  PiggyBank,
  Settings,
  Wallet,
} from "lucide-react"

interface CommandItemDef {
  id: string
  label: string
  subtext?: string
  href: string
  icon: React.ElementType
}

const NAV_ITEMS: CommandItemDef[] = [
  { id: "nav-overview",     label: "Overview",     href: "/calculator/overview",     icon: LayoutDashboard },
  { id: "nav-accounts",     label: "Accounts",     href: "/calculator/accounts",     icon: Wallet },
  { id: "nav-plan",         label: "Plan",         href: "/calculator/plan",         icon: ListChecks },
  { id: "nav-expenses",     label: "Expenses",     href: "/calculator/expenses",     icon: DollarSign },
  { id: "nav-projections",  label: "Projections",  href: "/calculator/projections",  icon: BarChart2 },
  { id: "nav-charts",       label: "Charts",       href: "/calculator/charts",       icon: BarChart3 },
  { id: "nav-settings",     label: "Settings",     href: "/calculator/settings",     icon: Settings },
]

const ACCOUNT_ICON: Record<AccountType, React.ElementType> = {
  pension_fund:          Wallet,
  retirement_annuity:    Wallet,
  preservation_fund:     Wallet,
  tfsa:                  PiggyBank,
  discretionary:         BarChart2,
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const accounts = useCalculatorStore((s) => s.accounts)

  const accountItems: CommandItemDef[] = accounts.map((acc) => ({
    id: `account-${acc.id}`,
    label: acc.name,
    subtext: `${ACCOUNT_TYPE_LABELS[acc.type]}  ·  ${formatCurrency(acc.currentBalance)}`,
    href: "/calculator/accounts",
    icon: ACCOUNT_ICON[acc.type] ?? Wallet,
  }))

  // Global Cmd+K / Ctrl+K listener. cmdk's CommandDialog owns focus and
  // keyboard navigation once open — this listener only opens and closes it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Custom event from TopBar search button
  useEffect(() => {
    function onOpen() { setOpen(true) }
    window.addEventListener("open-command-palette", onOpen)
    return () => window.removeEventListener("open-command-palette", onOpen)
  }, [])

  const navigate = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette">
      <CommandInput
        placeholder="Search sections and accounts…"
        aria-label="Search sections and accounts"
        autoComplete="off"
      />
      <CommandList>
        <CommandEmpty>No results found</CommandEmpty>
        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.id}
                value={item.id}
                onSelect={() => navigate(item.href)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
        {accountItems.length > 0 && (
          <CommandGroup heading="Accounts">
            {accountItems.map((item) => {
              const Icon = item.icon
              return (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => navigate(item.href)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{item.label}</span>
                    {item.subtext && (
                      <span className="truncate text-xs text-muted-foreground/70">
                        {item.subtext}
                      </span>
                    )}
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>

      {/* Keyboard hint strip */}
      <div className="flex items-center gap-3 border-t border-border px-4 py-2">
        <HintKey label="↑↓" description="navigate" />
        <HintKey label="↵" description="open" />
        <HintKey label="esc" description="close" />
        <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/50">
          <kbd className="rounded border border-border/60 bg-muted/50 px-1 py-0.5 font-mono text-[10px] leading-tight">
            ⌘K
          </kbd>
          toggle
        </span>
      </div>
    </CommandDialog>
  )
}

function HintKey({ label, description }: { label: string; description: string }) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
      <kbd className="rounded border border-border/60 bg-muted/50 px-1 py-0.5 font-mono text-[10px] leading-tight">
        {label}
      </kbd>
      {description}
    </span>
  )
}
