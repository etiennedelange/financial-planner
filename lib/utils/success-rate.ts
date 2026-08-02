export type SuccessRateStyle = {
  text: string
  bg: string
  border: string
  label: string
}

export function getSuccessRateStyle(rate: number): SuccessRateStyle {
  if (rate >= 90) return {
    text: "text-chart-2",
    bg: "bg-[hsl(var(--chart-2))]",
    border: "border-[hsl(var(--chart-2))]",
    label: "Excellent",
  }
  if (rate >= 75) return {
    text: "text-chart-4",
    bg: "bg-[hsl(var(--chart-4))]",
    border: "border-[hsl(var(--chart-4))]",
    label: "Good",
  }
  if (rate >= 60) return {
    text: "text-warning",
    bg: "bg-[hsl(var(--warning))]",
    border: "border-[hsl(var(--warning))]",
    label: "Fair",
  }
  if (rate >= 40) return {
    text: "text-warning",
    bg: "bg-[hsl(var(--warning))]",
    border: "border-[hsl(var(--warning))]",
    label: "At Risk",
  }
  return {
    text: "text-destructive",
    bg: "bg-destructive",
    border: "border-destructive",
    label: "Critical",
  }
}
