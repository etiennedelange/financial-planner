"use client"

import { TopBar } from "./top-bar"
import { Sidebar } from "./sidebar"
import type { User } from "@supabase/supabase-js"

interface AppShellProps {
  accountCount: number
  user: User | null
  isLoaded: boolean
  children: React.ReactNode
}

export function AppShell({ accountCount, user, isLoaded, children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar accountCount={accountCount} user={user} isLoaded={isLoaded} />

      {/* Content area — offset by sidebar width */}
      <div className="flex flex-1 flex-col pl-[220px] overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
