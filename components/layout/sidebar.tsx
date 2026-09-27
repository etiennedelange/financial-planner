"use client"

import { Badge } from "@/components/ui/badge"
import {
  ChartColumnIcon,
  LayoutDashboardIcon,
  ReceiptIcon,
  SlidersHorizontalIcon,
  TrendingUpIcon,
  WalletIcon,
} from "@animateicons/react/lucide"
import Link from "next/link"
import { usePathname } from "next/navigation"
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

export function Sidebar({ accountCount, isLoaded }: SidebarProps) {
  const pathname = usePathname()
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
              Financial
            </span>
            <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground leading-none">
              Planner
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

    </aside>
  )
}
