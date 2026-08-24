"use client"

import {
  ChartColumnIcon,
  LayoutDashboardIcon,
  ReceiptIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  TrendingUpIcon,
  WalletIcon,
} from "@animateicons/react/lucide"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAnimatedIcon, type AnimatedIconComponent } from "@/components/ui/animated-icon"

const NAV_ITEMS: { href: string; label: string; icon: AnimatedIconComponent }[] = [
  { href: "/calculator/overview", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/calculator/accounts", label: "Accounts", icon: WalletIcon },
  { href: "/calculator/plan", label: "Plan", icon: SlidersHorizontalIcon },
  { href: "/calculator/expenses", label: "Expenses", icon: ReceiptIcon },
  { href: "/calculator/projections", label: "Projections", icon: TrendingUpIcon },
  { href: "/calculator/charts", label: "Charts", icon: ChartColumnIcon },
  { href: "/calculator/settings", label: "Settings", icon: SettingsIcon },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-14">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <BottomNavItem key={item.href} item={item} active={isActive} />
          )
        })}
      </div>
    </nav>
  )
}

function BottomNavItem({ item, active }: { item: (typeof NAV_ITEMS)[number]; active: boolean }) {
  const { iconProps, controlProps } = useAnimatedIcon()
  const Icon = item.icon

  return (
    <Link
      {...controlProps}
      href={item.href}
      prefetch
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors active:bg-accent/40",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      {active && (
        <span className="absolute top-0 left-[20%] right-[20%] h-[2px] rounded-b-full bg-primary" />
      )}
      <Icon
        {...iconProps}
        size={18}
        className={cn("transition-transform duration-150", active && "scale-105")}
      />
      <span className="text-[9px] tracking-wide font-medium leading-none">{item.label}</span>
    </Link>
  )
}
