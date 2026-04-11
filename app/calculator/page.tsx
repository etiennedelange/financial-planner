import { CalculatorClient } from "./calculator-client"

/**
 * Server component shell for the calculator route.
 *
 * Kept as a server component so that:
 *  - Next.js renders the route without hydrating the outer shell
 *  - Future Supabase server-side data fetching can be added here and passed
 *    as props to CalculatorClient (e.g. initial accounts from the DB)
 *
 * All interactive logic lives in CalculatorClient ("use client").
 */
export default function CalculatorPage() {
  return <CalculatorClient />
}
