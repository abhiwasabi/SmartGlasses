import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  const syncSession = useCallback(async () => {
    if (!supabase) return
    try {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        if (data.session.expires_at && data.session.expires_at * 1000 < Date.now() + 120_000) {
          const { data: refreshed } = await supabase.auth.refreshSession()
          if (refreshed.session) {
            setSession(refreshed.session)
            return
          }
        }
        setSession(data.session)
      } else {
        setSession(null)
      }
    } catch {
      // Network or Supabase error
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    let mounted = true

    void syncSession().finally(() => {
      if (mounted) setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) { setSession(nextSession); setLoading(false) }
    })

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncSession()
      }
    }
    window.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)

    const interval = setInterval(() => {
      void syncSession()
    }, 5 * 60_000)

    return () => {
      mounted = false
      data.subscription.unsubscribe()
      window.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
      clearInterval(interval)
    }
  }, [syncSession])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  return { session, loading, signOut, syncSession }
}

