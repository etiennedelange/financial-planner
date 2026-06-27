"use client"

import { useState, useMemo } from "react"
import { Plus, ChevronDown, AlertTriangle, Pencil, MoreHorizontal, Database } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { AccountFormDialog } from "@/components/accounts/account-form-dialog"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { SEED_ACCOUNTS } from "@/lib/dev/seed-accounts"
import { formatCurrency } from "@/lib/utils/currency"
import { TFSA_LIMITS_CONFIG } from "@/lib/constants/tax-year.config"
import { cn } from "@/lib/utils"
import type { Account, AccountType } from "@/types"
import { useShallow } from "zustand/react/shallow"

// ─── Constants ─────────────────────────────────────────────────────────────────

const GROUP_ORDER: AccountType[] = [
  "retirement_annuity",
  "pension_fund",
  "preservation_fund",
  "tfsa",
  "discretionary",
]

const GROUP_LABELS: Record<AccountType, string> = {
  retirement_annuity: "Retirement Annuities",
  pension_fund: "Pension Funds",
  preservation_fund: "Preservation Funds",
  tfsa: "Tax-Free Savings",
  discretionary: "Discretionary",
}

const GROUP_LABELS_SHORT: Record<AccountType, string> = {
  retirement_annuity: "RA",
  pension_fund: "Pension",
  preservation_fund: "Preservation",
  tfsa: "TFSA",
  discretionary: "Disc.",
}

const TYPE_SHORT: Record<AccountType, string> = {
  retirement_annuity: "RA",
  pension_fund: "PF",
  preservation_fund: "Pres",
  tfsa: "TFSA",
  discretionary: "Disc",
}

const TYPE_COLOR: Record<AccountType, string> = {
  retirement_annuity: "#818cf8", // indigo-400
  pension_fund: "#60a5fa",       // blue-400
  preservation_fund: "#2dd4bf",  // teal-400
  tfsa: "#4ade80",               // green-400
  discretionary: "#fb923c",      // orange-400
}

function typeColor(type: AccountType): string {
  return TYPE_COLOR[type]
}

function typeBg(type: AccountType): string {
  return `${TYPE_COLOR[type]}26` // 15% opacity
}

// ─── Portfolio hero ─────────────────────────────────────────────────────────────
// Unboxed, floating — the numbers are the design.

interface AllocationSegment {
  type: AccountType
  pct: number
}

interface PortfolioHeroProps {
  totalBalance: number
  totalMonthly: number
  weightedNetReturn: number
  accountCount: number
  segments: AllocationSegment[]
  onAddClick: () => void
  onSeedClick: () => void
}

