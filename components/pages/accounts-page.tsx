"use client"

import { useState, useMemo, useTransition } from "react"
import { Plus, ChevronDown, AlertTriangle, Pencil, Trash2, Database, Wallet } from "lucide-react"
import { m } from "motion/react"
import { FloatingActionBar } from "@/components/ui/floating-action-bar"
import { PageCard } from "@/components/ui/page-card"
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
import { toast } from "@/lib/hooks/use-toast"

// ─── Animated numeric display with spring physics ─────────────────────────────

function AnimatedNumber({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

  return (
    <m.span
      className={className}
      animate={{ opacity: 1 }}
      initial={{ opacity: 0.5 }}
      transition={
        prefersReducedMotion
          ? { duration: 0.05 }
          : {
              type: "spring",
              stiffness: 20,
              damping: 10,
              mass: 0.1,
            }
      }
      key={value}
    >
      {value.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}
    </m.span>
  )
}

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

// Type colors: used only in the small type badge chip and the allocation bar (data encoding).
const TYPE_COLOR: Record<AccountType, string> = {
  retirement_annuity: "#818cf8",
  pension_fund: "#60a5fa",
  preservation_fund: "#2dd4bf",
  tfsa: "#4ade80",
  discretionary: "#fb923c",
}

function typeColor(type: AccountType): string {
  return TYPE_COLOR[type]
}

function typeBg(type: AccountType): string {
  return `${TYPE_COLOR[type]}22`
}

// ─── Portfolio summary card ─────────────────────────────────────────────────────

interface AllocationSegment {
  type: AccountType
  pct: number
}

interface PortfolioSummaryCardProps {
  totalBalance: number
  totalMonthly: number
  weightedNetReturn: number
  accountCount: number
  segments: AllocationSegment[]
  onAddClick: () => void
  onSeedClick: () => void
}

function PortfolioSummaryCard({
  totalBalance,
  totalMonthly,
  weightedNetReturn,
  accountCount,
  segments,
  onAddClick,
  onSeedClick,
}: PortfolioSummaryCardProps) {
  const nonZero = segments.filter((s) => s.pct > 0.5)
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

  return (
    <PageCard
      label="Portfolio"
      leading={<Wallet className="h-3.5 w-3.5 text-muted-foreground" />}
      trailing={
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={onSeedClick}
            className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground"
          >
            <Database className="h-3 w-3" />
            Seed
          </Button>
          <Button size="sm" onClick={onAddClick} className="h-7 gap-1.5 px-2.5 text-xs">
            <Plus className="h-3 w-3" />
            Add Account
          </Button>
        </div>
      }
      contentClassName="pt-5"
    >
      <div className="mt-3 space-y-3">
        <m.p
          className="font-mono text-2xl font-semibold tabular-nums tracking-tight leading-none"
          layout={!prefersReducedMotion}
        >
          {formatCurrency(totalBalance)}
        </m.p>

        {nonZero.length > 0 && (
          <m.div
            className="space-y-2"
            layout={!prefersReducedMotion}
          >
            {/* Allocation bar — morphs smoothly with spring physics */}
            <m.div
              className="flex h-1.5 w-full overflow-hidden rounded-full gap-[2px]"
              layout={!prefersReducedMotion}
            >
              {nonZero.map((seg) => (
                <m.div
                  key={seg.type}
                  layoutId={`segment-${seg.type}`}
                  animate={{ width: `${seg.pct}%` }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0.2 }
                      : {
                          type: "spring",
                          stiffness: 25,
                          damping: 15,
                          mass: 1,
                        }
                  }
                  style={{ backgroundColor: typeColor(seg.type) }}
                />
              ))}
            </m.div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {nonZero.map((seg) => (
                  <m.span
                    key={seg.type}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                    layout={!prefersReducedMotion}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full flex-none"
                      style={{ backgroundColor: typeColor(seg.type) }}
                    />
                    {GROUP_LABELS_SHORT[seg.type]} {seg.pct.toFixed(0)}%
                  </m.span>
                ))}
              </div>
              <m.div
                className="flex flex-wrap items-center gap-x-3 gap-y-1"
                layout={!prefersReducedMotion}
              >
                <span className="text-[11px] text-muted-foreground">
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {formatCurrency(totalMonthly)}
                  </span>
                  /mo
                </span>
                {totalBalance > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {weightedNetReturn.toFixed(1)}%
                    </span>{" "}
                    net
                    <InfoTooltip
                      content="Balance-weighted average return across all accounts, after fees."
                      side="top"
                    />
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {accountCount}
                  </span>{" "}
                  {accountCount === 1 ? "account" : "accounts"}
                </span>
              </m.div>
            </div>
          </m.div>
        )}
      </div>
    </PageCard>
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
    <div className="space-y-2.5 pt-3 mt-3 border-t border-border/50">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        TFSA Limits
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Lifetime contributed</span>
          <span
            className={cn(
              "font-mono text-[11px] tabular-nums",
              isLifetimeFull ? "text-destructive" : "text-foreground"
            )}
          >
            {formatCurrency(contributed)}
            <span className="text-muted-foreground">
              {" "}/ {formatCurrency(TFSA_LIMITS_CONFIG.lifetimeLimit)}
            </span>
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
        <span
          className={cn(
            "font-mono text-[11px] tabular-nums text-right",
            isAnnualOver ? "text-destructive" : "text-muted-foreground"
          )}
        >
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

// ─── Account row ────────────────────────────────────────────────────────────────

interface AccountRowProps {
  account: Account
  onEdit: (account: Account) => void
  onDelete: (id: string) => void
}

function AccountRow({ account, onEdit, onDelete }: AccountRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [, startTransition] = useTransition()

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

  const toggle = () => {
    // Use View Transitions API if available; falls back to instant state change
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        startTransition(() => {
          setExpanded((v) => !v)
        })
      })
    } else {
      startTransition(() => {
        setExpanded((v) => !v)
      })
    }
  }

  return (
    <>
      <div>
        {/* Main row — morphs background smoothly */}
        <m.div
          className="group flex items-center gap-3 px-6 py-3 cursor-pointer select-none"
          animate={{
            backgroundColor: expanded ? "hsl(var(--muted) / 0.5)" : "transparent",
          }}
          transition={{
            duration: 0.2,
            ease: "easeInOut",
          }}
          onMouseEnter={(e) => {
            if (!expanded) {
              e.currentTarget.style.backgroundColor = "hsl(var(--accent) / 0.3)"
            }
          }}
          onMouseLeave={(e) => {
            if (!expanded) {
              e.currentTarget.style.backgroundColor = "transparent"
            }
          }}
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
          {/* Type badge — only constrained use of type color */}
          <span
            className="inline-flex items-center justify-center flex-none rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: bg, color }}
          >
            {TYPE_SHORT[account.type]}
          </span>

          {/* Name + provider */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-sm font-medium leading-tight truncate">{account.name}</p>
              {tfsaWarning && (
                <AlertTriangle
                  className={cn(
                    "h-3 w-3 flex-none",
                    tfsaWarning === "lifetime" ? "text-destructive" : "text-warning"
                  )}
                  aria-label={
                    tfsaWarning === "lifetime"
                      ? "TFSA lifetime limit reached"
                      : "TFSA annual limit exceeded"
                  }
                />
              )}
            </div>
            {account.provider && (
              <p className="text-xs text-muted-foreground truncate">{account.provider}</p>
            )}
          </div>

          {/* Secondary stats — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-3 flex-none">
            <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
              +{formatCurrency(account.monthlyContribution)}/mo
            </span>
            <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
              {netReturn.toFixed(1)}% net
            </span>
          </div>

          {/* Balance */}
          <p className="font-mono text-sm font-semibold tabular-nums tracking-tight shrink-0">
            {formatCurrency(account.currentBalance)}
          </p>

          {/* Actions + chevron */}
          <div className="flex items-center gap-0.5 flex-none">
            <div
              className="flex items-center gap-0.5 opacity-100 md:opacity-40 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity"
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
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                aria-label="Delete account"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 flex-none",
                expanded && "rotate-180"
              )}
              aria-hidden
            />
          </div>
        </m.div>

        {/* Expanded detail panel — smooth morphing with motion library */}
        <m.div
          className={cn(
            "grid overflow-hidden",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
          animate={{
            gridTemplateRows: expanded ? "1fr" : "0fr",
          }}
          transition={{
            duration: 0.2,
            ease: "easeInOut",
          }}
          aria-hidden={expanded ? undefined : true}
        >
          <div className="min-h-0">
            <m.div
              className={cn(
                "px-6 pb-4 bg-muted/50 border-t border-border/40"
              )}
              animate={{
                opacity: expanded ? 1 : 0,
              }}
              transition={{
                duration: 0.15,
                delay: expanded ? 0.05 : 0,
              }}
            >
              <div className="pt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Expected return
                  </p>
                  <p className="font-mono text-sm tabular-nums">{account.expectedReturn.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Annual fees
                  </p>
                  <p className="font-mono text-sm tabular-nums">{account.annualFees.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Net return
                  </p>
                  <p className="font-mono text-sm tabular-nums">{netReturn.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Escalation
                  </p>
                  <p className="font-mono text-sm tabular-nums">
                    {account.contributionEscalation.toFixed(1)}%/yr
                  </p>
                </div>
              </div>
              {account.type === "tfsa" && <TfsaLimitBars account={account} />}
            </m.div>
          </div>
        </m.div>
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
              onClick={() => {
                onDelete(account.id)
                toast({ title: "Account deleted" })
              }}
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

// ─── Account group card ──────────────────────────────────────────────────────────

interface AccountGroupCardProps {
  type: AccountType
  accounts: Account[]
  totalBalance: number
  onEdit: (account: Account) => void
  onDelete: (id: string) => void
}

function AccountGroupCard({ type, accounts, totalBalance, onEdit, onDelete }: AccountGroupCardProps) {
  const groupBalance = accounts.reduce((s, a) => s + a.currentBalance, 0)
  const groupPct = totalBalance > 0 ? (groupBalance / totalBalance) * 100 : 0
  const color = typeColor(type)
  const bg = typeBg(type)

  return (
    <PageCard
      label={GROUP_LABELS[type]}
      trailing={
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {formatCurrency(groupBalance)}
          </span>
          {totalBalance > 0 && (
            <span
              className="text-[10px] font-medium font-mono tabular-nums rounded px-1.5 py-0.5"
              style={{ backgroundColor: bg, color }}
            >
              {groupPct.toFixed(0)}%
            </span>
          )}
        </div>
      }
      noContentPadX
      contentClassName="pt-5"
    >
      <div className="mt-2 divide-y divide-border/40">
        {accounts.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </PageCard>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────────

function EmptyState({ onAdd, onSeed }: { onAdd: () => void; onSeed: () => void }) {
  return (
    <div className="pt-4">
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center gap-4">
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

  const totalBalance = useMemo(
    () => accounts.reduce((s, a) => s + a.currentBalance, 0),
    [accounts]
  )
  const totalMonthly = useMemo(
    () => accounts.reduce((s, a) => s + a.monthlyContribution, 0),
    [accounts]
  )
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
      toast({ title: "Account updated" })
    } else {
      addAccount({ ...data, id: crypto.randomUUID() })
      toast({ title: "Account added" })
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
        <EmptyState onAdd={handleAddClick} onSeed={handleSeedClick} />
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
    <>
      <div className="space-y-4 pb-4 md:pb-16">
        <PortfolioSummaryCard
          totalBalance={totalBalance}
          totalMonthly={totalMonthly}
          weightedNetReturn={weightedNetReturn}
          accountCount={accounts.length}
          segments={allocationSegments}
          onAddClick={handleAddClick}
          onSeedClick={handleSeedClick}
        />

        {GROUP_ORDER.filter((type) => grouped[type]).map((type) => (
          <AccountGroupCard
            key={type}
            type={type}
            accounts={grouped[type]!}
            totalBalance={totalBalance}
            onEdit={handleEditClick}
            onDelete={removeAccount}
          />
        ))}

        <AccountFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          account={editingAccount}
          onSubmit={handleSubmit}
        />
      </div>

      <FloatingActionBar
        primary={{
          label: "Add Account",
          icon: <Plus className="h-3.5 w-3.5" />,
          onClick: handleAddClick,
        }}
        secondary={{
          label: "Seed",
          icon: <Database className="h-3.5 w-3.5" />,
          onClick: handleSeedClick,
          variant: "outline",
        }}
        hint="Add your RA, TFSA, Pension, or Discretionary account"
      />
    </>
  )
}
