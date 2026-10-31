import { describe, it } from "vite-plus/test"
import { RuleTester } from "vite-plus/lint/plugins-dev"
import plugin from "./money-time-plugin.mjs"

RuleTester.describe = describe
RuleTester.it = it

const rule = plugin.rules["no-hand-rolled-inflation"]

new RuleTester().run("money-time/no-hand-rolled-inflation", rule, {
  valid: [
    "escalate(amount, years, inflationRate)",
    "inflationFactor(years, inflationRate)",
    // Not inflation: returns and fees may still be compounded inline.
    "Math.pow(1 + annualReturn, years)",
    "(1 + monthlyRate) ** months",
    // Not `1 + <name>`.
    "Math.pow(inflationRate, 2)",
    "Math.pow(2 + inflationRate, years)",
    "Math.pow(1 - inflationRate, years)",
    "(1 + inflationRate) * years",
    "Math.max(1 + inflationRate, years)",
  ],
  invalid: [
    { code: "Math.pow(1 + inflationRate, years)", errors: [{ messageId: "mathPow" }] },
    {
      code: "Math.pow(1 + inflation, yearsToRetirement + year)",
      errors: [{ messageId: "mathPow" }],
    },
    { code: "Math.pow(1 + generalInflation, n)", errors: [{ messageId: "mathPow" }] },
    { code: "(1 + inflationRate) ** years", errors: [{ messageId: "exponent" }] },
    { code: "const f = (1 + medicalInflation) ** (age - 65)", errors: [{ messageId: "exponent" }] },
  ],
})
