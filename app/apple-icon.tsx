import { ImageResponse } from "next/og"
import { PwaIconArtwork } from "@/lib/pwa/icon-artwork"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(<PwaIconArtwork />, { ...size })
}
