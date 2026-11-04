import type { InvestmentType } from "@/types"
import { SA_DEFAULTS } from "./defaults"

export { INVESTMENT_TYPES, type InvestmentType } from "@/types"

/**
 * What an account is invested in. Drives its Monte Carlo volatility, how much it moves with
 * the shared market shock, and its fall in the historical stress test.
 *
 * Every figure below is in RAND terms and comes from the research record
 * docs/history/2026-11-04-investment-type-risk-research.md (verified 2026-11-04), which
 * gives each source's URL, period and as-at date. Computed figures are reproduced by
 * scripts/research/investment-type-risk.py.
 *
 * Volatility is the annual standard deviation the simulation draws (log returns). The
 * factsheet figures are "annualised monthly volatility" since inception, which is the
 * nearest published equivalent.
 */
export interface InvestmentTypeSource {
  label: string
  url: string
  /** "secondary" = a third party transcribing the data owner's figures */
  kind: "primary" | "secondary" | "computed"
  asAt: string
}

export interface InvestmentTypeRisk {
  label: string
  /** Real funds of this type, shown in the account form */
  example: string
  /** Annual volatility, decimal (0.16 = 16%) */
  volatility: number
  /**
   * ρ in the one-factor model: shock = √ρ · z_market + √(1 − ρ) · z_type, so two different
   * types correlate √(ρᵢ · ρⱼ). 0 = independent of the market, 1 = moves in lockstep.
   */
  factorLoading: number
  /** True when `factorLoading` is an explicit assumption rather than fitted to data */
  factorLoadingAssumed: boolean
  /**
   * Return for the stress test's "bad first year of retirement", decimal. The worst
   * rolling 12-month return where a factsheet publishes one; otherwise the worst
   * calendar year in rand, which understates a 12-month fall (`stressUnderstated`).
   */
  stressReturn: number
  stressPeriod: string
  stressUnderstated: boolean
  /** Worst peak-to-trough fall, decimal; null where no rand figure was found */
  maxDrawdown: number | null
  maxDrawdownPeriod: string | null
  /**
   * A forward-looking long-run compound (CAGR) return hint, percent, derived from the app's
   * SA defaults. Shown in the account form; never applied automatically.
   */
  suggestedReturn: number
  sources: readonly InvestmentTypeSource[]
  verifiedOn: string
  /** True when any figure rests on a secondary source */
  secondary: boolean
}

const VERIFIED_ON = "2026-11-04"

const ALLAN_GRAY_FACTSHEET =
  "https://www.allangray.co.za/globalassets/documents-repository/fund/factsheet/"

const SRC = {
  moneyMarket: {
    label: "Allan Gray Money Market Fund factsheet (STeFI 3-month benchmark)",
    url: `${ALLAN_GRAY_FACTSHEET}Allan%20Gray%20Money%20Market%20Fund/Latest/Allan%20Gray%20Money%20Market%20Fund%20Latest.pdf`,
    kind: "primary",
    asAt: "2026-09-30",
  },
  stable: {
    label: "Allan Gray Stable Fund factsheet (fund figures)",
    url: `${ALLAN_GRAY_FACTSHEET}Allan%20Gray%20Stable%20Fund/Files/AGSF%20-%202026-09.pdf`,
    kind: "primary",
    asAt: "2026-09-30",
  },
  balanced: {
    label: "Allan Gray Balanced Fund factsheet (SA Multi-Asset High Equity category benchmark)",
    url: `${ALLAN_GRAY_FACTSHEET}Allan%20Gray%20Balanced%20Fund/Files/AGBF%20-%202026-09.pdf`,
    kind: "primary",
    asAt: "2026-09-30",
  },
  equity: {
    label: "Allan Gray Equity Fund factsheet (SA Equity General category benchmark)",
    url: `${ALLAN_GRAY_FACTSHEET}Allan%20Gray%20Equity%20Fund/Files/AGEF%20-%202026-09.pdf`,
    kind: "primary",
    asAt: "2026-09-30",
  },
  hudson: {
    label: "Hudson (2025), What drives the correlation between stocks and bonds, UCT",
    url: "http://hdl.handle.net/11427/41650",
    kind: "primary",
    asAt: "2025",
  },
  fred: {
    label: "FRED DEXSFUS, USD/ZAR at year-end",
    url: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXSFUS&fq=Annual&fam=eop",
    kind: "primary",
    asAt: "2026-11-02",
  },
  msciUsd: {
    label: "MSCI World net USD annual returns 2008–2025 (from the MSCI factsheet)",
    url: "https://investingintheweb.com/blog/msci-world-index-historical-data/",
    kind: "secondary",
    asAt: "2026-08-31",
  },
  sygnia: {
    label: "Sygnia Itrix MSCI World MDD (60-month risk statistics)",
    url: "https://resources.easyequities.co.za/ETFs/ETF%20Factsheets/Sygnia/SYGWD.pdf",
    kind: "primary",
    asAt: "2025-12-31",
  },
  oneInvest: {
    label: "1nvest MSCI World Index Feeder MDD",
    url: "https://resources.easyequities.co.za/ETFs/ETF%20Factsheets/1nvest/ETFWLD.pdf",
    kind: "primary",
    asAt: "2025-12-31",
  },
  ndxUsd: {
    label: "Nasdaq-100 annual price returns 1999–2025",
    url: "https://en.wikipedia.org/wiki/Nasdaq-100",
    kind: "secondary",
    asAt: "2026-10",
  },
  computed: {
    label: "Rand returns computed from the USD series and USD/ZAR",
    url: "scripts/research/investment-type-risk.py",
    kind: "computed",
    asAt: VERIFIED_ON,
  },
} as const satisfies Record<string, InvestmentTypeSource>

