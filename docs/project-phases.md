# SA Retirement Calculator - Project Phases

This document provides an overview of all project phases. For detailed information about each phase, see the individual phase files linked below.

## Phase Overview

Based on REQUIREMENTS.md, the project is being developed in the following phases:

| Phase | Status | Documentation |
|-------|--------|---------------|
| **Phase 1** | ✅ Complete | [Calculation Accuracy](project-phases/phase-1-calculation-accuracy.md) |
| **Phase 1.5** | ✅ Complete | [Testing & Validation](project-phases/phase-1-5-testing-validation.md) |
| **Phase 1.6** | ✅ Complete | [Performance Optimization](project-phases/phase-1-6-performance-optimization.md) |
| **Phase 1.7** | ✅ Complete | [Next 16 / React 19 / Tailwind v4 Modernization](project-phases/phase-1-7-modernization.md) |
| **Phase 2** | 🔄 In Progress | [Supabase Integration](project-phases/phase-2-supabase.md) |
| **Phase 3** | 🔲 Pending | [User Accounts](project-phases/phase-3-user-accounts.md) |
| **Phase 4** | 🔲 Pending | [Data Persistence](project-phases/phase-4-data-persistence.md) |
| **Phase 5** | 🔲 Pending | [Export Functionality](project-phases/phase-5-export-functionality.md) |
| **Phase 6** | 🔄 In Progress | [Enhanced Tax Calculations](project-phases/phase-6-enhanced-tax.md) |
| **Future** | 📋 Planned | [Future Enhancements](project-phases/future-enhancements.md) |

## Current Status Summary

**Latest Update (2026-04-27) — Sticky results bar + collapsible spacing fix:**
- ✅ **StickyResultsBar** — new fixed-bottom bar showing Portfolio at Retirement, Monthly Income, Success Rate; appears via IntersectionObserver once the metrics grid scrolls out of view; pulses a spinner when recalculating
- ✅ **Collapsible section spacing** — removed `dashboard-section` class (mb-12/mb-16) from `CollapsibleSection` accordion; sections now use border dividers only with no excessive gap
- 🔄 **Phase 6 (Tax):** ~93% complete; pending — account-specific depletion timeline, medical aid credits, TFSA lifetime limit tracking
- 🎯 **Next:** medical aid credits or TFSA lifetime limit tracking

**Previous Update (2026-04-27) — Phase 6 bug fixes and display mode:**
- ✅ **Display mode** — nominal/real toggle now applies to all currency values in the calculations breakdown; per-row `yearsFromNow` deflation in yearly tables
- ✅ **Payslip fix** — `monthlyIncomeAtRetirement` now correctly uses the post-lump-sum portfolio
- ✅ **Monte Carlo fix** — success rate now reflects the reduced drawdown portfolio when a lump sum is configured; was previously too optimistic

**Previous Update (2026-04-19) — Phase 2 started:**
- ✅ **Accounts persist to Supabase** — anonymous auth, RLS, fire-and-forget store sync all working
- ✅ **Local Supabase stack** — docker-in-docker added to devcontainer; `npx supabase start` to run
- 🎯 **Next:** scenarios table, TypeScript type generation, then Phase 3 (real auth)

**Previous Update (2026-04-12) — Phase 1.6 complete:**
- ✅ **Removed duplicate calculation in CalculationsBreakdown** — component now accepts `projection` prop from parent, eliminating two manual projection loops and a second `calculateProjection()` call. Breakdown figures now match the projection engine exactly.
- ✅ **Phase 1.6 marked complete** — Web Workers (2026-04-11), Zustand useShallow (Phase 1.7), and duplicate calculation fix (2026-04-12) cover all high-impact items. Remaining deferred items (form debouncing, InsightsPanel worker) have diminishing returns.

**Previous Update (2026-04-11):**
- ✅ **Phase 1.7 Complete:** Next 16 / React 19 / Tailwind v4 Modernization (all 6 steps, commits 3640f93…6e45ed3)
- ✅ **All deferred items resolved** including React Compiler audit, RSC split, and Node.js/Zod migrations
- 📊 **Production perf vs baseline:** interactive TBT **597ms → 533ms (-10.7%)**, longTaskMs **847ms → 783ms (-7.6%)**
- 🎯 **Next:** Phase 2 (Supabase integration)

**Previous Update (2026-01-15):**
- ✅ **Phase 1.6 Phase 1 Complete:** Quick Wins Implemented
- ✅ Recharts tree-shaking optimization
- ✅ React.memo added to 4 key components
- ✅ InsightsPanel dependency optimization
- 📊 Expected: 20-30% performance improvement

**Previous Update (2026-01-07):**
- ✅ Comprehensive SA retirement tax calculations implemented
- ✅ Age-based rebates, income tax, and lump sum tax modeling
- ✅ Retirement payslip UI and tax breakdown components

## How to Use This Documentation

1. **For Phase Details:** Click on any phase link in the table above to see:
   - Specific completed tasks and deliverables
   - Pending work and deferred items
   - Documentation references
   - Implementation sketches and code examples

2. **For Planning:** Review the "Current Status Summary" to understand:
   - What's complete and ready to build on
   - What's in progress and timeline
   - What's pending for future work

3. **For Contributing:** When updating a phase:
   - Edit the corresponding file in `docs/project-phases/`
   - Update the status indicator (✅/🔄/🔲) in the phase table above
   - Add a dated entry to the "Current Status Summary" section
   - Keep each phase file focused and concise (under 500 lines where possible)

## Filing Structure

```
docs/
├── project-phases/
│   ├── phase-1-calculation-accuracy.md
│   ├── phase-1-5-testing-validation.md
│   ├── phase-1-6-performance-optimization.md
│   ├── phase-1-7-modernization.md
│   ├── phase-2-supabase.md
│   ├── phase-3-user-accounts.md
│   ├── phase-4-data-persistence.md
│   ├── phase-5-export-functionality.md
│   ├── phase-6-enhanced-tax.md
│   └── future-enhancements.md
└── project-phases.md (this file)
```

## Guidelines for Maintaining This Documentation

**When updating a phase:**
1. Edit the corresponding file in `docs/project-phases/{phase-name}.md`
2. Update the status emoji in the phase table above (✅ for complete, 🔄 for in progress, 🔲 for pending)
3. Add a dated status update to the "Current Status Summary" section
4. Each phase file should be self-contained and focus on that phase's scope
5. Reference related history files in `history/` for deep dives
6. Keep the main `project-phases.md` file as a lightweight index

**When creating new phases:**
1. Create a new file: `docs/project-phases/phase-N-{description}.md`
2. Use the template from an existing phase file
3. Add a row to the phase table in `project-phases.md`
4. Link to the new file in the phase overview table