function PortfolioHero({
  totalBalance,
  totalMonthly,
  weightedNetReturn,
  accountCount,
  segments,
  onAddClick,
  onSeedClick,
}: PortfolioHeroProps) {
  const nonZero = segments.filter((s) => s.pct > 0.5)
  const showReturn = totalBalance > 0

  return (
    <div className="space-y-5 pb-2">
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onSeedClick}>
          <Database className="mr-1.5 h-3.5 w-3.5" />
          Seed
        </Button>
        <Button size="sm" onClick={onAddClick}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Account
        </Button>
      </div>

      {/* Hero balance — no container, raw typography */}
      <div>
        <p className="font-mono text-[2rem] sm:text-[2.75rem] font-semibold tabular-nums tracking-tight leading-none">
          {formatCurrency(totalBalance)}
        </p>
      </div>

      {/* Allocation bar — thick, prominent */}
      {nonZero.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex h-2 w-full overflow-hidden rounded-full gap-[2px]">
            {nonZero.map((seg) => (
              <div
                key={seg.type}
                className="transition-all duration-700"
                style={{ width: `${seg.pct}%`, backgroundColor: typeColor(seg.type) }}
              />
            ))}
          </div>
          {/* Legend + secondary stats */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {nonZero.map((seg) => (
                <span key={seg.type} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full flex-none"
                    style={{ backgroundColor: typeColor(seg.type) }}
                  />
                  {GROUP_LABELS_SHORT[seg.type]} {seg.pct.toFixed(0)}%
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[11px] text-muted-foreground">
                <span className="font-mono font-medium text-foreground tabular-nums">
                  {formatCurrency(totalMonthly)}
                </span>
                /mo
              </span>
              {showReturn && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {weightedNetReturn.toFixed(1)}%
                  </span>
                  net
                  <InfoTooltip
                    content="Balance-weighted average return across all accounts, after fees."
                    side="top"
                  />
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">
                <span className="font-mono font-medium text-foreground tabular-nums">{accountCount}</span> accounts
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="h-px bg-border" />
    </div>
  )
}

// ─── TFSA limit bars ────────────────────────────────────────────────────────────

function TfsaLimitBars({ account }: { account: Account }) {
  const contributed = account.tfsaContributionsToDate ?? 0
  const annualRate = account.monthlyContribution * 12
  const lifetimePct = Math.min(100, (contributed / TFSA_LIMITS_CONFIG.lifetimeLimit) * 100)
  const isLifetimeFull = contributed >= TFSA_LIMITS_CONFIG.lifetimeLimit
  const isAnnualOver = annualRate > TFSA_LIMITS_CONFIG.annualLimit

  return (
    <div className="space-y-3 pt-3 mt-3 border-t border-border/50">
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">TFSA Limits</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Lifetime contributed</span>
          <span className={cn("font-mono text-[11px] tabular-nums", isLifetimeFull ? "text-destructive" : "text-foreground")}>
            {formatCurrency(contributed)}
            <span className="text-muted-foreground"> / {formatCurrency(TFSA_LIMITS_CONFIG.lifetimeLimit)}</span>
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${lifetimePct}%`,
              backgroundColor: isLifetimeFull
                ? "hsl(var(--destructive))"
                : lifetimePct > 80
                ? "hsl(var(--warning))"
                : typeColor("tfsa"),
            }}
          />
        </div>
        {isLifetimeFull && (
          <p className="text-[11px] text-destructive">
            Lifetime limit reached — no further TFSA contributions permitted.
          </p>
        )}
      </div>
      <div className="flex items-start justify-between gap-4">
        <span className="text-[11px] text-muted-foreground">Annual rate</span>
        <span className={cn("font-mono text-[11px] tabular-nums text-right", isAnnualOver ? "text-destructive" : "text-muted-foreground")}>
          {formatCurrency(annualRate)}/yr
          {isAnnualOver && (
            <span className="block text-destructive">
              exceeds R{(TFSA_LIMITS_CONFIG.annualLimit / 1000).toFixed(0)}k limit
            </span>
          )}
        </span>
      </div>
    </div>
  )
}

// ─── Account card V3 ────────────────────────────────────────────────────────────
// Cards in a 2-column grid. Top color bar as type identity.
// Balance is the hero. Proportion bar shows portfolio weight.

interface AccountCardV3Props {
  account: Account
  portfolioPct: number
  onEdit: (account: Account) => void
  onDelete: (id: string) => void
}

function AccountCardV3({ account, portfolioPct, onEdit, onDelete }: AccountCardV3Props) {
  const [expanded, setExpanded] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const netReturn = account.expectedReturn - account.annualFees
  const color = typeColor(account.type)
  const bg = typeBg(account.type)

  const tfsaWarning = useMemo((): "lifetime" | "annual" | null => {
    if (account.type !== "tfsa") return null
    const contributed = account.tfsaContributionsToDate ?? 0
    if (contributed >= TFSA_LIMITS_CONFIG.lifetimeLimit) return "lifetime"
    if (account.monthlyContribution * 12 > TFSA_LIMITS_CONFIG.annualLimit) return "annual"
    return null
  }, [account])

  const toggle = () => setExpanded((v) => !v)

  return (
    <>
      <div
        className={cn(
          "rounded-xl border border-border bg-card overflow-hidden transition-shadow duration-200",
          expanded && "shadow-sm"
        )}
      >
        {/* Top color bar — type identity */}
        <div className="h-[3px] w-full" style={{ backgroundColor: color }} />

        {/* Card body — clickable */}
        <div
          className="group p-4 cursor-pointer select-none transition-colors hover:bg-accent/30"
          onClick={toggle}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              toggle()
            }
          }}
        >
          {/* Header: badge + name + actions + chevron */}
          <div className="flex items-start justify-between gap-2 mb-4">
            <div className="flex items-start gap-2 min-w-0">
              <span
                className="inline-flex items-center justify-center flex-none mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: bg, color }}
              >
                {TYPE_SHORT[account.type]}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight truncate">{account.name}</p>
                {account.provider && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{account.provider}</p>
                )}
              </div>
              {tfsaWarning && (
                <AlertTriangle
                  className={cn("h-3.5 w-3.5 flex-none mt-0.5", tfsaWarning === "lifetime" ? "text-destructive" : "text-warning")}
                  aria-label={tfsaWarning === "lifetime" ? "TFSA lifetime limit reached" : "TFSA annual limit exceeded"}
                />
              )}
            </div>
            <div className="flex items-center gap-0.5 flex-none">
              {/* Action buttons — appear on hover */}
              <div
                className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onEdit(account)}
                  aria-label="Edit account"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="More actions">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {/* Chevron — always visible, shows expand state */}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 flex-none",
                  expanded && "rotate-180"
                )}
                aria-hidden
              />
            </div>
          </div>

          {/* Balance — hero number */}
          <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight leading-none mb-4">
            {formatCurrency(account.currentBalance)}
          </p>

          {/* Proportion bar */}
          <div className="space-y-1.5">
            <div className="h-[3px] w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${portfolioPct}%`, backgroundColor: color }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground tabular-nums font-mono">
                {portfolioPct.toFixed(1)}%
              </span>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="font-mono tabular-nums">+{formatCurrency(account.monthlyContribution)}/mo</span>
                <span className="text-border">·</span>
                <span className="font-mono tabular-nums">{netReturn.toFixed(1)}% net</span>
              </div>
            </div>
          </div>

        </div>

        {/* Expanded detail panel */}
        {expanded && (
          <div className="border-t border-border/60 bg-muted/30 px-4 py-4 animate-in fade-in-0 duration-150">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-0.5">
                  Expected return
                </p>
                <p className="font-mono text-sm tabular-nums">{account.expectedReturn.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-0.5">
                  Annual fees
                </p>
                <p className="font-mono text-sm tabular-nums">{account.annualFees.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-0.5">
                  Net return
                </p>
                <p
                  className="font-mono text-sm tabular-nums"
                  style={{ color: netReturn >= 7 ? typeColor("tfsa") : undefined }}
                >
                  {netReturn.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-0.5">
                  Escalation
                </p>
                <p className="font-mono text-sm tabular-nums">
                  {account.contributionEscalation.toFixed(1)}%/yr
                </p>
              </div>
            </div>

            {account.type === "tfsa" && <TfsaLimitBars account={account} />}
          </div>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {account.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the account and its settings from all projections. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(account.id)}
              aria-label={`Delete account ${account.name}`}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Group section ───────────────────────────────────────────────────────────────
// Bold horizontal section header + 2-column card grid below.

interface GroupSectionV3Props {
  type: AccountType
  accounts: Account[]
  totalBalance: number
  onEdit: (account: Account) => void
  onDelete: (id: string) => void
}

function GroupSectionV3({ type, accounts, totalBalance, onEdit, onDelete }: GroupSectionV3Props) {
  const groupBalance = accounts.reduce((s, a) => s + a.currentBalance, 0)
  const groupPct = totalBalance > 0 ? (groupBalance / totalBalance) * 100 : 0
  const color = typeColor(type)

  return (
    <div className="space-y-3">
      {/* Section header — bold, horizontal */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-[14px] w-[3px] rounded-full flex-none" style={{ backgroundColor: color }} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
            {GROUP_LABELS[type]}
          </span>
          <span className="text-[11px] text-muted-foreground opacity-50">· {accounts.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {formatCurrency(groupBalance)}
          </span>
          {totalBalance > 0 && (
            <span
              className="text-[10px] font-medium font-mono tabular-nums rounded px-1.5 py-0.5"
              style={{ backgroundColor: typeBg(type), color }}
            >
              {groupPct.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* 2-column card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        {accounts.map((account) => (
          <AccountCardV3
            key={account.id}
            account={account}
            portfolioPct={totalBalance > 0 ? (account.currentBalance / totalBalance) * 100 : 0}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────────

function EmptyStateV3({ onAdd, onSeed }: { onAdd: () => void; onSeed: () => void }) {
  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
          Accounts
        </p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center gap-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">No accounts yet</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Add your Pension Fund, RA, TFSA, or Discretionary accounts. Each one feeds into your
            projections independently.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" onClick={onSeed}>
            <Database className="mr-2 h-4 w-4" />
            Seed Accounts
          </Button>
          <Button onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Account
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────────

export function AccountsPage() {
  const { accounts, addAccount, seedAccounts, updateAccount, removeAccount } = useCalculatorStore(
    useShallow((state) => ({
      accounts: state.accounts,
      addAccount: state.addAccount,
      seedAccounts: state.seedAccounts,
      updateAccount: state.updateAccount,
      removeAccount: state.removeAccount,
    }))
  )

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + a.currentBalance, 0), [accounts])
  const totalMonthly = useMemo(() => accounts.reduce((s, a) => s + a.monthlyContribution, 0), [accounts])

  const weightedNetReturn = useMemo(() => {
    if (totalBalance === 0) return 0
    return accounts.reduce((sum, a) => {
      const weight = a.currentBalance / totalBalance
      return sum + weight * (a.expectedReturn - a.annualFees)
    }, 0)
  }, [accounts, totalBalance])

  const allocationSegments = useMemo<AllocationSegment[]>(() => {
    if (totalBalance === 0) return []
    return GROUP_ORDER.flatMap((type) => {
      const typeBalance = accounts
        .filter((a) => a.type === type)
        .reduce((s, a) => s + a.currentBalance, 0)
      if (typeBalance === 0) return []
      return [{ type, pct: (typeBalance / totalBalance) * 100 }]
    })
  }, [accounts, totalBalance])

  const grouped = useMemo(
    () =>
      GROUP_ORDER.reduce<Partial<Record<AccountType, Account[]>>>((acc, type) => {
        const group = accounts.filter((a) => a.type === type)
        if (group.length > 0) acc[type] = group
        return acc
      }, {}),
    [accounts]
  )

  const handleAddClick = () => {
    setEditingAccount(null)
    setDialogOpen(true)
  }

  const handleEditClick = (account: Account) => {
    setEditingAccount(account)
    setDialogOpen(true)
  }

  const handleSubmit = (data: Omit<Account, "id">) => {
    if (editingAccount) {
      updateAccount(editingAccount.id, data)
    } else {
      addAccount({ ...data, id: crypto.randomUUID() })
    }
  }

  const handleSeedClick = () => {
    setEditingAccount(null)
    setDialogOpen(false)
    seedAccounts(SEED_ACCOUNTS)
  }

  if (!accounts.length) {
    return (
      <>
        <EmptyStateV3 onAdd={handleAddClick} onSeed={handleSeedClick} />
        <AccountFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          account={editingAccount}
          onSubmit={handleSubmit}
        />
      </>
    )
  }

  return (
    <div className="space-y-7">
      {/* Floating portfolio hero */}
      <PortfolioHero
        totalBalance={totalBalance}
        totalMonthly={totalMonthly}
        weightedNetReturn={weightedNetReturn}
        accountCount={accounts.length}
        segments={allocationSegments}
        onAddClick={handleAddClick}
        onSeedClick={handleSeedClick}
      />

      {/* Type-grouped card grids */}
      <div className="space-y-7">
        {GROUP_ORDER.filter((type) => grouped[type]).map((type) => (
          <GroupSectionV3
            key={type}
            type={type}
            accounts={grouped[type]!}
            totalBalance={totalBalance}
            onEdit={handleEditClick}
            onDelete={removeAccount}
          />
        ))}
      </div>

      {/* Ghost add card */}
      <button
        onClick={handleAddClick}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <Plus className="h-3.5 w-3.5" />
        Add another account
      </button>

      <AccountFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editingAccount}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
