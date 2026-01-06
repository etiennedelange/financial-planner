# Playwright UI Flow Documentation

This directory contains Playwright tests for documenting the SA Retirement Calculator's user flows and capturing UX pain points.

## Purpose

**This is NOT for E2E testing** - it's for:
- 📸 Documenting user journeys with screenshots
- 🔍 Identifying UX pain points (tab switching, context loss)
- 📊 Capturing "before" state for future UI improvements
- 📱 Testing responsive layouts (desktop/tablet/mobile)

## Quick Start

### Run All Journeys (All Viewports)
```bash
npm run ui:doc
```

### Run Single Viewport
```bash
npm run ui:doc:desktop  # Fastest, desktop only
npm run ui:doc:tablet   # Tablet viewport
npm run ui:doc:mobile   # Mobile viewport
```

### Debug Mode
```bash
npm run ui:doc:headed   # Watch tests run in browser
npm run ui:doc:debug    # Step-through debugging
```

### View Results
```bash
npm run ui:doc:report   # Open Playwright HTML report
```

## Output

Screenshots are saved to:
```
e2e/output/screenshots/
├── journey-01-first-time-user/
│   ├── 01-empty-state.png
│   ├── 02-add-account-dialog-open.png
│   └── ...
├── journey-02-multi-account-setup/
└── ...
```

## User Journeys

### Journey 1: First-Time User
- **File:** `journeys/01-first-time-user.spec.ts`
- **Scenario:** Empty state → Add first account → Explore tabs
- **Captures:** Tab switching friction, context loss

### Journey 2: Multi-Account Setup
- **File:** `journeys/02-multi-account-setup.spec.ts`
- **Scenario:** Add TFSA + RA + Pension Fund
- **Captures:** Multiple account management

### Journey 3: Personal & Goals
- **File:** `journeys/03-personal-goals.spec.ts`
- **Scenario:** Adjust age, retirement, income
- **Captures:** Switching to see impact

### Journey 4: Insights Exploration
- **File:** `journeys/04-insights-exploration.spec.ts`
- **Scenario:** View recommendations and analysis
- **Captures:** Context loss when comparing with accounts

### Journey 5: Display Modes
- **File:** `journeys/05-display-modes.spec.ts`
- **Scenario:** Toggle Real vs Nominal
- **Captures:** Mode visibility across tabs

### Journey 6: Calculations Review
- **File:** `journeys/06-calculations-review.spec.ts`
- **Scenario:** Detailed formulas and breakdowns
- **Captures:** Tab switching to verify inputs

### Journey 7: Responsive Layouts
- **File:** `journeys/07-responsive-layouts.spec.ts`
- **Scenario:** Same flows on mobile/tablet
- **Captures:** Tab navigation on small screens

## Known UX Issues Being Documented

🔴 **Critical Pain Point: Excessive Tab Switching**
- Too many clicks to see related information (adjust assumptions → see insights impact)
- Loss of context when switching between tabs
- Cannot compare information across tabs (e.g., see accounts while viewing insights)

The screenshots document these issues for future UI redesign planning.

## Helpers & Utilities

### StateManager (`helpers/state-manager.ts`)
Manipulates localStorage for test setup:
```typescript
const stateManager = new StateManager(page)

// Clear state
await stateManager.clearState()

// Seed preset state
await stateManager.seedState(SINGLE_TFSA_STATE)

// Wait for hydration
await stateManager.waitForHydration()
```

### ScreenshotHelper (`helpers/screenshot-helper.ts`)
Captures and organizes screenshots:
```typescript
const screenshots = new ScreenshotHelper(page, 'journey-01-first-time-user')

// Full page screenshot
await screenshots.capture('empty-state', { fullPage: true })

// Element screenshot
await screenshots.captureElement('.recharts-wrapper', 'chart')

// Wait for charts
await screenshots.waitForCharts()
```

### State Seeds (`fixtures/state-seeds.ts`)
Preset states for different scenarios:
- `EMPTY_STATE` - No accounts
- `SINGLE_TFSA_STATE` - One TFSA account
- `MULTI_ACCOUNT_STATE` - TFSA + RA + Pension
- `RETIREMENT_READY_STATE` - Near retirement (age 63)
- `TFSA_AT_LIMIT_STATE` - R500k limit reached (R0 contributions)
- `OLD_PENSION_STATE` - Old employer pension (R0 contributions)

## Adding a New Journey

1. Create test file in `journeys/`:
```bash
touch e2e/journeys/08-my-new-journey.spec.ts
```

2. Use the template:
```typescript
import { test } from '@playwright/test'
import { StateManager } from '../helpers/state-manager'
import { ScreenshotHelper } from '../helpers/screenshot-helper'
import { EMPTY_STATE } from '../fixtures/state-seeds'

test.describe('Journey 8: My New Journey', () => {
  let screenshots: ScreenshotHelper
  let stateManager: StateManager

  test.beforeEach(async ({ page }) => {
    screenshots = new ScreenshotHelper(page, 'journey-08-my-new-journey')
    stateManager = new StateManager(page)

    await page.goto('/calculator')
    await stateManager.clearState()
    await stateManager.seedState(EMPTY_STATE)
    await page.reload()
    await stateManager.waitForHydration()
  })

  test('should document my new journey', async ({ page }) => {
    await screenshots.capture('step-1')
    // ... your test steps
  })
})
```

3. Run your journey:
```bash
npm run ui:doc:desktop -- 08-my-new-journey
```

## Configuration

Edit `playwright.config.ts` to:
- Add new viewport sizes
- Adjust timeouts
- Change screenshot settings
- Configure CI integration

## CI Integration (Future)

Currently runs locally only. For CI:
1. Add to `.github/workflows/ui-doc.yml`
2. Upload screenshots as artifacts
3. Comment on PRs with screenshot links

## Troubleshooting

### Charts not rendering
```typescript
await screenshots.waitForCharts()
```

### State not persisting
```typescript
await stateManager.seedState(STATE)
await page.reload()  // Important!
await stateManager.waitForHydration()
```

### Monte Carlo timing out
```typescript
await screenshots.waitForMonteCarloSimulation()
```

### Selectors not finding elements
Use accessible roles:
```typescript
// ✅ Good
await page.getByRole('button', { name: 'Add Account' })

// ❌ Avoid
await page.click('.btn-add')
```

## Next Steps

After documenting current flow:
1. Review all screenshots
2. Identify patterns in UX friction
3. Create backlog items for improvements
4. Design new UI layout (separate plan)

Potential solutions to explore:
- Single scrolling page (replace tabs with sections)
- Sidebar navigation (keep all content visible)
- Split-screen layout (inputs left, results right)
- Floating insights panel (always accessible)
- Sticky summary cards (metrics stay visible)
