"use client"

import { useCalculator } from "@/lib/context/calculator-context"
import dynamic from "next/dynamic"

const SettingsPage = dynamic(
  () => import("@/components/pages/settings-page").then((m) => ({ default: m.SettingsPage })),
  { ssr: false }
)

export default function SettingsRoute() {
  const { projection } = useCalculator()
  return <SettingsPage projection={projection} />
}
