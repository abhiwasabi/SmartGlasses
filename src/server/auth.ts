import { createHash } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

export type AccountAuthSettings = { supabaseUrl?: string; supabasePublishableKey?: string }
export type AuthorizeRequest = (request: Pick<IncomingMessage, 'headers'>) => Promise<boolean>

export class AccountAuthorizationUnavailable extends Error {
  constructor() {
    super('Account verification is temporarily unavailable. Try again in a moment.')
  }
}

export function createAccountAuthorizer(settings: AccountAuthSettings, send: typeof fetch = fetch): AuthorizeRequest {
  const verified = new Map<string, number>()
  return async request => {
    const header = request.headers.authorization
    const match = typeof header === 'string' ? header.match(/^Bearer\s+(.+)$/i) : null
    const token = match?.[1]?.trim()
    if (!token || !settings.supabaseUrl || !settings.supabasePublishableKey) return false
    const fingerprint = createHash('sha256').update(token).digest('hex')
    if ((verified.get(fingerprint) ?? 0) > Date.now()) return true
    try {
      const response = await send(`${settings.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
        headers: { apikey: settings.supabasePublishableKey, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5_000),
      })
      if (response.status === 401 || response.status === 403) return false
      if (!response.ok) throw new AccountAuthorizationUnavailable()
      const user = await response.json() as { id?: unknown }
      if (typeof user.id !== 'string' || !user.id) return false
      // Avoid adding an auth network round trip to every ElevenLabs sentence.
      verified.set(fingerprint, Date.now() + 5 * 60_000)
      return true
    } catch {
      // A timeout or provider outage does not mean the user's session expired.
      throw new AccountAuthorizationUnavailable()
    }
  }
}
