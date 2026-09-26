import { useState } from 'react'
import type { FormEvent } from 'react'
import { Glasses, LoaderCircle, LockKeyhole } from 'lucide-react'
import { supabase, supabaseConfigured } from '../lib/supabase'

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    setSubmitting(true); setError(''); setMessage('')
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    setSubmitting(false)
    if (result.error) { setError(result.error.message); return }
    if (mode === 'signup' && !result.data.session) setMessage('Check your email to confirm your account, then sign in.')
  }

  return <main className="auth-page">
    <section className="auth-card">
      <div className="auth-brand"><span><Glasses size={30} /></span><strong>clarity.</strong></div>
      {!supabaseConfigured ? <>
        <div className="auth-icon"><LockKeyhole size={24} /></div>
        <h1>Connect your account service</h1>
        <p>Add your Supabase project URL and publishable key to <code>.env.local</code>, then restart the dashboard.</p>
        <div className="auth-config"><code>VITE_SUPABASE_URL=</code><code>VITE_SUPABASE_PUBLISHABLE_KEY=</code></div>
      </> : <>
        <div className="auth-icon"><LockKeyhole size={24} /></div>
        <h1>{mode === 'signin' ? 'Welcome back' : 'Create your workspace'}</h1>
        <p>{mode === 'signin' ? 'Sign in to see your private notes and memories.' : 'Every note and memory will belong only to this account.'}</p>
        <form className="auth-form" onSubmit={submit}>
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-message" role="status">{message}</p>}
          <button className="button button-primary" disabled={submitting}>{submitting && <LoaderCircle className="spin" size={15} />}{mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>
        <button className="text-button auth-switch" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }}>{mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button>
      </>}
    </section>
  </main>
}
