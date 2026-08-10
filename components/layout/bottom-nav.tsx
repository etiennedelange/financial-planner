"use client"

import { BarChart3, LayoutDashboard, Receipt, Settings, SlidersHorizontal, TrendingUp, Wallet } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/calculator/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/calculator/accounts", label: "Accounts", icon: Wallet },
  { href: "/calculator/plan", label: "Plan", icon: SlidersHorizontal },
  { href: "/calculator/expenses", label: "Expenses", icon: Receipt },
  { href: "/calculator/projections", label: "Projections", icon: TrendingUp },
  { href: "/calculator/charts", label: "Charts", icon: BarChart3 },
  { href: "/calculator/settings", label: "Settings", icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-14">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors active:bg-accent/40",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-[20%] right-[20%] h-[2px] rounded-b-full bg-primary" />
              )}
              <Icon className={cn("h-[18px] w-[18px] transition-transform duration-150", isActive && "scale-105")} />
              <span className="text-[9px] tracking-wide font-medium leading-none">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
