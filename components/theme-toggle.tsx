"use client"

import * as React from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { AnimatePresence, motion } from "motion/react"

import { Button } from "@/components/ui/button"

const CYCLE: Array<"light" | "dark" | "system"> = ["light", "dark", "system"]

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const
const LABELS = { light: "Light", dark: "Dark", system: "System" } as const

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const current = (mounted ? theme ?? "dark" : "dark") as "light" | "dark" | "system"
  const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]

  const iconKey = mounted
    ? theme === "system"
      ? "system"
      : resolvedTheme === "dark"
        ? "dark"
        : "light"
    : "dark"

  const Icon = ICONS[iconKey as keyof typeof ICONS]

  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative h-8 w-8 px-0 text-muted-foreground hover:text-foreground"
      title={`${LABELS[current]} — click for ${LABELS[next]}`}
      onClick={() => setTheme(next)}
      onMouseDown={(e) => e.currentTarget.blur()}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={iconKey}
          initial={{ opacity: 0, scale: 0.6, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: -6 }}
          transition={{ type: "spring", stiffness: 600, damping: 28 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <Icon className="h-4 w-4" />
        </motion.span>
      </AnimatePresence>
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
