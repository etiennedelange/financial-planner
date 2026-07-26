import { fixupConfigRules } from "@eslint/compat"
import coreWebVitals from "eslint-config-next/core-web-vitals"

const config = [
  { ignores: [".next/**", "coverage/**", "node_modules/**"] },
  ...fixupConfigRules(coreWebVitals),

  /**
   * Phase 10 Step 2 — money-time discipline.
   *
   * Hand-rolled inflation exponentiation was the shape of both recent P0 bugs: the
   * replacement ratio divided a nominal at-retirement rand by a present-day rand (a 5x
   * overstatement over 30 years), and `inflationAdjustedWithdrawal` used ^year instead of
   * ^(yearsToRetirement + year). There were 21 such expressions across 10 files, using
   * five different exponent expressions.
   *
   * They now all route through lib/calculations/utils/money-time.ts, which is the only
   * file permitted to contain the raw formula.
   */
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "lib/calculations/utils/money-time.ts",
      "lib/calculations/utils/money-time.test.ts",
      // Tests are DELIBERATELY exempt. A test that verifies the engine's escalation
      // must compute its expected value independently; if it called the same
      // escalate() the engine calls, a bug inside escalate() would be invisible and
      // the test would merely restate the implementation. Hand-rolled arithmetic in
      // a test is an independent oracle, not a smell.
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/__tests__/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // Math.pow(1 + <…inflation…>, n)
          selector:
            "CallExpression[callee.object.name='Math'][callee.property.name='pow'] > BinaryExpression[operator='+'][left.value=1][right.name=/[Ii]nflation/]",
          message:
            "Do not hand-roll inflation exponentiation. Use escalate() / deflate() / inflationFactor() from lib/calculations/utils/money-time.ts — mixing money bases is what caused the 75f68f7 replacement-ratio bug.",
        },
        {
          // (1 + <…inflation…>) ** n
          selector:
            "BinaryExpression[operator='**'] > BinaryExpression[operator='+'][left.value=1][right.name=/[Ii]nflation/]",
          message:
            "Do not hand-roll inflation exponentiation. Use escalate() / deflate() / inflationFactor() from lib/calculations/utils/money-time.ts.",
        },
      ],
    },
  },
]

export default config
