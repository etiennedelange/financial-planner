"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { AnimatePresence, motion } from "motion/react"

import { Button } from "@/components/ui/button"

// True after client hydration. Reading the resolved theme before mount on the
// server would render the wrong icon for the current theme, so we keep the
// server snapshot "false" and switch to the client value on hydration. Done via
// useSyncExternalStore instead of a setState-in-effect so the first client
// render already matches the theme.
function useMounted() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()

  const isDark = mounted && resolvedTheme === "dark"
  const Icon = isDark ? Moon : Sun

  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative h-8 w-8 px-0 text-muted-foreground hover:text-foreground"
      title={isDark ? "Dark mode — click for light" : "Light mode — click for dark"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      onMouseDown={(e) => e.currentTarget.blur()}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={isDark ? "dark" : "light"}
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
