"use client"

import { AuthModal } from "@/components/auth/auth-modal"
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
  ChartColumnIcon,
  LayoutDashboardIcon,
  ReceiptIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  TrendingUpIcon,
  WalletIcon,
} from "@animateicons/react/lucide"
import { LogOut, User as UserIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { useAnimatedIcon, type AnimatedIconComponent } from "@/components/ui/animated-icon"

const NAV_ITEMS: { href: string; label: string; icon: AnimatedIconComponent; showBadge?: boolean }[] = [
  { href: "/calculator/overview", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/calculator/accounts", label: "Accounts", icon: WalletIcon, showBadge: true },
  { href: "/calculator/plan", label: "Plan", icon: SlidersHorizontalIcon },
  { href: "/calculator/expenses", label: "Expenses", icon: ReceiptIcon },
  { href: "/calculator/projections", label: "Projections", icon: TrendingUpIcon },
  { href: "/calculator/charts", label: "Charts", icon: ChartColumnIcon },
]

interface SidebarProps {
  accountCount: number
  user: User | null
  isLoaded: boolean
}

function NavItem({
  item,
  accountCount,
  active,
}: {
  item: (typeof NAV_ITEMS)[number]
  accountCount: number
  active: boolean
}) {
  const { iconProps, controlProps } = useAnimatedIcon()
  const Icon = item.icon

  return (
    <Link
      {...controlProps}
      href={item.href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-all duration-150",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {active && (
        <span className="absolute left-0 inset-y-1 w-[2px] rounded-full bg-primary" />
      )}
      <Icon {...iconProps} size={16} className="shrink-0" />
      <span className="flex-1 text-left tracking-wide">{item.label}</span>
      {item.showBadge && accountCount > 0 && (
        <Badge
          variant="outline"
          className={cn(
            "ml-auto h-4 min-w-4 px-1 text-[10px]",
            active ? "border-primary/30 bg-primary/10 text-primary" : ""
          )}
        >
          {accountCount}
        </Badge>
      )}
    </Link>
  )
}

function SettingsNavLink({ active }: { active: boolean }) {
  const { iconProps, controlProps } = useAnimatedIcon()

  return (
    <Link
      {...controlProps}
      href="/calculator/settings"
      prefetch
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-all duration-150",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {active && (
        <span className="absolute left-0 inset-y-1 w-[2px] rounded-full bg-primary" />
      )}
      <SettingsIcon {...iconProps} size={16} className="shrink-0" />
      <span className="tracking-wide">Settings</span>
    </Link>
  )
}

export function Sidebar({ accountCount, user, isLoaded }: SidebarProps) {
  const pathname = usePathname()
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const isAnon = !user
  const email = user?.email

  async function handleSignOut() {
    await createClient().auth.signOut()
  }

  return (
    <aside className="fixed left-0 top-0 z-30 hidden md:flex h-screen w-(--sidebar-width) flex-col bg-background border-r border-border">
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
      <nav aria-label="Main navigation" className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            accountCount={accountCount}
            active={pathname === item.href}
          />
        ))}
      </nav>

      {/* Bottom utility */}
      <div className="px-3 pb-4 border-t border-border pt-3 space-y-0.5">
        <SettingsNavLink active={pathname === "/calculator/settings"} />

        <div>
          {isAnon ? (
            <button
              onClick={() => setAuthModalOpen(true)}
              aria-label="Sign in to your account"
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
                <button aria-label="Account menu" className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 border border-primary/25">
                    <UserIcon className="h-3 w-3 text-primary" />
                  </div>
                  <span className="flex-1 truncate text-left text-xs">{email}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/calculator/settings">
                    <SettingsIcon className="mr-2 h-4 w-4" size={16} />
                    Manage Account
                  </Link>
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
    </aside>
  )
}
