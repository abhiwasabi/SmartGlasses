import test from 'node:test'
import assert from 'node:assert/strict'
import { AccountAuthorizationUnavailable, createAccountAuthorizer } from '../src/server/auth.ts'

const settings = { supabaseUrl: 'https://project.supabase.co/', supabasePublishableKey: 'public-key' }

test('account authorization verifies bearer sessions with Supabase and caches valid tokens', async () => {
  let calls = 0
  const authorize = createAccountAuthorizer(settings, async (url, options) => {
    calls++
    assert.equal(url, 'https://project.supabase.co/auth/v1/user')
    assert.equal(options.headers.apikey, 'public-key')
    assert.equal(options.headers.Authorization, 'Bearer signed-session')
    return Response.json({ id: 'user-id' })
  })
  const request = { headers: { authorization: 'Bearer signed-session' } }
  assert.equal(await authorize(request), true)
  assert.equal(await authorize(request), true)
  assert.equal(calls, 1)
})

test('account authorization rejects absent and invalid sessions', async () => {
  const authorize = createAccountAuthorizer(settings, async () => new Response('{}', { status: 401 }))
  assert.equal(await authorize({ headers: {} }), false)
  assert.equal(await authorize({ headers: { authorization: 'Basic credentials' } }), false)
  assert.equal(await authorize({ headers: { authorization: 'Bearer expired-session' } }), false)
})

test('account verification outages are not treated as expired sessions or cached', async () => {
  for (const failure of [
    async () => { throw new Error('Network unavailable') },
    async () => new Response('{}', { status: 503 }),
    async () => new Response('{}', { status: 429 }),
  ]) {
    let calls = 0
    const authorize = createAccountAuthorizer(settings, async (...args) => {
      calls++
      return calls === 1 ? failure(...args) : Response.json({ id: 'user-id' })
    })
    const request = { headers: { authorization: 'Bearer valid-session' } }
    await assert.rejects(authorize(request), AccountAuthorizationUnavailable)
    assert.equal(await authorize(request), true)
    assert.equal(calls, 2)
  }
})
