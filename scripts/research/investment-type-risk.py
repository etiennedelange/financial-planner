"""Reproduce the rand-terms risk figures behind lib/constants/investment-types.ts.

Run: python3 -I scripts/research/investment-type-risk.py   (standard library only)

Every input series is embedded below with its source; see
docs/history/2026-11-04-investment-type-risk-research.md for URLs and retrieval dates.
Volatilities are standard deviations of annual LOG returns (the model draws annual
log-normal returns, so this is the matching parameter).
"""

import math
import statistics as st

# USD/ZAR, last observation of each calendar year. FRED DEXSFUS (H.10), annual, end of period.
FX = dict(zip(range(1999, 2026), [
    6.1600, 7.5700, 12.0000, 8.5850, 6.7000, 5.6450, 6.3300, 7.0375, 6.8595, 9.3000,
    7.3613, 6.6700, 8.0751, 8.4845, 10.4850, 11.5425, 15.4660, 13.7000, 12.3750, 14.3775,
    13.9730, 14.6500, 15.9300, 16.9950, 18.2622, 18.8792, 16.5496,
]))

# FTSE/JSE All Share, calendar-year %, 1974-2017. topforeignstocks.com, credited to
# Allan Gray; total return per the author's last comment (secondary source).
ALSI = dict(zip(range(1974, 2018), [
    -0.8, -18.9, -10.9, 20.6, 37.2, 94.4, 40.9, 0.8, 38.4, 14.4, 9.4, 42.0, 55.9, -4.3,
    14.8, 55.7, 5.1, 31.1, -2.0, 54.7, 22.7, 8.8, 9.4, -4.5, -10.0, 61.4, 0.0, 29.3, -8.1,
    16.1, 25.4, 47.3, 41.2, 19.2, -23.2, 32.1, 19.0, 2.6, 26.7, 21.4, 10.9, 5.1, -0.0, 21.0,
]))

# MSCI World net total return, USD, calendar-year %, 2008-2025 (MSCI factsheet via
# investingintheweb.com; secondary source).
MSCI_USD = dict(zip(range(2008, 2026), [
    -40.71, 29.99, 11.76, -5.54, 15.83, 26.68, 4.94, -0.87, 7.51, 22.40, -8.71, 27.67,
    15.90, 21.82, -18.14, 23.79, 18.67, 21.09,
]))

# Nasdaq-100 PRICE return, USD, calendar-year %, 1999-2025 (Wikipedia, citing Yahoo ^NDX;
# secondary source). Excludes a ~0.5-1% dividend yield; volatility is barely affected.
NDX_USD = dict(zip(range(1999, 2026), [
    101.95, -36.84, -32.65, -37.58, 49.12, 10.44, 1.49, 6.79, 18.67, -41.89, 53.54, 19.22,
    2.70, 16.82, 34.99, 17.94, 8.43, 5.89, 31.52, -1.04, 37.96, 47.58, 26.63, -32.97, 53.81,
    24.88, 20.17,
]))


def to_zar(usd):
    return {y: ((1 + r / 100) * FX[y] / FX[y - 1] - 1) * 100 for y, r in usd.items() if y - 1 in FX}


def logs(d, ys):
    return [math.log(1 + d[y] / 100) for y in ys]


def log_sd(d, ys):
    return st.stdev(logs(d, ys)) * 100


def cagr(d, ys):
    return (math.prod(1 + d[y] / 100 for y in ys) ** (1 / len(ys)) - 1) * 100


def corr(a, b, ys):
    return st.correlation(logs(a, ys), logs(b, ys))


def worst_10y_ratio(d, ys):
    ys = list(ys)
    windows = [log_sd(d, ys[i : i + 10]) for i in range(len(ys) - 9)]
    return max(windows) / log_sd(d, ys)


MSCI = to_zar(MSCI_USD)
NDX = to_zar(NDX_USD)
FX_CHANGE = {y: (FX[y] / FX[y - 1] - 1) * 100 for y in FX if y - 1 in FX}

if __name__ == "__main__":
    rows = [
        ("SA equity (ALSI TR)", ALSI, range(1990, 2018)),
        ("Global equity (MSCI World, ZAR)", MSCI, range(2008, 2026)),
        ("Concentrated (Nasdaq-100, ZAR)", NDX, range(2000, 2026)),
        ("Concentrated (Nasdaq-100, ZAR)", NDX, range(2008, 2026)),
    ]
    print(f"{'series':34s} {'years':9s} {'logSD':>6s} {'CAGR':>6s}  worst year   10y-stress")
    for name, d, ys in rows:
        ys = list(ys)
        w = min(ys, key=lambda y: d[y])
        print(f"{name:34s} {ys[0]}-{ys[-1]} {log_sd(d, ys):5.1f}% {cagr(d, ys):5.1f}%  {w}: {d[w]:6.1f}%   x{worst_10y_ratio(d, ys):.2f}")

    c_sg = corr(ALSI, MSCI, range(2008, 2018))
    c_sn = corr(ALSI, NDX, range(2000, 2018))
    c_gn = corr(MSCI, NDX, range(2008, 2026))
    print(f"\ncorr SA~global {c_sg:.2f} (2008-17, n=10)  SA~Nasdaq {c_sn:.2f} (2000-17, n=18)  global~Nasdaq {c_gn:.2f} (2008-25, n=18)")
    print(f"corr MSCI World USD return ~ USD/ZAR change {corr(MSCI_USD, FX_CHANGE, range(2008, 2026)):.2f} (rand cushions global falls)")

    # One-factor fit, corr(i, j) = sqrt(rho_i * rho_j): three pairs, three unknowns, exact.
    rho_g = math.sqrt(c_sg * c_gn / c_sn)
    print(f"one-factor loadings: global {rho_g:.2f}  SA {c_sg ** 2 / rho_g:.2f}  Nasdaq {c_gn ** 2 / rho_g:.2f}")
