export const RECOVERY_CODE_COUNT = 10

// Crockford base32 minus I, L, O and U — no character pair a user can confuse
// while copying a code off a screen under pressure.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const GROUP = 5

function randomGroup(): string {
  const bytes = new Uint8Array(GROUP)
  crypto.getRandomValues(bytes)
  // 32-character alphabet divides 256 exactly, so the modulo introduces no bias.
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")
}

/** Ten single-use recovery codes. Shown to the user exactly once; only hashes are stored. */
export function generateRecoveryCodes(): string[] {
  const codes = new Set<string>()
  while (codes.size < RECOVERY_CODE_COUNT) {
    codes.add(`${randomGroup()}-${randomGroup()}`)
  }
  return [...codes]
}

/** Normalises user input: strips whitespace, uppercases, tolerates a missing hyphen. */
export function normaliseRecoveryCode(input: string): string {
  const bare = input.replace(/[\s-]/g, "").toUpperCase()
  return bare.length === GROUP * 2 ? `${bare.slice(0, GROUP)}-${bare.slice(GROUP)}` : bare
}
