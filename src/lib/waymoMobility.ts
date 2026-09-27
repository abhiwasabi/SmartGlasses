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
  },
]
