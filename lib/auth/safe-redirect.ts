/**
 * Resolves an untrusted `next` param to a same-origin path only.
 *
 * `next` arrives on a public, unauthenticated URL (email links), so it must be
 * treated as attacker-controlled. Resolving it against `origin` and comparing
 * resolved origins (rather than pattern-matching the raw string) closes
 * `@evil.com`, absolute URLs, protocol-relative `//evil.com`, and backslash
 * variants in one check, since browsers/URL parsers normalize all of them
 * before the origin comparison ever runs.
 */
export function safeNext(next: string | null, origin: string): string {
  if (!next) return "/calculator"
  try {
    const resolved = new URL(next, origin)
    return resolved.origin === origin
      ? `${resolved.pathname}${resolved.search}${resolved.hash}`
      : "/calculator"
  } catch {
    return "/calculator"
  }
}
