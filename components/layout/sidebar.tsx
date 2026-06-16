"use client"

import { AuthModal } from "@/components/auth/auth-modal"
import { ProfileModal } from "@/components/auth/profile-modal"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import {
  LayoutDashboard,
  LogOut,
  Receipt,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
  Settings,
  User as UserIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"

const NAV_ITEMS: { href: string; label: string; icon: React.ElementType; showBadge?: boolean }[] = [
  { href: "/calculator/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/calculator/accounts", label: "Accounts", icon: Wallet, showBadge: true },
  { href: "/calculator/plan", label: "Plan", icon: SlidersHorizontal },
  { href: "/calculator/expenses", label: "Expenses", icon: Receipt },
  { href: "/calculator/projections", label: "Projections", icon: TrendingUp },
]

interface SidebarProps {
  accountCount: number
  user: User | null
  isLoaded: boolean
}

export function Sidebar({ accountCount, user, isLoaded }: SidebarProps) {
  const pathname = usePathname()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)

  const isAnon = !user || user.is_anonymous
  const email = user?.email

  async function handleSignOut() {
    await createClient().auth.signOut()
  }

  return (
    <aside className="fixed left-0 top-0 z-30 hidden md:flex h-screen w-[220px] flex-col bg-background border-r border-border">
      {/* Wordmark */}
      <div className="px-4 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-sm bg-primary flex items-center justify-center shrink-0">
            <span className="font-mono text-[9px] font-bold tracking-tight text-primary-foreground leading-none">
              SA
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground leading-none">
              Retirement
            </span>
            <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground leading-none">
              Calculator
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute left-0 inset-y-1 w-[2px] rounded-full bg-primary" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left tracking-wide">{item.label}</span>
              {item.showBadge && accountCount > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-auto h-4 min-w-4 px-1 text-[10px]",
                    isActive ? "border-primary/30 bg-primary/10 text-primary" : ""
                  )}
                >
                  {accountCount}
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom utility */}
      <div className="px-3 pb-4 border-t border-border pt-3 space-y-0.5">
        <Link
          href="/calculator/settings"
          className={cn(
            "group relative flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-all duration-150",
            pathname === "/calculator/settings"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {pathname === "/calculator/settings" && (
            <span className="absolute left-0 inset-y-1 w-[2px] rounded-full bg-primary" />
          )}
          <Settings className="h-4 w-4 shrink-0" />
          <span className="tracking-wide">Settings</span>
        </Link>

        <div>
          {isAnon ? (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 border border-primary/25">
                <UserIcon className="h-3 w-3 text-primary" />
              </div>
              <span className="flex-1 truncate text-left text-xs">Sign in</span>
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 border border-primary/25">
                    <UserIcon className="h-3 w-3 text-primary" />
                  </div>
                  <span className="flex-1 truncate text-left text-xs">{email}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setProfileModalOpen(true)} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Manage Account
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      {user && !isAnon && (
        <ProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} user={user} />
      )}
    </aside>
  )
}
