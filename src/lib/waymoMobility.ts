export type WaymoPickupZone = {
  id: string
  name: string
  campusArea: string
  description: string
  curbType: string
  adaAccessible: boolean
  lightingRating: 'Excellent' | 'Good'
  googleMapsUrl: string
  tip: string
}

export type RouteStep = {
  stepNumber: number
  instruction: string
  distance: string
  turnType: 'straight' | 'left' | 'right' | 'slight-left' | 'slight-right' | 'arrive'
  audioText: string
  safetyAlert?: string
}

export type MobilityRoute = {
  id: string
  name: string
  origin: string
  destination: string
  distance: string
  walkingTime: string
  bikeTime: string
  elevationChange: string
  crosswalkCount: number
  nightSafety: 'High (Illuminated)' | 'Moderate'
  googleMapsUrl: string
  routeHighlights: string[]
  steps: RouteStep[]
}

export const WAYMO_PICKUP_ZONES: WaymoPickupZone[] = [
  {
    id: 'zone-gc-loop',
    name: 'Graham Center Student Union (North Loop)',
    campusArea: 'Central Campus',
    description: 'Designated autonomous ride-hail and transit turnaround curb directly outside the student union.',
    curbType: 'White Curb · Passenger Loading Zone (No Parking)',
    adaAccessible: true,
    lightingRating: 'Excellent',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Graham+Center+FIU+Miami',
    tip: 'Avoid blocking shuttle buses. Stand under the covered canopy during rain.',
  },
  {
    id: 'zone-gl-west',
    name: 'Green Library & Campus Quad (West Curb)',
    campusArea: 'Academic Core',
    description: 'Low-speed pedestrian corridor with dedicated passenger boarding cut-outs.',
    curbType: 'Designated Rideshare & Mobility Bay',
    adaAccessible: true,
    lightingRating: 'Excellent',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Green+Library+FIU+Miami',
    tip: 'Direct access to library elevators and 24/7 security blue-light station.',
  },
  {
    id: 'zone-pg-red',
    name: 'Red Parking Garage Transit Hub (Ground Level)',
    campusArea: 'Southwest Hub',
    description: 'Protected covered passenger loading lane sheltered from Miami sun and rainstorms.',
    curbType: 'Covered Multi-Modal Transit Lane',
    adaAccessible: true,
    lightingRating: 'Excellent',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Red+Parking+Garage+FIU+Miami',
    tip: 'Safest rain pickup zone with direct indoor connection to campus walkways.',
  },
  {
    id: 'zone-arena-circle',
    name: 'Ocean Bank Arena & Recreation Circle',
    campusArea: 'Athletics & Event District',
    description: 'Wide radius turnaround loop engineered for smooth autonomous vehicle navigation and large group pick-ups.',
    curbType: 'Event Staging & Rideshare Turnaround',
    adaAccessible: true,
    lightingRating: 'Good',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Ocean+Bank+Convocation+Center+FIU',
    tip: 'Best for late-night post-hackathon pickups away from inner campus foot traffic.',
  },
  {
    id: 'zone-engineering',
    name: 'Engineering Center East Terminal',
    campusArea: '107th Ave Complex',
    description: 'Dedicated EV charging and autonomous mobility turnaround bay with wide curb visibility.',
    curbType: 'Transit & Clean Mobility Bay',
    adaAccessible: true,
    lightingRating: 'Excellent',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=FIU+College+of+Engineering+and+Computing',
    tip: 'Seamless connection for engineering students commuting between main campus and EC.',
  },
]

