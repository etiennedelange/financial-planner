---
type: History Entry
title: "2026-10-30 — docs/ converted to an Open Knowledge Format bundle"
description: "Frontmatter on every doc, log.md replacing the Recent Activity feed, and docs:check; the generated OKF indexes were added then removed after an A/B test showed no benefit."
date: 2026-10-30
tags: [tooling]
---

# 2026-10-30 — docs/ converted to an Open Knowledge Format bundle

> **Follow-up, same day: the generated indexes were removed.** An A/B test (below) showed
> they did not help, so `docs/` keeps the frontmatter, `log.md` and `docs:check` but is no
> longer an OKF bundle in the conformance sense. Sections below describe what was first
> built; read "Follow-up" at the end for the current state.

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

## Follow-up: A/B test and slimming down

Two fresh read-only sessions answered the same three doc questions (2FA risk register,
Section 11F credit, Phases 10/11), one on `main` (plain markdown) and one on the OKF branch.

| | plain (`main`) | OKF branch |
|---|---|---|
| Tool calls before answering | 4 | 7 |
| Cost | $0.19 | $0.40 |

Both answers were correct. The OKF session read the root index but then grepped and listed
directories like the other one, never opened `history/index.md`, and re-read two phase
docs. One run each on three questions is a small sample, so this shows only that there was
no large gain.

**Removed:** the 7 generated `index.md` files, `pnpm docs:index`, `scripts/docs-okf.mjs`
(replaced by the smaller `scripts/docs-check.mjs`), and the requirement for `type`.
**Kept:** `title`/`description` frontmatter (still required), `date`/`tags`, `log.md`, and
`pnpm docs:check` (frontmatter, broken links between docs, ISO log dates). Rules in
`CLAUDE.md`, `docs/README.md`, `docs-sync`, `wrap-up` and house-rules were updated to match.
Verified with `pnpm docs:check`.
