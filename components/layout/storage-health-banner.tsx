"use client"

import Link from "next/link"
import { useSyncExternalStore } from "react"
import { getStorageHealth, subscribeStorageHealth } from "@/lib/store/storage-health"

const MESSAGES = {
  quota: "Your browser's storage is full, so your latest changes are not being saved.",
  unavailable:
    "Your browser is blocking site storage (private mode or blocked site data), so changes won't be saved when you close this tab.",
} as const

/**
 * With no server copy, a failed save is silent data loss — so it is shown, loudly and
 * early, with the one thing the user can do about it: download a backup.
 */
export function StorageHealthBanner() {
  const health = useSyncExternalStore(subscribeStorageHealth, getStorageHealth, () => "ok" as const)
  if (health === "ok") return null

  return (
    <div
      role="alert"
      className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive md:px-8"
    >
      {MESSAGES[health]}{" "}
      <Link href="/calculator/settings" className="font-medium underline underline-offset-2">
        Download a backup
      </Link>
      .
    </div>
  )
}
