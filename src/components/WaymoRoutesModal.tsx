import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Compass,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  MapPin,
  Mic,
  Navigation,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react'
import {
  calculateDynamicRoute,
  POPULAR_CAMPUS_SPOTS,
  type MobilityRoute,
  type RouteStep,
} from '../lib/waymoMobility'

function StepIcon({ type }: { type: RouteStep['turnType'] }) {
  switch (type) {
    case 'left':
      return <CornerUpLeft size={16} />
    case 'right':
      return <CornerUpRight size={16} />
    case 'slight-left':
      return <ArrowUpLeft size={16} />
    case 'slight-right':
      return <ArrowUpRight size={16} />
    case 'arrive':
      return <MapPin size={16} className="text-emerald-500" />
    case 'straight':
    default:
      return <ArrowUp size={16} />
  }
}

export function WaymoRoutesModal() {
  const [destinationInput, setDestinationInput] = useState<string>('Green Library')
  const [searchQuery, setSearchQuery] = useState<string>('Green Library')
  const [activeRoute, setActiveRoute] = useState<MobilityRoute>(() => calculateDynamicRoute('Green Library'))
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false)

  const navigateToDestination = (destination: string) => {
    const trimmed = destination.trim()
    if (!trimmed) return
    setDestinationInput(trimmed)
    setSearchQuery(trimmed)
    const newRoute = calculateDynamicRoute(trimmed)
    setActiveRoute(newRoute)
  }

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    navigateToDestination(searchQuery)
  }

  const handleVoiceSearch = () => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert('Voice dictation is not supported in this browser. Please type your destination.')
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = 'en-US'
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => {
        setIsListeningVoice(true)
      }

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript
        if (transcript) {
          setSearchQuery(transcript)
          navigateToDestination(transcript)
        }
        setIsListeningVoice(false)
      }

      recognition.onerror = () => {
        setIsListeningVoice(false)
      }

      recognition.onend = () => {
        setIsListeningVoice(false)
      }

      recognition.start()
    } catch {
      setIsListeningVoice(false)
    }
  }

  return (
    <div className="help-content waymo-navigation-modal">
      {/* Search Header: "Where would you like to go?" */}
      <section className="waymo-search-box">
        <div className="search-header-copy">
          <div className="search-badge">
            <Compass size={14} />
            <span>Campus Mobility & Walking Directions</span>
          </div>
          <h3>Where would you like to go?</h3>
          <p>Input any campus building, dorm, or landmark to instantly calculate the walking route, elevation profile, crosswalks, and directions.</p>
        </div>

        <form onSubmit={handleSearchSubmit} className="destination-search-form">
          <div className="input-field-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="destination-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="e.g. Green Library, Frost Art Museum, Engineering Center..."
              aria-label="Enter destination"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-input-btn"
                onClick={() => setSearchQuery('')}
                title="Clear input"
              >
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              className={`mic-search-btn ${isListeningVoice ? 'is-listening' : ''}`}
              onClick={handleVoiceSearch}
              title={isListeningVoice ? 'Listening…' : 'Speak destination'}
            >
              <Mic size={15} />
              {isListeningVoice && <span className="mic-pulse" />}
            </button>
          </div>
          <button type="submit" className="search-submit-btn">
            <Navigation size={14} />
            <span>Get Route</span>
          </button>
        </form>

        {/* Quick Destination Chips */}
        <div className="destination-chips-row">
          <span className="chips-label">Popular:</span>
          <div className="chips-scroll">
            {POPULAR_CAMPUS_SPOTS.map(spot => {
              const isSelected = destinationInput.toLowerCase().includes(spot.shortLabel.toLowerCase())
              return (
                <button
                  key={spot.name}
                  type="button"
                  className={`destination-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => navigateToDestination(spot.shortLabel)}
                >
                  <MapPin size={11} />
                  <span>{spot.shortLabel}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Route Summary Banner */}
      <section className="waymo-route-banner">
        <div className="banner-title-row">
          <div>
            <span className="route-origin-label">START: Current Location (Campus Core)</span>
            <h3>{activeRoute.destination}</h3>
          </div>
          <span className="route-tag highlight">🚶 {activeRoute.walkingTime} · {activeRoute.distance}</span>
        </div>
        <div className="route-meta">
          <span className="route-tag">🛴 Bike/Scooter: {activeRoute.bikeTime}</span>
          <span className="route-tag">📈 {activeRoute.elevationChange}</span>
          <span className="route-tag">🚦 {activeRoute.crosswalkCount} Crosswalks</span>
          <span className="route-tag">🌙 {activeRoute.nightSafety}</span>
        </div>
      </section>

      {/* Step-by-Step Directions List */}
      <section className="waymo-steps-list">
        <h4 className="steps-list-heading">Step-by-Step Directions</h4>
        {activeRoute.steps.map((step) => {
          return (
            <div
              key={step.stepNumber}
              className="turn-step-card"
            >
              <div className="step-left">
                <span className={`turn-icon-wrap ${step.turnType === 'arrive' ? 'arrive' : ''}`}>
                  <StepIcon type={step.turnType} />
                </span>
                <span className="step-number-label">0{step.stepNumber}</span>
              </div>
              <div className="step-middle">
                <p className="step-instruction">{step.instruction}</p>
                <div className="step-submeta">
                  <span className="step-distance-badge">{step.distance}</span>
                  {step.safetyAlert && (
                    <span className="step-alert-badge">
                      <ShieldAlert size={11} />
                      {step.safetyAlert}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {/* Route Safety Highlights */}
      {activeRoute.routeHighlights.length > 0 && (
        <section className="route-safety-section">
          <h4 className="steps-list-heading">Safety & Route Notes</h4>
          <ul className="route-highlights-list">
            {activeRoute.routeHighlights.map((highlight, index) => (
              <li key={index} className="route-highlight-item">
                <ShieldCheck size={14} className="highlight-icon" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Route Action Links */}
      <div className="waymo-modal-footer">
        <a
          href={activeRoute.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="button-waymo-maps"
        >
          <ExternalLink size={13} /> Open Route in Google Maps
        </a>
      </div>

      {/* Mobility Principles Note */}
      <div className="help-local">
        <Route size={17} />
        <p>
          <strong>Public Mobility:</strong> Utilizing open Google Maps routing, protected pedestrian crosswalks, and elevation data to ensure safe, accessible, and heads-up campus navigation.
        </p>
      </div>
    </div>
  )
}
