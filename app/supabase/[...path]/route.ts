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
    // @ts-expect-error duplex required for streaming request bodies
    duplex: "half",
  })

  const responseHeaders = new Headers(upstream.headers)
  // Remove hop-by-hop headers
  responseHeaders.delete("transfer-encoding")

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
