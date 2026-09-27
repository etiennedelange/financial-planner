/**
 * Build-time feature flags.
 *
 * NEXT_PUBLIC_* values are inlined into the client bundle at `next build`, so
 * each flag must reference `process.env.NEXT_PUBLIC_…` literally (no dynamic
 * key lookup) and changing one on Vercel requires a redeploy.
 */

/**
 * Account sign-in / sign-up (Supabase Auth) is still work in progress. Off
 * unless explicitly opted in, so a deployment that forgets the variable ships
 * with the sign-in dialog disabled rather than a half-finished auth flow.
 * Local dev opts in via `.env.local` (see `.env.example`).
 */
export function isAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"
}
