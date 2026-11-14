# SA Financial Planner

A South African retirement and financial planning tool. It runs deterministic
projections and Monte Carlo simulations across a multi-account portfolio with
SA-specific tax treatment.

> **Source-available, not open source.** This repository is public so the code
> can be read and reviewed. It is not licensed for reuse — see [LICENSE](LICENSE).
> Nothing here is financial advice; projections are illustrative and depend
> entirely on the assumptions entered.

## What it does

- **Multi-account portfolio**: Pension Fund, Retirement Annuity, Preservation
  Fund, TFSA, and Discretionary accounts, each with its own contribution, fee,
  and tax rules
- **SA tax treatment**: income tax brackets and age-based rebates, retirement
  lump sum tables, RA/pension deduction limits, TFSA annual and lifetime caps,
  and CGT. All limits live in one config: `lib/constants/tax-year.config.ts`
- **Monte Carlo simulation** that runs in a Web Worker, alongside a
  deterministic projection engine. Both engines share their calculation
  utilities, so they model the same plan
- **Private by design**: no accounts and no database. Everything is stored in your
  browser; download a backup file to keep or move it
- **Expense tracking**: models current spending as the baseline for
  retirement income needs
- **Installable PWA** with an offline fallback, plus print/PDF and CSV export

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui ·
Zustand (persisted to localStorage) · bring-your-own-key AI (browser → provider) ·
Vite+ (Vitest, Oxlint, Oxfmt) · Playwright. Hosted on Vercel.

## Project layout

```
app/                     Routes (calculator/*, print)
components/              UI, including layout/ and debug/
lib/calculations/        Deterministic projection engine and shared utilities
lib/monte-carlo/         Monte Carlo simulation engine
lib/constants/           Tax-year config (single source of truth)
lib/store/               Zustand stores (plan, expenses) + local persistence
lib/ai/                  Bring-your-own-key AI: key vault, provider clients
docs/                    Phase plans and dated change history
```

## Running locally

Requires Node 24 and pnpm. No database, accounts or environment variables are needed.

```bash
pnpm install
pnpm dev                     # http://localhost:3000
```

## Checks

```bash
pnpm typecheck   # includes test files, which `next build` does not check
pnpm check       # format, lint and types (Vite+: Oxfmt, Oxlint)
pnpm test        # Vitest unit tests (via Vite+)
pnpm build
```

CI runs all of these on every push and pull request.

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).
