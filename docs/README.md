---
type: Guide
title: "Documentation Conventions"
description: "How docs/ is organised, the three-tier update rule, frontmatter requirements, and the docs:check command."
---

# Documentation Conventions

Map of `docs/` — what lives where, and the rules that keep it current. CLAUDE.md
carries the short version of these rules; this file is the reference.

Each doc starts with YAML frontmatter in the style of
[Open Knowledge Format](https://github.com/GoogleCloudPlatform/open-knowledge-format) (OKF).
OKF conformance is not enforced: there are no generated `index.md` files, and `type` is optional.
See `history/2026-10-30-docs-okf-bundle.md` for why.

## Layout

| Path | Purpose |
|------|---------|
| `log.md` | Chronological update log, newest first, one line per entry linking to `history/` |
| `project-phases.md` | Phase status table (the only place a phase's status emoji lives) |
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
3. **`log.md`** — a one-line entry (date, title, link, one-sentence summary).
   `project-phases.md` changes only when a phase's status emoji does.

## Frontmatter

Every doc except `log.md` starts with:

```yaml
---
type: History Entry        # optional; e.g. History Entry, Phase, Design Spec, Implementation Plan, Risk Register, Reference, Guide
title: "Short display title"
description: "One sentence saying what the file is for."
date: 2026-10-24           # dated files only (history, specs, plans); matches the filename
tags: [tax, calculations]  # optional
---
```

`title` and `description` are required and enforced by `pnpm docs:check`. A good description
lets an agent decide whether to open the file without reading it.

Do **not** put a phase's status in frontmatter or in a `title` — the status table in
`project-phases.md` owns it, and a second copy goes stale.

## Checking

```bash
pnpm docs:check   # fails on missing frontmatter/title/description, broken links between docs, non-ISO log dates
```

## Conventions

- History filenames: `YYYY-MM-DD-short-slug.md`, lowercase, hyphens.
- `log.md` is add-at-top and uncapped; dates are `## YYYY-MM-DD` headings. Its detail is
  never lost — it lives in `history/`.
- Status emoji: ✅ complete · 🔄 in progress · 📋 planned. Change it only when a
  phase's status actually changes, not on every entry.
- Completed-era planning docs are moved into `history/` with a date prefix, not
  deleted.
- Links between docs are relative (`../history/...`), so they work on GitHub. Links from
  inside `project-phases/` need `../` prefixes. `pnpm docs:check` catches the stray
  `docs/docs/` kind of mistake that once went unnoticed for weeks.
- Paths to source files written in prose are relative to the **repo root**
  (`lib/calculations/...`).
- Root files (`CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`, `REQUIREMENTS.md`, `README.md`,
  `SECURITY.md`) are plain markdown without frontmatter; tooling reads them in that form.
