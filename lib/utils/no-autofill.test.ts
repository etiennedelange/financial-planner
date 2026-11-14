import { describe, expect, it } from "vite-plus/test"
import { NO_AUTOFILL_PROPS } from "./no-autofill"

describe("NO_AUTOFILL_PROPS", () => {
  it("carries every password manager's opt-out, not just autocomplete=off", () => {
    expect(NO_AUTOFILL_PROPS.autoComplete).toBe("off")
    expect(NO_AUTOFILL_PROPS["data-1p-ignore"]).toBe(true) // 1Password
    expect(NO_AUTOFILL_PROPS["data-lpignore"]).toBe("true") // LastPass
    expect(NO_AUTOFILL_PROPS["data-bwignore"]).toBe(true) // Bitwarden
    expect(NO_AUTOFILL_PROPS["data-form-type"]).toBe("other") // Dashlane
  })
})
