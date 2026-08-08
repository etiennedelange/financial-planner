import { SupabaseProvider } from "@/components/supabase-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google"
import { connection } from "next/server"
import { headers } from "next/headers"
import "./globals.css"

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-ibm-sans",
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-mono",
})

export const metadata: Metadata = {
  title: "SA Retirement Calculator",
  description: "South African retirement planning with Monte Carlo simulations",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Next.js only injects the request's CSP nonce into its own script tags on
  // dynamically rendered pages — statically prerendered routes have no request
  // at build time, so the nonce silently doesn't get applied and every
  // framework script trips the CSP. connection() forces dynamic rendering
  // app-wide so the nonce set in lib/supabase/proxy.ts always reaches them.
  await connection()

  // next-themes injects its own inline script (to set the theme class before
  // hydration) that Next.js's automatic nonce injection doesn't reach — it's
  // library-rendered, not framework-generated. next-themes accepts a nonce
  // prop specifically for this.
  const nonce = (await headers()).get("x-nonce") ?? undefined

  return (
    <html lang="en" suppressHydrationWarning className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full`}>
      <body className={`${ibmPlexSans.className} h-full`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem={true}
          disableTransitionOnChange
          nonce={nonce}
        >
          <SupabaseProvider>
            <main className="bg-background h-full">
              {children}
            </main>
          </SupabaseProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
