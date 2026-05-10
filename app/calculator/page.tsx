import { Suspense } from "react"
import { CalculatorClient } from "./calculator-client"

export default function CalculatorPage() {
  return (
    <Suspense>
      <CalculatorClient />
    </Suspense>
  )
}
