---
type: History Entry
title: "2026-11-04 — Investment-type risk research: volatilities, worst falls and correlations in rand"
description: "Research record behind lib/constants/investment-types.ts: rand volatility, worst 12-month return, maximum drawdown and one-factor correlation loadings for the six investment types, each with its source, period and verification date; what could not be verified."
date: 2026-11-04
tags: [monte-carlo, research, risk, sources]
---

# 2026-11-04 — Investment-type risk research

Research checklist of the [investment types plan](../superpowers/plans/2026-11-01-investment-types-range-stress-test.md).
All figures verified 2026-11-04 unless marked. "Primary" means the fund manager's or data
owner's own document; "secondary" means a third party transcribing one. Computed figures
come from [`scripts/research/investment-type-risk.py`](../../scripts/research/investment-type-risk.py),
which embeds its inputs and runs with the standard library.

## Per type

| Type | Volatility | Worst 12 months | Max drawdown | Basis |
|---|---|---|---|---|
| Cash | 0.6% | +3.8% (to 31 Oct 2021) | n/a | STeFI 3-month, since Jul 2001 (A) |
| Conservative | 5.0% | −7.4% (to 31 Mar 2020) | −16.7% (20 Jan–23 Mar 2020) | Allan Gray Stable **fund**, since Jul 2000 (B); its benchmark is cash + 2%, so no category figure |
| Balanced | 9.1% | −16.7% (to 28 Feb 2009) | −23.3% (20 Jan–23 Mar 2020) | SA Multi-Asset High Equity category average, since Oct 1999 (C) |
| SA equity | 16.0% | −37.6% (to 28 Feb 2009) | −45.4% (22 May–20 Nov 2008) | SA Equity General category average (ALSI to Feb 2015), since Oct 1998 (D) |
| Global equity | 16.3% | −19.6% (calendar 2008) | −22.9% (since Mar 2018 only) | MSCI World net, ZAR, annual 2008–2025, computed (E, F); 60-month monthly SD 14.2% (G); drawdown (H) |
| Concentrated equity | 28.4% (2000–2025) / 22.9% (2008–2025) | −55.3% (calendar 2002); −28.5% (2022); −21.2% (2008) | not found in ZAR | Nasdaq-100 price, ZAR, annual, computed (E, I) |

Volatility for A–D is the factsheet's "annualised monthly volatility" since inception. For E
and I it is the standard deviation of annual log returns, which is the parameter the
simulation draws.

**Cross-checks for SA equity:** ALSI annual log SD 17.1% (1990–2017, secondary J), and 16.03%
monthly-annualised for 2002–2020 (Hudson, K). The worst ALSI calendar year is 2008 at −23.2%
(J). The JSE fell about 40% peak to trough in 2008 (L).

**The rand cushions global falls.** Over 2008–2025, MSCI World's USD return correlates −0.59
with the change in USD/ZAR. In 2008 MSCI World lost 40.7% in USD but 19.6% in rand. So global
equity's rand volatility (16.3%) is *below* its USD volatility (19.7%).

## Correlations

| Pair | Correlation | Data |
|---|---|---|
| SA equity ↔ SA bonds (ALBI) | 0.13 (rises in 2008 and 2020) | monthly, Jun 2002–2020 (K, Table 2) |
| SA equity ↔ global equity (ZAR) | 0.56 | annual log, 2008–2017, n = 10 (computed) |
| SA equity ↔ Nasdaq-100 (ZAR) | 0.53 | annual log, 2000–2017, n = 18 (computed) |
| Global ↔ Nasdaq-100 (ZAR) | 0.93 | annual log, 2008–2025, n = 18 (computed) |

**One-factor fit.** With corr(i, j) = √(ρᵢρⱼ), the three equity pairs solve exactly to loadings
of global 0.99, SA equity 0.32 and Nasdaq 0.88. With n = 10–18 annual points these are rough.
The SA ↔ global pair rests on only 10 years.

**Not verified:** correlations for Balanced and Conservative funds with either equity type.
Their loadings need an explicit, documented assumption.

## Stress factor (Feature 2)

The worst rolling 10-year annual log SD divided by the full-period figure is 1.33 for the
ALSI (1990–2017; 1.32 over 1974–2017), 1.13 for MSCI World ZAR (2008–2025) and 1.11 for
Nasdaq-100 ZAR (2000–2025). The global series are short, so their ratios understate the
stress. A single documented factor of about 1.3 is defensible.

## Could not verify

- A rand max drawdown for global equity or Nasdaq-100 covering 2008 or the dot-com crash.
  Factsheets start in 2008 (Sygnia) or 2017–2018 (Satrix, 1nvest).
