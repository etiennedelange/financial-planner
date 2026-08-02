# Plain-English AI Plan Narrative — Design Spec

Date: 2026-08-01
Status: Approved, pending implementation plan

## Purpose

An on-demand "Explain my plan" button on the overview page that generates a
plain-English narrative of the user's retirement projection: what the
numbers mean, and which levers the plan is most sensitive to — framed as
general education, not personalized directives.

This is the second of two features from the same brainstorming session (the
first, the What-If sensitivity panel, is specced separately in
`2026-08-01-sensitivity-slider-design.md`). Unlike the sensitivity panel,
this feature needs new infrastructure the app doesn't have today: this is
the app's first server-side API route and first AI SDK dependency.

## Placement & trigger

Card on `/calculator/overview`, with an explicit "Explain my plan" button.
Nothing is generated automatically — every generation is a deliberate user
action, so no API cost is spent until requested.

## Content scope & advice framing

The narrative covers:

1. A plain-English restatement of the deterministic projection (nest egg at
   retirement) and Monte Carlo success probability.
2. General-education framing of which factors the plan is most sensitive to
   ("plans like this are typically most sensitive to retirement age and
   contribution rate") — **never** second-person directives ("you should
   retire two years later").

This framing choice exists because personalized financial advice is
regulated in South Africa under FAIS (Financial Advisory and Intermediary
Services Act). The system prompt hard-constrains the model to
general-education phrasing tied to the numbers already shown elsewhere in
the app, and the UI pairs every generation with a **persistent, hardcoded**
disclaimer (not model-generated text) — visible under the button *before*
generation, not only after — stating that plan numbers are sent to an AI
provider to produce the summary, and that it is not financial advice.

## Data sent to the model

Full scenario context, matching what the app already computes client-side
via `useCalculator()` and `useCalculatorStore()`: all accounts (type,
balance, monthly contribution, expected return, fees), `personalInfo`,
`retirementGoals`, `drawdownConfig`, and the current `projection` /
`simulationResult` numbers. No new server-side computation — the client
sends numbers it already has.

Because this is more personal financial data than the app has previously
sent to any third party, the Vercel AI Gateway's zero-data-retention setting
must be confirmed/enabled at implementation time (see Prerequisites below).

## Architecture

**Chosen approach:** a single Next.js Route Handler using `streamText` via
the Vercel AI Gateway, returning a plain text stream — no chat-oriented
client hooks (`useChat`/`useCompletion`), since this is a single-shot
generation rather than a multi-turn conversation. This was chosen over (a)
using `@ai-sdk/react`'s chat hooks, which pull in chat-shaped state
(message arrays, tool parts) for no benefit here, and (b) a non-streaming
`generateText` call, which contradicts the token-by-token streaming
requirement below.

### Files

- `app/api/plan-narrative/route.ts` — Node.js Route Handler (Fluid Compute
  default; no `runtime = 'edge'`). Accepts the scenario payload as the
  request body, calls `buildPlanNarrativePrompt(payload)`, then
  `streamText({ model, system, prompt }).toTextStreamResponse()`.
- `lib/ai/plan-narrative-prompt.ts` — pure function:
  ```ts
  function buildPlanNarrativePrompt(payload: PlanNarrativePayload): {
    system: string
    prompt: string
  }
  ```
  Kept separate from the route handler so it is independently unit-testable
  without any network/model call.
- `components/dashboard/plan-narrative-card.tsx` — new card on the overview
  page: button, streamed text render area, persistent disclaimer text.
  Follows the existing `components/dashboard/` component pattern (see
  `key-insights-summary.tsx`, `getting-started.tsx`).
- `lib/hooks/use-plan-narrative.ts` — client hook exposing
  `{ text, isStreaming, error, cooldownRemaining, generate() }`. Builds the
  payload from the store, checks the client-side cache, performs the
  `fetch` + `ReadableStream` read, and updates cache/cooldown state.

### Data flow

1. User clicks "Explain my plan."
2. `use-plan-narrative.ts` builds the payload from `useCalculatorStore()` +
   `useCalculator()` (accounts, personalInfo, retirementGoals,
   drawdownConfig, projection, simulationResult).
3. Payload is hashed/serialized; if it matches the last cached payload, the
   cached text is shown instantly with no network call.
4. Otherwise, `POST /api/plan-narrative` with the payload. The route builds
   the prompt via `buildPlanNarrativePrompt` and streams the model's
   response back as plain text.
5. The hook reads the stream via `response.body.getReader()` and appends
   decoded chunks to `text`, so the card renders progressively.
6. On stream completion, the hook caches `{ payloadHash, text }` and starts
   an 8-second cooldown on the button. A failed attempt does **not** trigger
   the cooldown.

### Model selection

The exact Vercel AI Gateway model string (e.g. `anthropic/claude-sonnet-…`)
is **not** hardcoded in this spec. Per the AI SDK skill's explicit guidance,
the implementer must query the live model list
(`curl https://ai-gateway.vercel.sh/v1/models`) at implementation time and
pick the current highest-version model, since any ID written today may be
stale by the time this is built.

## Caching & cost control

Client-side only, per the "cache last result + short cooldown" decision:

- A single `{ payloadHash, text }` slot (not a multi-entry cache) held in a
  ref inside `use-plan-narrative.ts`.
- Re-clicking with an unchanged payload replays the cached text for free.
- A changed payload triggers regeneration, followed by an 8-second button
  cooldown to prevent rapid-fire clicking.
- No server-side rate-limiting table or per-session counter — this is a UX
  guard, not an abuse-prevention system. If abuse becomes a real problem
  later, that would be a follow-up spec (e.g. a `session_id`-keyed counter
  the way `expenses-store.ts` already uses `session_id` for RLS).

## Error handling

- Zero accounts: the card does not render at all — same guard used by the
  What-If sensitivity panel (`deferredAccounts.length === 0`).
- Fetch/stream failure: inline error state with a "Try again" button;
  failed attempts do not consume/start the cooldown.
- Gateway or provider error: surfaced as a generic user-facing message,
  never the raw provider error text (avoids leaking implementation details
  and matches not showing raw errors elsewhere in the app).

## Testing

- `lib/ai/plan-narrative-prompt.test.ts`: verifies prompt construction
  across scenarios — multiple accounts, a single account, 0% success
  probability, R0-contribution accounts — and asserts the system prompt
  text contains the general-education/no-directives constraint. No live
  model calls.
- `lib/hooks/use-plan-narrative.test.ts`: cache-hit vs cache-miss behavior
  and cooldown timing, with `fetch` mocked.
- `app/api/plan-narrative/route.ts` is intentionally thin (payload → prompt
  → `streamText` wiring only) and is not unit tested beyond confirming it
  calls `buildPlanNarrativePrompt` with the parsed request body — no test
  asserts on actual model output, since that's non-deterministic and
  outside this app's control.

## Prerequisites for implementation (not done as part of this spec)

- Install the `ai` package (and provider/gateway packages as needed) —
  per the AI SDK skill, only `ai` is installed up front; provider-specific
  packages are added only if the Gateway path isn't used.
- Add `AI_GATEWAY_API_KEY` to `.env.local` for local development (Vercel
  deployments can authenticate via OIDC instead, with no key needed).
- Confirm/enable zero data retention on the Vercel AI Gateway, given this
  feature sends more personal financial data to a third party than any
  existing feature in the app.
- Fetch the current model list and select a model ID at implementation
  time (see "Model selection" above) — do not reuse any model ID written
  in earlier drafts of this document.

## Out of scope for this spec

- Automatic/background generation (rejected placement option).
- Specific numeric suggestions ("increase your contribution by R500") —
  rejected in favor of generic-levers framing, for FAIS-adjacent liability
  reasons.
- Server-side rate limiting / abuse prevention beyond the client cooldown.
- Referencing What-If sensitivity panel results in the prompt — a natural
  future enhancement once that feature ships, but not a dependency for v1
  of this feature.
