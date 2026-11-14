import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test"
import { StorageHealthBanner } from "./storage-health-banner"
import {
  reportStorageFailure,
  reportStorageSuccess,
  resetStorageHealth,
} from "@/lib/store/storage-health"

describe("StorageHealthBanner", () => {
  let host: HTMLElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    resetStorageHealth()
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => root.render(<StorageHealthBanner />))
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    resetStorageHealth()
  })

  it("renders nothing while storage works", () => {
    expect(host.querySelector("[role=alert]")).toBeNull()
  })

  it("warns that storage is full, with a link to download a backup", () => {
    act(() => reportStorageFailure(new DOMException("full", "QuotaExceededError")))
    const alert = host.querySelector("[role=alert]")!
    expect(alert.textContent).toContain("storage is full")
    expect(alert.querySelector("a")?.getAttribute("href")).toBe("/calculator/settings")
  })

  it("warns that storage is blocked in private mode / blocked-site-data situations", () => {
    act(() => reportStorageFailure(new DOMException("denied", "SecurityError")))
    expect(host.querySelector("[role=alert]")!.textContent).toContain("blocking site storage")
  })

  it("disappears again once saving works", () => {
    act(() => reportStorageFailure(new Error("x")))
    expect(host.querySelector("[role=alert]")).not.toBeNull()
    act(() => reportStorageSuccess())
    expect(host.querySelector("[role=alert]")).toBeNull()
  })
})
