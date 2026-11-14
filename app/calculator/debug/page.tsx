"use client"

import { useCalculator } from "@/lib/context/calculator-context"
import dynamic from "next/dynamic"

const DebugPage = dynamic(
  () => import("@/components/pages/debug-page").then((m) => ({ default: m.DebugPage })),
  { ssr: false },
)

export default function DebugRoute() {
  const { projection, simulationResult, isDeferred } = useCalculator()
  return (
    <DebugPage
      projection={projection}
      simulationResult={simulationResult}
      isDeferred={isDeferred}
    />
  )
}
