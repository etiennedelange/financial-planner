import { act, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"
import { NumberInput, type NumberInputProps } from "./number-input"
import { GROUP_SEPARATOR } from "@/lib/utils/number-field"

function typeInto(input: HTMLInputElement, value: string) {
  // The native setter bypasses React's value tracker (a plain `input.value =` would hide
  // the change from onChange); it is invoked with an explicit `this` on the next line.
  // oxlint-disable-next-line typescript/unbound-method
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

function press(input: HTMLInputElement, key: string) {
  const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
  input.dispatchEvent(e)
  return e
}

type HarnessProps = Partial<NumberInputProps> & { initial: number }

/** A parent that owns the value, like an inline editor's useState does */
function Harness({ initial, ...props }: HarnessProps) {
  const [value, setValue] = useState(initial)
  return (
    <NumberInput aria-label="Expense amount" value={value} onValueChange={setValue} {...props} />
  )
}

describe("NumberInput (inline editors)", () => {
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

  const render = async (props: HarnessProps) => {
    await act(async () => root.render(<Harness {...props} />))
  }
  const input = () => container.querySelector<HTMLInputElement>("input")!

  it("is named by aria-label when no visible label exists", async () => {
    await render({ initial: 1500 })
    expect(input().getAttribute("aria-label")).toBe("Expense amount")
  })

  it("shows a rand amount with cents, grouped, with the R inside the field", async () => {
    await render({ initial: 12_345.6, prefix: "R", group: true, decimals: 2 })
    expect(input().value).toBe(`12${GROUP_SEPARATOR}345.6`)
    expect(container.textContent).toContain("R")
  })

  it("keeps cents to two places and rejects a third", async () => {
    await render({ initial: 0, group: true, decimals: 2 })
    await act(async () => typeInto(input(), "10.999"))
    expect(input().value).toBe("10.99")
  })

  it("shows the placeholder for an empty (NaN) value", async () => {
    await render({ initial: NaN, placeholder: "0" })
    expect(input().value).toBe("")
    expect(input().placeholder).toBe("0")
  })

  it("runs the caller's key handler (Enter to save) before anything else", async () => {
    const onKeyDown = vi.fn()
    await render({ initial: 500, onKeyDown })
    await act(async () => void press(input(), "Enter"))
    expect(onKeyDown).toHaveBeenCalledTimes(1)
  })

  it("lets the caller veto arrow-key stepping with preventDefault", async () => {
    await render({ initial: 5, step: 1, onKeyDown: (e) => e.preventDefault() })
    await act(async () => void press(input(), "ArrowUp"))
    expect(input().value).toBe("5")
  })

  it("steps by default when the caller does not intervene", async () => {
    await render({ initial: 5, step: 1 })
    await act(async () => void press(input(), "ArrowUp"))
    expect(input().value).toBe("6")
  })

  it("names stepper buttons after the aria-label", async () => {
    await render({ initial: 5, stepper: true })
    expect(container.querySelector('[aria-label="Increase Expense amount"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Decrease Expense amount"]')).not.toBeNull()
  })

  it("opts out of password-manager autofill, since it is a text box rather than type=number", async () => {
    await render({ initial: 5 })
    expect(input().type).toBe("text")
    expect(input().hasAttribute("data-1p-ignore")).toBe(true)
    expect(input().getAttribute("data-lpignore")).toBe("true")
    expect(input().hasAttribute("data-bwignore")).toBe(true)
    expect(input().getAttribute("data-form-type")).toBe("other")
    expect(input().getAttribute("autocomplete")).toBe("off")
  })

  it("uses the compact height and right alignment for list rows", async () => {
    await render({ initial: 5, size: "sm", alignEnd: true })
    expect(container.firstElementChild!.className).toContain("h-8")
    expect(input().className).toContain("text-right")
  })

  it("form-size values match body copy (14px) on desktop but stay 16px on phones", async () => {
    // Bigger than the surrounding text looks wrong on desktop; smaller than 16px makes iOS
    // zoom the page on focus. So: text-base by default, text-sm from the sm breakpoint.
    await render({ initial: 5, prefix: "R" })
    expect(input().className).toContain("text-base")
    expect(input().className).toContain("sm:text-sm")
    expect(container.querySelector("span")!.className).toContain("sm:text-sm")
  })

  it("inline-size values are text-sm at every width", async () => {
    await render({ initial: 5, size: "sm" })
    expect(input().className).toContain("text-sm")
    expect(input().className).not.toContain("text-base")
  })

  it("marks the control invalid", async () => {
    await render({ initial: 5, invalid: true })
    expect(input().getAttribute("aria-invalid")).toBe("true")
  })
})
