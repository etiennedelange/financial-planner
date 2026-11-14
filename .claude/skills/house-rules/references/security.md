# Security Checklist

Read when the diff touches `lib/security/`, `proxy.ts`, `lib/store/` persistence code,
`lib/utils/plan-io.ts`, `lib/ai/`, `components/ai/`, or `package.json` / `pnpm-lock.yaml`.

The app has **no accounts, no server-side secrets, no analytics and makes no outbound requests**
(decided 2026-11-14). Data lives only in the browser; "Explain my plan" just builds a prompt for
the user to copy. The threats that matter are therefore about keeping it that way and about
untrusted data entering the stores. Context:
`docs/history/2026-11-14-remove-accounts-local-first.md`.

The earlier auth/RLS/MFA checklist guarded code that no longer exists; its record is
`docs/security/auth-2fa-risk-register.md` (retired). The short-lived bring-your-own-key AI mode is
recorded in `docs/security/byok-llm-key-handling.md` (retired).

---

## SEC1 — No outbound requests

**Check:** no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or `sendBeacon` in app source,
and no AI, analytics or telemetry client or script. `lib/security/no-outbound-requests.test.ts`
enforces it — if it needed editing, that is a product decision, not a refactor.

**Check:** the CSP `connect-src` stays `'self'`, with no third-party `script-src` origin and
`frame-src 'none'` (`lib/security/headers.ts`, pinned by `headers.test.ts`). A new analytics or
widget script is a security change, not a UI one.

**Check:** plan data never goes in a URL. Links to chat apps (`lib/ai/copy-prompt.ts`) are plain
URLs with no query string; the user pastes the copied prompt.

## SEC2 — CSP and the nonce

**Check:** the nonce is still minted per request in `lib/security/apply-headers.ts` and
`app/layout.tsx` still reads `x-nonce`. Do not move to a static export — it loses the nonce CSP.

## SEC3 — Untrusted data entering the stores

**Check:** anything loaded from a file or an old persisted payload goes through the shared
`sanitizePlan` / `sanitizeExpenses` (the same functions `migrate` uses). A second copy of the
clamping logic will drift. Backup import also rejects oversized files before parsing.

**Check:** storage failures are reported through `lib/store/storage-health.ts`, never swallowed —
with no server copy, silent failure is silent data loss.

**Check:** "Clear all local data" resets the in-memory stores **before** removing keys.

## SEC4 — Dependencies

**Check:** if `package.json` or `pnpm-lock.yaml` changed, run `pnpm audit`. New runtime
dependencies need a reason: every one runs on the same origin as the user's financial data.
`next` and `@next/bundle-analyzer` move together.

The project also has a dedicated `security-audit` skill for devcontainer, pnpm and semgrep
checks — recommend it rather than reproducing it here.

## SEC5 — Injection and rendering

**Check:** new `dangerouslySetInnerHTML`. Exactly one exists, in `components/ui/chart.tsx`
for generated CSS custom properties. Any new instance carrying user-derived content is a finding.

**Check:** user financial data in `console.*`. Logs are neither a UI nor a safe place for it.
