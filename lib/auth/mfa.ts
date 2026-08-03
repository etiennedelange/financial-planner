import { createClient } from "@/lib/supabase/client"
import { generateRecoveryCodes, normaliseRecoveryCode } from "./recovery-codes"

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
  return (data.totp ?? []).map((f) => ({ id: f.id, friendlyName: f.friendly_name ?? null }))
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

/** Signs a challenge with a recovery code instead of a TOTP code. */
export async function redeemRecoveryCode(code: string): Promise<boolean> {
  const { data, error } = await createClient()
    .rpc("redeem_recovery_code", { code: normaliseRecoveryCode(code) })
  if (error) throw new Error(error.message)
  return data === true
}

export async function recoveryCodesRemaining(): Promise<number> {
  const { data, error } = await createClient().rpc("recovery_codes_remaining")
  if (error) throw new Error(error.message)
  return data ?? 0
}
