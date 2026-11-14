"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Check, CircleDashed, Copy, Minus, Search, TriangleAlert, X } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageCard } from "@/components/ui/page-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import {
  buildDebugModel,
  checkToText,
  filterChecks,
  filterSections,
  summarizeChecks,
  toDebugText,
  type CheckStatus,
  type CheckVerdict,
  type DebugGroup,
  type DebugRow,
  type DebugSection,
  type ReconciliationCheck,
} from "@/lib/debug/debug-model"
import { copyText, type CopyOutcome } from "@/lib/debug/copy"
import { cn } from "@/lib/utils"
import type { ProjectionResult, SimulationResult } from "@/types"

interface DebugPageProps {
  projection: ProjectionResult | null
  simulationResult: SimulationResult | null
  isDeferred: boolean
}

const GROUPS: { id: DebugGroup; title: string }[] = [
  { id: "inputs", title: "Inputs" },
  { id: "results", title: "Results" },
  { id: "reference", title: "Reference" },
]

type TabId = "reconciliation" | DebugGroup

const TABS: { id: TabId; title: string }[] = [
  { id: "reconciliation", title: "Reconciliation" },
  ...GROUPS,
]

export function DebugPage({ projection, simulationResult, isDeferred }: DebugPageProps) {
  const { accounts, personalInfo, retirementGoals, assumptions, drawdownConfig, displayMode } =
    useCalculatorStore(
      useShallow((s) => ({
        accounts: s.accounts,
        personalInfo: s.personalInfo,
        retirementGoals: s.retirementGoals,
        assumptions: s.assumptions,
        drawdownConfig: s.drawdownConfig,
        displayMode: s.displayMode,
      })),
    )

  const model = useMemo(
    () =>
      buildDebugModel({
        accounts,
        personalInfo,
        retirementGoals,
        assumptions,
        drawdownConfig,
        displayMode,
        projection,
        simulationResult,
        isDeferred,
      }),
    [
      accounts,
      personalInfo,
      retirementGoals,
      assumptions,
      drawdownConfig,
      displayMode,
      projection,
      simulationResult,
      isDeferred,
    ],
  )

  const [query, setQuery] = useState("")
  const checks = useMemo(() => filterChecks(model.checks, query), [model.checks, query])
  const sections = useMemo(() => filterSections(model.sections, query), [model.sections, query])

  const [tab, setTab] = useState<TabId>("reconciliation")
  const [copy, setCopy] = useState<{ outcome: CopyOutcome; what: string } | null>(null)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(resetTimer.current), [])

  const runCopy = async (text: string, what: string) => {
    const outcome = await copyText(text)
    setCopy({ outcome, what })
    clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setCopy(null), 4000)
  }
  // Stamp the export at the moment of copying, not at the last store change
  const onCopyAll = () => runCopy(toDebugText({ ...model, generatedAt: new Date() }), "All values")
  const onCopyCheck = (c: ReconciliationCheck) => runCopy(checkToText(c), c.label)

  const verdict = useMemo(() => summarizeChecks(model.checks), [model.checks])
  const filtering = query.trim() !== ""
  const countIn = (group: DebugGroup) => sections.filter((s) => s.group === group).length

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Verdict verdict={verdict} hasProjection={model.hasProjection} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <p className="min-w-0 basis-full text-sm text-muted-foreground lg:max-w-prose lg:flex-1 lg:basis-0">
            {model.compounding.label} compounding. Every figure comes from the engine; the
            reconciliation recomputes {model.checks.length} of them a second way.
          </p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="debug-filter"
                name="debug-filter"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter all tabs"
                aria-label="Filter rows on every tab"
                className="h-9 w-48 pl-8 sm:w-56"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCopyAll}
              aria-label="Copy all debug values as text"
            >
              {copy?.outcome === "copied" && copy.what === "All values" ? (
                <Check aria-hidden className="mr-2 h-4 w-4" />
              ) : (
                <Copy aria-hidden className="mr-2 h-4 w-4" />
              )}
              Copy
            </Button>
          </div>
          <span
            role="status"
            aria-live="polite"
            className={cn(
              "basis-full text-sm",
              copy?.outcome === "failed" ? "text-destructive" : "text-muted-foreground",
              copy === null && "sr-only",
            )}
          >
            {copy?.outcome === "copied" && `Copied: ${copy.what}.`}
            {copy?.outcome === "failed" &&
              "Could not write to the clipboard. Check browser permissions, or select the rows and copy by hand."}
            {model.recalculating && copy === null && "Recalculating…"}
          </span>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="space-y-4">
        <div>
          <TabsList aria-label="Debug sections" className="h-auto w-full flex-wrap justify-start">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.title}
                {filtering && (
                  <span className="ml-1.5 font-mono text-xs tabular-nums text-muted-foreground">
                    {t.id === "reconciliation" ? checks.length : countIn(t.id)}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="reconciliation" className="mt-0">
          <PageCard label="Reconciliation" contentClassName="space-y-3" noContentPadX>
            {!model.hasProjection && (
              <p className="px-6 text-sm text-muted-foreground">
                Nothing to compare yet.{" "}
                <Link href="/calculator/accounts" className="underline underline-offset-4">
                  Add an account
                </Link>{" "}
                to run the checks.
              </p>
            )}
            {checks.length === 0 ? (
              <div className="flex flex-col items-start gap-3 px-6 py-2">
                <p className="text-sm text-muted-foreground">
                  No checks match &ldquo;{query.trim()}&rdquo;.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => setQuery("")}>
                  <X aria-hidden data-icon="inline-start" className="mr-2 h-4 w-4" />
                  Clear filter
                </Button>
              </div>
            ) : (
              <>
                <ReconciliationTable checks={checks} onCopy={onCopyCheck} />
                <ReconciliationList checks={checks} onCopy={onCopyCheck} />
              </>
            )}
          </PageCard>
        </TabsContent>

        {GROUPS.map((group) => {
          const groupSections = sections.filter((s) => s.group === group.id)
          return (
            <TabsContent key={group.id} value={group.id} className="mt-0">
              {groupSections.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-lg border border-border px-4 py-6">
                  <p className="text-sm text-muted-foreground">
                    No {group.title.toLowerCase()} rows match &ldquo;{query.trim()}&rdquo;.
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setQuery("")}>
                    <X aria-hidden data-icon="inline-start" className="mr-2 h-4 w-4" />
                    Clear filter
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {groupSections.map((section) => (
                    <SectionCard key={section.id} section={section} />
                  ))}
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}

function Verdict({ verdict, hasProjection }: { verdict: CheckVerdict; hasProjection: boolean }) {
  const Icon =
    verdict.tone === "match" ? Check : verdict.tone === "mismatch" ? TriangleAlert : Minus
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-3",
        verdict.tone === "mismatch" ? "border-destructive/50 bg-destructive/5" : "border-border",
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "h-5 w-5 shrink-0",
          verdict.tone === "match" && "text-primary",
          verdict.tone === "mismatch" && "text-destructive",
          (verdict.tone === "partial" || verdict.tone === "pending") && "text-muted-foreground",
        )}
      />
      <span
        className={cn(
          "text-xl font-semibold tracking-tight",
          verdict.tone === "mismatch" && "text-destructive",
        )}
      >
        {hasProjection ? verdict.headline : "Waiting for a projection"}
      </span>
      {hasProjection && verdict.detail && (
        <span className="text-sm text-muted-foreground">{verdict.detail}</span>
      )}
    </div>
  )
}

const STATUS_META: Record<CheckStatus, { text: string; icon: typeof Check }> = {
  match: { text: "Match", icon: Check },
  mismatch: { text: "Mismatch", icon: TriangleAlert },
  skipped: { text: "Not comparable", icon: Minus },
  pending: { text: "Pending", icon: CircleDashed },
}

interface CheckViewProps {
  checks: ReconciliationCheck[]
  onCopy: (c: ReconciliationCheck) => void
}

function StatusLabel({ status }: { status: CheckStatus }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-sm",
        status === "mismatch" && "font-semibold text-destructive",
        status === "match" && "font-medium text-foreground",
        (status === "skipped" || status === "pending") && "text-muted-foreground",
      )}
    >
      <Icon aria-hidden className={cn("h-4 w-4", status === "match" && "text-primary")} />
      {meta.text}
    </span>
  )
}

