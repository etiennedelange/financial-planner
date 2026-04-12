"use client"

import * as React from "react"

type ColorTheme = "blue" | "green" | "rose" | "violet" | "orange"

type ColorThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: ColorTheme
  storageKey?: string
}

type ColorThemeProviderState = {
  colorTheme: ColorTheme
  setColorTheme: (theme: ColorTheme) => void
}

const initialState: ColorThemeProviderState = {
  colorTheme: "blue",
  setColorTheme: () => null,
}

const ColorThemeProviderContext = React.createContext<ColorThemeProviderState>(initialState)

const THEME_CLASSES = ["theme-blue", "theme-green", "theme-rose", "theme-violet", "theme-orange"] as const

export function ColorThemeProvider({
  children,
  defaultTheme = "blue",
  storageKey = "color-theme",
}: ColorThemeProviderProps) {
  // The pre-hydration script in app/layout.tsx already applies the stored
  // theme class to <html> before React hydrates, so there's no flash.
  // We read localStorage on mount to sync React state with what's on the DOM.
  const [colorTheme, setColorThemeState] = React.useState<ColorTheme>(() => {
    if (typeof window === "undefined") return defaultTheme
    return (localStorage.getItem(storageKey) as ColorTheme) ?? defaultTheme
  })

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.remove(...THEME_CLASSES)
    root.classList.add(`theme-${colorTheme}`)
  }, [colorTheme])

  const value = {
    colorTheme,
    setColorTheme: (theme: ColorTheme) => {
      localStorage.setItem(storageKey, theme)
      setColorThemeState(theme)
    },
  }

  // React 19: <Context> can be used directly as a provider (no .Provider needed)
  return (
    <ColorThemeProviderContext value={value}>
      {children}
    </ColorThemeProviderContext>
  )
}

export const useColorTheme = () => {
  const context = React.useContext(ColorThemeProviderContext)

  if (context === undefined)
    throw new Error("useColorTheme must be used within a ColorThemeProvider")

  return context
}
