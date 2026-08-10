import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUser = vi.fn()
const getSession = vi.fn()
const getAuthenticatorAssuranceLevel = vi.fn()
const signOut = vi.fn()
const deleteUser = vi.fn()
const adminSignOut = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        getUser,
        getSession,
        mfa: { getAuthenticatorAssuranceLevel },
        signOut,
      },
    }),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { deleteUser, signOut: adminSignOut } },
  }),
}))

import { DELETE } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
  getSession.mockResolvedValue({ data: { session: { access_token: 'token-1' } } })
  getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal1' } })
  signOut.mockResolvedValue({ error: null })
  deleteUser.mockResolvedValue({ error: null })
  adminSignOut.mockResolvedValue({ error: null })
})

describe('DELETE /api/account/delete', () => {
  it('rejects an unauthenticated request without touching the admin API', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    const response = await DELETE()

    expect(response.status).toBe(401)
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('passes the live session access token to the AAL check, not the cached no-arg snapshot', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    await DELETE()

    expect(getAuthenticatorAssuranceLevel).toHaveBeenCalledWith('token-1')
  })

  it('requires a live aal2 challenge when a factor is enrolled but not yet verified this session', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' } })

    const response = await DELETE()

    expect(response.status).toBe(403)
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('refuses to delete when the service role key is not configured', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    const response = await DELETE()

    expect(response.status).toBe(500)
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('never reports success to the client when the admin deleteUser call fails', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    deleteUser.mockResolvedValue({ error: { message: 'Admin API rejected the request' } })

    const response = await DELETE()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.deleted).toBeUndefined()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('deletes only the authenticated caller and signs out globally on success', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const response = await DELETE()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ deleted: true })
    expect(deleteUser).toHaveBeenCalledWith('user-1')
    expect(signOut).toHaveBeenCalledWith({ scope: 'global' })
  })

  it('revokes all refresh tokens via the admin API before deleting the user', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const callOrder: string[] = []
    adminSignOut.mockImplementation(async () => { callOrder.push('signOut'); return { error: null } })
    deleteUser.mockImplementation(async () => { callOrder.push('deleteUser'); return { error: null } })

    await DELETE()

    expect(adminSignOut).toHaveBeenCalledWith('user-1', 'global')
    expect(callOrder).toEqual(['signOut', 'deleteUser'])
  })
})