/** Long-run blend of the app's forward-looking defaults, percent, rounded to 0.1 */
function blendedReturn(equityShare: number): number {
  const blend = equityShare * SA_DEFAULTS.equityReturn + (1 - equityShare) * SA_DEFAULTS.bondReturn
  return Math.round(blend * 1000) / 10
}

const EQUITY_RETURN_PERCENT = Math.round(SA_DEFAULTS.equityReturn * 1000) / 10

export const INVESTMENT_TYPE_RISK: Record<InvestmentType, InvestmentTypeRisk> = {
  cash: {
    label: "Cash / money market",
    example: "Money market fund, notice deposit",
    volatility: 0.006,
    factorLoading: 0,
    factorLoadingAssumed: false,
    stressReturn: 0.038,
    stressPeriod: "12 months to 31 Oct 2021 (STeFI 3-month)",
    stressUnderstated: false,
    maxDrawdown: null,
    maxDrawdownPeriod: null,
    suggestedReturn: Math.round(SA_DEFAULTS.cashReturn * 1000) / 10,
    sources: [SRC.moneyMarket],
    verifiedOn: VERIFIED_ON,
    secondary: false,
  },
  conservative: {
    label: "Conservative (low equity)",
    example: "SA Multi-Asset Low Equity fund, e.g. Allan Gray Stable",
    volatility: 0.05,
    // Assumption: no published correlation. Mostly SA bonds and cash with some equity.
    factorLoading: 0.3,
    factorLoadingAssumed: true,
    stressReturn: -0.074,
    stressPeriod: "12 months to 31 Mar 2020 (Allan Gray Stable Fund)",
    stressUnderstated: false,
    maxDrawdown: -0.167,
    maxDrawdownPeriod: "20 Jan – 23 Mar 2020",
    suggestedReturn: blendedReturn(0.3),
    sources: [SRC.stable],
    verifiedOn: VERIFIED_ON,
    secondary: false,
  },
  balanced: {
    label: "Balanced (high equity)",
    example: "SA Multi-Asset High Equity fund, e.g. a balanced unit trust or RA default",
    volatility: 0.091,
    // Assumption: no published correlation. Up to 45% offshore, so between SA and global.
    factorLoading: 0.5,
    factorLoadingAssumed: true,
    stressReturn: -0.167,
    stressPeriod: "12 months to 28 Feb 2009 (category average)",
    stressUnderstated: false,
    maxDrawdown: -0.233,
    maxDrawdownPeriod: "20 Jan – 23 Mar 2020",
    suggestedReturn: blendedReturn(0.65),
    sources: [SRC.balanced],
    verifiedOn: VERIFIED_ON,
    secondary: false,
  },
  sa_equity: {
    label: "SA equity",
    example: "Satrix 40, Satrix Top 40, an SA general equity fund",
    volatility: 0.16,
    // Fitted: SA ↔ global 0.56, SA ↔ Nasdaq 0.53, global ↔ Nasdaq 0.93 (annual, rand)
    factorLoading: 0.32,
    factorLoadingAssumed: false,
    stressReturn: -0.376,
    stressPeriod: "12 months to 28 Feb 2009 (category average)",
    stressUnderstated: false,
    maxDrawdown: -0.454,
    maxDrawdownPeriod: "22 May – 20 Nov 2008",
    suggestedReturn: EQUITY_RETURN_PERCENT,
    sources: [SRC.equity, SRC.hudson],
    verifiedOn: VERIFIED_ON,
    secondary: false,
  },
  global_equity: {
    label: "Global equity",
    example: "Satrix MSCI World, Sygnia Itrix MSCI World, 1nvest MSCI World",
    volatility: 0.163,
    factorLoading: 0.99,
    factorLoadingAssumed: false,
    stressReturn: -0.196,
    stressPeriod: "calendar 2008 in rand (MSCI World −40.7% in USD)",
    stressUnderstated: true,
    // Since Mar 2018 only: no rand drawdown covering 2008 was found
    maxDrawdown: -0.2286,
    maxDrawdownPeriod: "since Mar 2018 (1nvest MSCI World Feeder)",
    suggestedReturn: EQUITY_RETURN_PERCENT,
    sources: [SRC.computed, SRC.msciUsd, SRC.fred, SRC.sygnia, SRC.oneInvest],
    verifiedOn: VERIFIED_ON,
    secondary: true,
  },
  concentrated_equity: {
    label: "Concentrated equity",
    example: "Satrix Nasdaq 100, a single-sector or single-country tech fund",
    // 2000–2025 including the dot-com crash; 22.9% over 2008–2025
    volatility: 0.284,
    factorLoading: 0.88,
    factorLoadingAssumed: false,
    stressReturn: -0.212,
    stressPeriod: "calendar 2008 in rand (worst rand year: 2002 at −55.3%)",
    stressUnderstated: true,
    maxDrawdown: null,
    maxDrawdownPeriod: null,
    suggestedReturn: EQUITY_RETURN_PERCENT,
    sources: [SRC.computed, SRC.ndxUsd, SRC.fred],
    verifiedOn: VERIFIED_ON,
    secondary: true,
  },
}

/**
 * Multiplier on each type's volatility for the cautious end of the success range
 * (Feature 2). The worst rolling 10-year annual volatility of the ALSI was 1.33× its
 * 1990–2017 figure (1.32× over 1974–2017); the rand global series are too short (1.11–1.13×)
 * to fit their own factor, so one documented factor applies to every type.
 */
export const CAUTIOUS_VOLATILITY_FACTOR = 1.3
