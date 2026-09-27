import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeftRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Compass,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  Footprints,
  Locate,
  LocateFixed,
  MapPin,
  Mic,
  Navigation,
  Navigation2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
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
  calculateRelativeTurn,
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

// Campus Core reference coordinate (Graham Center)
const CAMPUS_CORE_COORDS: UserLocation = {
  lat: 25.7562,
  lng: -80.3746,
  accuracy: 4,
  heading: null,
}

export function WaymoRoutesModal() {
  const [destinationInput, setDestinationInput] = useState<string>('Green Library')
  const [searchQuery, setSearchQuery] = useState<string>('Green Library')
  const [userCoords, setUserCoords] = useState<UserLocation | null>(null)
  const [useCampusDemoOrigin, setUseCampusDemoOrigin] = useState<boolean>(false)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'active' | 'denied' | 'unsupported'>('idle')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [deviceHeading, setDeviceHeading] = useState<number>(0)
  const [hasCompassSensor, setHasCompassSensor] = useState<boolean>(false)
  const [activeRoute, setActiveRoute] = useState<MobilityRoute>(() => calculateDynamicRoute('Green Library'))
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false)

  // Motion & Walking State
  const [stepsTaken, setStepsTaken] = useState<number>(0)
  const [manualMetersWalked, setManualMetersWalked] = useState<number>(0)
  const [isAutoWalking, setIsAutoWalking] = useState<boolean>(false)
  const [gpsPingCount, setGpsPingCount] = useState<number>(0)

  const watchIdRef = useRef<number | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastStepTimeRef = useRef<number>(0)

  // 1. Listen to mobile device compass orientation (gyro / magnetometer)
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const iosHeading = (e as any).webkitCompassHeading
      let heading: number | null = null

      if (typeof iosHeading === 'number' && !isNaN(iosHeading)) {
        // iOS True North Heading
        heading = Math.round(iosHeading)
      } else if (e.alpha !== null && !isNaN(e.alpha)) {
        // Android Compass Heading
        heading = Math.round((360 - e.alpha) % 360)
      }

      if (heading !== null) {
        setDeviceHeading(heading)
        setHasCompassSensor(true)
      }
    }

    window.addEventListener('deviceorientation', handleOrientation, true)
    window.addEventListener('deviceorientationabsolute' as any, handleOrientation, true)

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true)
      window.removeEventListener('deviceorientationabsolute' as any, handleOrientation, true)
    }
  }, [])

  // 2. Real-Time Physical Step / Motion Detection (Accelerometer)
  useEffect(() => {
    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity || e.acceleration
      if (!acc) return

      const total = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2)
      const now = Date.now()

      // Walking step rhythm detection: human step creates vertical acceleration spike
      if (Math.abs(total - 9.8) > 1.6 && now - lastStepTimeRef.current > 380) {
        lastStepTimeRef.current = now
        setStepsTaken(prev => prev + 1)
      }
    }

    window.addEventListener('devicemotion', handleMotion, true)
    return () => {
      window.removeEventListener('devicemotion', handleMotion, true)
    }
  }, [])

  // 3. Auto-Walk Simulation Timer (decrements 1 meter per second when enabled)
  useEffect(() => {
    if (!isAutoWalking) return

    const interval = setInterval(() => {
      setManualMetersWalked(prev => prev + 1.2)
    }, 1000)

    return () => clearInterval(interval)
  }, [isAutoWalking])

  // 4. High-Frequency GPS Polling Loop (polls GPS every 1.5s when active)
  useEffect(() => {
    if (locationStatus !== 'active') {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    pollIntervalRef.current = setInterval(() => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserCoords({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              heading: pos.coords.heading,
            })
            setGpsPingCount(c => c + 1)
          },
          () => {},
          { enableHighAccuracy: true, timeout: 3500, maximumAge: 0 }
        )
      }
    }, 1500)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [locationStatus])

  // Cleanup GPS watcher on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

  const requestSensorsPermission = async () => {
    // Request iOS orientation permission
    if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      try {
        const state = await (DeviceOrientationEvent as any).requestPermission()
        if (state === 'granted') setHasCompassSensor(true)
      } catch (err) {
        console.warn('Compass permission rejected:', err)
      }
    }
    // Request iOS motion permission
    if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
      try {
        await (DeviceMotionEvent as any).requestPermission()
      } catch (err) {
        console.warn('Motion permission rejected:', err)
      }
    }
  }

  const toggleLocationServices = async () => {
    await requestSensorsPermission()

    if (locationStatus === 'active') {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      setUserCoords(null)
      setLocationStatus('idle')
      setStepsTaken(0)
      setManualMetersWalked(0)
      setIsAutoWalking(false)
      setActiveRoute(calculateDynamicRoute(destinationInput, null))
      return
    }

    if (!('geolocation' in navigator)) {
      setLocationStatus('unsupported')
      return
    }

    setLocationStatus('locating')
    setLocationError(null)

    // Immediate initial snapshot
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: UserLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
        }
        setUserCoords(coords)
        setLocationStatus('active')
        setGpsPingCount(c => c + 1)
        setActiveRoute(calculateDynamicRoute(destinationInput, coords))
      },
      (err) => {
        console.warn('Initial GPS ping failed, relying on watcher:', err)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    )

    // Continuous watcher
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
        setGpsPingCount(c => c + 1)
        setActiveRoute(calculateDynamicRoute(destinationInput, coords))
      },
      (err) => {
        setLocationStatus('denied')
        setLocationError(err.message || 'Location permission was denied or unavailable.')
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    )
  }

  const navigateToDestination = (destination: string) => {
    const trimmed = destination.trim()
    if (!trimmed) return
    setDestinationInput(trimmed)
    setSearchQuery(trimmed)
    setStepsTaken(0)
    setManualMetersWalked(0)
    const effectiveCoords = useCampusDemoOrigin ? CAMPUS_CORE_COORDS : userCoords
    const newRoute = calculateDynamicRoute(trimmed, effectiveCoords)
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

  // Active Origin Coordinates (either real GPS or Campus Demo Origin)
  const effectiveLocation = useCampusDemoOrigin ? CAMPUS_CORE_COORDS : userCoords
  const isLocationActive = locationStatus === 'active' || useCampusDemoOrigin

  // Destination & Distance Calculations
  const destCoords = getDestinationCoordinates(activeRoute.destination)
  const activeOrigin = effectiveLocation || CAMPUS_CORE_COORDS

  // Base geographical distance
  const baseDistMeters = calculateHaversineDistanceMeters(
    activeOrigin.lat,
    activeOrigin.lng,
    destCoords.lat,
    destCoords.lng
  )

  // Deduct physical footsteps walked (average human stride = 0.76m) + manual steps
  const totalMetersAdvanced = (stepsTaken * 0.76) + manualMetersWalked
  const currentLiveDistMeters = Math.max(0, baseDistMeters - totalMetersAdvanced)

  const liveWalkingMins = Math.max(1, Math.round(currentLiveDistMeters / 80))
  const targetBearing = calculateCompassBearing(
    activeOrigin.lat,
    activeOrigin.lng,
    destCoords.lat,
    destCoords.lng
  )
  const relativeTurn = calculateRelativeTurn(deviceHeading, targetBearing.degrees)
  const hasArrived = currentLiveDistMeters <= 5

  // Manual rotation adjuster
  const rotateHeading = (delta: number) => {
    setDeviceHeading(prev => (prev + delta + 360) % 360)
  }

  // Manual walk step
  const handleStepForward = () => {
    setManualMetersWalked(prev => prev + 2)
  }

  const handleResetWalkProgress = () => {
    setStepsTaken(0)
    setManualMetersWalked(0)
    setIsAutoWalking(false)
  }

  return (
    <div className="help-content waymo-navigation-modal">
      {/* Search Header: "Where would you like to go?" */}
      <section className="waymo-search-box">
        <div className="search-header-copy">
          <div className="search-badge">
            <Compass size={14} />
            <span>Campus Mobility & Real-Time Guidance</span>
          </div>
          <h3>Where would you like to go?</h3>
          <p>Input any campus building, dorm, or landmark to calculate the walking route, real-time compass turns, and live distance countdown.</p>
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

      {/* Real-Time Location & Compass Turn Guidance Card */}
      <section className="live-location-guidance-card">
        {isLocationActive ? (
          <div className="location-active-view">
            <div className="location-status-header">
              <div className="gps-live-tag">
                <span className="gps-live-dot" />
                <strong>
                  {useCampusDemoOrigin ? 'Campus Core Origin' : 'Live Phone GPS Active'}
                </strong>
                <span className="gps-accuracy-badge">
                  {hasCompassSensor ? '🧭 Compass Sensor Active' : '📍 GPS Active'}
                </span>
                {stepsTaken > 0 && (
                  <span className="gps-accuracy-badge step-badge">
                    <Footprints size={11} /> {stepsTaken} steps
                  </span>
                )}
              </div>
              <div className="location-header-actions">
                <button
                  type="button"
                  className={`origin-switch-btn ${useCampusDemoOrigin ? 'is-demo' : ''}`}
                  onClick={() => {
                    const nextMode = !useCampusDemoOrigin
                    setUseCampusDemoOrigin(nextMode)
                    setStepsTaken(0)
                    setManualMetersWalked(0)
                    const nextCoords = nextMode ? CAMPUS_CORE_COORDS : userCoords
                    setActiveRoute(calculateDynamicRoute(destinationInput, nextCoords))
                  }}
                  title="Switch between your physical GPS and Campus Core"
                >
                  <ArrowLeftRight size={12} />
                  <span>{useCampusDemoOrigin ? 'Switch to Physical GPS' : 'Campus Core Mode'}</span>
                </button>
                <button
                  type="button"
                  className="location-toggle-btn active"
                  onClick={toggleLocationServices}
                  title="Stop tracking"
                >
                  <LocateFixed size={12} />
                  <span>Turn Off</span>
                </button>
              </div>
            </div>

            {/* Live Compass Turning & Heading HUD */}
            <div className="live-guidance-hero">
              <div className="compass-visual-wrap">
                <div
                  className="compass-needle"
                  style={{ transform: `rotate(${relativeTurn.needleRotation}deg)` }}
                >
                  <Navigation2 size={28} className="compass-arrow" />
                </div>
                <span className="compass-degree-label">
                  {Math.round(relativeTurn.needleRotation)}°
                </span>
              </div>

              <div className="guidance-text-content">
                {hasArrived ? (
                  <div className="arrival-badge">
                    <h4>🎉 Arrived at Destination!</h4>
                    <p>You have reached <strong>{activeRoute.destination}</strong>.</p>
                  </div>
                ) : (
                  <>
                    <span className="guidance-eyebrow">
                      {relativeTurn.isFacingTarget ? 'TARGET LOCKED' : 'TURN GUIDANCE'}
                    </span>
                    <h4 className={relativeTurn.isFacingTarget ? 'text-facing-target' : 'text-turn-action'}>
                      {relativeTurn.directionText}
                    </h4>
                    <p>
                      Facing {deviceHeading}° · Target is at {targetBearing.degrees}° ({targetBearing.cardinal})
                    </p>
                  </>
                )}

                <div className="live-stats-row">
                  <span className="stat-pill highlight live-dist-pill">
                    📍 {Math.round(currentLiveDistMeters)} meters remaining
                  </span>
                  <span className="stat-pill">
                    🚶 ~{liveWalkingMins} min walk
                  </span>
                  {totalMetersAdvanced > 0 && (
                    <span className="stat-pill walking-active-pill">
                      🏃 -{Math.round(totalMetersAdvanced)}m walked
                    </span>
                  )}
                  <span className="stat-pill subtle">
                    {activeOrigin.lat.toFixed(4)}, {activeOrigin.lng.toFixed(4)}{gpsPingCount > 0 ? ` · ${gpsPingCount} pings` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Walking Motion & Walk Simulation Controls */}
            <div className="live-walk-motion-bar">
              <div className="walk-status-info">
                <Footprints size={14} className={stepsTaken > 0 || isAutoWalking ? 'pulse-icon' : ''} />
                <span>
                  {stepsTaken > 0
                    ? `Physical motion detected: ${stepsTaken} steps (~${(stepsTaken * 0.76).toFixed(1)}m)`
                    : 'Walk with phone in hand or test motion with controls:'}
                </span>
              </div>
              <div className="walk-action-buttons">
                <button
                  type="button"
                  className="walk-btn"
                  onClick={handleStepForward}
                  title="Simulate taking 2 steps forward"
                >
                  <Footprints size={12} />
                  <span>+2m Step</span>
                </button>
                <button
                  type="button"
                  className={`walk-btn auto-walk-btn ${isAutoWalking ? 'is-active' : ''}`}
                  onClick={() => setIsAutoWalking(prev => !prev)}
                  title={isAutoWalking ? 'Pause walk' : 'Continuously walk forward at 1.2 m/s'}
                >
                  {isAutoWalking ? <Pause size={12} /> : <Play size={12} />}
                  <span>{isAutoWalking ? 'Pause' : 'Auto-Walk'}</span>
                </button>
                {totalMetersAdvanced > 0 && (
                  <button
                    type="button"
                    className="walk-btn reset-btn"
                    onClick={handleResetWalkProgress}
                    title="Reset walked meters"
                  >
                    <RotateCcw size={11} />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* Compass Calibration Controls */}
            <div className="compass-calibration-bar">
              <span className="calibration-tip">
                {hasCompassSensor
                  ? '📱 Rotate phone in hand — needle and degrees update live'
                  : '💡 Rotate phone or use test buttons below to simulate turns:'}
              </span>
              <div className="rotate-controls">
                <button
                  type="button"
                  className="rotate-btn"
                  onClick={() => rotateHeading(-30)}
                  title="Turn Left 30°"
                >
                  <RotateCcw size={12} />
                  <span>Turn -30°</span>
                </button>
                <span className="current-heading-tag">{deviceHeading}°</span>
                <button
                  type="button"
                  className="rotate-btn"
                  onClick={() => rotateHeading(30)}
                  title="Turn Right 30°"
                >
                  <RotateCw size={12} />
                  <span>Turn +30°</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="location-prompt-view">
            <div className="location-prompt-icon">
              <Locate size={20} />
            </div>
            <div className="location-prompt-info">
              <h4>Enable Location & Compass to Lead the Way</h4>
              <p>
                Access device GPS and digital compass to track your real-time walking distance, compass turns, and guide you directly from where you are standing.
              </p>
              {locationError && (
                <div className="location-error-msg">
                  <ShieldAlert size={13} />
                  <span>{locationError}</span>
                </div>
              )}
            </div>
            <div className="prompt-buttons-group">
              <button
                type="button"
                className={`enable-location-btn ${locationStatus === 'locating' ? 'is-loading' : ''}`}
                onClick={toggleLocationServices}
                disabled={locationStatus === 'locating'}
              >
                <LocateFixed size={15} />
                <span>{locationStatus === 'locating' ? 'Acquiring GPS…' : 'Use Current Location'}</span>
              </button>
              <button
                type="button"
                className="campus-demo-btn"
                onClick={() => {
                  setUseCampusDemoOrigin(true)
                  setStepsTaken(0)
                  setManualMetersWalked(0)
                  setActiveRoute(calculateDynamicRoute(destinationInput, CAMPUS_CORE_COORDS))
                  requestSensorsPermission()
                }}
              >
                <Compass size={14} />
                <span>Test Campus Mode</span>
              </button>
            </div>
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
          <strong>Public Mobility & Location Services:</strong> Clarity integrates continuous GPS polling and accelerometer motion detection with digital compass heading to dynamically decrement walking distance and provide real-time turn guidance.
        </p>
      </div>
    </div>
  )
}
