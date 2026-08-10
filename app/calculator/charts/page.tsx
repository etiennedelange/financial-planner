"use client"

import dynamic from "next/dynamic"

const ChartsPage = dynamic(
  () => import("@/components/pages/charts-page").then((m) => ({ default: m.ChartsPage })),
  { ssr: false }
)

export default function ChartsRoute() {
  return <ChartsPage />
}
