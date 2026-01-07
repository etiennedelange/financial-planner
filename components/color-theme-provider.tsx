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
  defaultTheme = "violet",
  storageKey = "color-theme",
  ...props
}: ColorThemeProviderProps) {
  const [colorTheme, setColorThemeState] = React.useState<ColorTheme>(
    () => (typeof window !== "undefined" && (localStorage.getItem(storageKey) as ColorTheme)) || defaultTheme
  )

  React.useEffect(() => {
    const root = window.document.documentElement

    // Remove all theme classes
    root.classList.remove("theme-blue", "theme-green", "theme-rose", "theme-violet", "theme-orange")

    // Add current theme class
    root.classList.add(`theme-${colorTheme}`)
  }, [colorTheme])

  const value = {
    colorTheme,
    setColorTheme: (theme: ColorTheme) => {
      localStorage.setItem(storageKey, theme)
      setColorThemeState(theme)
    },
  }

  return (
    <ColorThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ColorThemeProviderContext.Provider>
  )
}

export const useColorTheme = () => {
  const context = React.useContext(ColorThemeProviderContext)

  if (context === undefined)
    throw new Error("useColorTheme must be used within a ColorThemeProvider")

  return context
}
