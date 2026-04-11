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

export function ColorThemeProvider({
  children,
  defaultTheme = "blue",
  storageKey = "color-theme",
}: ColorThemeProviderProps) {
  // Start with defaultTheme so SSR and initial client render agree (no hydration mismatch).
  // After mount, read localStorage and update if a stored preference exists.
  const [colorTheme, setColorThemeState] = React.useState<ColorTheme>(defaultTheme)

  React.useEffect(() => {
    const stored = localStorage.getItem(storageKey) as ColorTheme | null
    if (stored) setColorThemeState(stored)
  }, [storageKey])

  React.useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("theme-blue", "theme-green", "theme-rose", "theme-violet", "theme-orange")
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
