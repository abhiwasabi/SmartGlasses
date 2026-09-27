import { createClient } from '@supabase/supabase-js'

const environment = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
const url = environment?.VITE_SUPABASE_URL?.trim()
const publishableKey = environment?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const supabaseConfigured = Boolean(url && publishableKey)
export const supabase = url && publishableKey ? createClient(url, publishableKey) : null

export async function getValidAccessToken(forceRefresh = false): Promise<string | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getSession()
    const session = data.session
    if (!session) return null

    // If token is expiring within 2 minutes or forced, refresh it automatically
    if (forceRefresh || (session.expires_at && session.expires_at * 1000 < Date.now() + 120_000)) {
      const { data: refreshed, error } = await supabase.auth.refreshSession()
      if (!error && refreshed.session?.access_token) {
        return refreshed.session.access_token
      }
    }
    return session.access_token
  } catch {
    return null
  }
}
