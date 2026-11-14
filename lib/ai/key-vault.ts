// Holds the user's LLM API key. The design goals, in order:
//
//  1. The key is NEVER written to storage in plaintext. Two modes:
//       - session-only: lives in module memory until the tab closes. Nothing on disk.
//       - remembered:   encrypted with a user passphrase (PBKDF2-SHA-256 -> AES-256-GCM)
//                       and stored as an opaque blob. Useless without the passphrase.
//  2. Unlocked plaintext lives ONLY in this module's closure — never in a zustand
//     store, React state/context, the DOM, `persist`, an export file or a URL. UI
//     code asks for the key at the moment of a request (getKey) and drops it.
//  3. Failure messages never contain the key or the passphrase, and "wrong
//     passphrase" and "tampered blob" are indistinguishable (AES-GCM auth failure).
//
// What this does NOT defend against (documented in docs/security/byok-llm-key-handling.md):
// a script running in this origin WHILE the vault is unlocked can still request
// getKey(). The CSP connect-src allowlist stops it sending the key to an attacker's
// host, and a spend-capped key bounds what it could do with the provider — but there
// is no browser-only scheme that fully closes that gap.

import type { ProviderId } from "@/lib/ai/providers/origins"
import { PROVIDER_IDS } from "@/lib/ai/providers/origins"

export const VAULT_PREFIX = "rc-llm-key-v1:"
export const MIN_PASSPHRASE_LENGTH = 12
export const PBKDF2_ITERATIONS = 600_000 // OWASP 2023 guidance for PBKDF2-HMAC-SHA256
/** Remembered keys re-lock after this long without being used. */
export const IDLE_LOCK_MS = 15 * 60 * 1000

// Bounds applied to a stored blob before use: a tampered blob must not be able to
// request absurd work (DoS) or an absurdly weak derivation.
const MIN_ITERATIONS = 100_000
const MAX_ITERATIONS = 5_000_000
const MIN_KEY_LENGTH = 8
const MAX_KEY_LENGTH = 512

export type VaultErrorCode =
  | "invalid-key"
  | "weak-passphrase"
  | "wrong-passphrase"
  | "no-stored-key"
  | "storage-unavailable"
  | "unsupported"

export class VaultError extends Error {
  readonly code: VaultErrorCode
  constructor(code: VaultErrorCode, message: string) {
    super(message)
    this.name = "VaultError"
    this.code = code
  }
}

/** none: nothing saved. locked: encrypted blob exists. session: in memory only. unlocked: blob + in memory. */
export type KeyStatus = "none" | "locked" | "session" | "unlocked"

interface StoredBlob {
  v: 1
  provider: ProviderId
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number }
  salt: string
  iv: string
  ct: string
}

// ---- module-scoped state (deliberately not exported, not reactive state) -------

const memory = new Map<ProviderId, string>()
let idleTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()
let pagehideInstalled = false

function notify() {
  for (const listener of listeners) listener()
}

/** For useSyncExternalStore: re-render when anything about the vault changes. */
export function subscribeVault(listener: () => void): () => void {
  installPagehideLock()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// ---- helpers ------------------------------------------------------------------

function storageKey(provider: ProviderId): string {
  return `${VAULT_PREFIX}${provider}`
}

function getStorage(): Storage {
  try {
    return window.localStorage
  } catch {
    throw new VaultError("storage-unavailable", "Browser storage is unavailable.")
  }
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle
  if (!s) {
    throw new VaultError(
      "unsupported",
      "Encrypted storage needs a secure (HTTPS) connection. You can still use the key for this session only.",
    )
  }
  return s
}

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length))
  crypto.getRandomValues(bytes)
  return bytes
}

/** Provider is bound into the ciphertext so a blob cannot be swapped between providers. */
function aad(provider: ProviderId): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(`${VAULT_PREFIX}${provider}`)
  const bytes = new Uint8Array(new ArrayBuffer(encoded.length))
  bytes.set(encoded)
  return bytes
}

async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const s = subtle()
  const material = await s.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ])
  return s.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false, // non-extractable: the derived key cannot be read back out
    ["encrypt", "decrypt"],
  )
}

/** Keys go into HTTP headers: printable ASCII only, which also rules out header injection. */
export function validateApiKey(raw: string): string {
  const key = raw.trim()
  if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH || !/^[\x21-\x7E]+$/.test(key)) {
    throw new VaultError("invalid-key", "That doesn't look like a valid API key.")
  }
  return key
}

function isBlob(value: unknown): value is StoredBlob {
  if (typeof value !== "object" || value === null) return false
  const b = value as Partial<StoredBlob>
  return (
    b.v === 1 &&
    typeof b.provider === "string" &&
    (PROVIDER_IDS as string[]).includes(b.provider) &&
    b.kdf?.name === "PBKDF2" &&
    b.kdf.hash === "SHA-256" &&
    Number.isInteger(b.kdf.iterations) &&
    b.kdf.iterations >= MIN_ITERATIONS &&
    b.kdf.iterations <= MAX_ITERATIONS &&
    typeof b.salt === "string" &&
    typeof b.iv === "string" &&
    typeof b.ct === "string"
  )
}

