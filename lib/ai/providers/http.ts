import { PROVIDER_ORIGINS, type ProviderId } from "@/lib/ai/providers/origins"
import { ProviderError } from "@/lib/ai/providers/types"

const REQUEST_TIMEOUT_MS = 60_000

/**
 * The single place a request carrying the API key leaves the app. Every provider
 * goes through it, so the hardening below cannot be forgotten for one of them:
 *
 *  - the target must be a pinned provider origin (matching the CSP connect-src);
 *  - credentials: "omit"      — never attach cookies to a request holding a key;
 *  - referrerPolicy: no-referrer, cache: no-store;
 *  - redirect: "error"        — a redirect must never re-send custom key headers elsewhere;
 *  - a hard timeout, combined with the caller's abort signal.
 */
export async function providerFetch(
  provider: ProviderId,
  path: string,
  init: { headers: Record<string, string>; body: string; signal?: AbortSignal },
): Promise<Response> {
  const url = new URL(path, PROVIDER_ORIGINS[provider])
  if (url.origin !== PROVIDER_ORIGINS[provider]) {
    throw new ProviderError("blocked")
  }

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...init.headers },
      body: init.body,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      redirect: "error",
      signal,
    })
  } catch (error) {
    throw mapFetchError(error, init.signal, timeout)
  }

  if (!response.ok) throw mapStatus(response.status)
  if (!response.body) throw new ProviderError("unknown")
  return response
}

function mapFetchError(error: unknown, userSignal?: AbortSignal, timeout?: AbortSignal) {
  if (userSignal?.aborted) return new ProviderError("aborted")
  if (timeout?.aborted) return new ProviderError("timeout")
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ProviderError("aborted")
  }
  // A TypeError from fetch is a network failure, a CORS rejection or a CSP block —
  // the browser deliberately doesn't say which, so the message covers all three.
  return new ProviderError("network")
}

export function mapStatus(status: number): ProviderError {
  if (status === 401 || status === 403) return new ProviderError("invalid-key")
  if (status === 402) return new ProviderError("quota")
  if (status === 429) return new ProviderError("rate-limited")
  if (status === 400 || status === 404 || status === 422) return new ProviderError("bad-request")
  return new ProviderError("unknown")
}
