"use client"

import { TopBar } from "./top-bar"
import { Sidebar } from "./sidebar"
import { BottomNav } from "./bottom-nav"
import { StorageHealthBanner } from "./storage-health-banner"

interface AppShellProps {
  accountCount: number
  isLoaded: boolean
  children: React.ReactNode
}

export function AppShell({ accountCount, isLoaded, children }: AppShellProps) {
  return (
    // data-bootstrap-phase exposes store-hydration readiness to e2e tests
    // (state-manager's waitForHydration polls it instead of a blind sleep).
    <div
      className="flex h-screen overflow-hidden"
      data-bootstrap-phase={isLoaded ? "ready" : "loading"}
    >
      {/* Sidebar — desktop only */}
      <Sidebar accountCount={accountCount} isLoaded={isLoaded} />

      {/* Content area — offset by sidebar on desktop, full width on mobile */}
      <div className="flex flex-1 flex-col md:pl-(--sidebar-width) overflow-hidden">
        <TopBar />
        <StorageHealthBanner />
        {/* A div: app/layout.tsx already wraps every page in the one <main> landmark */}
        <div data-app-scroller className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 pt-4 pb-24 md:px-8 md:py-6">{children}</div>
        </div>
      </div>

      {/* Bottom nav — mobile only */}
      <BottomNav />
    </div>
  )
}
