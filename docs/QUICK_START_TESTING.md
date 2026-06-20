# Quick Start: Testing Implementation

**Use this document to quickly ask Claude to implement testing tasks**

---

## How to Use This Document

Simply copy one of the commands below and paste it to Claude Code:

---

## Priority 0 (Critical - Do First)

### Consolidate Duplicate Functions
```
Implement Task 1 from docs/history/testing-and-validation-plan.md:
Consolidate the duplicate projectFinalSavings functions into a single
shared utility at lib/calculations/utils/projection.ts
```

### Enhance Debug Window
```
Implement Task 2 from docs/history/testing-and-validation-plan.md:
Add compounding method display and calculation checksums to the Debug Window
```

---

## Priority 1 (High Priority)

### Add Unit Tests
```
Implement Task 3 from docs/history/testing-and-validation-plan.md:
Set up Vitest and create unit tests for core calculation functions
```

### Add Integration Tests
```
Implement Task 4 from docs/history/testing-and-validation-plan.md:
Create cross-tab consistency tests to ensure all tabs show the same values
```

---

## Priority 2 (Medium Priority)

### Display Mode Tests
```
Implement Task 5 from docs/history/testing-and-validation-plan.md:
Add tests to verify display mode toggle updates all currency values
```

### Validation Script
```
Implement Task 6 from docs/history/testing-and-validation-plan.md:
Create automated validation script for debug output
```

---

## Run All Tests

### After Implementation
```
Please run the following tests and verify they all pass:
1. npm test
2. npm run test:coverage
3. npm run build
4. Use the SA retirement validator agent to verify calculations
```

---

## Complete All Testing Tasks

### Full Implementation
```
Please implement Phase 1.5 (Testing & Validation Framework) from
docs/history/project-phases.md. Start with P0 tasks, then P1, then P2.
Follow the detailed steps in docs/history/testing-and-validation-plan.md.
```

---

## Update Progress

### After Completing Tasks
```
Please update docs/history/project-phases.md to mark completed tasks
and update the progress percentage for Phase 1.5
```

---

## Tips

- Start with P0 tasks (consolidation) as they have the highest impact
- Run tests after each task to ensure nothing breaks
- Use the Debug Window to verify calculations after changes
- Check that all tabs show consistent values
- Validate with the SA retirement validator agent for complex scenarios

---

## References

- Full plan: `docs/history/testing-and-validation-plan.md`
- Project phases: `docs/history/project-phases.md`
- Development guide: `CLAUDE.md`
