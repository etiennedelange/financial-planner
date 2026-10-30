---
type: History Entry
title: "2026-10-30 — docs/ converted to an Open Knowledge Format bundle"
description: "docs/ is now an OKF v0.2 bundle: frontmatter on every doc, generated index.md per directory, log.md replacing the Recent Activity feed, and a validator."
date: 2026-10-30
tags: [tooling]
---

# 2026-10-30 — docs/ converted to an Open Knowledge Format bundle

## Why

Agents had no cheap way to find the right doc. The only map was `docs/README.md` (a
layout table), and `docs/history/` alone is 50 files whose names are the only hint of their
content. An agent either guessed from filenames or opened files to see what they were. OKF
([spec](https://github.com/GoogleCloudPlatform/open-knowledge-format), v0.2) fixes this with
a one-line `description` per file and a generated `index.md` per directory, so an agent reads
one small index and then opens only what it needs.

## What changed

| Area | Change |
|---|---|
| `docs/**/*.md` (88 files) | Added frontmatter: `type`, `title`, `description`, plus `date` (dated files) and `tags` where they apply. No body text was changed. Phase status suffixes (✅/🔄/📋) were left out of `title`; `project-phases.md` stays the single owner of status. |
| `docs/index.md`, `docs/*/index.md` (7) | Generated from frontmatter. The root one carries `okf_version: "0.2"`. |
| `docs/log.md` | Replaces the Recent Activity feed in `project-phases.md` (the 10 existing entries, one line each, using each history file's description). Now uncapped; the old "latest 10" rule is dropped because `log.md` is not read in full. |
| `docs/project-phases.md` | Recent Activity section replaced by a pointer to `log.md`. |
| `scripts/docs-okf.mjs`, `package.json` | `pnpm docs:index` regenerates indexes; `pnpm docs:check` validates (frontmatter, `type`/`title`/`description`, broken doc links, stale indexes, ISO log dates). Zero dependencies. |
| `docs/README.md`, `CLAUDE.md`, `.claude/agents/docs-sync.md`, `.claude/commands/wrap-up.md`, `.claude/skills/house-rules/references/best-practices.md` | Rules updated: log.md instead of Recent Activity, frontmatter requirement, run `docs:index` and `docs:check`. `docs-sync` and `wrap-up` also referred to a "Current Status Summary" section that no longer existed. |

## Decisions

- **Bundle root is `docs/`**, not the repo. `CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`,
  `REQUIREMENTS.md`, `README.md`, `SECURITY.md` stay plain markdown at the root because
  Claude Code and the impeccable skill read them in their current format.
- **Relative links, not OKF's bundle-absolute `/path`.** Both are valid in the spec, but
  GitHub resolves a leading `/` against the repo root, so absolute links would break when
  browsing `docs/` on GitHub.
- **`title` and `description` are required by `docs:check`** although OKF only recommends
  them; the indexes depend on them.
- **No `generated` / `verified` / `sources` provenance.** The docs mix human and agent
  writing and nothing records which, so claiming either would be invented.
- **Spec version.** Written against the v0.2 SPEC in the `GoogleCloudPlatform/knowledge-catalog`
  snapshot. That repo's README says the canonical home has moved to
  `GoogleCloudPlatform/open-knowledge-format`; the later spec was not checked, so re-read it
  before relying on field names (an earlier source called the format early and experimental).

## Verification

- `pnpm docs:index` then `pnpm docs:check`: 96 files, 7 indexes, no errors, no broken
  links between docs.
- Conformance per SPEC §11: every non-reserved `.md` has parseable frontmatter with a
  non-empty `type`; `index.md` and `log.md` follow §8 and §9.
- No application code or test changed, so the unit suite was not re-run.
