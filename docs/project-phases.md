---
type: Status Overview
title: "SA Retirement Calculator - Project Phases"
description: "Phase status table for the whole project; links to one file per phase."
---

# SA Retirement Calculator - Project Phases

This document provides an overview of all project phases. For detailed information about each phase, see the individual phase files linked below.

## Phase Overview

Based on REQUIREMENTS.md, the project is being developed in the following phases:

| Phase | Status | Documentation |
|-------|--------|---------------|
| **Phase 1** | ✅ Complete | [Calculation Accuracy](project-phases/phase-1-calculation-accuracy.md) |
| **Phase 1.5** | ✅ P0 resolved | [Testing & Validation](project-phases/phase-1-5-testing-validation.md) — invariants rewritten, 12/12 mutations killed |
| **Phase 1.6** | ✅ Complete | [Performance Optimization](project-phases/phase-1-6-performance-optimization.md) |
| **Phase 1.7** | ✅ Complete | [Next 16 / React 19 / Tailwind v4 Modernization](project-phases/phase-1-7-modernization.md) |
| **Phase 2** | ✅ Complete | [Supabase Integration](project-phases/phase-2-supabase.md) |
| **Phase 3** | ✅ Risk register resolved | [User Accounts](project-phases/phase-3-user-accounts.md) |
| **Phase 4** | ✅ Complete | [Data Persistence](project-phases/phase-4-data-persistence.md) |
| **Phase 5** | 🔄 In Progress | [Export Functionality](project-phases/phase-5-export-functionality.md) |
| **Phase 6** | ✅ Complete | [Enhanced Tax Calculations](project-phases/phase-6-enhanced-tax.md) |
| **Phase 7** | ✅ Complete | [UI Redesign — Sidebar App Shell](project-phases/phase-7-ui-redesign.md) |
| **Phase 8** | ✅ Complete | [Expense Tracker](project-phases/phase-8-expense-tracker.md) |
| **Phase 9** | 🔄 In Progress | [Site-Wide Improvement](project-phases/phase-9-site-improvement.md) |
| **Phase 10** | ✅ Complete | [Calculation Simplification](project-phases/phase-10-calculation-simplification.md) — all steps done; engine deduplicated, money units type-safe, MC seeded |
| **Phase 11** | 📋 Planned | [Dead Code Cleanup](project-phases/phase-11-dead-code-cleanup.md) — knip-verified unused files/deps/exports |
| **Future** | 📋 Planned | [Future Enhancements](project-phases/future-enhancements.md) |

## Recent Activity

See [log.md](log.md) — the chronological update log (newest first), one line per entry
linking to its `history/` write-up.

## Maintaining This File

See [README.md](README.md) for the three-tier rule and conventions. In short: full detail
goes in a dated `history/` file; phase files carry checkboxes and pending lists; `log.md`
gets a one-line entry; this file's status emoji changes only when a phase's status
genuinely changes.
