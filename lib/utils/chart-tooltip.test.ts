import { describe, it, expect } from "vite-plus/test"
import { formatCurrency } from "@/lib/utils/currency"
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
      "name",
    )
    expect(entry?.label).toBe("Likely range")
  })
})

describe("chart tooltips — edge cases", () => {
  describe("getPayloadConfigFromPayload", () => {
    it("returns undefined for a missing payload item", () => {
      expect(getPayloadConfigFromPayload(config, null, "p50")).toBeUndefined()
      expect(getPayloadConfigFromPayload(config, undefined, "p50")).toBeUndefined()
    })

    it("resolves through a string field on the item itself", () => {
      // item.name = "p50" redirects the lookup from "name" to the p50 entry
      expect(getPayloadConfigFromPayload(config, { name: "p50" }, "name")?.label).toBe("Median")
    })

    it("falls back to the key's own entry when the redirected key is not configured", () => {
      expect(getPayloadConfigFromPayload(config, { name: "unknown" }, "nestEgg")?.label).toBe(
        "Nest egg",
      )
    })

    it("ignores a non-object nested payload", () => {
      const item = { dataKey: "p90", payload: null }
      expect(getPayloadConfigFromPayload(config, item, "p90")?.label).toBe("Possible range")
    })

    it("returns undefined when neither key is configured", () => {
      expect(getPayloadConfigFromPayload(config, { dataKey: "zzz" }, "zzz")).toBeUndefined()
    })
  })

  describe("resolveTooltipLabelValue", () => {
    it("uses an explicit labelKey's config label instead of the x value", () => {
      const v = resolveTooltipLabelValue("2026", {
        labelKey: "p75",
        payload: [{ dataKey: "p50" }],
        config,
      })
      expect(v).toBe("Likely range")
    })

    it("falls back to the item name, then to 'value', for the config key", () => {
      expect(resolveTooltipLabelValue(undefined, { payload: [{ name: "p90" }], config })).toBe(
        "Possible range",
      )
      expect(resolveTooltipLabelValue(undefined, { payload: [{}], config })).toBeNull()
    })
  })

  describe("formatters with missing or bad values", () => {
    it("formats a non-numeric percentile value as R 0, keyed 'value' with no item", () => {
      expect(formatPercentileTooltip("abc", undefined, config)).toBe(`value: ${formatCurrency(0)}`)
    })

    it("uses the item name when there is no dataKey, and the raw key when unconfigured", () => {
      expect(formatPercentileTooltip(1000, { name: "p50" }, config)).toBe(
        `Median: ${formatCurrency(1000)}`,
      )
      expect(formatPercentileTooltip(1000, { dataKey: "p99" }, config)).toBe(
        `p99: ${formatCurrency(1000)}`,
      )
    })

    it("treats a missing scenario item or bad value as currency zero", () => {
      expect(formatScenarioTooltip("abc", undefined)).toBe(formatCurrency(0))
      expect(formatScenarioTooltip(undefined, { dataKey: "success" })).toBe("0%")
    })
  })
})
