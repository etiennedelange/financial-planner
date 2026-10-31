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
 * file permitted to contain the raw formula. Ported from the ESLint
 * `no-restricted-syntax` selectors when lint moved to Oxlint (Oxlint has no
 * `no-restricted-syntax`); the exemptions live in vite.config.ts.
 */
import { definePlugin, defineRule } from "vite-plus/lint/plugins"

const INFLATION_NAME = /[Ii]nflation/

// `1 + <…inflation…>`
function isOnePlusInflation(node) {
  return (
    node?.type === "BinaryExpression" &&
    node.operator === "+" &&
    node.left.type === "Literal" &&
    node.left.value === 1 &&
    node.right.type === "Identifier" &&
    INFLATION_NAME.test(node.right.name)
  )
}

const noHandRolledInflation = defineRule({
  meta: {
    type: "problem",
    messages: {
      mathPow:
        "Do not hand-roll inflation exponentiation. Use escalate() / deflate() / inflationFactor() from lib/calculations/utils/money-time.ts — mixing money bases is what caused the 75f68f7 replacement-ratio bug.",
      exponent:
        "Do not hand-roll inflation exponentiation. Use escalate() / deflate() / inflationFactor() from lib/calculations/utils/money-time.ts.",
    },
  },
  create(context) {
    return {
      // Math.pow(1 + <…inflation…>, n)
      CallExpression(node) {
        const { callee } = node
        if (
          callee.type === "MemberExpression" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "Math" &&
          callee.property.type === "Identifier" &&
          callee.property.name === "pow" &&
          node.arguments.some(isOnePlusInflation)
        ) {
          context.report({ node, messageId: "mathPow" })
        }
      },
      // (1 + <…inflation…>) ** n
      BinaryExpression(node) {
        if (node.operator === "**" && (isOnePlusInflation(node.left) || isOnePlusInflation(node.right))) {
          context.report({ node, messageId: "exponent" })
        }
      },
    }
  },
})

export default definePlugin({
  meta: { name: "money-time" },
  rules: { "no-hand-rolled-inflation": noHandRolledInflation },
})
