"use client"

import { useEffect, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { Check, ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={commit}>
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel}>
        <X className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
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
      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={commit}>
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ─── add group row ────────────────────────────────────────────────────────────

function AddGroupRow({ onSave, onCancel }: { onSave: (name: string, color: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("")
  const [color, setColor] = useState<string>("#6366f1") // indigo — from GROUP_COLOR_OPTIONS

  const commit = () => {
    if (!name.trim()) { onCancel(); return }
    onSave(name.trim(), color)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-sm border border-primary/25 mb-3">
      <Input value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") onCancel() }}
        className="h-7 text-sm flex-1" placeholder="Group name" autoFocus />
      <div className="flex gap-1 flex-wrap">
        {GROUP_COLOR_OPTIONS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={cn("w-4 h-4 rounded-full border-2 transition-all", color === c ? "border-foreground scale-110" : "border-transparent")}
            style={{ background: c }}
          />
        ))}
      </div>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={commit}>
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel}>
        <X className="h-3.5 w-3.5" />
      </Button>
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
  const groupTotal = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {/* Group header */}
      <div
        className="group flex items-center gap-2.5 px-3 py-2.5 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: group.color }} />
        <span className="flex-1 text-sm font-semibold">{group.name}</span>
        <span className="text-xs text-muted-foreground tabular-nums font-mono">{formatCurrency(groupTotal)}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemoveGroup(group.id) }}
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity ml-1"
          title="Delete group"
        >
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </button>
        {collapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>

      {/* Group body */}
      {!collapsed && (
        <div className="divide-y divide-border/50">
          {expenses.map((expense) =>
            editingId === expense.id ? (
              <div key={expense.id} className="px-2 py-1">
                <EditRow
                  expense={expense}
                  onSave={(name, amount) => { onUpdate(expense.id, name, amount); onEdit(null) }}
                  onCancel={() => onEdit(null)}
                  onDelete={() => { onRemoveExpense(expense.id); onEdit(null) }}
                />
              </div>
            ) : (
              <div
                key={expense.id}
                className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/20 transition-colors"
              >
                <span className="flex-1 text-sm truncate">{expense.name}</span>
                <button
                  onClick={() => onToggleRetirement(expense.id)}
                  className={cn(
                    "shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors",
                    expense.inRetirement
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-muted/50 text-muted-foreground border-border"
                  )}
                >
                  {expense.inRetirement ? "in retirement" : "not in retirement"}
                </button>
                <span className="text-sm font-mono tabular-nums w-20 text-right">{formatCurrency(expense.amount)}</span>
                <button onClick={() => onEdit(expense.id)}
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity shrink-0">
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
              className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
            >
              <Plus className="h-3 w-3" />
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
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Monthly Summary</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Income</span>
            {editIncome ? (
              <div className="flex items-center gap-1">
                <Input value={incomeInput} onChange={(e) => setIncomeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveIncome(); if (e.key === "Escape") setEditIncome(false) }}
                  className="h-6 w-28 text-right text-sm font-mono" autoFocus />
                <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" onClick={saveIncome}>
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <button onClick={() => { setIncomeInput(String(monthlyIncome)); setEditIncome(true) }}
                className="text-sm font-mono font-semibold hover:text-primary transition-colors">
                {formatCurrency(monthlyIncome)}
              </button>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total expenses</span>
            <span className="text-sm font-mono font-semibold text-destructive">{formatCurrency(total)}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold">Surplus</span>
            <span className={cn("text-sm font-mono font-bold", surplus >= 0 ? "text-primary" : "text-destructive")}>
              {formatCurrency(surplus)}
            </span>
          </div>
          <div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(100, monthlyIncome > 0 ? (total / monthlyIncome) * 100 : 0)}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {monthlyIncome > 0 ? `${((total / monthlyIncome) * 100).toFixed(1)}% of income` : "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">By Group</CardTitle></CardHeader>
        <CardContent className="space-y-2.5">
          {groupTotals.map(({ group, total: gt }) => (
            <div key={group.id}>
              <div className="flex justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: group.color }} />
                  <span className="text-xs text-muted-foreground">{group.name}</span>
                </div>
                <span className="text-xs font-mono tabular-nums">{formatCurrency(gt)}</span>
              </div>
              <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${(gt / maxGroupTotal) * 100}%`, background: group.color }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-2"><CardTitle className="text-sm">4% Rule Target</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">Monthly retirement expenses × 300</p>
          <p className="text-2xl font-bold font-mono">{formatCurrency(fourPctTarget)}</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">In retirement</p>
              <p className="font-mono font-semibold">{formatCurrency(retirementTotal)}<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Not in retirement</p>
              <p className="font-mono font-semibold">{formatCurrency(total - retirementTotal)}<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export function ExpensesPage() {
  const {
    groups, expenses, monthlyIncome,
    addGroup, removeGroup,
    addExpense, updateExpense, removeExpense, toggleRetirement,
    setMonthlyIncome,
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
    }))
  )

  const setRetirementGoals = useCalculatorStore((s) => s.setRetirementGoals)
  const syncFromDb = useExpensesStore((s) => s.syncFromDb)
  const storeSessionId = useExpensesStore((s) => s.sessionId)

  // Seed defaults on first mount when store is empty (works offline too)
  useEffect(() => {
    if (groups.length === 0) {
      syncFromDb(storeSessionId ?? "")
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-sync retirement total → desiredMonthlyIncome
  useEffect(() => {
    const retirementTotal = expenses.filter((e) => e.inRetirement).reduce((s, e) => s + e.amount, 0)
    setRetirementGoals({ desiredMonthlyIncome: retirementTotal })
  }, [expenses, setRetirementGoals])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null)
  const [addingGroup, setAddingGroup] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Monthly Expenses</h2>
          <p className="text-sm text-muted-foreground">
            Expenses marked "in retirement" drive your retirement income target automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAddingGroup(true)} disabled={addingGroup}>
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
          {groups.map((group) => (
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
          ))}
        </div>

        <SummaryPanel
          monthlyIncome={monthlyIncome}
          groups={groups}
          expenses={expenses}
          onSetIncome={setMonthlyIncome}
        />
      </div>
    </div>
  )
}
