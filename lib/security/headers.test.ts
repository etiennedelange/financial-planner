import { describe, it, expect } from 'vitest'
import { buildCsp, SECURITY_HEADERS } from './headers'

const SUPABASE = 'https://abc.supabase.co'

function directive(csp: string, name: string): string {
  const found = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `))
  if (!found) throw new Error(`No ${name} directive in CSP`)
  return found
}

describe('buildCsp', () => {
  it('binds script-src to the request nonce', () => {
    expect(directive(buildCsp('abc123', SUPABASE, false), 'script-src')).toContain("'nonce-abc123'")
  })

  it('allows the Supabase origin to be contacted', () => {
    expect(directive(buildCsp('n', SUPABASE, false), 'connect-src')).toContain(SUPABASE)
  })

  it('blocks framing entirely', () => {
    expect(directive(buildCsp('n', SUPABASE, false), 'frame-ancestors')).toContain("'none'")
  })

  it('restricts form submission to the same origin', () => {
    expect(directive(buildCsp('n', SUPABASE, false), 'form-action')).toContain("'self'")
  })

  it('does not permit unsafe-eval in production', () => {
    expect(buildCsp('n', SUPABASE, false)).not.toContain("'unsafe-eval'")
  })

  it('permits unsafe-eval in development for React refresh', () => {
    expect(directive(buildCsp('n', SUPABASE, true), 'script-src')).toContain("'unsafe-eval'")
  })

  it('allows the data: URIs used by TOTP QR codes', () => {
    expect(directive(buildCsp('n', SUPABASE, false), 'img-src')).toContain('data:')
  })

  it('does not force an https upgrade in development, where the dev server is plain http', () => {
    expect(buildCsp('n', SUPABASE, true)).not.toContain('upgrade-insecure-requests')
  })
})

describe('SECURITY_HEADERS', () => {
  it('denies framing', () => {
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY')
  })

  it('sets a two-year HSTS max-age including subdomains', () => {
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toContain('max-age=63072000')
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toContain('includeSubDomains')
  })

  it('blocks MIME sniffing', () => {
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff')
  })

  it('does not leak full URLs cross-origin', () => {
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })
})
