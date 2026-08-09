import { type NextRequest, NextResponse } from "next/server"
import { notFound } from "next/navigation"

// Proxies local Supabase through Next.js so the browser can reach it in
// remote devcontainer environments (Codespaces) where port 54321 isn't
// accessible from the user's browser. Only active in development.
// To use: set NEXT_PUBLIC_SUPABASE_URL=http://localhost:3000/supabase
const SUPABASE_INTERNAL_URL = "http://127.0.0.1:54321"

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (process.env.NODE_ENV !== "development") notFound()
  const { path } = await params
  const search = request.nextUrl.search
  const targetUrl = `${SUPABASE_INTERNAL_URL}/${path.join("/")}${search}`

  const headers = new Headers(request.headers)
  headers.delete("host")

  const body =
    request.method !== "GET" && request.method !== "HEAD"
      ? request.body
      : undefined

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    // Supabase redirects (e.g. GoTrue's /verify -> redirect_to) often point
    // back at this same Next.js app. Following them here would silently
    // inline that page's already-rendered HTML — with its own CSP nonce
    // baked into its script tags — under this route's URL, whose middleware
    // stamps a different nonce on the response header. Every script then
    // fails the browser's nonce check. Passing the 3xx straight through lets
    // the browser do its own top-level navigation instead.
    redirect: "manual",
    // @ts-expect-error duplex required for streaming request bodies
    duplex: "half",
  })

  const responseHeaders = new Headers(upstream.headers)
  // Remove hop-by-hop headers. content-encoding/content-length are dropped
  // too: fetch() transparently decompresses the body, so forwarding the
  // original encoding/length headers describes bytes that no longer match
  // what's actually being sent, and the browser fails to decode them.
  responseHeaders.delete("transfer-encoding")
  responseHeaders.delete("content-encoding")
  responseHeaders.delete("content-length")

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
export const OPTIONS = proxy
