import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

const receiver = 'http://127.0.0.1:8765'

export function AssistantGoal() {
  const [context, setContext] = useState('walking')
  const [goal, setGoal] = useState('')
  const [status, setStatus] = useState('Checking local assistant…')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${receiver}/health`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(); setStatus('Local assistant ready') })
      .catch(() => { if (!controller.signal.aborted) setStatus('Start the local assistant to set a goal') })
    return () => controller.abort()
  }, [])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch(`${receiver}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: context.trim(), goal: goal.trim() }),
      })
      if (!response.ok) throw new Error(`Assistant rejected the goal (${response.status}).`)
      setStatus(goal.trim() ? `Goal active: ${goal.trim()}` : 'Goal cleared; safety alerts remain active')
    } catch (error) {
      setStatus(error instanceof TypeError ? 'Local assistant unavailable at 127.0.0.1:8765' : (error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return <section className="panel assistant-goal" aria-labelledby="assistant-goal-heading">
    <div className="panel-heading"><div className="panel-title"><div><h2 id="assistant-goal-heading">What are you trying to do?</h2><p>Give the assistant a goal so it can judge what the camera notices.</p></div></div></div>
    <form onSubmit={save} className="assistant-goal-form">
      <label>Current activity<select value={context} onChange={event => setContext(event.target.value)}><option value="walking">Walking</option><option value="running">Running</option><option value="driving">Driving</option><option value="other">Other</option></select></label>
      <label>Your goal<input value={goal} onChange={event => setGoal(event.target.value)} maxLength={200} placeholder="Find a trash bin, locate a door, avoid obstacles…" /></label>
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Set goal'}</button>
    </form>
    <p className="assistant-goal-status" role="status">{status}</p>
  </section>
}
