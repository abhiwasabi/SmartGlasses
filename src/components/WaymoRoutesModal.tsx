import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Compass,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  Locate,
  LocateFixed,
  MapPin,
  Mic,
  Navigation,
  Navigation2,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react'
import {
  calculateCompassBearing,
  calculateDynamicRoute,
  calculateHaversineDistanceMeters,
  getDestinationCoordinates,
  POPULAR_CAMPUS_SPOTS,
  type Coordinates,
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

type UserLocation = Coordinates & {
  accuracy: number
  heading: number | null
}

export function WaymoRoutesModal() {
  const [destinationInput, setDestinationInput] = useState<string>('Green Library')
  const [searchQuery, setSearchQuery] = useState<string>('Green Library')
  const [userCoords, setUserCoords] = useState<UserLocation | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'active' | 'denied' | 'unsupported'>('idle')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [activeRoute, setActiveRoute] = useState<MobilityRoute>(() => calculateDynamicRoute('Green Library'))
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false)

  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

  const toggleLocationServices = () => {
    if (locationStatus === 'active') {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      setUserCoords(null)
      setLocationStatus('idle')
      setActiveRoute(calculateDynamicRoute(destinationInput, null))
      return
    }

    if (!('geolocation' in navigator)) {
      setLocationStatus('unsupported')
      return
    }

    setLocationStatus('locating')
    setLocationError(null)

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: UserLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
        }
        setUserCoords(coords)
        setLocationStatus('active')
        setActiveRoute(calculateDynamicRoute(destinationInput, coords))
      },
      (err) => {
        setLocationStatus('denied')
        setLocationError(err.message || 'Location permission was denied or unavailable.')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 2000 }
    )
  }

  const navigateToDestination = (destination: string) => {
    const trimmed = destination.trim()
    if (!trimmed) return
    setDestinationInput(trimmed)
    setSearchQuery(trimmed)
    const newRoute = calculateDynamicRoute(trimmed, userCoords)
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

  // Live Location Calculations
  const destCoords = getDestinationCoordinates(activeRoute.destination)
  let liveDistMeters = 0
  let liveWalkingMins = 0
  let bearing = { degrees: 0, cardinal: 'North' }
  let hasArrived = false

  if (userCoords && destCoords) {
    liveDistMeters = calculateHaversineDistanceMeters(
      userCoords.lat,
      userCoords.lng,
      destCoords.lat,
      destCoords.lng
    )
    liveWalkingMins = Math.max(1, Math.round(liveDistMeters / 80))
    bearing = calculateCompassBearing(
      userCoords.lat,
      userCoords.lng,
      destCoords.lat,
      destCoords.lng
    )
    hasArrived = liveDistMeters < 25
  }

  return (
    <div className="help-content waymo-navigation-modal">
      {/* Search Header: "Where would you like to go?" */}
      <section className="waymo-search-box">
        <div className="search-header-copy">
          <div className="search-badge">
            <Compass size={14} />
            <span>Campus Mobility & Live Location Guidance</span>
          </div>
          <h3>Where would you like to go?</h3>
          <p>Input any campus building, dorm, or landmark to instantly calculate the walking route, live distance from where you are, and step-by-step directions.</p>
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

      {/* Live Location Services & Real-Time Guidance Card */}
      <section className="live-location-guidance-card">
        {locationStatus === 'active' && userCoords ? (
          <div className="location-active-view">
            <div className="location-status-header">
              <div className="gps-live-tag">
                <span className="gps-live-dot" />
                <strong>Live Location Enabled</strong>
                <span className="gps-accuracy-badge">±{Math.round(userCoords.accuracy)}m accuracy</span>
              </div>
              <button
                type="button"
                className="location-toggle-btn active"
                onClick={toggleLocationServices}
                title="Turn off GPS tracking"
              >
                <LocateFixed size={13} />
                <span>Turn Off GPS</span>
              </button>
            </div>

            <div className="live-guidance-hero">
              <div className="compass-visual-wrap">
                <div
                  className="compass-needle"
                  style={{ transform: `rotate(${bearing.degrees}deg)` }}
                >
                  <Navigation2 size={24} className="compass-arrow" />
                </div>
                <span className="compass-degree-label">{bearing.degrees}°</span>
              </div>

              <div className="guidance-text-content">
                {hasArrived ? (
                  <div className="arrival-badge">
                    <h4>🎉 You have arrived!</h4>
                    <p>You are at {activeRoute.destination}.</p>
                  </div>
                ) : (
                  <>
                    <span className="guidance-eyebrow">LIVE BEARING & DIRECTION</span>
                    <h4>Head {bearing.cardinal} ({bearing.degrees}°)</h4>
                    <p>Continue walking towards <strong>{activeRoute.destination}</strong>.</p>
                  </>
                )}
                <div className="live-stats-row">
                  <span className="stat-pill highlight">
                    📍 {Math.round(liveDistMeters)} meters remaining
                  </span>
                  <span className="stat-pill">
                    🚶 ~{liveWalkingMins} min walk
                  </span>
                  <span className="stat-pill subtle">
                    GPS: {userCoords.lat.toFixed(4)}, {userCoords.lng.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="location-prompt-view">
            <div className="location-prompt-icon">
              <Locate size={20} />
            </div>
            <div className="location-prompt-info">
              <h4>Enable Location Services to Lead the Way</h4>
              <p>
                Allow device GPS to track your real-time walking distance, compass heading, and guide you directly from where you are standing.
              </p>
              {locationError && (
                <div className="location-error-msg">
                  <ShieldAlert size={13} />
                  <span>{locationError} (Please enable location access in browser settings)</span>
                </div>
              )}
            </div>
            <button
              type="button"
              className={`enable-location-btn ${locationStatus === 'locating' ? 'is-loading' : ''}`}
              onClick={toggleLocationServices}
              disabled={locationStatus === 'locating'}
            >
              <LocateFixed size={15} />
              <span>{locationStatus === 'locating' ? 'Acquiring GPS…' : 'Use Current Location'}</span>
            </button>
          </div>
        )}
      </section>

      {/* Route Summary Banner */}
      <section className="waymo-route-banner">
        <div className="banner-title-row">
          <div>
            <span className="route-origin-label">START: {activeRoute.origin}</span>
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
          <ExternalLink size={13} /> Open Live Walking Navigation in Google Maps
        </a>
      </div>

      {/* Mobility Principles Note */}
      <div className="help-local">
        <Route size={17} />
        <p>
          <strong>Public Mobility & Location Services:</strong> Clarity utilizes HTML5 GPS Geolocation and Google Maps walking routes to calculate real-time distance, bearing, and step-by-step pedestrian navigation.
        </p>
      </div>
    </div>
  )
}
