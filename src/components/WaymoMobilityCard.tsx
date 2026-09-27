import { Compass, MapPin, Navigation, Route, ShieldCheck } from 'lucide-react'

type Props = {
  onOpenPickups: () => void
  onOpenShield: () => void
  onOpenRoutes: () => void
  onOpenMobilityNotes: () => void
  mobilityCount: number
}

export function WaymoMobilityCard({ onOpenPickups, onOpenShield, onOpenRoutes, onOpenMobilityNotes, mobilityCount }: Props) {
  return (
    <section className="waymo-card" aria-label="Waymo Mobility & Safe Transit Co-Pilot">
      <div className="waymo-top">
        <div className="waymo-brand">
          <span className="waymo-emblem">
            <Compass size={24} strokeWidth={2} />
          </span>
          <div>
            <div className="waymo-badge-row">
              <span className="waymo-tag">WAYMO MOBILITY CHALLENGE</span>
              <span className="waymo-tag-sub">SHELLHACKS 2026</span>
            </div>
            <h2>Autonomous Transit & Safe Route Co-Pilot</h2>
            <p>Autonomous-grade pedestrian perception, designated safe curb pickup bays & Google Maps route intelligence.</p>
          </div>
        </div>
      </div>
      <div className="waymo-actions">
        <button type="button" className="waymo-action-btn" onClick={onOpenPickups}>
          <MapPin size={18} />
          <div>
            <strong>Safe Pickup Bays</strong>
            <small>Designated curb zones & ADA access</small>
          </div>
        </button>
        <button type="button" className="waymo-action-btn" onClick={onOpenShield}>
          <ShieldCheck size={18} />
          <div>
            <strong>Pedestrian Vision Shield</strong>
            <small>Crosswalk & spatial awareness</small>
          </div>
        </button>
        <button type="button" className="waymo-action-btn" onClick={onOpenRoutes}>
          <Route size={18} />
          <div>
            <strong>Campus Routes & Elevation</strong>
            <small>Walking ETAs & lit night corridors</small>
          </div>
        </button>
        <button type="button" className="waymo-action-btn" onClick={onOpenMobilityNotes}>
          <Navigation size={18} />
          <div>
            <strong>Saved Mobility Packets</strong>
            <small>{mobilityCount > 0 ? `${mobilityCount} saved route packet${mobilityCount > 1 ? 's' : ''}` : 'No active routes saved'}</small>
          </div>
        </button>
      </div>
      <div className="waymo-hint">
        <ShieldCheck size={16} />
        <span>
          <strong>Hands-Free Waymo Voice Trigger:</strong> Ask your glasses: <em>“Find safe Waymo pickup near Green Library”</em> or <em>“Safe walking route to Engineering Center.”</em> Gemini retrieves safe pickup bays, elevation grades, and Google Maps directions.
        </span>
      </div>
    </section>
  )
}