- MSCI World net USD returns for 2001–2007. The secondary source starts in 2008.
- A Nasdaq-100 total-return series. Price return is used, which barely affects volatility.
- The Satrix MDDs (STXWDM, STXNDQ, 30 Sep 2026) publish no standard deviation. Their best and
  worst of ≤10 non-overlapping years (Nasdaq +63.81 / −10.55; MSCI World +27.80 / −4.06) miss 2008.

## Decisions (Etienne, 2026-11-04)

Recorded in [`lib/constants/investment-types.ts`](../../lib/constants/investment-types.ts),
pinned by its test file.

- **Concentrated equity volatility: 28.4%**, the 2000–2025 figure that includes the dot-com crash.
- **Stress test uses the worst rolling 12-month return** where a factsheet publishes one. For
  global equity and Nasdaq-100 it uses the 2008 calendar year in rand (−19.6% / −21.2%),
  flagged `stressUnderstated`. The Nasdaq's worst rand year (2002, −55.3%) is noted for an
  optional second scenario.
- **Balanced 0.5 and Conservative 0.3 factor loadings are assumptions**, flagged
  `factorLoadingAssumed`.
- **Suggested returns are forward-looking**, derived from `SA_DEFAULTS`: cash 6.5%, equity
  types 11%, Conservative 8.9% (30/70 equity/bond blend), Balanced 10% (65/35).
- **Cautious volatility factor: 1.3** for every type.

## Sources

| Ref | Source | Kind | As at |
|---|---|---|---|
| A | Allan Gray Money Market Fund factsheet, https://www.allangray.co.za/globalassets/documents-repository/fund/factsheet/Allan%20Gray%20Money%20Market%20Fund/Latest/Allan%20Gray%20Money%20Market%20Fund%20Latest.pdf | primary | 30 Sep 2026 |
| B | Allan Gray Stable Fund factsheet, https://www.allangray.co.za/globalassets/documents-repository/fund/factsheet/Allan%20Gray%20Stable%20Fund/Files/AGSF%20-%202026-09.pdf | primary | 30 Sep 2026 |
| C | Allan Gray Balanced Fund factsheet (benchmark column), https://www.allangray.co.za/globalassets/documents-repository/fund/factsheet/Allan%20Gray%20Balanced%20Fund/Files/AGBF%20-%202026-09.pdf | primary | 30 Sep 2026 |
| D | Allan Gray Equity Fund factsheet (benchmark column), https://www.allangray.co.za/globalassets/documents-repository/fund/factsheet/Allan%20Gray%20Equity%20Fund/Files/AGEF%20-%202026-09.pdf | primary | 30 Sep 2026 |
| E | FRED DEXSFUS, USD/ZAR year-end, https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXSFUS&fq=Annual&fam=eop | primary | updated 2 Nov 2026 |
| F | MSCI World net USD annual returns, https://investingintheweb.com/blog/msci-world-index-historical-data/ | secondary | 31 Aug 2026 |
| G | Sygnia Itrix MSCI World MDD, https://resources.easyequities.co.za/ETFs/ETF%20Factsheets/Sygnia/SYGWD.pdf | primary | 31 Dec 2025 |
| H | 1nvest MSCI World Index Feeder MDD, https://resources.easyequities.co.za/ETFs/ETF%20Factsheets/1nvest/ETFWLD.pdf | primary | 31 Dec 2025 |
| I | Nasdaq-100 annual price returns, https://en.wikipedia.org/wiki/Nasdaq-100 | secondary | Oct 2026 |
| J | FTSE/JSE All Share returns 1974–2017 (credits Allan Gray), https://topforeignstocks.com/2014/01/08/south-africas-ftsejse-all-share-index-returns-by-year/ | secondary | updated 31 Mar 2018 |
| K | Hudson, J. (2025), *What drives the correlation between stocks and bonds*, MCom, UCT, http://hdl.handle.net/11427/41650 | primary | 2025 |
| L | Moneyweb, https://www.moneyweb.co.za/investing/volatile-jse-really/ | secondary | verified 2026-10-31 |
| M | Satrix MDDs STXWDM / STXNDQ, https://satrix.co.za/fund/mdd/STXWDM, https://satrix.co.za/fund/mdd/STXNDQ | primary | 30 Sep 2026 |

**Access notes.** etfsa.co.za and slickcharts return 403. The Allan Gray, Satrix, Sygnia,
1nvest and UCT PDFs read cleanly with `pdfjs-dist@4.10.38` (legacy build,
`getTextContent`), installed with `--ignore-scripts` outside the repo. The earlier zlib
extractor is no longer needed.
