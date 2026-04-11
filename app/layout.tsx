import { ColorThemeProvider } from "@/components/color-theme-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/next"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SA Retirement Calculator",
  description: "South African retirement planning with Monte Carlo simulations",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ColorThemeProvider defaultTheme="blue" storageKey="color-theme">
            <main className="min-h-screen bg-background">
              {children}
            </main>
          </ColorThemeProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
