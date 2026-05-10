import type { YearlyProjection } from "@/types"

function escape(val: string | number | null | undefined): string {
  const s = String(val ?? "")
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s
}

function row(...cells: (string | number | null | undefined)[]): string {
  return cells.map(escape).join(",")
}

export function exportProjectionCsv(
  projections: YearlyProjection[],
  filename = `retirement-projection-${new Date().toISOString().split("T")[0]}.csv`
): void {
  const header = row(
    "Year",
    "Age",
    "Starting Balance (R)",
    "Contributions (R)",
    "Growth (R)",
    "Fees (R)",
    "Withdrawals (R)",
    "Income Tax (R)",
    "Lump Sum Tax (R)",
    "Medical Aid (R)",
    "Net Income (R)",
    "Ending Balance (R)",
    "Inflation-Adj Withdrawal (R)"
  )

  const lines = [
    header,
    ...projections.map((p) =>
      row(
        p.year,
        p.age,
        p.startingBalance.toFixed(2),
        p.contributions.toFixed(2),
        p.growth.toFixed(2),
        p.fees.toFixed(2),
        p.withdrawals.toFixed(2),
        p.incomeTax.toFixed(2),
        p.lumpSumTax.toFixed(2),
        p.medicalAidContribution.toFixed(2),
        p.netIncome.toFixed(2),
        p.endingBalance.toFixed(2),
        p.inflationAdjustedWithdrawal.toFixed(2)
      )
    ),
  ]

  const csv = lines.join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
