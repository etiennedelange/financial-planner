# AI Narrative Model Picker — Design Spec

Date: 2026-08-01
Status: Approved, pending implementation plan

## Purpose

Let users choose which model generates the plan narrative (Fast / Balanced /
Best) via a small dropdown on the existing "Explain My Plan" card, instead
of the hardcoded `anthropic/claude-sonnet-5` the feature currently always
uses.

This extends the AI plan narrative feature already shipped (see
`2026-08-01-ai-plan-narrative-design.md` and its implementation plan). It
does not change that feature's FAIS-liability framing, streaming behavior,
or cost-control (cache + cooldown) — only which model produces the text.

## Placement

Inline on `components/dashboard/plan-narrative-card.tsx`, as a `<Select>`
next to the existing "Explain my plan" / "Regenerate" button.

## Model tiers

Three curated tiers, plain labels only (no cost/speed hints shown to the
user):

| Tier label | Model ID (as of 2026-08-01) |
|---|---|
| Fast | `anthropic/claude-haiku-4.5` |
| Balanced (default) | `anthropic/claude-sonnet-5` |
| Best | `anthropic/claude-opus-5` |

**These IDs must be re-verified at implementation time** by querying
`curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id | startswith("anthropic/")) | .id] | reverse | .[]'`
per the AI SDK skill's standing guidance — do not assume the table above is
still current if this plan is executed significantly later.

## Security: server-authoritative tier mapping

The client never sends a raw model ID — only a tier key (`"fast"` |
`"balanced"` | `"best"`). The Route Handler is the only place that maps a
tier to an actual model ID, via a small lookup table. This means a client
can never smuggle an arbitrary, potentially expensive model ID into the
request; the worst a manipulated client payload can do is send an
unrecognized string, which the server treats as `"balanced"` (silent
fallback, not an error — see Error Handling below).

## Files

- `lib/ai/model-tiers.ts` — new. Exports:
  ```ts
  export type ModelTier = "fast" | "balanced" | "best"

  export const MODEL_TIERS: Record<ModelTier, string> = {
    fast: "anthropic/claude-haiku-4.5",
    balanced: "anthropic/claude-sonnet-5",
    best: "anthropic/claude-opus-5",
  }

  export const DEFAULT_MODEL_TIER: ModelTier = "balanced"
  ```
- `app/api/plan-narrative/route.ts` — modified. Reads `tier` from the
  parsed request body; if it's a key in `MODEL_TIERS`, uses that model,
  otherwise falls back to `DEFAULT_MODEL_TIER`'s model. Everything else
  about the route (prompt building, `streamText`, `toTextStreamResponse`)
  is unchanged.
- `lib/hooks/use-plan-narrative.ts` — modified. `usePlanNarrativeInput`
  gains a `tier: ModelTier` field; `generate()` includes it in the request
  body and in the cache key (see Data Flow).
- `components/dashboard/plan-narrative-card.tsx` — modified. Renders a
  shadcn `<Select>` with the three tier labels, backed by a small
  `useState` initialized from `localStorage` (key:
  `"plan-narrative-model-tier"`) and written back to `localStorage` on
  change. This is a plain client preference — unlike the narrative
  text/cache (which needed a Zustand store to survive in-app navigation,
  see the persistence fix in the shipped feature), a `<Select>`'s own value
  only needs to survive the same kind of lifecycle a normal form control
  does, and `localStorage` read/write is simpler for a single scalar
  preference than adding another store.

## Data flow

1. On mount, `PlanNarrativeCard` reads `localStorage.getItem("plan-narrative-model-tier")`, falling back to `DEFAULT_MODEL_TIER` if unset or invalid.
2. Selecting a different tier updates component state and
   `localStorage.setItem(...)`.
3. `usePlanNarrative` receives `tier` as part of its input and includes it
   both in the POST body and in the JSON-stringified cache key — so
   switching tiers always produces a fresh generation (a cache hit under
   the old tier never gets shown as if it came from the newly selected
   tier).
4. The Route Handler resolves `tier` → model ID via `MODEL_TIERS`,
   defaulting to `DEFAULT_MODEL_TIER`'s model for anything unrecognized,
   and proceeds exactly as it does today.

## Error handling

- Unrecognized/missing tier in the request body: silent fallback to
  `DEFAULT_MODEL_TIER`'s model server-side — not a user-facing error, since
  this is a defensive default (e.g. an old cached client sending a tier key
  that's since been removed), not a real failure mode.
- No other error paths change from the existing feature (network/stream
  failures still show the existing inline error state; failed attempts
  still don't consume the cooldown).

## Testing

- `lib/ai/model-tiers.ts` is a static lookup table with no logic — no
  dedicated test file.
- The Route Handler's new tier-resolution branch is small enough to verify
  with a manual curl check (send an invalid tier, confirm the response
  still streams using the default model rather than erroring) rather than
  a new automated test, consistent with the Route Handler already being
  untested per the original plan (thin wiring, no test asserts on model
  output).
- No changes needed to `lib/ai/plan-narrative-prompt.ts` or its existing
  test suite — prompt construction is independent of which model executes
  it.

## Out of scope for this spec

- Surfacing cost or speed information in the UI (explicitly rejected —
  plain labels only, per the approved design).
- Letting users choose a specific provider/model by name rather than a
  curated tier.
- Persisting the tier preference server-side/per-account (it's a
  `localStorage`-only client preference).
