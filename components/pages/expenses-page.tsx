"use client"

import { useEffect, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { Check, ChevronDown, ChevronRight, Circle, CircleCheck, FolderPlus, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageCard } from "@/components/ui/page-card"
import { Input } from "@/components/ui/input"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useExpensesStore } from "@/lib/store/expenses-store"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { formatCurrency } from "@/lib/utils/currency"
import { GROUP_COLOR_OPTIONS, type Expense, type ExpenseGroup } from "@/types/expenses"
import { cn } from "@/lib/utils"

// ─── inline edit row ──────────────────────────────────────────────────────────

function EditRow({
  expense,
  onSave,
  onCancel,
  onDelete,
}: {
  expense: Expense
  onSave: (name: string, amount: number) => void
  onCancel: () => void
  onDelete: () => void
}) {
  const [name, setName] = useState(expense.name)
  const [amount, setAmount] = useState(String(expense.amount))

  const commit = () => {
    const parsed = parseFloat(amount.replace(/\s/g, ""))
    onSave(name.trim() || expense.name, isNaN(parsed) ? expense.amount : parsed)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit()
    if (e.key === "Escape") onCancel()
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/60 rounded-sm border border-border">
      <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey}
        className="h-7 text-sm flex-1 min-w-0" autoFocus />
      <Input value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={onKey}
        className="h-7 text-sm w-28 text-right font-mono" placeholder="0" />
      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={commit} aria-label="Save expense">
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel} aria-label="Cancel edit">
        <X className="h-3.5 w-3.5" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label="Delete expense">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{expense.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This expense will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── add expense row ──────────────────────────────────────────────────────────

function AddExpenseRow({
  onSave,
  onCancel,
}: {
  onSave: (name: string, amount: number) => void
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")

  const commit = () => {
    if (!name.trim()) { onCancel(); return }
    const parsed = parseFloat(amount.replace(/\s/g, ""))
    onSave(name.trim(), isNaN(parsed) ? 0 : parsed)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit()
    if (e.key === "Escape") onCancel()
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 rounded-sm border border-primary/25">
      <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey}
        className="h-7 text-sm flex-1 min-w-0" placeholder="Expense name" autoFocus />
      <Input value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={onKey}
        className="h-7 text-sm w-28 text-right font-mono" placeholder="0" />
      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={commit} aria-label="Save expense">
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel} aria-label="Cancel">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ─── add group row ────────────────────────────────────────────────────────────

function AddGroupRow({ onSave, onCancel }: { onSave: (name: string, color: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("")
  const [color, setColor] = useState<string>("#818cf8") // indigo-400

  const commit = () => {
    if (!name.trim()) { onCancel(); return }
    onSave(name.trim(), color)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-sm border border-primary/25">
      <Input value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") onCancel() }}
        className="h-7 text-sm flex-1" placeholder="Group name" autoFocus />
      <div className="flex gap-1 flex-wrap">
        {GROUP_COLOR_OPTIONS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={`Select color ${c}`}
            aria-pressed={color === c}
            className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1", color === c ? "ring-2 ring-foreground ring-offset-1" : "hover:ring-1 hover:ring-muted-foreground/30")}
          >
            <span className={cn("w-4 h-4 rounded-full transition-transform", color === c ? "scale-110" : "")} style={{ background: c }} />
          </button>
        ))}
      </div>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={commit} aria-label="Save group">
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel} aria-label="Cancel">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ─── empty state ──────────────────────────────────────────────────────────────

function EmptyGroups({ onAdd, onLoadSample }: { onAdd: () => void; onLoadSample: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <FolderPlus className="h-10 w-10 text-muted-foreground/40" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">No expense groups yet</p>
        <p className="text-xs text-muted-foreground/70">Group your expenses to track what you spend in retirement vs. today.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Create first group
        </Button>
        <Button variant="ghost" size="sm" onClick={onLoadSample}>
          Load sample data
        </Button>
      </div>
    </div>
  )
}

// ─── expense group section ────────────────────────────────────────────────────

function GroupSection({
  group,
  expenses,
  editingId,
  addingToGroupId,
  onEdit,
  onUpdate,
  onRemoveExpense,
  onToggleRetirement,
  onAddExpense,
  onSetAdding,
  onRemoveGroup,
}: {
  group: ExpenseGroup
  expenses: Expense[]
  editingId: string | null
  addingToGroupId: string | null
  onEdit: (id: string | null) => void
  onUpdate: (id: string, name: string, amount: number) => void
  onRemoveExpense: (id: string) => void
  onToggleRetirement: (id: string) => void
  onAddExpense: (groupId: string, name: string, amount: number) => void
  onSetAdding: (groupId: string | null) => void
  onRemoveGroup: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [flashId, setFlashId] = useState<string | null>(null)
  const prevExpenseLengthRef = useRef(expenses.length)
  const groupTotal = expenses.reduce((s, e) => s + e.amount, 0)

  useEffect(() => {
    if (!flashId) return
    const t = setTimeout(() => setFlashId(null), 500)
    return () => clearTimeout(t)
  }, [flashId])

  // Flash the newly added expense row
  useEffect(() => {
    const prev = prevExpenseLengthRef.current
    prevExpenseLengthRef.current = expenses.length
    if (expenses.length > prev) {
      const last = expenses[expenses.length - 1]
      if (last) setFlashId(last.id)
    }
  }, [expenses])

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {/* Top color bar — group identity */}
      <div className="h-[3px] w-full" style={{ backgroundColor: group.color }} />
      {/* Group header */}
      <div className="group/header flex items-center bg-muted/30 hover:bg-muted/50 transition-colors">
        <button
          className="flex flex-1 items-center gap-2.5 px-3 py-2.5 text-left min-w-0"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: group.color }} />
          <span className="flex-1 text-sm font-semibold truncate">{group.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums font-mono shrink-0">{formatCurrency(groupTotal)}</span>
          {collapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 mr-2 shrink-0 opacity-0 group-hover/header:opacity-60 hover:!opacity-100 focus:opacity-60 transition-opacity"
              aria-label={`Delete group ${group.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &ldquo;{group.name}&rdquo;?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the group and all {expenses.length} expense{expenses.length !== 1 ? "s" : ""} inside it. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onRemoveGroup(group.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete group
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Group body */}
      {!collapsed && (
        <div className="divide-y divide-border/50">
          {/* Column header — only when there are expenses */}
          {expenses.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-muted/10">
              <span className="flex-1 text-xs text-muted-foreground">Item</span>
              <div className="shrink-0 flex items-center gap-0.5">
                <span className="text-xs text-muted-foreground">Retirement</span>
                <InfoTooltip content="Mark expenses you'll have in retirement. These count toward your 4% Rule target." side="top" />
              </div>
              <span className="min-w-[5rem] text-right text-xs text-muted-foreground">Monthly</span>
              <span className="w-3 shrink-0" />
            </div>
          )}

          {expenses.map((expense) =>
            editingId === expense.id ? (
              <div key={expense.id} className="px-2 py-1">
                <EditRow
                  expense={expense}
                  onSave={(name, amount) => {
                    onUpdate(expense.id, name, amount)
                    onEdit(null)
                    setFlashId(expense.id)
                  }}
                  onCancel={() => onEdit(null)}
                  onDelete={() => { onRemoveExpense(expense.id); onEdit(null) }}
                />
              </div>
            ) : (
              <div
                key={expense.id}
                className={cn(
                  "group/row flex items-center gap-2 px-3 py-2 hover:bg-muted/20 transition-colors motion-safe:duration-500 motion-reduce:duration-0",
                  flashId === expense.id && "bg-primary/10"
                )}
              >
                <span className="flex-1 text-sm truncate">{expense.name}</span>
                <button
                  onClick={() => onToggleRetirement(expense.id)}
                  aria-label={expense.inRetirement ? "In retirement — click to exclude" : "Not in retirement — click to include"}
                  title={expense.inRetirement ? "Included in retirement budget" : "Not included in retirement budget"}
                  className={cn(
                    "shrink-0 transition-colors",
                    expense.inRetirement ? "text-primary" : "text-muted-foreground/30 hover:text-muted-foreground/60"
                  )}
                >
                  {expense.inRetirement
                    ? <CircleCheck className="h-4 w-4" />
                    : <Circle className="h-4 w-4" />
                  }
                </button>
                <span className="text-sm font-mono tabular-nums min-w-[5rem] text-right">{formatCurrency(expense.amount)}</span>
                <button
                  onClick={() => onEdit(expense.id)}
                  aria-label={`Edit ${expense.name}`}
                  className="transition-opacity shrink-0 opacity-20 group-hover/row:opacity-60 hover:!opacity-100 focus-visible:!opacity-100 sm:opacity-0 sm:group-hover/row:opacity-60"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )
          )}

          {/* Add expense row */}
          {addingToGroupId === group.id ? (
            <div className="px-2 py-1">
              <AddExpenseRow
                onSave={(name, amount) => { onAddExpense(group.id, name, amount); onSetAdding(null) }}
                onCancel={() => onSetAdding(null)}
              />
            </div>
          ) : (
            <button
              onClick={() => onSetAdding(group.id)}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add expense
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── summary panel ────────────────────────────────────────────────────────────

function SummaryPanel({ monthlyIncome, groups, expenses, onSetIncome }: {
  monthlyIncome: number
  groups: ExpenseGroup[]
  expenses: Expense[]
  onSetIncome: (v: number) => void
}) {
  const [editIncome, setEditIncome] = useState(false)
  const [incomeInput, setIncomeInput] = useState(String(monthlyIncome))

  useEffect(() => {
    if (!editIncome) setIncomeInput(String(monthlyIncome))
  }, [monthlyIncome, editIncome])

  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const retirementTotal = expenses.filter((e) => e.inRetirement).reduce((s, e) => s + e.amount, 0)
  const surplus = monthlyIncome - total
  const FOUR_PCT_MULTIPLIER = 300 // 12 months / 4% = 300
  const fourPctTarget = retirementTotal * FOUR_PCT_MULTIPLIER

  const groupTotals = groups
    .map((g) => ({ group: g, total: expenses.filter((e) => e.groupId === g.id).reduce((s, e) => s + e.amount, 0) }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)

  const maxGroupTotal = groupTotals[0]?.total ?? 1

  const saveIncome = () => {
    const parsed = parseFloat(incomeInput.replace(/[\s,]/g, ""))
    if (!isNaN(parsed) && parsed > 0) onSetIncome(parsed)
    else setIncomeInput(String(monthlyIncome))
    setEditIncome(false)
  }

  return (
    <div className="space-y-4">
      <PageCard label="Monthly Summary" contentClassName="space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">Income</span>
              <InfoTooltip content="After-tax monthly take-home. Click the amount to edit." side="right" />
            </div>
            {editIncome ? (
              <div className="flex items-center gap-1">
                <Input value={incomeInput} onChange={(e) => setIncomeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveIncome(); if (e.key === "Escape") setEditIncome(false) }}
                  className="h-6 w-28 text-right text-sm font-mono" autoFocus />
                <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" onClick={saveIncome} aria-label="Save income">
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => { setIncomeInput(String(monthlyIncome)); setEditIncome(true) }}
                className="group/income flex items-center gap-1 text-sm font-mono font-semibold hover:text-primary transition-colors border-b border-dashed border-muted-foreground/30 hover:border-primary/50"
                aria-label="Edit monthly income"
              >
                {formatCurrency(monthlyIncome)}
                <Pencil className="h-2.5 w-2.5 opacity-40 group-hover/income:opacity-80 transition-opacity" />
              </button>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total expenses</span>
            <span className="text-sm font-mono font-semibold text-foreground">{formatCurrency(total)}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold">Surplus</span>
            <span className={cn("text-sm font-mono font-bold", surplus >= 0 ? "text-primary" : "text-destructive")}>
              {formatCurrency(surplus)}
            </span>
          </div>
          <div>
            <div
              role="progressbar"
              aria-label="Expense ratio"
              aria-valuenow={Math.min(100, monthlyIncome > 0 ? Math.round((total / monthlyIncome) * 100) : 0)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1 w-full rounded-full bg-muted overflow-hidden"
            >
              <div className={cn("h-full rounded-full transition-all duration-300", surplus >= 0 ? "bg-primary" : "bg-destructive")}
                style={{ width: `${Math.min(100, monthlyIncome > 0 ? (total / monthlyIncome) * 100 : 0)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {monthlyIncome > 0 ? `${((total / monthlyIncome) * 100).toFixed(1)}% of income` : "—"}
            </p>
          </div>
      </PageCard>

      {groupTotals.length > 0 && (
        <PageCard label="By Group" contentClassName="space-y-2.5">
            {groupTotals.map(({ group, total: gt }) => (
              <div key={group.id}>
                <div className="flex justify-between mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: group.color }} />
                    <span className="text-xs text-muted-foreground">{group.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground/60 tabular-nums">
                      {total > 0 ? `${Math.round((gt / total) * 100)}%` : ""}
                    </span>
                    <span className="text-xs font-mono tabular-nums">{formatCurrency(gt)}</span>
                  </div>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${group.name} spend`}
                  aria-valuenow={Math.round((gt / maxGroupTotal) * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1 w-full rounded-full bg-muted overflow-hidden"
                >
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${(gt / maxGroupTotal) * 100}%`, background: group.color }} />
                </div>
              </div>
            ))}
        </PageCard>
      )}

      <PageCard
        label="4% Rule Target"
        className="bg-primary/5 border-primary/20"
        contentClassName="space-y-2"
        trailing={
          <InfoTooltip
            content="The 4% Safe Withdrawal Rate: a portfolio 25× your annual expenses (= 300× monthly) has historically sustained 30+ years of withdrawals. Only expenses marked 'in retirement' count toward this target."
            side="left"
          />
        }
      >
          <p className="text-xs text-muted-foreground">Monthly retirement expenses × 300</p>
          <p className="text-2xl font-bold font-mono">{formatCurrency(fourPctTarget)}</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">In retirement</p>
              <p className="font-mono font-semibold">{formatCurrency(retirementTotal)}<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Not in retirement</p>
              <p className="font-mono font-semibold">{formatCurrency(total - retirementTotal)}<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
            </div>
          </div>
      </PageCard>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export function ExpensesPage() {
  const {
    groups, expenses, monthlyIncome,
    addGroup, removeGroup,
    addExpense, updateExpense, removeExpense, toggleRetirement,
    setMonthlyIncome, loadSampleData, clearAll,
  } = useExpensesStore(
    useShallow((s) => ({
      groups: s.groups,
      expenses: s.expenses,
      monthlyIncome: s.monthlyIncome,
      addGroup: s.addGroup,
      removeGroup: s.removeGroup,
      addExpense: s.addExpense,
      updateExpense: s.updateExpense,
      removeExpense: s.removeExpense,
      toggleRetirement: s.toggleRetirement,
      setMonthlyIncome: s.setMonthlyIncome,
      loadSampleData: s.loadSampleData,
      clearAll: s.clearAll,
    }))
  )

  const setRetirementGoals = useCalculatorStore((s) => s.setRetirementGoals)

  // Auto-sync retirement total → desiredMonthlyIncome
  useEffect(() => {
    const retirementTotal = expenses.filter((e) => e.inRetirement).reduce((s, e) => s + e.amount, 0)
    setRetirementGoals({ desiredMonthlyIncome: retirementTotal })
  }, [expenses, setRetirementGoals])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null)
  const [addingGroup, setAddingGroup] = useState(false)

  const handleAddGroup = () => setAddingGroup(true)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Track your monthly spending to determine how much you need in retirement.</p>
        <div className="flex items-center gap-2 shrink-0">
          {groups.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Clear all
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all expenses?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {groups.length} group{groups.length !== 1 ? "s" : ""} and {expenses.length} expense{expenses.length !== 1 ? "s" : ""}. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Clear all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button size="sm" onClick={handleAddGroup} disabled={addingGroup}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Group
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          {addingGroup && (
            <AddGroupRow
              onSave={(name, color) => { addGroup(name, color); setAddingGroup(false) }}
              onCancel={() => setAddingGroup(false)}
            />
          )}
          {groups.length === 0 && !addingGroup ? (
            <EmptyGroups onAdd={handleAddGroup} onLoadSample={loadSampleData} />
          ) : (
            groups.map((group) => (
              <GroupSection
                key={group.id}
                group={group}
                expenses={expenses.filter((e) => e.groupId === group.id)}
                editingId={editingId}
                addingToGroupId={addingToGroupId}
                onEdit={(id) => { setEditingId(id); if (id) setAddingToGroupId(null) }}
                onUpdate={(id, name, amount) => updateExpense(id, { name, amount })}
                onRemoveExpense={removeExpense}
                onToggleRetirement={toggleRetirement}
                onAddExpense={(groupId, name, amount) => addExpense(groupId, name, amount)}
                onSetAdding={(id) => { setAddingToGroupId(id); if (id) setEditingId(null) }}
                onRemoveGroup={removeGroup}
              />
            ))
          )}
        </div>

        <div className="order-first lg:order-last">
          <SummaryPanel
            monthlyIncome={monthlyIncome}
            groups={groups}
            expenses={expenses}
            onSetIncome={setMonthlyIncome}
          />
        </div>
      </div>
    </div>
  )
}
