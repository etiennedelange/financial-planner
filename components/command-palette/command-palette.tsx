"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"
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
  Search,
  Settings,
  Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CommandItem {
  id: string
  label: string
  subtext?: string
  group: "Navigate" | "Accounts"
  href: string
  icon: React.ElementType
}

const NAV_ITEMS: CommandItem[] = [
  { id: "nav-overview",     label: "Overview",     group: "Navigate", href: "/calculator/overview",     icon: LayoutDashboard },
  { id: "nav-accounts",     label: "Accounts",     group: "Navigate", href: "/calculator/accounts",     icon: Wallet },
  { id: "nav-plan",         label: "Plan",         group: "Navigate", href: "/calculator/plan",         icon: ListChecks },
  { id: "nav-expenses",     label: "Expenses",     group: "Navigate", href: "/calculator/expenses",     icon: DollarSign },
  { id: "nav-projections",  label: "Projections",  group: "Navigate", href: "/calculator/projections",  icon: BarChart2 },
  { id: "nav-charts",       label: "Charts",       group: "Navigate", href: "/calculator/charts",       icon: BarChart3 },
  { id: "nav-settings",     label: "Settings",     group: "Navigate", href: "/calculator/settings",     icon: Settings },
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
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const accounts = useCalculatorStore((s) => s.accounts)

  const accountItems: CommandItem[] = accounts.map((acc) => ({
    id: `account-${acc.id}`,
    label: acc.name,
    subtext: `${ACCOUNT_TYPE_LABELS[acc.type]}  ·  ${formatCurrency(acc.currentBalance)}`,
    group: "Accounts" as const,
    href: "/calculator/accounts",
    icon: ACCOUNT_ICON[acc.type] ?? Wallet,
  }))

  const allItems: CommandItem[] = [...NAV_ITEMS, ...accountItems]

  const filtered = query.trim()
    ? allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          (item.subtext ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : allItems

  const navFiltered  = filtered.filter((i) => i.group === "Navigate")
  const acctFiltered = filtered.filter((i) => i.group === "Accounts")

  // Reset the highlighted item to the top whenever the query changes. Done as a
  // guarded render-time adjustment (React's "adjust state when props change"
  // pattern) rather than in an effect, so the list and selection never render
  // one frame out of step.
  const [prevQuery, setPrevQuery] = useState(query)
  if (prevQuery !== query) {
    setPrevQuery(query)
    setSelectedIndex(0)
  }

  // When the palette opens, clear the previous query and reset selection. Same
  // render-time adjustment as above; the input focus still needs an effect.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setQuery("")
      setSelectedIndex(0)
    }
  }

  // Global Cmd+K / Ctrl+K listener
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

  // Auto-focus the input when opening
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open])

  const activate = useCallback(
    (item: CommandItem) => {
      setOpen(false)
      router.push(item.href)
    },
    [router]
  )

  function handleInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      activate(filtered[selectedIndex])
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[28%] z-50 w-full max-w-[520px] translate-x-[-50%] overflow-hidden",
            "rounded-xl border border-border bg-background shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>

          {/* Search input */}
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKey}
              placeholder="Search sections and accounts…"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-lg leading-none text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Results list */}
          <div className="max-h-[360px] overflow-y-auto py-1.5">
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No results for{" "}
                <span className="font-medium text-foreground">&quot;{query}&quot;</span>
              </p>
            ) : (
              <>
                <ResultGroup
                  label="Navigate"
                  items={navFiltered}
                  allFiltered={filtered}
                  selectedIndex={selectedIndex}
                  onActivate={activate}
                  onHover={setSelectedIndex}
                />
                <ResultGroup
                  label="Accounts"
                  items={acctFiltered}
                  allFiltered={filtered}
                  selectedIndex={selectedIndex}
                  onActivate={activate}
                  onHover={setSelectedIndex}
                />
              </>
            )}
          </div>

          {/* Keyboard hint strip */}
          <div className="flex items-center gap-3 border-t border-border px-4 py-2">
            <HintKey label="↑↓" description="navigate" />
            <HintKey label="↵"  description="open" />
            <HintKey label="esc" description="close" />
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  )
}

function ResultGroup({
  label,
  items,
  allFiltered,
  selectedIndex,
  onActivate,
  onHover,
}: {
  label: string
  items: CommandItem[]
  allFiltered: CommandItem[]
  selectedIndex: number
  onActivate: (item: CommandItem) => void
  onHover: (index: number) => void
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="px-4 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
        {label}
      </p>
      {items.map((item) => {
        const globalIdx = allFiltered.indexOf(item)
        const isSelected = globalIdx === selectedIndex
        const Icon = item.icon
        return (
          <button
            key={item.id}
            onClick={() => onActivate(item)}
            onMouseEnter={() => onHover(globalIdx)}
            className={cn(
              "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-75",
              isSelected
                ? "bg-accent text-accent-foreground"
                : "text-foreground/80 hover:bg-accent/40 hover:text-foreground"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors duration-75",
                isSelected ? "text-primary" : "text-muted-foreground"
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{item.label}</p>
              {item.subtext && (
                <p className="text-xs text-muted-foreground/70 truncate">{item.subtext}</p>
              )}
            </div>
            {isSelected && (
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground/50">↵</span>
            )}
          </button>
        )
      })}
    </div>
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
