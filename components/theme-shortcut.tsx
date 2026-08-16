"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"

/**
 * Press `d` anywhere to toggle between light and dark mode.
 *
 * Bare-letter shortcuts must never fire while the user is typing, so the
 * handler bails out for every typing target (inputs, textareas, selects, and
 * contenteditable nodes) before looking at the key.
 */
export function ThemeShortcut() {
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return
      }
      if (e.key === "d" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [resolvedTheme, setTheme])

  return null
}
