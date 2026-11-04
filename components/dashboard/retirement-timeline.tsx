"use client"

import { PageCard } from "@/components/ui/page-card"
import type { OverviewSummary } from "@/lib/calculations/utils/overview-summary"
import { cn } from "@/lib/utils"

interface RetirementTimelineProps {
  summary: OverviewSummary
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
}

interface Segment {
  key: string
  years: number
  startAge: number
  caption: string
  barClassName: string
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/** A proportional bar of the plan's life: saving → goal income → (any) years below goal. */
export function RetirementTimeline({
  summary,
  currentAge,
  retirementAge,
  lifeExpectancy,
}: RetirementTimelineProps) {
  const segments: Segment[] = [
    {
      key: "saving",
      years: summary.yearsToRetirement,
      startAge: currentAge,
      caption: "Today",
      barClassName: "bg-primary",
    },
    {
      key: "income",
      years: summary.yearsOfGoalIncome,
      startAge: retirementAge,
      caption: "Retire",
      barClassName: "bg-primary/40",
    },
    {
      key: "shortfall",
      years: summary.yearsBelowGoal,
      startAge: summary.goalIncomeUntilAge,
      caption: summary.yearsOfGoalIncome > 0 ? "Below goal" : "Retire · below goal",
      barClassName: "bg-warning/60",
    },
  ].filter((s) => s.years > 0)

  if (segments.length === 0) return null

  const columns = segments.map((s) => `${s.years}fr`).join(" ")
  const description = [
    summary.yearsToRetirement > 0 && `${plural(summary.yearsToRetirement, "year")} saving`,
    summary.yearsOfGoalIncome > 0 && `${plural(summary.yearsOfGoalIncome, "year")} of goal income`,
    summary.yearsBelowGoal > 0 && `${plural(summary.yearsBelowGoal, "year")} below goal`,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <PageCard label="Your timeline" description={description} contentClassName="space-y-3">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: columns }}
        role="img"
        aria-label={`Age ${currentAge} to ${lifeExpectancy}: ${description}`}
      >
        {segments.map((s, i) => (
          <div
            key={s.key}
            className={cn(
              "h-3 rounded-sm",
              i === 0 && "rounded-l-md",
              i === segments.length - 1 && "rounded-r-md",
              s.barClassName,
            )}
          />
        ))}
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: columns }} aria-hidden="true">
        {segments.map((s, i) => (
          <div key={s.key} className="flex min-w-0 justify-between gap-2">
            <AgeMark age={s.startAge} caption={s.caption} />
            {i === segments.length - 1 && (
              <AgeMark age={lifeExpectancy} caption="Plan ends" align="end" />
            )}
          </div>
        ))}
      </div>
    </PageCard>
  )
}

function AgeMark({
  age,
  caption,
  align = "start",
}: {
  age: number
  caption: string
  align?: "start" | "end"
}) {
  return (
    <div className={cn("flex flex-col", align === "end" && "items-end text-right")}>
      <span className="font-mono text-sm font-semibold">{age}</span>
      <span className="text-xs text-muted-foreground">{caption}</span>
    </div>
  )
}
