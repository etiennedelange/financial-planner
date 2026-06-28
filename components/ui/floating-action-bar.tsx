"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface FloatingAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: "default" | "outline" | "ghost" | "secondary"
  disabled?: boolean
}

interface FloatingActionBarProps {
  primary: FloatingAction
  secondary?: FloatingAction
  hint?: string
  className?: string
}

export function FloatingActionBar({ primary, secondary, hint, className }: FloatingActionBarProps) {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  const ticking = useRef(false)

  useEffect(() => {
    const scroller = document.querySelector("main") as HTMLElement | null
    if (!scroller) return

    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        const y = scroller.scrollTop
        if (y > lastY.current + 12 && y > 80) {
          setHidden(true)
        } else if (y < lastY.current - 8) {
          setHidden(false)
        }
        lastY.current = y
        ticking.current = false
      })
    }

    scroller.addEventListener("scroll", onScroll, { passive: true })
    return () => scroller.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div
      className={cn(
        "fixed z-30 left-0 right-0 md:left-[220px]",
        "bottom-14 md:bottom-0",
        "border-t border-border bg-card/90 backdrop-blur-sm",
        "transition-transform duration-200 ease-out",
        hidden ? "translate-y-full" : "translate-y-0",
        className
      )}
    >
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-3 px-4 md:px-8">
        {hint ? (
          <p className="hidden md:block flex-1 font-mono text-[11px] text-muted-foreground/40 select-none">
            {hint}
          </p>
        ) : (
          <div className="flex-1" />
        )}
        {secondary && (
          <Button
            size="sm"
            variant={secondary.variant ?? "outline"}
            onClick={secondary.onClick}
            disabled={secondary.disabled}
            className="h-7 gap-1.5 px-3 text-xs"
          >
            {secondary.icon}
            {secondary.label}
          </Button>
        )}
        <Button
          size="sm"
          variant={primary.variant ?? "default"}
          onClick={primary.onClick}
          disabled={primary.disabled}
          className="h-7 gap-1.5 px-3 text-xs"
        >
          {primary.icon}
          {primary.label}
        </Button>
      </div>
    </div>
  )
}
