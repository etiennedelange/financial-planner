import { act, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MotionGlobalConfig } from "motion/react"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test"
import { NumberField, type NumberFieldProps } from "./number-field"
import { GROUP_SEPARATOR } from "@/lib/utils/number-field"

/** Type into an input the way a user does, so React sees the change */
function typeInto(input: HTMLInputElement, value: string) {
  // The native setter bypasses React's value tracker (a plain `input.value =` would hide
  // the change from onChange); it is invoked with an explicit `this` on the next line.
  // oxlint-disable-next-line typescript/unbound-method
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

function press(input: HTMLInputElement, key: string, shiftKey = false) {
  input.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true }))
}

const grouped = (s: string) => s.replace(/ /g, GROUP_SEPARATOR)

type HarnessProps = Partial<NumberFieldProps> & { initial: number; onChange?: (n: number) => void }

/** A parent that owns the value, like a react-hook-form Controller does */
function Harness({ initial, onChange, ...props }: HarnessProps) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <NumberField
        id="f"
        label="Annual income"
        value={value}
        onValueChange={(n) => {
          setValue(n)
          onChange?.(n)
        }}
        {...props}
      />
      <button type="button" id="external" onClick={() => setValue(42_000)}>
        external
      </button>
    </>
  )
}

describe("NumberField", () => {
  let container: HTMLDivElement
  let root: Root

  // happy-dom's Web Animations stub rejects when Motion cancels an animation.
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false
  })

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
  const input = () => container.querySelector<HTMLInputElement>("#f")!

  describe("Critical SA scenarios", () => {
    it("shows rands grouped with the unit inside the field", async () => {
      await render({ initial: 600_000, group: true, prefix: "R", suffix: "/ year" })
      expect(input().value).toBe(grouped("600 000"))
      expect(container.textContent).toContain("R")
      expect(container.textContent).toContain("/ year")
    })

    it("regroups as digits are typed and reports a number, not text", async () => {
      const onChange = vi.fn()
      await render({ initial: 0, group: true, onChange })
      await act(async () => typeInto(input(), "1250000"))
      expect(input().value).toBe(grouped("1 250 000"))
      expect(onChange).toHaveBeenLastCalledWith(1_250_000)
    })

    it("rejects a keystroke that would exceed the hard cap and keeps the old text", async () => {
      const onChange = vi.fn()
      await render({ initial: 900, group: true, hardMax: 1000, onChange })
      await act(async () => typeInto(input(), "9000"))
      expect(input().value).toBe("900")
      expect(onChange).not.toHaveBeenCalled()
    })

    it("accepts a value exactly at the hard cap", async () => {
      const onChange = vi.fn()
      await render({ initial: 100, hardMax: 1000, onChange })
      await act(async () => typeInto(input(), "1000"))
      expect(onChange).toHaveBeenLastCalledWith(1000)
    })
  })

  describe("Edge cases", () => {
    it("shows R0 as 0, not an empty field", async () => {
      await render({ initial: 0, group: true })
      expect(input().value).toBe("0")
    })

    it("reports NaN for a cleared field so the schema can say 'Enter a ...'", async () => {
      const onChange = vi.fn()
      await render({ initial: 35, onChange })
      await act(async () => typeInto(input(), ""))
      expect(input().value).toBe("")
      expect(onChange).toHaveBeenLastCalledWith(NaN)
    })

    it("shows a NaN value as an empty field", async () => {
      await render({ initial: NaN })
      expect(input().value).toBe("")
    })

    it("does not overwrite an in-progress decimal like '5.'", async () => {
      await render({ initial: 5, decimals: 2 })
      await act(async () => typeInto(input(), "5."))
      expect(input().value).toBe("5.")
      await act(async () => typeInto(input(), "5.5"))
      expect(input().value).toBe("5.5")
    })

    it("drops letters and extra decimals", async () => {
      const onChange = vi.fn()
      await render({ initial: 5, decimals: 2, onChange })
      await act(async () => typeInto(input(), "5a.5.5"))
      expect(input().value).toBe("5.55")
      expect(onChange).toHaveBeenLastCalledWith(5.55)
    })

    it("follows a value changed from outside, such as a scenario switch or reset", async () => {
      await render({ initial: 600_000, group: true })
      await act(async () => container.querySelector<HTMLButtonElement>("#external")!.click())
      expect(input().value).toBe(grouped("42 000"))
    })

    it("lets an out-of-range value be typed so the schema can explain it", async () => {
      const onChange = vi.fn()
      await render({ initial: 35, min: 18, max: 100, onChange })
      await act(async () => typeInto(input(), "150"))
      expect(input().value).toBe("150")
      expect(onChange).toHaveBeenLastCalledWith(150)
    })
  })

  describe("Stepping", () => {
    it("ArrowUp and ArrowDown step by `step`", async () => {
      const onChange = vi.fn()
      await render({ initial: 35, step: 1, min: 18, max: 100, onChange })
      await act(async () => press(input(), "ArrowUp"))
      expect(input().value).toBe("36")
      await act(async () => press(input(), "ArrowDown"))
      await act(async () => press(input(), "ArrowDown"))
      expect(input().value).toBe("34")
      expect(onChange).toHaveBeenLastCalledWith(34)
    })

    it("Shift multiplies the step by 10", async () => {
      await render({ initial: 600_000, group: true, step: 10_000, min: 0 })
      await act(async () => press(input(), "ArrowUp", true))
      expect(input().value).toBe(grouped("700 000"))
    })

    it("clamps at the bounds and never goes below R0", async () => {
      await render({ initial: 5_000, group: true, step: 10_000, min: 0 })
      await act(async () => press(input(), "ArrowDown"))
      expect(input().value).toBe("0")
      await act(async () => press(input(), "ArrowDown"))
      expect(input().value).toBe("0")
    })

    it("does not step past the hard cap", async () => {
      await render({ initial: 1000, step: 1, hardMax: 1000 })
      await act(async () => press(input(), "ArrowUp"))
      expect(input().value).toBe("1000")
    })

    it("stepper buttons are labelled and step the value", async () => {
      await render({ initial: 35, step: 1, min: 18, max: 100, stepper: true })
      const up = container.querySelector<HTMLButtonElement>(
        '[aria-label="Increase Annual income"]',
      )!
      const down = container.querySelector<HTMLButtonElement>(
        '[aria-label="Decrease Annual income"]',
      )!
      await act(async () => up.click())
      expect(input().value).toBe("36")
      await act(async () => down.click())
      await act(async () => down.click())
      expect(input().value).toBe("34")
    })

    it("has no stepper buttons unless asked", async () => {
      await render({ initial: 35 })
      expect(container.querySelector("button[aria-label^='Increase']")).toBeNull()
    })
  })

  describe("Accessibility", () => {
    it("labels the input and describes it with the error and hint", async () => {
      await render({ initial: 35, error: "Age must be between 18 and 100", hint: "Some hint" })
      const label = container.querySelector<HTMLLabelElement>("label")!
      expect(label.htmlFor).toBe("f")
      expect(input().getAttribute("aria-invalid")).toBe("true")
      const describedBy = input().getAttribute("aria-describedby")!.split(" ")
      expect(describedBy).toHaveLength(2)
      const text = describedBy.map(
        (id) => container.querySelector(`#${CSS.escape(id)}`)?.textContent,
      )
      expect(text).toContain("Age must be between 18 and 100")
      expect(text).toContain("Some hint")
    })

    it("is not marked invalid without an error", async () => {
      await render({ initial: 35 })
      expect(input().getAttribute("aria-invalid")).toBeNull()
      expect(input().getAttribute("aria-describedby")).toBeNull()
    })

    it("uses a numeric keypad on phones", async () => {
      await render({ initial: 35 })
      expect(input().inputMode).toBe("numeric")
    })

    it("uses a decimal keypad when decimals are allowed", async () => {
      await render({ initial: 5.5, decimals: 2 })
      expect(input().inputMode).toBe("decimal")
    })
  })
})
