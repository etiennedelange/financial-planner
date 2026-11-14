import { type NextRequest } from "next/server"
import { withSecurityHeaders } from "@/lib/security/apply-headers"

// Nonce-based CSP + security headers on every request. See
// lib/security/apply-headers.ts. (No session handling: the app has no accounts.)
export function proxy(request: NextRequest) {
  return withSecurityHeaders(request)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
