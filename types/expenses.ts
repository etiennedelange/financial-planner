// types/expenses.ts
export interface ExpenseGroup {
  id: string
  name: string
  color: string
  sortOrder: number
}

export interface Expense {
  id: string
  groupId: string
  name: string
  amount: number
  inRetirement: boolean
  sortOrder: number
}

export const GROUP_COLOR_OPTIONS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#94a3b8", // slate
  "#71717a", // zinc
] as const

export type GroupColorOption = (typeof GROUP_COLOR_OPTIONS)[number]
