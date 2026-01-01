# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

South African retirement planning calculator with Monte Carlo simulations, multi-account portfolio management, and SA-specific tax treatment. Built with Next.js, TypeScript, shadcn/ui, and Supabase.

## Development Commands

```bash
npm run dev      # Start Next.js dev server (port 3000)
npm run build    # Production build
npm run lint     # Run ESLint
npm run test     # Run tests
```

## Development Environment

Devcontainer-based setup with Node 20 LTS. Ports:
- 3000: Next.js application
- 54321: Supabase API
- 54323: Supabase Studio

## South African Financial Defaults

These are critical domain values for calculations:
- Inflation: 5.5% p.a.
- Equity return: 10-12% p.a. (nominal)
- Bond return: 7-9% p.a. (nominal)
- Equity volatility: 15-18% std dev
- Safe withdrawal rate: 3-5%
- Life expectancy: 90 years

### Tax Limits (2024/2025)
- Pension/RA deduction: 27.5% of income, max R350,000 p.a.
- TFSA: R36,000 annual, R500,000 lifetime

## Account Types

Supported retirement account types:
- Pension Funds
- Retirement Annuities (RAs)
- Preservation Funds
- Tax-Free Savings Accounts (TFSA)
- Discretionary Investment Accounts

## Key Features

- Monte Carlo simulations (1,000-10,000 runs)
- Multiple account management with individual tracking
- Drawdown strategies (4% rule, dynamic withdrawal)
- What-if scenario analysis
- PDF/CSV export
