"use client"

import { AuthModal } from "@/components/auth/auth-modal"
import { ProfileModal } from "@/components/auth/profile-modal"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { User } from "@supabase/supabase-js"
import {
  LayoutDashboard,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
  Settings,
  User as UserIcon,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

export type NavPage = "overview" | "accounts" | "plan" | "projections" | "settings"

const NAV_ITEMS: { id: NavPage; label: string; icon: React.ElementType; showBadge?: boolean }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "accounts", label: "Accounts", icon: Wallet, showBadge: true },
  { id: "plan", label: "Plan", icon: SlidersHorizontal },
  { id: "projections", label: "Projections", icon: TrendingUp },
]

interface SidebarProps {
  activePage: NavPage
  onNavigate: (page: NavPage) => void
  accountCount: number
  user: User | null
}

export function Sidebar({ activePage, onNavigate, accountCount, user }: SidebarProps) {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)

  const isAnon = !user || user.is_anonymous
  const email = user?.email

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-[220px] flex-col bg-card border-r">
      {/* Wordmark */}
      <div className="px-4 py-5">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          SA Retirement
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activePage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.showBadge && accountCount > 0 && (
                <Badge
                  variant={isActive ? "secondary" : "outline"}
                  className="ml-auto h-5 min-w-5 px-1.5 text-xs"
                >
                  {accountCount}
                </Badge>
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom utility */}
      <div className="px-2 pb-4">
        <Separator className="mb-2" />
        <button
          onClick={() => onNavigate("settings")}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            activePage === "settings"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Settings</span>
        </button>

        <button
          onClick={() => isAnon ? setAuthModalOpen(true) : setProfileModalOpen(true)}
          className="mt-0.5 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
            <UserIcon className="h-3.5 w-3.5" />
          </div>
          <span className="flex-1 truncate text-left text-xs">
            {isAnon ? "Sign in" : email}
          </span>
        </button>
      </div>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      {user && !isAnon && (
        <ProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} user={user} />
      )}
    </aside>
  )
}
