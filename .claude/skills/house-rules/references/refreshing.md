# Refreshing These Checklists

The four checklists were distilled from `docs/` on 2026-08-16. They are a cache, and caches
go stale. A stale reviewer is worse than no reviewer, because it asserts old rules with the
same confidence as current ones.

## When to refresh

- A phase completes and adds conventions
- CLAUDE.md's "Common Pitfalls" or "UI Components" sections change
- A new security review lands in `docs/security/`
- A new incident class appears in `docs/history/` — especially one described as a
  *regression*, *root cause*, *drift*, or something that shipped *silently*
- A review using this skill enforces a rule that turns out to be obsolete

## How to re-derive

The checklists come from these sources, in priority order — CLAUDE.md wins any conflict,
since it is the instruction file the whole project is held to:

| Source | Feeds |
|---|---|
| `CLAUDE.md` | all four — especially "Common Pitfalls", "UI Components", "Testing Requirements" |
| `docs/README.md` | `best-practices.md` (three-tier doc rule) |
| `docs/THEMING.md` | `styling.md` |
| `docs/security/*.md` | `security.md` |
| `docs/FINANCIAL_LOGIC_REFERENCE.md` | `regression.md` (formulas, SA tax rules) |
| `docs/project-phases/*.md` | open gaps, deliberate exceptions, known-bad items |
| `docs/history/*.md` | the incidents behind every rule |

Useful sweeps for new material:

```bash
# Rule-shaped statements
grep -rn -iE "^\s*[-*]?\s*(never|don'?t|avoid|must not|always)\b" docs/ --include="*.md"

# Incident language — where the expensive rules come from
grep -rn -iE "(lesson|pitfall|regression|root cause|went unnoticed|bitten|silently|drift)" \
  docs/history/ docs/project-phases/ --include="*.md"

# Anything newer than this skill
find docs -name "*.md" -newer .claude/skills/house-rules/SKILL.md
```

## What makes a good entry

Not every documented preference deserves a slot. The bar:

1. **It has a provenance.** Cite the doc, and where possible the incident. A rule whose
   origin nobody can name will not survive an argument with a developer who disagrees.
2. **It is checkable against a diff.** "Write clear code" is unenforceable. "Any
   `annualReturn / 12` is a finding" is enforceable.
3. **It is not generic.** `/code-review` already covers null checks and error handling.
   This skill only earns its context by knowing things no general reviewer could —
   that `fees` is deliberately excluded from the conservation invariant, that
   `expenses-store` is global on purpose, that `--chart-5` means *negative*.

Rules that fail the bar make the review longer and less trusted. Prune as readily as you add.

## Recording deliberate exceptions

Some things look like violations and are not. These matter as much as the rules, because a
reviewer that reports known-good state as a defect gets ignored. Currently pinned:

- Raw HSL triplets in `app/globals.css` — correct by design
- `dangerouslySetInnerHTML` in `components/ui/chart.tsx` — generated CSS custom properties
- `yearlyProjections[].lumpSumTax === 0` — a gap INV-018 pins deliberately
- Store branch coverage below 85% — a tracked open P1, not a new finding
- The `nextjs-agent-rules` block in CLAUDE.md — rewritten by `next dev`

When you add a rule, ask whether it needs a matching exception. When you remove one, check
whether an exception became dead with it.
