import { ColorThemeProvider } from "@/components/color-theme-provider"
import { SupabaseProvider } from "@/components/supabase-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SA Retirement Calculator",
  description: "South African retirement planning with Monte Carlo simulations",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('color-theme');if(t)document.documentElement.classList.add('theme-'+t)}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.className} h-full`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ColorThemeProvider defaultTheme="blue" storageKey="color-theme">
            <SupabaseProvider>
              <main className="bg-background h-full">
                {children}
              </main>
            </SupabaseProvider>
          </ColorThemeProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
