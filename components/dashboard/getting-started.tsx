"use client"

import { Button } from "@/components/ui/button"
import { BarChart2, ListChecks, Wallet } from "lucide-react"
import Link from "next/link"

const STEPS = [
  {
    icon: Wallet,
    label: "01",
    title: "Add accounts",
    description:
      "Enter your retirement accounts — RAs, pension funds, TFSAs, and discretionary investments — with their current balance and monthly contribution.",
    cta: { text: "Add accounts →", href: "/calculator/accounts" },
  },
  {
    icon: ListChecks,
    label: "02",
    title: "Configure your plan",
    description:
      "Set your retirement age, desired monthly income, inflation assumptions, and withdrawal rate to define what a successful retirement looks like for you.",
    cta: { text: "Open plan →", href: "/calculator/plan" },
  },
  {
    icon: BarChart2,
    label: "03",
    title: "Run the simulation",
    description:
      "Monte Carlo runs 1,000 market scenarios with randomised returns to calculate the probability of your portfolio funding your retirement goals.",
    cta: null,
  },
]

export function GettingStarted() {
  return (
    <div className="border-t border-border/40 pt-6 pb-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/40 mb-5">
        Getting started
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 sm:divide-x sm:divide-border/30">
        {STEPS.map((step) => {
          const Icon = step.icon
          return (
            <div
              key={step.label}
              className="flex flex-col gap-2 py-5 sm:py-0 sm:px-7 first:sm:pl-0 last:sm:pr-0 border-b border-border/30 sm:border-b-0 last:border-b-0"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-[10px] text-muted-foreground/30 tabular-nums">
                  {step.label}
                </span>
                <Icon className="h-3.5 w-3.5 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-semibold text-foreground">{step.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground/70 flex-1">
                {step.description}
              </p>
              {step.cta && (
                <Button
                  asChild
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto justify-start p-0 text-xs text-primary"
                >
                  <Link href={step.cta.href}>{step.cta.text}</Link>
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
