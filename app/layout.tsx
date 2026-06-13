import { ColorThemeProvider } from "@/components/color-theme-provider"
import { SupabaseProvider } from "@/components/supabase-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google"
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('color-theme');if(t)document.documentElement.classList.add('theme-'+t)}catch(e){}`,
          }}
        />
      </head>
      <body className={`${ibmPlexSans.className} h-full`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ColorThemeProvider defaultTheme="gold" storageKey="color-theme">
            <SupabaseProvider>
              <main className="bg-background h-full">
                {children}
              </main>
            </SupabaseProvider>
          </ColorThemeProvider>
        </ThemeProvider>
        <Analytics />
      {/* impeccable-live-start */}
<script src="http://localhost:8400/live.js"></script>
{/* impeccable-live-end */}
</body>
    </html>
  )
}
