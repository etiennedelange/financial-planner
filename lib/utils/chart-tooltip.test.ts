import { describe, it, expect } from "vitest"
import { formatCurrency } from "@/lib/utils/formatters"
import {
  resolveTooltipLabelValue,
  formatPercentileTooltip,
  formatScenarioTooltip,
  getPayloadConfigFromPayload,
} from "./chart-tooltip"

const config = {
  p50: { label: "Median" },
  p75: { label: "Likely range" },
  p90: { label: "Possible range" },
  nestEgg: { label: "Nest egg" },
  success: { label: "Success" },
} as const

describe("resolveTooltipLabelValue", () => {
  it("returns the numeric x-axis value raw instead of the series label", () => {
    const label = resolveTooltipLabelValue(65, {
      payload: [{ dataKey: "balance", name: "balance" }],
      config,
    })
    expect(label).toBe(65)
  })

  it("returns the config label for a string category that is a config key", () => {
    const label = resolveTooltipLabelValue("balance", {
      payload: [{ dataKey: "balance" }],
      config: { balance: { label: "Portfolio Balance" } },
    })
    expect(label).toBe("Portfolio Balance")
  })

  it("returns the raw string label when it is not a config key", () => {
    const label = resolveTooltipLabelValue("Conservative", {
      payload: [{ dataKey: "name", name: "Conservative" }],
      config,
    })
    expect(label).toBe("Conservative")
  })

  it("falls back to the series label when the x value is absent", () => {
    const label = resolveTooltipLabelValue(undefined, {
      payload: [{ dataKey: "p50" }],
      config,
    })
    expect(label).toBe("Median")
  })

  it("returns null when there is no payload", () => {
    const label = resolveTooltipLabelValue(65, { payload: [], config })
    expect(label).toBeNull()
  })
})

describe("formatPercentileTooltip", () => {
  it("labels the median row with its series name", () => {
    const text = formatPercentileTooltip(1500000, { dataKey: "p50" }, config)
    expect(text).toContain("Median")
    expect(text).toContain(formatCurrency(1500000))
  })

  it("labels the 75th percentile as Likely range", () => {
    const text = formatPercentileTooltip(2000000, { dataKey: "p75" }, config)
    expect(text).toContain("Likely range")
  })

  it("labels the 90th percentile as Possible range", () => {
    const text = formatPercentileTooltip(3000000, { dataKey: "p90" }, config)
    expect(text).toContain("Possible range")
  })
})

describe("formatScenarioTooltip", () => {
  it("formats the success series as a percentage, not currency", () => {
    const text = formatScenarioTooltip(100, { dataKey: "success" })
    expect(text).toBe("100%")
  })

  it("formats a partial success rate with no decimals", () => {
    const text = formatScenarioTooltip(84.6, { dataKey: "success" })
    expect(text).toBe("85%")
  })

  it("formats the nest egg series as currency", () => {
    const text = formatScenarioTooltip(5000000, { dataKey: "nestEgg" })
    expect(text).toBe(formatCurrency(5000000))
  })

  it("handles an item whose display name differs from its dataKey", () => {
    const text = formatScenarioTooltip(100, { dataKey: "success", name: "Success rate" })
    expect(text).toBe("100%")
  })
})

describe("getPayloadConfigFromPayload", () => {
  it("resolves the config entry by dataKey", () => {
    const entry = getPayloadConfigFromPayload(config, { dataKey: "p90" }, "p90")
    expect(entry?.label).toBe("Possible range")
  })

  it("resolves nested payload data when the key is a string field", () => {
    const entry = getPayloadConfigFromPayload(
      config,
      { dataKey: "x", payload: { name: "p75" } },
      "name"
    )
    expect(entry?.label).toBe("Likely range")
  })
})
