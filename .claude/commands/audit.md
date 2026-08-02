---
description: Run a multi-agent adversarial audit of the current branch's changes
---

# Multi-Agent Audit

Fan out the specialist auditors across the current changes, then deduplicate and rank their findings into a single report.

## Step 1 — Scope the audit

Determine what changed before dispatching anything. Agents given no scope will audit the whole repo and return noise.

```
git diff --stat main...HEAD
git status --porcelain
git diff --name-only main...HEAD
```

Classify the changed files:

- **Calculation** — `lib/calculations/`, `lib/monte-carlo/`, `lib/constants/tax-year.config.ts`
- **State** — `lib/store/`
- **UI** — `components/`, `app/`
- **Docs / config** — everything else

If `$ARGUMENTS` names a specific area or file, scope to that instead and skip the classification.

## Step 2 — Select agents by what actually changed

Do not dispatch all of them by reflex. Each agent costs tokens and returns findings you must then triage, so dispatch only those whose lane the diff touches.

| Changed | Dispatch |
|---|---|
| Calculation | `mathematics-auditor`, `sa-retirement-calc-validator`, `edge-case-hunter` |
| Tax config or tax logic | `tax-auditor` |
| Assumptions, defaults, withdrawal strategy | `financial-auditor` |
| State, hooks, general implementation | `software-auditor` |
| UI | `design-system-auditor` |
| Calculation with missing or thin tests | `test-generator` |

`devil-advocate` runs **last and separately** — see step 4.

## Step 3 — Dispatch in parallel

Send the selected agents in a single message so they run concurrently. Give every agent the same scope block:

- The exact list of changed files
- What the change was intended to do
- The instruction to confine itself to that scope
- The instruction to report zero findings if it finds nothing, rather than padding

These agents are read-only and will not edit files. `test-generator` and `docs-sync` are the exceptions — they write.

## Step 4 — Contrarian pass

Once the parallel agents have reported, dispatch `devil-advocate` with their **findings** as input, not the diff. Its job is to challenge the consensus the other agents reached — including their collective decision that something is fine.

## Step 5 — Deduplicate and rank

The specialists overlap at the edges, so the same defect will arrive more than once. Merge before reporting:

- Collapse findings that describe the same defect at the same `file:line` into one entry, keeping the clearest explanation and citing which agents found it. Independent corroboration raises confidence — say so.
- Drop findings that are out of the reporting agent's lane and better covered by a sibling's report of the same thing.
- Discard any finding with no concrete failing input. Every agent is required to supply one; a finding without one did not meet its own contract.
- Rank strictly by user impact — how much money or how many years of a real retiree's plan ride on it — not by how confident the agent sounded.

## Step 6 — Report

Present to the user:

1. **Verdict** — one line: is this branch safe to merge?
2. **Critical and High findings** — full detail, each with location, failing input, impact, and fix
3. **Medium and Low** — one line each
4. **Corroboration** — findings that multiple agents independently reached
5. **Coverage** — which agents ran, what each covered, and what nobody checked

Do not fix anything during the audit. Report first; let the user decide what to act on.
