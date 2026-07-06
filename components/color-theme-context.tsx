"use client"

import React, { createContext, useContext, useState } from "react"

type ColorTheme = "gold" | "teal-yellow"

interface ColorThemeContextType {
  colorTheme: ColorTheme
  setColorTheme: (theme: ColorTheme) => void
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(undefined)

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    if (typeof window === "undefined") return "gold"
    const stored = localStorage.getItem("color-theme") as ColorTheme | null
    return (stored === "gold" || stored === "teal-yellow") ? stored : "gold"
  })

  const handleSetColorTheme = (theme: ColorTheme) => {
    setColorTheme(theme)
    localStorage.setItem("color-theme", theme)
    applyColorTheme(theme)
  }

  return (
    <ColorThemeContext.Provider
      value={{
        colorTheme,
        setColorTheme: handleSetColorTheme,
      }}
    >
      {children}
    </ColorThemeContext.Provider>
  )
}

export function useColorTheme() {
  const context = useContext(ColorThemeContext)
  if (!context) {
    throw new Error("useColorTheme must be used within ColorThemeProvider")
  }
  return context
}

function applyColorTheme(theme: ColorTheme) {
  const html = document.documentElement
  html.classList.remove("theme-gold", "theme-teal-yellow")
  html.classList.add(`theme-${theme}`)
}
