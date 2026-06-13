"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { useColorTheme } from "@/components/color-theme-provider"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const themes = [
  { name: "Gold",   value: "gold",   color: "hsl(43 85% 45%)" },
  { name: "Blue",   value: "blue",   color: "hsl(225 73% 57%)" },
  { name: "Green",  value: "green",  color: "hsl(142 76% 36%)" },
  { name: "Rose",   value: "rose",   color: "hsl(346.8 77.2% 49.8%)" },
  { name: "Violet", value: "violet", color: "hsl(262.1 83.3% 57.8%)" },
  { name: "Orange", value: "orange", color: "hsl(24.6 95% 53.1%)" },
] as const

type ColorThemeValue = typeof themes[number]["value"]

export function ColorThemeToggle() {
  const { colorTheme, setColorTheme } = useColorTheme()
  const active = themes.find((t) => t.value === colorTheme) ?? themes[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 px-0"
          title="Accent color"
          onMouseDown={(e) => e.currentTarget.blur()}
        >
          <span
            className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10 dark:ring-white/10 transition-colors"
            style={{ backgroundColor: active.color }}
          />
          <span className="sr-only">Accent color</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Accent color
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="grid grid-cols-3 gap-1 p-1.5">
          {themes.map((t) => {
            const isActive = colorTheme === t.value
            return (
              <button
                key={t.value}
                onClick={() => setColorTheme(t.value as ColorThemeValue)}
                title={t.name}
                className="group flex flex-col items-center gap-1.5 rounded-md p-2 hover:bg-accent transition-colors cursor-pointer outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span
                  className="relative flex h-6 w-6 items-center justify-center rounded-full transition-[box-shadow]"
                  style={{
                    backgroundColor: t.color,
                    boxShadow: isActive
                      ? `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${t.color}`
                      : undefined,
                  }}
                >
                  {isActive && (
                    <Check
                      className="h-3 w-3 text-white"
                      style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.4))" }}
                    />
                  )}
                </span>
                <span
                  className={`text-[10px] leading-none transition-colors ${
                    isActive ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {t.name}
                </span>
              </button>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