function readBlob(provider: ProviderId): StoredBlob | null {
  let raw: string | null
  try {
    raw = getStorage().getItem(storageKey(provider))
  } catch {
    return null
  }
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isBlob(parsed) && parsed.provider === provider ? parsed : null
  } catch {
    return null
  }
}

// ---- idle / bfcache locking ----------------------------------------------------

function hasRememberedInMemory(): boolean {
  for (const provider of memory.keys()) if (readBlob(provider)) return true
  return false
}

function touchIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = null
  if (!hasRememberedInMemory()) return
  idleTimer = setTimeout(() => {
    idleTimer = null
    // Only remembered keys re-lock; a session-only key has no blob to unlock from.
    // Deleting from a Map while iterating it is well-defined in JS.
    for (const provider of memory.keys()) if (readBlob(provider)) memory.delete(provider)
    notify()
  }, IDLE_LOCK_MS)
}

function installPagehideLock() {
  if (pagehideInstalled || typeof window === "undefined") return
  pagehideInstalled = true
  // A page restored from the back/forward cache keeps its JS memory alive; lock it so
  // the key isn't sitting unlocked in a page the user navigated away from.
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) lockAll()
  })
}

// ---- public API ----------------------------------------------------------------

export function getStatus(provider: ProviderId): KeyStatus {
  const inMemory = memory.has(provider)
  const hasBlob = readBlob(provider) !== null
  if (inMemory) return hasBlob ? "unlocked" : "session"
  return hasBlob ? "locked" : "none"
}

/** Returns the usable key, or null if none / locked. Call at request time; do not retain. */
export function getKey(provider: ProviderId): string | null {
  const key = memory.get(provider) ?? null
  if (key !== null) touchIdleTimer()
  return key
}

/** Keep the key in memory only. Replaces (and removes) any remembered copy. */
export function saveSessionOnly(provider: ProviderId, rawKey: string): void {
  const key = validateApiKey(rawKey)
  try {
    getStorage().removeItem(storageKey(provider))
  } catch {
    // No storage at all is fine for session-only mode.
  }
  memory.set(provider, key)
  touchIdleTimer()
  notify()
}

/** Encrypt with a passphrase and store the opaque blob; also unlocks for this session. */
export async function saveEncrypted(
  provider: ProviderId,
  rawKey: string,
  passphrase: string,
): Promise<void> {
  const key = validateApiKey(rawKey)
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new VaultError(
      "weak-passphrase",
      `Use a passphrase of at least ${MIN_PASSPHRASE_LENGTH} characters.`,
    )
  }
  const salt = randomBytes(16)
  const iv = randomBytes(12) // fresh per encryption — never reuse an IV under one key
  const aesKey = await deriveAesKey(passphrase, salt, PBKDF2_ITERATIONS)
  const ciphertext = await subtle().encrypt(
    { name: "AES-GCM", iv, additionalData: aad(provider) },
    aesKey,
    new TextEncoder().encode(key),
  )
  const blob: StoredBlob = {
    v: 1,
    provider,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: PBKDF2_ITERATIONS },
    salt: toBase64(salt),
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ciphertext)),
  }
  try {
    getStorage().setItem(storageKey(provider), JSON.stringify(blob))
  } catch {
    throw new VaultError("storage-unavailable", "Couldn't save to browser storage.")
  }
  memory.set(provider, key)
  touchIdleTimer()
  notify()
}

/** Decrypt the remembered key into memory. Wrong passphrase and tampering look identical. */
export async function unlock(provider: ProviderId, passphrase: string): Promise<void> {
  const blob = readBlob(provider)
  if (!blob) throw new VaultError("no-stored-key", "There is no saved key to unlock.")
  try {
    const aesKey = await deriveAesKey(passphrase, fromBase64(blob.salt), blob.kdf.iterations)
    const plaintext = await subtle().decrypt(
      { name: "AES-GCM", iv: fromBase64(blob.iv), additionalData: aad(provider) },
      aesKey,
      fromBase64(blob.ct),
    )
    memory.set(provider, new TextDecoder().decode(plaintext))
  } catch (error) {
    if (error instanceof VaultError) throw error
    throw new VaultError("wrong-passphrase", "Wrong passphrase.")
  }
  touchIdleTimer()
  notify()
}

/** Drop the in-memory key. A remembered key stays encrypted on disk and can be unlocked again. */
export function lock(provider: ProviderId): void {
  memory.delete(provider)
  touchIdleTimer()
  notify()
}

export function lockAll(): void {
  for (const provider of PROVIDER_IDS) memory.delete(provider)
  touchIdleTimer()
  notify()
}

/** Remove the key everywhere: memory and the encrypted blob. */
export function forget(provider: ProviderId): void {
  memory.delete(provider)
  try {
    getStorage().removeItem(storageKey(provider))
  } catch {
    // Nothing stored if storage is unavailable.
  }
  touchIdleTimer()
  notify()
}

export function forgetAll(): void {
  for (const provider of PROVIDER_IDS) forget(provider)
}

/** Test helper: clears module state without touching storage. */
export function __resetVaultForTests(): void {
  memory.clear()
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = null
  listeners.clear()
}
