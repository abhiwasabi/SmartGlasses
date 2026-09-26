import { createClient } from '@supabase/supabase-js'

const environment = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
const url = environment?.VITE_SUPABASE_URL?.trim()
const publishableKey = environment?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const supabaseConfigured = Boolean(url && publishableKey)
export const supabase = url && publishableKey ? createClient(url, publishableKey) : null
