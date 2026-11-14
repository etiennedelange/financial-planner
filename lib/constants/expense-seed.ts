import type { Expense, ExpenseGroup } from "@/types/expenses"

/** Sample household budget used by "Load sample data". Pure; ids are fresh per call. */
export function generateSeedData(): { groups: ExpenseGroup[]; expenses: Expense[] } {
  const seedGroups: ExpenseGroup[] = [
    { id: crypto.randomUUID(), name: "Housing", color: "#fca5a5", sortOrder: 0 },
    { id: crypto.randomUUID(), name: "Food", color: "#fdba74", sortOrder: 1 },
    { id: crypto.randomUUID(), name: "Savings", color: "#86efac", sortOrder: 2 },
    { id: crypto.randomUUID(), name: "Insurance", color: "#93c5fd", sortOrder: 3 },
    { id: crypto.randomUUID(), name: "Subscriptions", color: "#c4b5fd", sortOrder: 4 },
    { id: crypto.randomUUID(), name: "Utilities", color: "#7dd3fc", sortOrder: 5 },
    { id: crypto.randomUUID(), name: "Transport", color: "#fcd34d", sortOrder: 6 },
    { id: crypto.randomUUID(), name: "Family", color: "#f9a8d4", sortOrder: 7 },
    { id: crypto.randomUUID(), name: "Software", color: "#a5b4fc", sortOrder: 8 },
    { id: crypto.randomUUID(), name: "Health", color: "#5eead4", sortOrder: 9 },
    { id: crypto.randomUUID(), name: "Banking", color: "#cbd5e1", sortOrder: 10 },
    { id: crypto.randomUUID(), name: "Other", color: "#d4d4d8", sortOrder: 11 },
  ]

  const g = (name: string) => seedGroups.find((g) => g.name === name)!.id

  const seedExpensesList: Expense[] = [
    // Housing
    {
      id: crypto.randomUUID(),
      groupId: g("Housing"),
      name: "Verband",
      amount: 12800,
      inRetirement: false,
      sortOrder: 0,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Housing"),
      name: "Munisipaliteit",
      amount: 1550,
      inRetirement: true,
      sortOrder: 1,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Housing"),
      name: "Elektrisiteit",
      amount: 600,
      inRetirement: true,
      sortOrder: 2,
    },
    // Food
    {
      id: crypto.randomUUID(),
      groupId: g("Food"),
      name: "Groceries",
      amount: 7500,
      inRetirement: true,
      sortOrder: 0,
    },
    // Savings
    {
      id: crypto.randomUUID(),
      groupId: g("Savings"),
      name: "Allan Gray RA",
      amount: 5000,
      inRetirement: false,
      sortOrder: 0,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Savings"),
      name: "TFSA",
      amount: 2000,
      inRetirement: false,
      sortOrder: 1,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Savings"),
      name: "Discretionary savings",
      amount: 1000,
      inRetirement: false,
      sortOrder: 2,
    },
    // Insurance
    {
      id: crypto.randomUUID(),
      groupId: g("Insurance"),
      name: "Versekering",
      amount: 1705,
      inRetirement: true,
      sortOrder: 0,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Insurance"),
      name: "PPS",
      amount: 425,
      inRetirement: true,
      sortOrder: 1,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Insurance"),
      name: "Alarm",
      amount: 445,
      inRetirement: true,
      sortOrder: 2,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Insurance"),
      name: "Gap cover",
      amount: 330,
      inRetirement: true,
      sortOrder: 3,
    },
    // Subscriptions
    {
      id: crypto.randomUUID(),
      groupId: g("Subscriptions"),
      name: "Netflix",
      amount: 229,
      inRetirement: true,
      sortOrder: 0,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Subscriptions"),
      name: "Apple One",
      amount: 180,
      inRetirement: true,
      sortOrder: 1,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Subscriptions"),
      name: "Disney+",
      amount: 170,
      inRetirement: true,
      sortOrder: 2,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Subscriptions"),
      name: "YouTube Subscriptions",
      amount: 160,
      inRetirement: true,
      sortOrder: 3,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Subscriptions"),
      name: "YouTube Premium",
      amount: 100,
      inRetirement: true,
      sortOrder: 4,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Subscriptions"),
      name: "PSN",
      amount: 249,
      inRetirement: true,
      sortOrder: 5,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Subscriptions"),
      name: "Xbox Game Pass",
      amount: 0,
      inRetirement: false,
      sortOrder: 6,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Subscriptions"),
      name: "DStv",
      amount: 0,
      inRetirement: false,
      sortOrder: 7,
    },
    // Utilities
    {
      id: crypto.randomUUID(),
      groupId: g("Utilities"),
      name: "Bellbuoy",
      amount: 1200,
      inRetirement: true,
      sortOrder: 0,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Utilities"),
      name: "Internet",
      amount: 847,
      inRetirement: true,
      sortOrder: 1,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Utilities"),
      name: "Selfoon",
      amount: 199,
      inRetirement: true,
      sortOrder: 2,
    },
    // Transport
    {
      id: crypto.randomUUID(),
      groupId: g("Transport"),
      name: "Petrol",
      amount: 800,
      inRetirement: false,
      sortOrder: 0,
    },
    // Family
    {
      id: crypto.randomUUID(),
      groupId: g("Family"),
      name: "Ma bydrae",
      amount: 1500,
      inRetirement: false,
      sortOrder: 0,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Family"),
      name: "Ma foon",
      amount: 260,
      inRetirement: false,
      sortOrder: 1,
    },
    // Software
    {
      id: crypto.randomUUID(),
      groupId: g("Software"),
      name: "Claude Code",
      amount: 400,
      inRetirement: true,
      sortOrder: 0,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Software"),
      name: "1Password",
      amount: 84,
      inRetirement: true,
      sortOrder: 1,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Software"),
      name: "Gemini",
      amount: 53,
      inRetirement: true,
      sortOrder: 2,
    },
    // Health
    {
      id: crypto.randomUUID(),
      groupId: g("Health"),
      name: "Pille",
      amount: 80,
      inRetirement: true,
      sortOrder: 0,
    },
    {
      id: crypto.randomUUID(),
      groupId: g("Health"),
      name: "Gym",
      amount: 0,
      inRetirement: false,
      sortOrder: 1,
    },
    // Banking
    {
      id: crypto.randomUUID(),
      groupId: g("Banking"),
      name: "FNB",
      amount: 250,
      inRetirement: true,
      sortOrder: 0,
    },
    // Other
    {
      id: crypto.randomUUID(),
      groupId: g("Other"),
      name: "Spending",
      amount: 2000,
      inRetirement: true,
      sortOrder: 0,
    },
  ]

  return { groups: seedGroups, expenses: seedExpensesList }
}
