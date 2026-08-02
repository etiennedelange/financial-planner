/**
 * COMPILE-TIME regression test — there are no runtime assertions here on purpose.
 *
 * This file is checked by `npx tsc --noEmit`. It pins the money-basis branding that
 * prevents the replacement-ratio bug shipped in 75f68f7, where a nominal at-retirement
 * withdrawal was divided by a present-day salary (a 5x overstatement over 30 years).
 *
 * If someone widens `Rands<B>` back to a covariant brand, the `@ts-expect-error` below
 * becomes "unused" and the type check fails — which is the point.
 */

import { calculateReplacementRatio } from '@/lib/calculations/retirement-tax'
import { retirementRands, todayRands, escalateToRetirement } from '@/lib/calculations/utils/money-time'

const withdrawalAtRetirement = retirementRands(902259)
const salaryToday = todayRands(600000)

// @ts-expect-error - mixing bases must not compile (this was the shipped bug)
calculateReplacementRatio(withdrawalAtRetirement, salaryToday)

// The correct form must compile.
calculateReplacementRatio(
  withdrawalAtRetirement,
  escalateToRetirement(salaryToday, 30, 0.055)
)
