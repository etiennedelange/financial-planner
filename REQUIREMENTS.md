# South African Retirement Calculator - Requirements

## Overview
A retirement planning calculator specifically designed for South African investors, featuring Monte Carlo simulations, inflation adjustments, and multi-account portfolio management.

## Core Features

### 1. Account Management
- **Multiple Account Support**
  - Add, edit, and remove retirement accounts
  - Support for various account types:
    - Pension Funds (e.g., Old Mutual)
    - Retirement Annuities (RAs) (e.g., Allan Gray)
    - Preservation Funds
    - Tax-Free Savings Accounts (TFSA)
    - Discretionary Investment Accounts
  - Each account should track:
    - Current balance (R)
    - Monthly contribution (R)
    - Expected annual return (%)
    - Account fees (% p.a.)
    - Account provider/name

### 2. Financial Inputs
- **Current Savings**
  - Total current retirement savings across all accounts
  - Individual account balances

- **Contribution Parameters**
  - Monthly contribution amount per account
  - Annual contribution escalation rate (linked to salary increases)
  - Option to set contribution limits (e.g., tax deductibility limits)

- **Retirement Goals**
  - Target retirement age
  - Current age
  - Desired monthly retirement income (in today's Rands)
  - Expected retirement duration / life expectancy

### 3. South African Specific Considerations
- **Tax Treatment**
  - Pension fund contributions (tax deductible up to 27.5% of income, max R350,000 p.a.)
  - RA contributions (same tax treatment)
  - TFSA contribution limits (R36,000 p.a., lifetime limit R500,000)
  - Retirement lump sum tax tables
  - Monthly annuity income tax

- **Inflation Assumptions**
  - South African CPI inflation rate (adjustable, default ~5-6%)
  - Different inflation rates for medical expenses (typically higher)

- **Investment Returns**
  - Expected nominal return rates by asset class
  - Local equity (JSE)
  - International equity
  - Bonds
  - Cash/Money Market
  - Property

### 4. Monte Carlo Simulation
- **Simulation Parameters**
  - Number of simulation runs (e.g., 1,000 or 10,000)
  - Return volatility (standard deviation)
  - Sequence of returns risk modeling

- **Outputs**
  - Probability of success (% of simulations where funds last until target age)
  - Percentile outcomes (10th, 25th, 50th, 75th, 90th percentiles)
  - Distribution graphs showing range of outcomes
  - Worst-case, median, and best-case scenarios

### 5. Drawdown Strategy
- **Safe Withdrawal Rates**
  - Configurable initial withdrawal rate (e.g., 4% rule, adjusted for SA context)
  - Dynamic withdrawal strategies:
    - Fixed percentage
    - Fixed rand amount (inflation-adjusted)
    - Variable percentage based on portfolio performance
    - Guardrails approach (upper and lower limits)

- **Drawdown Considerations**
  - Sequence of returns risk
  - Inflation adjustment of withdrawals
  - Minimum income floor
  - Maximum income ceiling

### 6. Calculations & Analytics
- **Automatic Recalculation**
  - Real-time updates when any input changes
  - Option for manual "Calculate" button or automatic recalculation
  - Performance optimization for multiple accounts

- **Projection Outputs**
  - Projected portfolio value at retirement
  - Monthly/annual income in retirement (nominal and real terms)
  - Portfolio depletion age
  - Shortfall/surplus analysis
  - Year-by-year portfolio balance projections

- **Visualizations**
  - Portfolio growth chart (accumulation phase)
  - Portfolio drawdown chart (retirement phase)
  - Monte Carlo simulation fan chart
  - Account allocation breakdown
  - Success probability gauge

### 7. Scenarios & Sensitivity Analysis
- **What-If Scenarios**
  - Impact of increasing/decreasing contributions
  - Effect of retiring earlier/later
  - Different return assumptions
  - Market crash scenarios
  - Longevity risk (living longer than expected)

## Technical Requirements

### Technology Stack
- **Frontend Framework**: Next.js (React-based)
- **UI Library**: React
- **Component Library**: shadcn/ui (with Radix UI primitives and Tailwind CSS)
- **Database & Backend**: Supabase (PostgreSQL with built-in authentication and real-time capabilities)
- **Language**: TypeScript (recommended for type safety)

### User Interface
- Clean, intuitive interface
- Responsive design (desktop and mobile)
- Interactive charts and graphs
- Export functionality (PDF reports, CSV data)
- Server-side rendering (SSR) with Next.js for optimal performance

### Data Persistence
- PostgreSQL database hosted on Supabase
- Supabase Authentication for user accounts
- Row Level Security (RLS) for data protection
- Save user profiles and scenarios
- Store multiple retirement accounts per user
- Historical calculation results
- Import/export functionality
- Real-time data synchronization capabilities

### Performance
- Calculations complete within 2-3 seconds
- Smooth UI updates with multiple accounts
- Efficient Monte Carlo simulation execution
- Optimistic UI updates for better perceived performance
- Database query optimization for multi-account portfolios

### Validation
- Input validation and error handling
- Reasonable range checks (e.g., retirement age > current age)
- Warning messages for unrealistic assumptions
- Client-side and server-side validation

## Assumptions & Defaults

### Default Values (Configurable)
- Inflation rate: 5.5% p.a.
- Equity return: 10-12% p.a. (nominal)
- Bond return: 7-9% p.a. (nominal)
- Cash return: 6-7% p.a. (nominal)
- Equity volatility: 15-18% (std dev)
- Safe withdrawal rate: 4-5% initial
- Life expectancy: 90 years
- Contribution escalation: 6% p.a.

### South African Regulatory Limits (2024/2025 Tax Year)
- Pension/RA tax deduction: 27.5% of income, max R350,000 p.a.
- TFSA annual limit: R36,000
- TFSA lifetime limit: R500,000

## Future Enhancements (Optional)
- Estate planning considerations
- Healthcare cost modeling
- Annuity vs living annuity comparison
- Offshore investment allocation
- Social security/government pension integration
- Spouse/joint retirement planning
- Legacy goals (leaving inheritance)
- Monte Carlo optimization for contribution allocation across accounts

## Success Criteria
- Accurate projections based on sound financial principles
- Clear visualization of retirement readiness
- Easy to add and manage multiple accounts
- Fast, responsive calculations
- Actionable insights for retirement planning decisions
