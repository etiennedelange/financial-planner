import { Suspense } from "react"
import { PrintClient } from "./print-client"

export const metadata = { title: "Retirement Plan Report" }

export default function PrintPage() {
  return (
    <Suspense>
      <PrintClient />
    </Suspense>
  )
}
