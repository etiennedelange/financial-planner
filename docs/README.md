---
type: Guide
title: "Documentation Conventions"
description: "How docs/ is organised as an OKF bundle, the three-tier update rule, and the commands that keep it valid."
---

# Documentation Conventions

`docs/` is an [Open Knowledge Format](https://github.com/GoogleCloudPlatform/open-knowledge-format)
(OKF v0.2) bundle: markdown files with YAML frontmatter, a generated `index.md` per
directory, and a `log.md` of changes. **Start at [index.md](index.md)** — it lists every
concept with its one-line description, so you can pick what to open without reading it all.
CLAUDE.md carries the short version of these rules; this file is the reference.

## Layout

| Path | Purpose |
|------|---------|
| `index.md`, `*/index.md` | Generated directory listings. Never hand-edit; run `pnpm docs:index` |
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

Every concept file (anything except `index.md` and `log.md`) starts with:

```yaml
---
type: History Entry        # required by OKF; see the types below
title: "Short display title"
description: "One sentence. This is what index.md shows, so make it say what the file is for."
date: 2026-10-24           # dated files only (history, specs, plans); matches the filename
tags: [tax, calculations]  # optional
---
```

`title` and `description` are required here (OKF only recommends them) because the
generated indexes depend on them. Types in use: `History Entry`, `Phase`, `Design Spec`,
`Implementation Plan`, `Risk Register`, `Reference`, `Guide`, `Status Overview`. OKF does
not register types, so a new one is fine when none fits.

Do **not** put a phase's status in frontmatter or in a `title` — the status table in
`project-phases.md` owns it, and a second copy goes stale.

## Commands

```bash
pnpm docs:index   # regenerate every index.md from concept frontmatter
pnpm docs:check   # fail on missing frontmatter/type/title/description, broken doc links, stale indexes, non-ISO log dates
```

Run `pnpm docs:index` then `pnpm docs:check` after adding, renaming or re-describing a doc.

## Conventions

- History filenames: `YYYY-MM-DD-short-slug.md`, lowercase, hyphens.
- `log.md` is append-at-top and uncapped; dates are `## YYYY-MM-DD` headings
  (OKF requires ISO dates there). Its detail is never lost — it lives in `history/`.
- Status emoji: ✅ complete · 🔄 in progress · 📋 planned. Change it only when a
  phase's status actually changes, not on every entry.
- Completed-era planning docs are moved into `history/` with a date prefix, not
  deleted.
- Links between docs are **relative** (`../history/...`), not OKF's bundle-absolute `/history/...`:
  GitHub resolves a leading `/` against the repo root, so absolute links break there.
  Links from inside `project-phases/` need `../` prefixes. `pnpm docs:check` catches the
  stray `docs/docs/` kind of mistake that once went unnoticed for weeks.
- Paths to source files written in prose are relative to the **repo root**
  (`lib/calculations/...`).
- Not in the bundle: `CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`, `REQUIREMENTS.md`, `README.md`,
  `SECURITY.md` at the repo root. Tooling reads them in their current form (Claude Code,
  the impeccable skill), so they stay plain markdown.
- Provenance (`generated`, `verified`, `sources`) is deliberately not used: these files are
  a mix of human and agent writing and nothing records which, so asserting it would be false.
