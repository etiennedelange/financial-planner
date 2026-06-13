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
  "#fca5a5", // rose
  "#fdba74", // orange
  "#fcd34d", // amber
  "#86efac", // green
  "#7dd3fc", // sky
  "#93c5fd", // blue
  "#c4b5fd", // violet
  "#f9a8d4", // pink
  "#a5b4fc", // indigo
  "#5eead4", // teal
  "#cbd5e1", // slate
  "#d4d4d8", // zinc
] as const

export type GroupColorOption = (typeof GROUP_COLOR_OPTIONS)[number]