function CopyCheckButton({
  check,
  onCopy,
}: {
  check: ReconciliationCheck
  onCopy: CheckViewProps["onCopy"]
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-11 w-11 text-muted-foreground md:h-8 md:w-8"
      onClick={() => onCopy(check)}
      aria-label={`Copy check: ${check.label}`}
    >
      <Copy aria-hidden className="h-3.5 w-3.5" />
    </Button>
  )
}

/** The band a compared check was held to, so a Match shows its margin and a Mismatch its limit. */
function ToleranceNote({ check }: { check: ReconciliationCheck }) {
  if (!check.tolerance) return null
  if (check.status === "match") {
    return (
      <div className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
        Within {check.tolerance}
      </div>
    )
  }
  if (check.status !== "mismatch") return null
  return (
    <div className="mt-1 flex items-start gap-1.5 text-sm text-foreground">
      <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <span>
        Outside the {check.tolerance} tolerance. Check whether the projection is stale before
        suspecting the engine.
      </span>
    </div>
  )
}

/** A check's explanation. Pending rows say nothing: the card already says why once. */
function CheckNote({ check }: { check: ReconciliationCheck }) {
  if (check.status === "pending") return null
  return <div className="mt-0.5 max-w-md text-sm text-muted-foreground">{check.note}</div>
}

