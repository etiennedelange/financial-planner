# Debug Window Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the debug window from a scrollable Sheet side panel into a centered Dialog with color-coded section categories, improved visual hierarchy, and "stats for nerds" aesthetic while maintaining all existing calculations and copy-all functionality.

**Architecture:** Single file refactor of `components/debug/debug-window.tsx`. Replace the outer `<Sheet>` with `<Dialog>`, reorganize all sections into 4 color-coded categories (Critical Metrics, Calculation Inputs, Calculated Results, Reference Data), apply consistent styling using Tailwind utilities and monospace fonts. All calculation logic remains unchanged; this is purely a presentation refactor.

**Tech Stack:** React, TypeScript, Tailwind CSS v4, shadcn/ui (Dialog, ScrollArea, Button, Separator components)

## Global Constraints

- No new components — use existing shadcn/ui Dialog, ScrollArea, Button, Separator
- All 100+ metrics must remain visible (no data loss)
- Copy-all functionality must maintain existing text export format
- Monospace fonts for values (`font-mono`)
- Color scheme: teal (`--primary`) + grays, no warm colors
- No changes to calculation logic or store interactions
- Dialog max-width: `900px`, max-height: `85vh`
- Mobile responsive: max-width `95vw`

---

## File Structure

**Modified:**
- `components/debug/debug-window.tsx` (850+ lines) — Replace Sheet container with Dialog, reorganize sections into 4 color-coded categories, update styling

**No New Files:**
- Reuse existing helper components (`Section`, `Param`)
- Import `Dialog` from shadcn/ui instead of `Sheet`

---

## Task 1: Replace Sheet with Dialog Container

**Files:**
- Modify: `components/debug/debug-window.tsx:1-50` (imports and JSX structure)

**Interfaces:**
- Consumes: Existing `useCalculatorStore`, `projection`, `simulationResult` props
- Produces: Dialog-based wrapper with same trigger button and header structure

- [ ] **Step 1: Update imports**

Replace Sheet imports with Dialog imports. In the file, change lines 5-13:

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
```

(Remove the Sheet import block.)

- [ ] **Step 2: Replace Sheet JSX with Dialog JSX**

Starting at line 407, replace:

```typescript
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={className}
          title="Debug: View Calculation Parameters"
        >
          <Bug className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle>Debug: Calculation Parameters</SheetTitle>
              <SheetDescription>
                All parameters used in retirement calculations
              </SheetDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={copyDebugInfo}
              className="ml-4"
              title={copied ? "Copied!" : "Copy all debug parameters"}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
          <div className="space-y-6">
```

With:

```typescript
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={className}
          title="Debug: View Calculation Parameters"
        >
          <Bug className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle>Debug: Calculation Parameters</DialogTitle>
              <DialogDescription>
                Verify all calculation inputs, assumptions, and results
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={copyDebugInfo}
              className="shrink-0"
              title={copied ? "Copied!" : "Copy all debug parameters"}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-6">
```

- [ ] **Step 3: Update closing JSX**

At the end of the return (around line 877-880), replace:

```typescript
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
```

With:

```typescript
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
```

- [ ] **Step 4: Run the app to verify Dialog opens/closes**

```bash
npm run dev
```

Expected: App loads on port 3000, debug button is visible bottom-right, clicking it opens a centered Dialog that closes on Escape or backdrop click.

- [ ] **Step 5: Commit**

```bash
git add components/debug/debug-window.tsx
git commit -m "refactor: replace Sheet with Dialog in debug window"
```

---

## Task 2: Create Color-Coded Section Categories

**Files:**
- Modify: `components/debug/debug-window.tsx:445-877` (section rendering)

**Interfaces:**
- Consumes: Existing Section, Param helper components
- Produces: 4 nested category wrappers with color-coded styling

- [ ] **Step 1: Create CategorySection helper component**

Add this new helper component before the closing of the file (before the final `Section` and `Param` components, around line 882):

```typescript
interface CategorySectionProps {
  title: string
  category: 'critical' | 'inputs' | 'results' | 'reference'
  children: React.ReactNode
}

