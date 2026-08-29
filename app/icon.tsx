import { ImageResponse } from "next/og"
import { PwaIconArtwork } from "@/lib/pwa/icon-artwork"

// One file generates all three "icon" family sizes (favicon tab icon +
// the two manifest/PWA install sizes) instead of three near-identical
// icon.tsx/icon1.tsx/icon2.tsx routes — see generateImageMetadata.
export function generateImageMetadata() {
  return [
    { id: "32", size: { width: 32, height: 32 }, contentType: "image/png" },
    { id: "192", size: { width: 192, height: 192 }, contentType: "image/png" },
    { id: "512", size: { width: 512, height: 512 }, contentType: "image/png" },
  ]
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const iconId = await id
  const size = iconId === "32" ? 32 : iconId === "192" ? 192 : 512
  return new ImageResponse(<PwaIconArtwork rounded={iconId === "32"} />, {
    width: size,
    height: size,
  })
}