function ReconciliationTable({ checks, onCopy }: CheckViewProps) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Check</TableHead>
            <TableHead className="text-right">Engine</TableHead>
            <TableHead className="text-right">Independent</TableHead>
            <TableHead className="text-right">Difference</TableHead>
            <TableHead>Result</TableHead>
            <TableHead className="w-12 pr-6">
              <span className="sr-only">Copy</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {checks.map((c) => {
            const figures = c.status === "match" || c.status === "mismatch"
            return (
              <TableRow key={c.id} className={cn(c.status === "mismatch" && "bg-destructive/5")}>
                <TableCell className="pl-6 align-top">
                  <div className="font-medium">{c.label}</div>
                  <CheckNote check={c} />
                  <ToleranceNote check={c} />
                </TableCell>
                <TableCell className="text-right align-top font-mono tabular-nums">
                  {c.engine}
                </TableCell>
                <TableCell className="text-right align-top font-mono tabular-nums">
                  {c.independent}
                </TableCell>
                <TableCell className="text-right align-top font-mono tabular-nums">
                  {figures ? (
                    c.delta
                  ) : (
                    <>
                      <span aria-hidden>—</span>
                      <span className="sr-only">Not applicable</span>
                    </>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <StatusLabel status={c.status} />
                </TableCell>
                <TableCell className="pr-6 align-top">
                  <CopyCheckButton check={c} onCopy={onCopy} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/** Below md the five-column table does not fit: one block per check, figures as a 3-up. */
function ReconciliationList({ checks, onCopy }: CheckViewProps) {
  return (
    <ul className="divide-y divide-border border-t border-border md:hidden">
      {checks.map((c) => {
        const figures = c.status === "match" || c.status === "mismatch"
        return (
          <li
            key={c.id}
            className={cn("space-y-2 px-6 py-3", c.status === "mismatch" && "bg-destructive/5")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 font-medium">{c.label}</div>
              <div className="flex shrink-0 items-center gap-1">
                <StatusLabel status={c.status} />
                <CopyCheckButton check={c} onCopy={onCopy} />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {[
                ["Engine", c.engine],
                ["Independent", c.independent],
                ["Difference", figures ? c.delta : "—"],
              ].map(([k, v]) => (
                <div key={k} className={cn("min-w-0", k === "Difference" && "col-span-2")}>
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="whitespace-nowrap font-mono tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            {c.status !== "pending" && <p className="text-sm text-muted-foreground">{c.note}</p>}
            <ToleranceNote check={c} />
          </li>
        )
      })}
    </ul>
  )
}

function SectionCard({ section }: { section: DebugSection }) {
  return (
    <PageCard label={section.title} contentClassName="space-y-3">
      {section.rows.length > 0 && (
        <dl className="mt-3 divide-y divide-border">
          {section.rows.map((r) => (
            <RowItem key={r.id} row={r} />
          ))}
        </dl>
      )}
      {section.footnote && (
        <p
          className={cn(
            "text-xs text-muted-foreground",
            section.footnoteKind === "formula" &&
              "rounded-md bg-muted p-2 font-mono text-foreground",
          )}
        >
          {section.footnote}
        </p>
      )}
    </PageCard>
  )
}

function RowItem({ row }: { row: DebugRow }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="min-w-0 text-sm text-muted-foreground">
        {row.label}
        {row.basis && <span className="block text-xs text-muted-foreground/80">{row.basis}</span>}
      </dt>
      <dd className={cn("shrink-0 text-right text-sm", row.numeric && "font-mono tabular-nums")}>
        {row.value}
      </dd>
    </div>
  )
}
