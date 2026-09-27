import { useState, useEffect, useRef } from 'react'
import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Route,
  ShieldAlert,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react'
import { MOBILITY_ROUTES, type MobilityRoute, type RouteStep } from '../lib/waymoMobility'

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
  const [selectedRouteId, setSelectedRouteId] = useState<string>(MOBILITY_ROUTES[0].id)
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [speechSupported, setSpeechSupported] = useState<boolean>(true)
  const isPlayingRef = useRef(isPlaying)
  isPlayingRef.current = isPlaying

  const selectedRoute = MOBILITY_ROUTES.find(r => r.id === selectedRouteId) || MOBILITY_ROUTES[0]
  const currentStep = selectedRoute.steps[activeStepIndex] || selectedRoute.steps[0]

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

    // Pick best English voice if available
    const voices = window.speechSynthesis.getVoices()
    const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Siri') || v.name.includes('Samantha')))
    if (preferredVoice) utterance.voice = preferredVoice

    utterance.onstart = () => {
      setIsPlaying(true)
    }

    utterance.onend = () => {
      if (autoAdvance && isPlayingRef.current) {
        if (stepIdx + 1 < route.steps.length) {
          setActiveStepIndex(stepIdx + 1)
          // Short pause between turns
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
      speakStep(selectedRoute, activeStepIndex, true)
    }
  }

  const handlePlaySingle = (idx: number) => {
    stopAudio()
    setActiveStepIndex(idx)
    setIsPlaying(true)
    speakStep(selectedRoute, idx, false)
  }

  const handleNext = () => {
    if (activeStepIndex + 1 < selectedRoute.steps.length) {
      const nextIdx = activeStepIndex + 1
      setActiveStepIndex(nextIdx)
      if (isPlaying) {
        speakStep(selectedRoute, nextIdx, true)
      }
    }
  }

  const handlePrev = () => {
    if (activeStepIndex > 0) {
      const prevIdx = activeStepIndex - 1
      setActiveStepIndex(prevIdx)
      if (isPlaying) {
        speakStep(selectedRoute, prevIdx, true)
      }
    }
  }

  const handleRepeat = () => {
    speakStep(selectedRoute, activeStepIndex, isPlaying)
  }

  const handleRouteChange = (routeId: string) => {
    stopAudio()
    setSelectedRouteId(routeId)
    setActiveStepIndex(0)
  }

  return (
    <div className="help-content waymo-navigation-modal">
      {/* Route Switcher Tabs */}
      <div className="waymo-route-tabs" role="tablist" aria-label="Campus routes">
        {MOBILITY_ROUTES.map(route => (
          <button
            key={route.id}
            type="button"
            role="tab"
            aria-selected={route.id === selectedRoute.id}
            className={`waymo-tab-btn ${route.id === selectedRoute.id ? 'active' : ''}`}
            onClick={() => handleRouteChange(route.id)}
          >
            <Route size={14} />
            <span>{route.name}</span>
          </button>
        ))}
      </div>

      {/* Selected Route Summary Banner */}
      <div className="waymo-route-banner">
        <div className="banner-title-row">
          <h3>{selectedRoute.name}</h3>
          <span className="route-tag highlight">🚶 {selectedRoute.walkingTime} · {selectedRoute.distance}</span>
        </div>
        <div className="route-meta">
          <span className="route-tag">🛴 Bike/Scooter: {selectedRoute.bikeTime}</span>
          <span className="route-tag">📈 {selectedRoute.elevationChange}</span>
          <span className="route-tag">🚦 {selectedRoute.crosswalkCount} Crosswalks</span>
          <span className="route-tag">🌙 {selectedRoute.nightSafety}</span>
        </div>
      </div>

      {/* Spoken Turn-by-Turn Audio Navigation Player */}
      <div className="waymo-audio-player">
        <div className="player-header">
          <div className="player-indicator">
            <span className={`audio-pulse-dot ${isPlaying ? 'active' : ''}`} />
            <div>
              <strong>Spoken Turn-by-Turn Guidance</strong>
              <small>
                {isPlaying
                  ? `Speaking Turn ${activeStepIndex + 1} of ${selectedRoute.steps.length} aloud…`
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
              disabled={activeStepIndex >= selectedRoute.steps.length - 1}
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
            <span className="step-num">Step {currentStep.stepNumber} of {selectedRoute.steps.length}</span>
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
      </div>

      {/* Step-by-Step Turn List */}
      <div className="waymo-steps-list">
        <h4 className="steps-list-heading">Step-by-Step Walking Turns</h4>
        {selectedRoute.steps.map((step, idx) => {
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
      </div>

      {/* Route Action Links */}
      <div className="waymo-modal-footer">
        <a
          href={selectedRoute.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="button-waymo-maps"
        >
          <ExternalLink size={13} /> Open Full Route in Google Maps
        </a>
      </div>

      {/* Waymo Mobility Principles Note */}
      <div className="help-local">
        <Route size={17} />
        <p>
          <strong>Hands-Free Auditory Navigation:</strong> Smart glasses deliver heads-up, auditory turn-by-turn guidance so pedestrians can keep their eyes on crosswalks and surroundings instead of staring down at a screen.
        </p>
      </div>
    </div>
  )
}
