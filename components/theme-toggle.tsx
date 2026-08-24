"use client"

import * as React from "react"
import { MoonIcon, SunIcon } from "@animateicons/react/lucide"
import { useReducedMotion } from "motion/react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { useAnimatedIcon } from "@/components/ui/animated-icon"
import { cn } from "@/lib/utils"

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
  const reduceMotion = useReducedMotion()

  // One hook per icon: an AnimatePresence-style keyed remount of a single icon
  // would detach the shared imperative ref (the exiting fiber nulls it once
  // its exit completes), leaving the icon unanimated after any theme switch or
  // the hydration flip. Both icons stay mounted instead — each keeps its own
  // stable ref — and the crossfade is a plain CSS transition.
  const sun = useAnimatedIcon()
  const moon = useAnimatedIcon()
  const active = mounted && resolvedTheme === "dark" ? moon : sun
  const isDark = active === moon

  // A theme switch while the pointer is already over the button does not fire a
  // fresh mouseenter, so kick the newly-visible icon's animation off manually.
  const hovering = React.useRef(false)
  React.useEffect(() => {
    if (hovering.current) active.controlProps.onMouseEnter?.()
  }, [isDark, active])

  // Gated on `mounted` as well: the server renders with reduceMotion=false, so
  // branching on the client-only value alone would mismatch hydration under
  // prefers-reduced-motion. Server and first client render both see mounted=false.
  const crossfade = mounted && !reduceMotion && "transition-all duration-300 ease-out"
  const hidden = "opacity-0 scale-50"

  return (
    <Button
      {...active.controlProps}
      onMouseEnter={() => {
        hovering.current = true
        active.controlProps.onMouseEnter?.()
      }}
      onMouseLeave={() => {
        hovering.current = false
        active.controlProps.onMouseLeave?.()
      }}
      variant="ghost"
      size="sm"
      className="relative h-8 w-8 px-0 text-muted-foreground hover:text-foreground"
      title={isDark ? "Dark mode — click for light" : "Light mode — click for dark"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      onMouseDown={(e) => e.currentTarget.blur()}
    >
      <span className="relative h-4 w-4">
        <SunIcon
          {...sun.iconProps}
          size={16}
          aria-hidden
          className={cn(
            "absolute inset-0",
            crossfade,
            isDark ? cn(hidden, "translate-y-1.5") : "opacity-100 scale-100 translate-y-0",
          )}
        />
        <MoonIcon
          {...moon.iconProps}
          size={16}
          aria-hidden
          className={cn(
            "absolute inset-0",
            crossfade,
            isDark ? "opacity-100 scale-100 translate-y-0" : cn(hidden, "-translate-y-1.5"),
          )}
        />
      </span>
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
