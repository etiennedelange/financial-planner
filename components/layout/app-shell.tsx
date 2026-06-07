"use client"

import { TopBar } from "./top-bar"
import { Sidebar } from "./sidebar"
import type { NavPage } from "./sidebar"
import type { User } from "@supabase/supabase-js"

interface AppShellProps {
  activePage: NavPage
  onNavigate: (page: NavPage) => void
  accountCount: number
  user: User | null
  displayMode: "nominal" | "real"
  onSetDisplayMode: (mode: "nominal" | "real") => void
  children: React.ReactNode
}

export function AppShell({
  activePage,
  onNavigate,
  accountCount,
  user,
  displayMode,
  onSetDisplayMode,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        accountCount={accountCount}
        user={user}
      />

      {/* Content area — offset by sidebar width */}
      <div className="flex flex-1 flex-col pl-[220px] overflow-hidden">
        <TopBar
          activePage={activePage}
          user={user}
          displayMode={displayMode}
          onSetDisplayMode={onSetDisplayMode}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
