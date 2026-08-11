import { createClient } from "@/lib/supabase/client"
import { generateRecoveryCodes } from "./recovery-codes"

export interface TotpEnrollment {
  factorId: string
  qrCode: string
  secret: string
}

export async function enrollTotp(): Promise<TotpEnrollment> {
  const { data, error } = await createClient().auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
  })
  if (error) throw new Error(error.message)
  // GoTrue's qr_code is a raw (non-percent-encoded) SVG data URI with a trailing
  // newline. next/image rejects any src ending in whitespace/control characters.
  return { factorId: data.id, qrCode: data.totp.qr_code.trimEnd(), secret: data.totp.secret }
}

/**
 * Confirms an enrolment with a code from the authenticator app, then issues recovery codes.
 *
 * If code storage fails the factor is rolled back. A verified factor with no recovery codes
 * is a lockout waiting to happen — better to make the user enrol again than to strand them.
 */
export async function verifyEnrollment(factorId: string, code: string): Promise<string[]> {
  const supabase = createClient()

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId })
  if (challengeError) throw new Error(challengeError.message)

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId, challengeId: challenge.id, code,
  })
  if (verifyError) throw new Error(verifyError.message)

  const codes = generateRecoveryCodes()
  const { error: storeError } = await supabase.rpc("store_recovery_codes", { codes })
  if (storeError) {
    await supabase.auth.mfa.unenroll({ factorId })
    throw new Error(storeError.message)
  }

  return codes
}

export async function listFactors(): Promise<{ id: string; friendlyName: string | null }[]> {
  const { data, error } = await createClient().auth.mfa.listFactors()
  if (error) throw new Error(error.message)
  // "unverified" means enrol() was called but verifyEnrollment() never completed
  // (e.g. the user closed the tab before entering a code) — that factor has no
  // recovery codes and was never confirmed, so it must not count as "2FA is on".
  return (data.totp ?? [])
    .filter((f) => f.status === "verified")
    .map((f) => ({ id: f.id, friendlyName: f.friendly_name ?? null }))
}

/**
 * Unenrols any abandoned (never-verified) TOTP factors for the current user.
 * Supabase's own AAL calculation treats an unverified factor as making aal2
 * reachable, so an abandoned enrolment attempt can strand a user at the MFA
 * challenge screen for a factor they never finished setting up. Called from
 * the enrolment UI's cancel path and as a self-healing backstop on the
 * challenge page itself.
 */
export async function unenrollAbandonedFactors(): Promise<void> {
  const supabase = createClient()
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw new Error(error.message)
  const abandoned = (data.totp ?? []).filter((f) => f.status !== "verified")
  for (const factor of abandoned) {
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
    if (unenrollError) throw new Error(unenrollError.message)
  }
}

/**
 * Elevates the session to aal2 by challenging an already-enrolled factor.
 * Disabling 2FA requires proof you still hold the device: Supabase's own
 * server rejects an unenroll of a verified factor at aal1 regardless of what
 * the client sends, so a password-only reauth can never satisfy it.
 */
export async function elevateWithTotp(factorId: string, code: string): Promise<void> {
  const supabase = createClient()

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId })
  if (challengeError) throw new Error(challengeError.message)

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId, challengeId: challenge.id, code,
  })
  if (verifyError) throw new Error(verifyError.message)
}

export async function unenrollTotp(factorId: string): Promise<void> {
  const { error } = await createClient().auth.mfa.unenroll({ factorId })
  if (error) throw new Error(error.message)
}

export async function currentAal(): Promise<{ current: string | null; next: string | null }> {
  const { data, error } = await createClient().auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw new Error(error.message)
  return { current: data.currentLevel, next: data.nextLevel }
}

export async function recoveryCodesRemaining(): Promise<number> {
  const { data, error } = await createClient().rpc("recovery_codes_remaining")
  if (error) throw new Error(error.message)
  return data ?? 0
}