export const MOBILITY_ROUTES: MobilityRoute[] = [
  {
    id: 'route-gc-to-ec',
    name: 'Graham Center → Engineering Center',
    origin: 'Graham Student Center',
    destination: 'Engineering Center',
    distance: '0.9 miles',
    walkingTime: '17 mins',
    bikeTime: '5 mins',
    elevationChange: '+11 ft flat grade',
    crosswalkCount: 3,
    nightSafety: 'High (Illuminated)',
    googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=Graham+Center+FIU&destination=FIU+College+of+Engineering+and+Computing&travelmode=walking',
    routeHighlights: [
      'Protected pedestrian overpass across SW 8th St corridor',
      'Continuous wide sidewalk separated from vehicle lanes',
      'Illuminated LED path with emergency call boxes every 300 ft',
    ],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Head east from Graham Center along the central campus walkway toward the fountain plaza.',
        distance: '400 ft',
        turnType: 'straight',
        audioText: 'Starting navigation to Engineering Center. Head east from Graham Center along the central walkway for 400 feet toward the fountain plaza.',
      },
      {
        stepNumber: 2,
        instruction: 'Turn left onto the East Promenade toward the pedestrian bridge.',
        distance: '600 ft',
        turnType: 'left',
        audioText: 'Turn left onto the East Promenade. Walk straight along the illuminated pathway for 600 feet toward the pedestrian bridge.',
      },
      {
        stepNumber: 3,
        instruction: 'Take the covered pedestrian bridge ramp over the SW 8th Street corridor.',
        distance: '500 ft',
        turnType: 'slight-right',
        safetyAlert: 'Pedestrian overpass · Fully barrier-separated walkway over highway traffic',
        audioText: 'Ascend the gentle ramp and cross the covered pedestrian bridge over SW 8th Street. Stay on the right side of the walkway.',
      },
      {
        stepNumber: 4,
        instruction: 'Descend to 107th Avenue sidewalk and continue north toward Engineering Center entrance.',
        distance: '800 ft',
        turnType: 'right',
        safetyAlert: 'Signalized crosswalk ahead · Wait for the pedestrian countdown',
        audioText: 'Exit the bridge and continue north along the 107th Avenue sidewalk for 800 feet. Cross at the signalized crosswalk.',
      },
      {
        stepNumber: 5,
        instruction: 'Turn left into the Engineering Center East Terminal Waymo pickup bay.',
        distance: '150 ft',
        turnType: 'arrive',
        audioText: 'Turn left into the entrance circle. You have arrived at the Engineering Center Waymo pickup hub on your left.',
      },
    ],
  },
  {
    id: 'route-gl-to-red',
    name: 'Green Library → Red Garage Transit Hub',
    origin: 'Green Library',
    destination: 'Red Parking Garage',
    distance: '0.3 miles',
    walkingTime: '6 mins',
    bikeTime: '2 mins',
    elevationChange: '+4 ft flat grade',
    crosswalkCount: 1,
    nightSafety: 'High (Illuminated)',
    googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=Green+Library+FIU&destination=Red+Parking+Garage+FIU&travelmode=walking',
    routeHighlights: [
      'Traffic-free central pedestrian promenade',
      'Fully tree-shaded walkway with resting benches',
      'Direct ADA ramp leading into ground-level covered transit curb',
    ],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Head west from Green Library entrance along the pedestrian promenade.',
        distance: '250 ft',
        turnType: 'straight',
        audioText: 'Starting route to Red Garage. Head west from the library entrance along the promenade for 250 feet.',
      },
      {
        stepNumber: 2,
        instruction: 'Turn slightly left past the outdoor breezeway toward the campus transit lane.',
        distance: '350 ft',
        turnType: 'slight-left',
        audioText: 'Turn slightly left past the covered breezeway. Walk straight for 350 feet past the student pavilion.',
      },
      {
        stepNumber: 3,
        instruction: 'Cross at the signalized campus crosswalk toward the garage entrance.',
        distance: '120 ft',
        turnType: 'straight',
        safetyAlert: 'Crosswalk alert · Watch for campus transit shuttles before crossing',
        audioText: 'Signalized campus crosswalk ahead. Check both directions for shuttles, then cross toward Red Garage.',
      },
      {
        stepNumber: 4,
        instruction: 'Turn right into the ground-level covered transit bay.',
        distance: '100 ft',
        turnType: 'arrive',
        audioText: 'Turn right onto the covered transit curb. You have arrived at the Red Garage Waymo loading zone.',
      },
    ],
  },
  {
    id: 'route-housing-to-arena',
    name: 'Student Housing Quad → Arena Pick-up',
    origin: 'Parkview Student Housing',
    destination: 'Ocean Bank Arena Loop',
    distance: '0.4 miles',
    walkingTime: '8 mins',
    bikeTime: '3 mins',
    elevationChange: '+2 ft flat grade',
    crosswalkCount: 2,
    nightSafety: 'High (Illuminated)',
    googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=Parkview+Hall+FIU&destination=Ocean+Bank+Convocation+Center+FIU&travelmode=walking',
    routeHighlights: [
      'Signalized pedestrian crosswalk with audible countdown timers',
      'Separated scooter/bike lane adjacent to walking path',
      'High visibility open curb for quick Waymo ride-hail connection',
    ],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Head south from Parkview Hall entrance along the housing quad pathway.',
        distance: '300 ft',
        turnType: 'straight',
        audioText: 'Starting route to Ocean Bank Arena. Head south along the housing quad pathway for 300 feet.',
      },
      {
        stepNumber: 2,
        instruction: 'Turn right at the fitness pavilion toward the recreation loop.',
        distance: '400 ft',
        turnType: 'right',
        audioText: 'Turn right at the outdoor fitness pavilion. Follow the illuminated night corridor for 400 feet.',
      },
      {
        stepNumber: 3,
        instruction: 'Cross the recreation loop at the high-visibility pedestrian crosswalk.',
        distance: '150 ft',
        turnType: 'straight',
        safetyAlert: 'Micro-mobility alert · Yield to approaching bikes and electric scooters',
        audioText: 'Approaching the recreation loop crosswalk. Watch for oncoming bikes and electric scooters, then cross.',
      },
      {
        stepNumber: 4,
        instruction: 'Follow the curve to Ocean Bank Arena wide turnaround circle.',
        distance: '180 ft',
        turnType: 'arrive',
        audioText: 'Continue 180 feet along the arena perimeter sidewalk. You have arrived at the Waymo turnaround bay on your right.',
      },
    ],
  },
]
