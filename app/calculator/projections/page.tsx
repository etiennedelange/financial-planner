"use client"

import { useCalculator } from "@/lib/context/calculator-context"
import dynamic from "next/dynamic"

const ProjectionsPage = dynamic(
  () => import("@/components/pages/projections-page").then((m) => ({ default: m.ProjectionsPage })),
  { ssr: false }
)

export default function ProjectionsRoute() {
  const { projection } = useCalculator()
  return <ProjectionsPage projection={projection} />
}
