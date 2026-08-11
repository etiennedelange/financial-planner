# Documentation Index

Map of `docs/` — what lives where, and the rules that keep it current. CLAUDE.md
carries the short version of these rules; this file is the reference.

## Layout

| Path | Purpose |
|------|---------|
| `project-phases.md` | Phase status table + Recent Activity feed (one-line entries, latest 10) |
| `project-phases/` | One file per phase: task checkboxes, pending lists, design decisions |
| `history/` | Dated full write-ups — **the only place detail lives** |
| `security/` | Risk registers and security audit records |
| `superpowers/specs/` | Design specs (brainstorming skill output) |
| `superpowers/plans/` | Implementation plans (writing-plans skill output) |
| `FINANCIAL_LOGIC_REFERENCE.md` | Calculation formulas + SA tax rules reference |
| `THEMING.md` | Design tokens and theming rules |

## The three-tier rule

Detail lives in exactly **one** place. Everywhere else links to it.

1. **`history/YYYY-MM-DD-slug.md`** — the full write-up: what changed, why, how
   verified. Written for any meaningful change (calculation, architecture,
   security, completed phase task, or multi-file bug fix).
2. **`project-phases/<phase>.md`** — checkbox flips and pending-list updates,
   linking to the history file instead of repeating it.
3. **`project-phases.md`** — a one-line Recent Activity entry (date, title,
   link) and the phase status emoji. Nothing more.

## Conventions

- History filenames: `YYYY-MM-DD-short-slug.md`, lowercase, hyphens.
- Recent Activity is capped at the latest **10** entries; the oldest rolls off.
  Its detail is never lost — it lives in `history/`.
- Status emoji: ✅ complete · 🔄 in progress · 📋 planned. Change it only when a
  phase's status actually changes, not on every entry.
- Completed-era planning docs are moved into `history/` with a date prefix, not
  deleted.
- Paths written in docs are relative to the **repo root** (e.g.
  `docs/history/...`); markdown links from inside `project-phases/` need `../`
  prefixes. Write paths carefully — a stray `docs/docs/` tree once went
  unnoticed for weeks because of this.
