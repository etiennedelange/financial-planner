"use client"

import * as React from "react"
import { Moon, Sun, Palette } from "lucide-react"
import { useTheme } from "next-themes"
import { AnimatePresence, motion } from "motion/react"

import { Button } from "@/components/ui/button"
import { useColorTheme } from "@/components/color-theme-context"

type ThemeState = "light-gold" | "dark-gold" | "light-teal" | "dark-teal"

const CYCLE: ThemeState[] = ["light-gold", "dark-gold", "light-teal", "dark-teal"]

const ICONS: Record<ThemeState, React.ComponentType<{ className?: string }>> = {
  "light-gold": Sun,
  "dark-gold": Moon,
  "light-teal": Palette,
  "dark-teal": Palette,
} as const

const LABELS: Record<ThemeState, string> = {
  "light-gold": "Light Gold",
  "dark-gold": "Dark Gold",
  "light-teal": "Light Teal",
  "dark-teal": "Dark Teal",
} as const

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const { colorTheme, setColorTheme } = useColorTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  const getCurrentState = (): ThemeState => {
    if (!mounted) return "light-gold"
    const mode = resolvedTheme === "dark" ? "dark" : "light"
    const theme = colorTheme === "teal-yellow" ? "teal" : "gold"
    return `${mode}-${theme}` as ThemeState
  }

  const current = getCurrentState()
  const nextIndex = (CYCLE.indexOf(current) + 1) % CYCLE.length
  const next = CYCLE[nextIndex]

  const handleThemeChange = () => {
    const [mode, theme] = next.split("-") as [string, string]
    setTheme(mode)
    setColorTheme(theme === "teal" ? "teal-yellow" : "gold")
  }

  const Icon = ICONS[current]

  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative h-8 w-8 px-0 text-muted-foreground hover:text-foreground"
      title={`${LABELS[current]} — click for ${LABELS[next]}`}
      onClick={handleThemeChange}
      onMouseDown={(e) => e.currentTarget.blur()}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={current}
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
