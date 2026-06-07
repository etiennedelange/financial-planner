"use client"

import * as React from "react"
import { Palette } from "lucide-react"
import { useColorTheme } from "@/components/color-theme-provider"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const themes = [
  { name: "Gold", value: "gold", color: "bg-yellow-500" },
  { name: "Blue", value: "blue", color: "bg-blue-500" },
  { name: "Green", value: "green", color: "bg-green-500" },
  { name: "Rose", value: "rose", color: "bg-rose-500" },
  { name: "Violet", value: "violet", color: "bg-violet-500" },
  { name: "Orange", value: "orange", color: "bg-orange-500" },
] as const

export function ColorThemeToggle() {
  const { colorTheme, setColorTheme } = useColorTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Palette className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Toggle color theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Color Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themes.map((theme) => (
          <DropdownMenuItem
            key={theme.value}
            onClick={() => setColorTheme(theme.value as any)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className={`w-4 h-4 rounded-full ${theme.color}`} />
            <span>{theme.name}</span>
            {colorTheme === theme.value && (
              <span className="ml-auto text-xs">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