function CategorySection({ title, category, children }: CategorySectionProps) {
  const bgColor = {
    critical: 'bg-primary/15',
    inputs: 'bg-primary/5',
    results: 'bg-primary/10',
    reference: 'bg-muted/30',
  }[category]

  const borderColor = {
    critical: 'border-primary',
    inputs: 'border-primary/40',
    results: 'border-primary',
    reference: 'border-muted-foreground/40',
  }[category]

  return (
    <div className={`rounded-lg border-l-4 ${borderColor} ${bgColor} p-4`}>
      <h3 className="font-semibold text-sm mb-3 text-primary">{title}</h3>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tests to verify no regressions**

```bash
npm run test
```

Expected: All tests pass (no changes to calculation logic yet).

- [ ] **Step 3: Commit**

```bash
git add components/debug/debug-window.tsx
git commit -m "feat: add CategorySection helper component for color-coded sections"
```

---

## Task 3: Reorganize Sections into Critical Metrics Category

**Files:**
- Modify: `components/debug/debug-window.tsx:446-492` (Calculation Method section)

**Interfaces:**
- Consumes: Existing `COMPOUNDING_METHOD_LABELS`, `COMPOUNDING_METHOD_DESCRIPTIONS`, `monthlyReturnFormula`, `netReturn`, `displayModeLabel`, derived values
- Produces: Single `CategorySection` with `category="critical"` containing critical metrics

- [ ] **Step 1: Extract critical metrics section**

Replace the current "Calculation Method" section (lines 446-491) with:

```typescript
            {/* CRITICAL METRICS */}
            <CategorySection title="Critical Metrics" category="critical">
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Compounding Method:</div>
                  <div className="font-semibold text-primary text-base">
                    {COMPOUNDING_METHOD_LABELS[compoundingMethod]}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 italic">
                    {COMPOUNDING_METHOD_DESCRIPTIONS[compoundingMethod]}
                  </div>
                </div>

                <div className="pt-2 border-t border-primary/20">
                  <div className="text-xs text-muted-foreground mb-1">Monthly Return Formula:</div>
                  <div className="font-mono text-xs bg-muted/50 p-2 rounded">
                    {monthlyReturnFormula}
                  </div>
                </div>

                <div className="pt-2 border-t border-primary/20">
                  <div className="text-xs text-muted-foreground mb-1">Display Mode:</div>
                  <div className="font-semibold text-sm">{displayModeLabel}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {displayMode === 'real'
                      ? 'Currency values show purchasing power in today\'s terms (inflation-adjusted)'
                      : 'Currency values show future nominal amounts (not inflation-adjusted)'}
                  </div>
                </div>

                <div className="pt-2 border-t border-primary/20">
                  <div className="text-xs font-semibold mb-2 text-muted-foreground">CALCULATION CHECKSUMS:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Param label="Total Accounts" value={accounts.length} small />
                    <Param label="Total Balance" value={formatCurrency(totalBalance)} small />
                    <Param label="Monthly Contrib" value={formatCurrency(totalMonthlyContribution)} small />
                    <Param label="Weighted Return" value={formatPercent(weightedReturn)} small />
                    <Param label="Weighted Fees" value={formatPercent(weightedFees)} small />
                    <Param label="Net Return" value={formatPercent(netReturn)} small />
                  </div>
                </div>

                <Separator className="my-2" />

                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Portfolio at Retirement:</div>
                    <div className="font-semibold text-primary">
                      {projection ? formatCurrency(projection.portfolioAtRetirement) : 'Calculating...'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Success Rate:</div>
                    <div className="font-semibold text-primary">
                      {simulationResult ? `${simulationResult.successRate.toFixed(2)}%` : 'Simulating...'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Years to Depletion:</div>
                    <div className="font-semibold text-primary">
                      {projection?.portfolioDepletionAge ? `Age ${projection.portfolioDepletionAge}` : 'Never'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Replacement Ratio:</div>
                    <div className="font-semibold text-primary">
                      {replacementRatio.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </CategorySection>
```

- [ ] **Step 2: Verify the Dialog still opens and displays critical metrics**

```bash
npm run dev
```

Expected: Dialog opens, shows Critical Metrics section with colored background and left border.

- [ ] **Step 3: Commit**

```bash
git add components/debug/debug-window.tsx
git commit -m "feat: reorganize Calculation Method into Critical Metrics category"
```

---

## Task 4: Reorganize Calculation Inputs Category

**Files:**
- Modify: `components/debug/debug-window.tsx:493-559` (Personal Info through Tax Deductions)

**Interfaces:**
- Consumes: Personal info, retirement goals, accounts, drawdown config, tax deduction calcs
- Produces: Wrapped sections under `CategorySection` with `category="inputs"`

- [ ] **Step 1: Wrap Calculation Inputs sections**

After the Critical Metrics CategorySection, add all Calculation Inputs sections wrapped in a single CategorySection. Insert this code where the old Personal Information section was (around line 493):

```typescript
            {/* CALCULATION INPUTS */}
            <CategorySection title="Calculation Inputs" category="inputs">
              <Section title="Personal Information">
                <Param label="Current Age" value={personalInfo.currentAge} />
                <Param label="Retirement Age" value={personalInfo.retirementAge} />
                <Param label="Life Expectancy" value={personalInfo.lifeExpectancy} />
                <Param label="Annual Income" value={formatCurrency(personalInfo.annualIncome)} />
                <Param label="Years to Retirement" value={yearsToRetirement} highlight />
                <Param label="Years in Retirement" value={yearsInRetirement} highlight />
              </Section>

              <Section title="Retirement Goals">
                <Param
                  label="Desired Monthly Income (Today)"
                  value={formatCurrency(retirementGoals.desiredMonthlyIncome)}
                />
                <Param
                  label="Inflation Rate"
                  value={`${retirementGoals.inflationRate}%`}
                />
                <Param
                  label="Inflation Rate (Decimal)"
                  value={inflationRate.toFixed(4)}
                  highlight
                />
                <Param
                  label="Legacy Amount"
                  value={formatCurrency(retirementGoals.legacyAmount)}
                />
              </Section>

              <Section title="Retirement Eligibility (SA Tax Rules)">
                <Param
                  label="Can Access RA"
                  value={canAccessRA ? 'YES (Age 55+)' : 'NO (Must be 55+)'}
                  highlight={canAccessRA}
                />
                <Param
                  label="Can Access Preservation Fund"
                  value={canAccessPreservation ? 'YES (1/3 lump sum)' : 'NO'}
                />
                <Param
                  label="Retirement Eligible"
                  value={retirementEligible ? 'YES' : 'NO'}
                  highlight={retirementEligible}
                />
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-semibold mb-2">TAX DEDUCTIONS (2026/2027):</p>
                  <Param label="Annual Contribution" value={formatCurrency(annualContribution)} />
                  <Param
                    label="Max RA Deduction"
                    value={`${formatCurrency(maxRADeduction)} (27.5% of income, max R430k)`}
                    highlight
                  />
                  <Param
                    label="Estimated Tax Savings"
                    value={`${formatCurrency(taxSavings)} (45% marginal rate)`}
                    highlight
                  />
                  <Param
                    label="Effective Cost After Tax"
                    value={formatCurrency(annualContribution - taxSavings)}
                  />
                </div>
              </Section>

              <Section title={`Accounts (${accounts.length})`}>
                {accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No accounts configured</p>
                ) : (
                  accounts.map((account, index) => (
                    <div key={account.id} className="mb-4 p-3 bg-muted/50 rounded-md">
                      <h4 className="font-semibold text-sm mb-2">
                        {index + 1}. {account.name} ({account.type})
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <Param label="Provider" value={account.provider} small />
                        <Param label="Balance" value={formatCurrency(account.currentBalance)} small />
                        <Param label="Monthly Contribution" value={formatCurrency(account.monthlyContribution)} small />
                        <Param label="Expected Return" value={`${account.expectedReturn}%`} small />
                        <Param label="Annual Fees" value={`${account.annualFees}%`} small />
                        <Param label="Escalation" value={`${account.contributionEscalation}%`} small />
                      </div>
                    </div>
                  ))
                )}
              </Section>

              <Section title="Drawdown Configuration">
                <Param label="Strategy" value={drawdownConfig.strategy} />
                <Param
                  label="Initial Withdrawal Rate"
                  value={`${drawdownConfig.initialWithdrawalRate}%`}
                />
                <Param
                  label="Minimum Withdrawal (Monthly)"
                  value={formatCurrency(drawdownConfig.minimumWithdrawal)}
                />
                <Param
                  label="Maximum Withdrawal (Monthly)"
                  value={formatCurrency(drawdownConfig.maximumWithdrawal)}
                />
                <Param
                  label="Lump Sum at Retirement"
                  value={`${drawdownConfig.lumpSumPercentage}%`}
                />
                {drawdownConfig.upperGuardrail && (
                  <Param
                    label="Upper Guardrail"
                    value={`${drawdownConfig.upperGuardrail}%`}
                  />
                )}
                {drawdownConfig.lowerGuardrail && (
                  <Param
                    label="Lower Guardrail"
                    value={`${drawdownConfig.lowerGuardrail}%`}
                  />
                )}
                {drawdownConfig.monthlyMedicalAid && (
                  <Param
                    label="Monthly Medical Aid"
                    value={formatCurrency(drawdownConfig.monthlyMedicalAid)}
                  />
                )}
                {drawdownConfig.medicalAidDependants !== undefined && (
                  <Param
                    label="Medical Aid Dependants"
                    value={drawdownConfig.medicalAidDependants}
                  />
                )}
              </Section>

              {assumptions && (
                <Section title="Market Assumptions">
                  <Param label="Equity Return" value={`${assumptions.equityReturn}%`} />
                  <Param label="Bond Return" value={`${assumptions.bondReturn}%`} />
                  <Param label="Cash Return" value={`${assumptions.cashReturn}%`} />
                  <Param label="Equity Volatility" value={`${assumptions.equityVolatility}%`} />
                  <Param label="Bond Volatility" value={`${assumptions.bondVolatility}%`} />
                  <Param label="Inflation Rate" value={`${assumptions.inflationRate}%`} />
                </Section>
              )}
            </CategorySection>
```

- [ ] **Step 2: Delete old individual sections**

Remove all the old individual sections that are now within the Calculation Inputs CategorySection (Personal Information, Retirement Goals, Retirement Eligibility, Accounts, Drawdown Configuration, Market Assumptions).

- [ ] **Step 3: Verify the Dialog displays Calculation Inputs category**

```bash
npm run dev
```

Expected: Dialog shows "Critical Metrics" section (dark teal background), followed by "Calculation Inputs" section (lighter teal background). Both have left borders.

- [ ] **Step 4: Commit**

```bash
git add components/debug/debug-window.tsx
git commit -m "feat: wrap Calculation Inputs sections in color-coded CategorySection"
```

---

## Task 5: Reorganize Calculated Results Category

**Files:**
- Modify: `components/debug/debug-window.tsx` (Portfolio through Monte Carlo Results sections)

**Interfaces:**
- Consumes: Portfolio aggregates, withdrawal details, tax calcs, projection results, simulation results
- Produces: Wrapped sections under `CategorySection` with `category="results"`

- [ ] **Step 1: Add Calculated Results category**

After the Calculation Inputs CategorySection closes, insert the Calculated Results CategorySection with all Portfolio Aggregates, Withdrawal Details, Tax Calculations, Projection Results, and Monte Carlo Results sections.

- [ ] **Step 2: Delete old individual sections**

Remove Portfolio Aggregates, Withdrawal Details, Tax Calculations, Projection Results, and Monte Carlo Results sections (they're now wrapped in Calculated Results CategorySection).

- [ ] **Step 3: Verify Calculated Results displays**

```bash
npm run dev
```

Expected: Dialog now shows 3 sections: Critical Metrics, Calculation Inputs, Calculated Results with appropriate colors.

- [ ] **Step 4: Commit**

```bash
git add components/debug/debug-window.tsx
git commit -m "feat: wrap Calculated Results sections in color-coded CategorySection"
```

---

## Task 6: Reorganize Reference Data Category

**Files:**
- Modify: `components/debug/debug-window.tsx` (SA Defaults through end)

**Interfaces:**
- Consumes: SA defaults, spending phases, accuracy notes, Monte Carlo config
- Produces: Wrapped sections under `CategorySection` with `category="reference"`

- [ ] **Step 1: Add Reference Data category**

After Calculated Results CategorySection closes, insert Reference Data CategorySection with Monte Carlo Simulation, Spending Phase Multipliers, SA Default Constants, and Accuracy Notes sections.

- [ ] **Step 2: Delete old individual sections**

Remove old Monte Carlo Configuration, Spending Phase Multipliers, and SA Defaults sections (now in Reference Data CategorySection).

- [ ] **Step 3: Verify all four categories display**

```bash
npm run dev
```

Expected: Dialog shows all 4 color-coded categories: Critical Metrics, Calculation Inputs, Calculated Results, Reference Data.

- [ ] **Step 4: Test copy-all functionality**

Click copy button, paste into text editor, verify all sections are included.

Expected: Copy works, all data present.

- [ ] **Step 5: Commit**

```bash
git add components/debug/debug-window.tsx
git commit -m "feat: reorganize Reference Data sections with color-coded CategorySection"
```

---

## Task 7: Verify All Sections Display and Copy Works

**Files:**
- Test: `components/debug/debug-window.tsx` (manual verification)

**Interfaces:**
- Consumes: All section content from previous tasks
- Produces: Verified Dialog with all 4 categories, working copy functionality

- [ ] **Step 1-8: Full verification suite** (see plan for detailed steps)

Run dev server, open debug dialog, verify:
- All 4 color-coded categories visible and distinct
- Monospace fonts on values
- Copy-all button works
- Dialog interactions (Escape, backdrop click)
- Mobile responsiveness
- No calculation changes
- All tests pass

- [ ] **Step 9: Commit**

```bash
git add components/debug/debug-window.tsx
git commit -m "test: verify all debug window categories display and copy functionality works"
```

---

## Task 8: Final Code Review and Cleanup

**Files:**
- Modify: `components/debug/debug-window.tsx` (final polish)

**Interfaces:**
- Consumes: All previous changes
- Produces: Clean, final version ready for merge

- [ ] **Steps 1-6: Cleanup and format**

Remove debug comments, verify imports, format, type-check, test, commit.

---

## Task 9: Update Phase Documentation

**Files:**
- Modify: `docs/project-phases.md`, `docs/project-phases/phase-9-site-improvement.md`

**Interfaces:**
- Consumes: Phase documentation structure
- Produces: Updated documentation reflecting debug window completion

- [ ] **Steps 1-3: Update docs and commit**

Add dated entry to project-phases.md, mark task complete in phase-9 docs, commit.

---

## Verification Checklist

- ✅ Dialog opens/closes smoothly
- ✅ All 4 color-coded categories display
- ✅ Monospace values
- ✅ Copy-all works
- ✅ Mobile responsive
- ✅ No calculation changes
- ✅ All tests pass
- ✅ Phase docs updated
