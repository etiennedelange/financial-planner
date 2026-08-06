import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUser = vi.fn()
const rpc = vi.fn()
const listFactors = vi.fn()
const deleteFactor = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser, mfa: { listFactors } },
      rpc,
    }),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { mfa: { deleteFactor } } },
  }),
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as Request
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
})

describe('POST /api/auth/recover', () => {
  it('rejects an unauthenticated request without redeeming a code or touching factor deletion', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    const response = await POST(makeRequest({ code: 'ABCD1234' }))

    expect(response.status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
    expect(deleteFactor).not.toHaveBeenCalled()
  })

  it('rejects a wrong or already-used recovery code without deleting any factor', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    rpc.mockResolvedValue({ data: false, error: null })

    const response = await POST(makeRequest({ code: 'WRONGCODE' }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toMatch(/not valid|already been used/)
    expect(listFactors).not.toHaveBeenCalled()
    expect(deleteFactor).not.toHaveBeenCalled()
  })

  it('scopes factor deletion to the authenticated caller, ignoring any id in the request body', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    rpc.mockResolvedValue({ data: true, error: null })
    listFactors.mockResolvedValue({ data: { totp: [{ id: 'factor-1' }] }, error: null })
    deleteFactor.mockResolvedValue({ error: null })

    const response = await POST(makeRequest({ code: 'GOODCODE', userId: 'attacker-controlled' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ recovered: true })
    expect(deleteFactor).toHaveBeenCalledWith({ id: 'factor-1', userId: 'user-1' })
  })

  it('never reports success to the client when a factor deletion fails', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    rpc.mockResolvedValue({ data: true, error: null })
    listFactors.mockResolvedValue({ data: { totp: [{ id: 'factor-1' }] }, error: null })
    deleteFactor.mockResolvedValue({ error: { message: 'Admin API rejected the request' } })

    const response = await POST(makeRequest({ code: 'GOODCODE' }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.recovered).toBeUndefined()
  })
})
