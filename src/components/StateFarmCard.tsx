import { Car, ExternalLink, FileText, Lock, ShieldAlert, ShieldCheck } from 'lucide-react'

type Props = {
  onOpenChecklist: () => void
  onOpenSafePark: () => void
  onOpenClaims: () => void
  claimsCount: number
}

export function StateFarmCard({ onOpenChecklist, onOpenSafePark, onOpenClaims, claimsCount }: Props) {
  return (
    <section className="statefarm-card" aria-label="State Farm Auto Insurance Co-Pilot">
      <div className="statefarm-top">
        <div className="statefarm-brand">
          <span className="statefarm-emblem">
            <ShieldAlert size={24} strokeWidth={2} />
          </span>
          <div>
            <h2>State Farm Claims & Risk Co-Pilot</h2>
            <p>Hands-free accident preparedness, evidence capture & everyday theft/hazard prevention for student drivers.</p>
          </div>
        </div>
      </div>
      <div className="statefarm-actions">
        <button type="button" className="statefarm-action-btn" onClick={onOpenChecklist}>
          <Car size={18} />
          <div>
            <strong>Accident Protocol</strong>
            <small>Step-by-step collision guidance</small>
          </div>
        </button>
        <button type="button" className="statefarm-action-btn" onClick={onOpenSafePark}>
          <Lock size={18} />
          <div>
            <strong>SafePark Risk Scanner</strong>
            <small>Campus theft & hazard reduction</small>
          </div>
        </button>
        <button type="button" className="statefarm-action-btn" onClick={onOpenClaims}>
          <FileText size={18} />
          <div>
            <strong>State Farm Claim Packets</strong>
            <small>{claimsCount > 0 ? `${claimsCount} saved claim packet${claimsCount > 1 ? 's' : ''}` : 'No active claims filed'}</small>
          </div>
        </button>
        <a
          href="https://reportloss.claims.statefarm.com/start-claim"
          target="_blank"
          rel="noopener noreferrer"
          className="statefarm-action-btn official-filer-btn"
          title="Open State Farm's official digital claim filer"
        >
          <ExternalLink size={18} />
          <div>
            <strong>Official Claim Filer</strong>
            <small>reportloss.claims.statefarm.com</small>
          </div>
        </a>
      </div>
      <div className="statefarm-hint">
        <ShieldCheck size={16} />
        <span>
          <strong>Hands-Free Glasses Trigger:</strong> Say <em>“I had an accident”</em> or <em>“State Farm claim”</em> into your glasses. Gemini automatically calms you, captures the other driver’s license plate & insurance via camera, and compiles an organized claim packet.
        </span>
      </div>
    </section>
  )
}
