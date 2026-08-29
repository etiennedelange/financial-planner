import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PwaIconArtwork } from "./icon-artwork"

function render(node: React.ReactNode) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(node)
  })
  return { container, root }
}

describe("PwaIconArtwork", () => {
  let container: HTMLDivElement
  let root: Root

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it("keeps the background full-bleed to the 32x32 canvas so OS icon masks have edge-to-edge fill", () => {
    ;({ container, root } = render(<PwaIconArtwork />))
    const bg = container.querySelector("rect")
    expect(bg?.getAttribute("width")).toBe("32")
    expect(bg?.getAttribute("height")).toBe("32")
  })

  it("insets the chart glyph inside a safe zone so OS icon masks (e.g. Windows taskbar pinning, Android adaptive icons) can't clip it", () => {
    ;({ container, root } = render(<PwaIconArtwork />))
    const safeZone = container.querySelector("g[transform]")
    expect(safeZone).not.toBeNull()

    // Every bar, the trend polyline, and its endpoint dot must live inside the inset group.
    expect(safeZone?.querySelectorAll("rect")).toHaveLength(4)
    expect(safeZone?.querySelector("polyline")).not.toBeNull()
    expect(safeZone?.querySelector("circle")).not.toBeNull()

    // The inset scale must shrink content (not 1) so it lands inside the safe zone.
    const transform = safeZone?.getAttribute("transform") ?? ""
    const scaleMatch = transform.match(/scale\(([\d.]+)\)/)
    expect(scaleMatch).not.toBeNull()
    expect(Number(scaleMatch?.[1])).toBeLessThan(1)
  })

  it("only rounds the corners (favicon usage) when rounded is set, without moving the glyph", () => {
    ;({ container, root } = render(<PwaIconArtwork rounded />))
    const svg = container.querySelector("svg")
    const bg = container.querySelector("rect")
    expect(svg?.style.borderRadius).toBe("22%")
    expect(bg?.getAttribute("rx")).toBe("7")

    ;({ container, root } = render(<PwaIconArtwork />))
    const svgSquare = container.querySelector("svg")
    const bgSquare = container.querySelector("rect")
    expect(svgSquare?.style.borderRadius).toBe("0px")
    expect(bgSquare?.getAttribute("rx")).toBe("0")
  })
})
