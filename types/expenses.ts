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
  "#f87171", // rose-400
  "#fb923c", // orange-400
  "#fbbf24", // amber-400
  "#4ade80", // green-400
  "#38bdf8", // sky-400
  "#60a5fa", // blue-400
  "#a78bfa", // violet-400
  "#f472b6", // pink-400
  "#818cf8", // indigo-400
  "#2dd4bf", // teal-400
  "#94a3b8", // slate-400
  "#a1a1aa", // zinc-400
] as const

export type GroupColorOption = (typeof GROUP_COLOR_OPTIONS)[number]
