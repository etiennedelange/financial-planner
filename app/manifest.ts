import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SA Retirement Calculator",
    short_name: "Retirement Calc",
    description: "South African retirement planning with Monte Carlo simulations",
    start_url: "/calculator",
    display: "standalone",
    background_color: "#faf9fb",
    theme_color: "#178262",
    icons: [
      { src: "/icon1", sizes: "192x192", type: "image/png" },
      { src: "/icon2", sizes: "512x512", type: "image/png" },
    ],
  }
}