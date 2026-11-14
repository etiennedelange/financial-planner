import { act, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"
import { Slider } from "./slider"

describe("Slider", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const thumb = () => container.querySelector<HTMLElement>("[role=slider]")!
  const press = (key: string) =>
    act(async () => {
      thumb().dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }))
    })

  describe("accessible name", () => {
    it("is on the element that has role=slider, so assistive tech announces it", async () => {
      await act(async () =>
        root.render(<Slider aria-label="Initial Withdrawal Rate" defaultValue={[4]} />),
      )
      expect(thumb().getAttribute("aria-label")).toBe("Initial Withdrawal Rate")
    })

    it("supports aria-labelledby too", async () => {
      await act(async () =>
        root.render(
          <>
            <span id="lbl">Lump sum</span>
            <Slider aria-labelledby="lbl" defaultValue={[4]} />
          </>,
        ),
      )
      expect(thumb().getAttribute("aria-labelledby")).toBe("lbl")
    })

    it("does not duplicate the label on the (role-less) root", async () => {
      await act(async () => root.render(<Slider aria-label="Rate" defaultValue={[4]} />))
      expect(container.querySelectorAll('[aria-label="Rate"]')).toHaveLength(1)
    })
  })

  describe("behaviour", () => {
    function Harness({
      onChange,
      onCommit,
    }: {
      onChange: (v: number) => void
      onCommit: (v: number) => void
    }) {
      const [value, setValue] = useState([10])
      return (
        <Slider
          aria-label="Value"
          value={value}
          min={0}
          max={20}
          step={5}
          onValueChange={([v]) => {
            setValue([v])
            onChange(v)
          }}
          onValueCommit={([v]) => onCommit(v)}
        />
      )
    }

    it("exposes its range and current value to assistive tech", async () => {
      await act(async () =>
        root.render(<Slider aria-label="V" min={2} max={8} defaultValue={[4]} />),
      )
      expect(thumb().getAttribute("aria-valuemin")).toBe("2")
      expect(thumb().getAttribute("aria-valuemax")).toBe("8")
      expect(thumb().getAttribute("aria-valuenow")).toBe("4")
    })

    it("a keyboard step changes the value and commits it", async () => {
      const onChange = vi.fn()
      const onCommit = vi.fn()
      await act(async () => root.render(<Harness onChange={onChange} onCommit={onCommit} />))
      await press("ArrowRight")
      expect(onChange).toHaveBeenCalledWith(15)
      expect(onCommit).toHaveBeenCalledWith(15)
      expect(thumb().getAttribute("aria-valuenow")).toBe("15")
    })

    it("Home and End jump to the bounds, and the value never leaves them", async () => {
      const onChange = vi.fn()
      await act(async () => root.render(<Harness onChange={onChange} onCommit={() => {}} />))
      await press("End")
      expect(thumb().getAttribute("aria-valuenow")).toBe("20")
      await press("ArrowRight")
      expect(thumb().getAttribute("aria-valuenow")).toBe("20")
      await press("Home")
      expect(thumb().getAttribute("aria-valuenow")).toBe("0")
    })
  })
})
