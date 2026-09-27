import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Car,
  Compass,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  MapPin,
  Mic,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react'
import {
  calculateDynamicRoute,
  getNearbyWaymos,
  POPULAR_CAMPUS_SPOTS,
  type MobilityRoute,
  type RouteStep,
  type WaymoVehicle,
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
  const [nearbyVehicles, setNearbyVehicles] = useState<WaymoVehicle[]>(() => getNearbyWaymos('Green Library'))
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false)
  const [speechSupported, setSpeechSupported] = useState<boolean>(true)

  const isPlayingRef = useRef(isPlaying)
  isPlayingRef.current = isPlaying

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setSpeechSupported(false)
    }
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const stopAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setIsPlaying(false)
  }

  const navigateToDestination = (destination: string) => {
    stopAudio()
    const trimmed = destination.trim()
    if (!trimmed) return
    setDestinationInput(trimmed)
    setSearchQuery(trimmed)
    const newRoute = calculateDynamicRoute(trimmed)
    setActiveRoute(newRoute)
    setNearbyVehicles(getNearbyWaymos(trimmed))
    setActiveStepIndex(0)
  }

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    navigateToDestination(searchQuery)
  }

  const handleVoiceSearch = () => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Please type your destination.')
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

  const speakStep = (route: MobilityRoute, stepIdx: number, autoAdvance = false) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    const step = route.steps[stepIdx]
    if (!step) {
      setIsPlaying(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(step.audioText)
    utterance.rate = 0.98
    utterance.pitch = 1.0

    const voices = window.speechSynthesis.getVoices()
    const preferredVoice = voices.find(
      v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Siri') || v.name.includes('Samantha'))
    )
    if (preferredVoice) utterance.voice = preferredVoice

    utterance.onstart = () => {
      setIsPlaying(true)
    }

    utterance.onend = () => {
      if (autoAdvance && isPlayingRef.current) {
        if (stepIdx + 1 < route.steps.length) {
          setActiveStepIndex(stepIdx + 1)
          setTimeout(() => {
            if (isPlayingRef.current) {
              speakStep(route, stepIdx + 1, true)
            }
          }, 1200)
        } else {
          setIsPlaying(false)
        }
      } else {
        setIsPlaying(false)
      }
    }

    utterance.onerror = () => {
      setIsPlaying(false)
    }

    window.speechSynthesis.speak(utterance)
  }

  const handleStartAll = () => {
    if (isPlaying) {
      stopAudio()
    } else {
      setIsPlaying(true)
      speakStep(activeRoute, activeStepIndex, true)
    }
  }

  const handlePlaySingle = (idx: number) => {
    stopAudio()
    setActiveStepIndex(idx)
    setIsPlaying(true)
    speakStep(activeRoute, idx, false)
  }

  const handleNext = () => {
    if (activeStepIndex + 1 < activeRoute.steps.length) {
      const nextIdx = activeStepIndex + 1
      setActiveStepIndex(nextIdx)
      if (isPlaying) {
        speakStep(activeRoute, nextIdx, true)
      }
    }
  }

  const handlePrev = () => {
    if (activeStepIndex > 0) {
      const prevIdx = activeStepIndex - 1
      setActiveStepIndex(prevIdx)
      if (isPlaying) {
        speakStep(activeRoute, prevIdx, true)
      }
    }
  }

  const handleRepeat = () => {
    speakStep(activeRoute, activeStepIndex, isPlaying)
  }

  const currentStep = activeRoute.steps[activeStepIndex] || activeRoute.steps[0]

  return (
    <div className="help-content waymo-navigation-modal">
      {/* Search Header: "Where would you like to go?" */}
      <section className="waymo-search-box">
        <div className="search-header-copy">
          <div className="search-badge">
            <Compass size={14} />
            <span>Autonomous Waymo Mobility & Campus Routing</span>
          </div>
          <h3>Where would you like to go?</h3>
          <p>Input any campus building, dorm, or landmark for instant safe routing, spoken audio guidance, and nearby Waymos.</p>
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
            <span>Get Safe Route</span>
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

      {/* Waymos Active Nearby Section */}
      <section className="waymo-fleet-section" aria-label="Waymos nearby">
        <div className="fleet-header">
          <div className="fleet-title">
            <span className="fleet-emblem">
              <Car size={16} />
            </span>
            <div>
              <h4>Waymos Active Nearby</h4>
              <small>Autonomous vehicles operating on campus loops & nearby curbs</small>
            </div>
          </div>
          <span className="fleet-count-badge">
            <Sparkles size={12} /> {nearbyVehicles.length} Vehicles in Area
          </span>
        </div>

        <div className="fleet-cards-grid">
          {nearbyVehicles.map(vehicle => (
            <div key={vehicle.id} className="waymo-vehicle-card">
              <div className="vehicle-top-row">
                <div className="vehicle-identity">
                  <strong>{vehicle.vehicleModel}</strong>
                  <span className="license-plate">{vehicle.licensePlate}</span>
                </div>
                <span className={`vehicle-status-badge status-${vehicle.status.toLowerCase().replace(/\s+/g, '-')}`}>
                  {vehicle.status} · {vehicle.etaMinutes}m ETA
                </span>
              </div>
              <div className="vehicle-beacon-row">
                <div className="beacon-tag">
                  <span className="beacon-led" style={{ backgroundColor: vehicle.beaconColor }} />
                  <span>Roof Beacon: <strong>{vehicle.beaconInitial}</strong></span>
                </div>
                <span className="vehicle-bay">Bay: {vehicle.nearestBay}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="fleet-safety-tip">
          <ShieldCheck size={14} />
          <span><strong>Autonomous Boarding Protocol:</strong> Remain on sidewalk behind curb until vehicle completely stops. Verify rooftop beacon monogram before opening doors.</span>
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

      {/* Spoken Turn-by-Turn Audio Navigation Player */}
      <section className="waymo-audio-player">
        <div className="player-header">
          <div className="player-indicator">
            <span className={`audio-pulse-dot ${isPlaying ? 'active' : ''}`} />
            <div>
              <strong>Spoken Turn-by-Turn Guidance</strong>
              <small>
                {isPlaying
                  ? `Speaking Turn ${activeStepIndex + 1} of ${activeRoute.steps.length} aloud through speaker…`
                  : speechSupported
                  ? `Plays turn directions aloud through your device/phone speaker`
                  : `Speech audio unavailable in this browser`}
              </small>
            </div>
          </div>
          <div className="player-controls">
            <button
              type="button"
              className="player-btn control-btn"
              onClick={handlePrev}
              disabled={activeStepIndex === 0}
              title="Previous Turn"
            >
              <SkipBack size={14} />
            </button>
            <button
              type="button"
              className={`player-btn play-btn ${isPlaying ? 'is-playing' : ''}`}
              onClick={handleStartAll}
              title={isPlaying ? 'Pause Voice Guidance' : 'Play All Turns Aloud'}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}
              <span>{isPlaying ? 'Pause' : 'Start Audio Guide'}</span>
            </button>
            <button
              type="button"
              className="player-btn control-btn"
              onClick={handleNext}
              disabled={activeStepIndex >= activeRoute.steps.length - 1}
              title="Next Turn"
            >
              <SkipForward size={14} />
            </button>
            <button
              type="button"
              className="player-btn control-btn"
              onClick={handleRepeat}
              title="Repeat Current Turn"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Current Active Turn Spotlight Card */}
        <div className="active-turn-spotlight">
          <div className="spotlight-step-badge">
            <span className="step-num">Step {currentStep.stepNumber} of {activeRoute.steps.length}</span>
            <span className="step-dist">{currentStep.distance}</span>
          </div>
          <div className="spotlight-body">
            <span className="spotlight-icon">
              <StepIcon type={currentStep.turnType} />
            </span>
            <div className="spotlight-text">
              <p className="instruction-text">{currentStep.instruction}</p>
              {currentStep.safetyAlert && (
                <div className="safety-alert-pill">
                  <ShieldAlert size={13} />
                  <span>{currentStep.safetyAlert}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Step-by-Step Turn List */}
      <section className="waymo-steps-list">
        <h4 className="steps-list-heading">Step-by-Step Walking Turns</h4>
        {activeRoute.steps.map((step, idx) => {
          const isActive = idx === activeStepIndex
          return (
            <div
              key={step.stepNumber}
              className={`turn-step-card ${isActive ? 'is-active-step' : ''}`}
              onClick={() => handlePlaySingle(idx)}
              role="button"
              tabIndex={0}
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
              <button
                type="button"
                className="step-speaker-btn"
                title="Speak this turn aloud"
                onClick={e => {
                  e.stopPropagation()
                  handlePlaySingle(idx)
                }}
              >
                {isActive && isPlaying ? <Volume2 size={15} className="speaking-anim" /> : <Volume2 size={15} />}
              </button>
            </div>
          )
        })}
      </section>

      {/* Route Action Links */}
      <div className="waymo-modal-footer">
        <a
          href={activeRoute.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="button-waymo-maps"
        >
          <ExternalLink size={13} /> Open Dynamic Route in Google Maps
        </a>
      </div>

      {/* Waymo Mobility Principles Note */}
      <div className="help-local">
        <Route size={17} />
        <p>
          <strong>Public Mobility & Autonomous Synergy:</strong> By combining real-time pedestrian crosswalk safety, ADA elevation profiles, and live autonomous Waymo loading bays, Clarity enables seamless, heads-up navigation without phone distraction.
        </p>
      </div>
    </div>
  )
}
