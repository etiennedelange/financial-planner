"use client"

import dynamic from "next/dynamic"

const RiskPage = dynamic(
  () => import("@/components/pages/risk-page").then((m) => ({ default: m.RiskPage })),
  { ssr: false },
)

export default function RiskRoute() {
  return <RiskPage />
}
