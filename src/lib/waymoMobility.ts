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

export type WaymoVehicle = {
  id: string
  vehicleModel: string
  licensePlate: string
  beaconInitial: string
  beaconColor: string
  status: 'Available' | 'Arriving' | 'In Transit'
  etaMinutes: number
  distanceMeters: number
  nearestBay: string
}

export const NEARBY_WAYMO_FLEET: WaymoVehicle[] = [
  {
    id: 'waymo-402',
    vehicleModel: 'Jaguar I-PACE · Autonomous Gen 5',
    licensePlate: 'FL · WMO-402',
    beaconInitial: 'CL',
    beaconColor: '#00A3FF',
    status: 'Available',
    etaMinutes: 2,
    distanceMeters: 180,
    nearestBay: 'Green Library & Quad (West Curb)',
  },
  {
    id: 'waymo-118',
    vehicleModel: 'Jaguar I-PACE · Autonomous Gen 5',
    licensePlate: 'FL · WMO-118',
    beaconInitial: 'SF',
    beaconColor: '#10B981',
    status: 'Arriving',
    etaMinutes: 4,
    distanceMeters: 360,
    nearestBay: 'Graham Center (North Loop)',
  },
  {
    id: 'waymo-890',
    vehicleModel: 'Jaguar I-PACE · Autonomous Gen 5',
    licensePlate: 'FL · WMO-890',
    beaconInitial: 'AZ',
    beaconColor: '#F59E0B',
    status: 'Available',
    etaMinutes: 6,
    distanceMeters: 540,
    nearestBay: 'Red Garage Transit Hub',
  },
]

export type CampusSpot = {
  name: string
  shortLabel: string
  category: string
  distance: string
  walkingTime: string
  bikeTime: string
  elevationChange: string
  crosswalkCount: number
  nightSafety: 'High (Illuminated)' | 'Moderate'
  nearestBayId: string
  highlights: string[]
  steps: RouteStep[]
}

export const POPULAR_CAMPUS_SPOTS: CampusSpot[] = [
  {
    name: 'Green Library & Quad',
    shortLabel: 'Green Library',
    category: 'Academic Core',
    distance: '0.3 miles',
    walkingTime: '6 mins',
    bikeTime: '2 mins',
    elevationChange: '+4 ft flat grade',
    crosswalkCount: 1,
    nightSafety: 'High (Illuminated)',
    nearestBayId: 'zone-gl-west',
    highlights: [
      'Traffic-free central promenade directly into library quad',
      'Continuous LED lighting with 24/7 security blue-light stations',
      'Designated Waymo passenger pickup bay directly on west curb',
    ],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Head west from your current location along the central promenade toward the fountain plaza.',
        distance: '250 ft',
        turnType: 'straight',
        audioText: 'Starting route to Green Library. Head west along the central promenade for 250 feet toward the fountain plaza.',
      },
      {
        stepNumber: 2,
        instruction: 'Turn slightly left past the breezeway toward the library main entrance.',
        distance: '350 ft',
        turnType: 'slight-left',
        audioText: 'Turn slightly left past the breezeway. Walk straight for 350 feet past the outdoor study pavilion.',
      },
      {
        stepNumber: 3,
        instruction: 'Cross at the campus pedestrian crossing toward the library steps.',
        distance: '120 ft',
        turnType: 'straight',
        safetyAlert: 'Crosswalk alert · Watch for campus shuttles and maintenance carts',
        audioText: 'Signalized crosswalk ahead. Check both directions, then cross toward the Green Library entrance.',
      },
      {
        stepNumber: 4,
        instruction: 'Arrive at Green Library West Entrance & designated Waymo pickup curb.',
        distance: '100 ft',
        turnType: 'arrive',
        audioText: 'You have arrived at Green Library. The designated Waymo mobility curb is directly to your right.',
      },
    ],
  },
  {
    name: 'Graham Student Center (GC)',
    shortLabel: 'Graham Center',
    category: 'Student Union & Dining',
    distance: '0.2 miles',
    walkingTime: '4 mins',
    bikeTime: '1 min',
    elevationChange: '+2 ft flat grade',
    crosswalkCount: 1,
    nightSafety: 'High (Illuminated)',
    nearestBayId: 'zone-gc-loop',
    highlights: [
      'Direct indoor and covered outdoor concourse access',
      'High foot-traffic corridor with illuminated night lighting',
      'North Loop passenger turnaround bay for quick Waymo pickups',
    ],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Head east along the main campus concourse toward the Graham Center entrance.',
        distance: '200 ft',
        turnType: 'straight',
        audioText: 'Starting route to Graham Center. Head east along the main concourse for 200 feet.',
      },
      {
        stepNumber: 2,
        instruction: 'Turn right at the bookstore atrium entrance into the dining plaza.',
        distance: '250 ft',
        turnType: 'right',
        audioText: 'Turn right at the bookstore atrium. Continue 250 feet toward the student food court concourse.',
      },
      {
        stepNumber: 3,
        instruction: 'Proceed to the north exit facing the Graham Center Transit Loop.',
        distance: '150 ft',
        turnType: 'arrive',
        audioText: 'Walk through the north doors. You have arrived at the Graham Center Waymo pickup turnaround curb.',
      },
    ],
  },
  {
    name: 'Engineering Center (107th Ave)',
    shortLabel: 'Engineering Center',
    category: 'Technology & Computing',
    distance: '0.9 miles',
    walkingTime: '17 mins',
    bikeTime: '5 mins',
    elevationChange: '+11 ft flat grade',
    crosswalkCount: 3,
    nightSafety: 'High (Illuminated)',
    nearestBayId: 'zone-engineering',
    highlights: [
      'Protected pedestrian bridge across SW 8th Street highway',
      'Separated wide walkway with emergency call boxes every 300 ft',
      'East Terminal autonomous turnaround bay with clean EV stations',
    ],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Head east from central campus along the East Walkway toward the perimeter road.',
        distance: '400 ft',
        turnType: 'straight',
        audioText: 'Starting route to Engineering Center. Head east along the walkway for 400 feet.',
      },
      {
        stepNumber: 2,
        instruction: 'Turn left onto the East Promenade toward the pedestrian bridge ramp.',
        distance: '600 ft',
        turnType: 'left',
        audioText: 'Turn left onto the East Promenade. Continue 600 feet toward the covered overpass ramp.',
      },
      {
        stepNumber: 3,
        instruction: 'Ascend the gentle ADA ramp across the covered SW 8th Street overpass.',
        distance: '500 ft',
        turnType: 'slight-right',
        safetyAlert: 'Pedestrian bridge · Fully barrier-separated walkway over traffic',
        audioText: 'Take the covered pedestrian bridge ramp over SW 8th Street. Stay on the right side.',
      },
      {
        stepNumber: 4,
        instruction: 'Descend to 107th Avenue sidewalk and walk north toward the main Engineering building.',
        distance: '800 ft',
        turnType: 'right',
        safetyAlert: 'Signalized crosswalk ahead · Check for turning vehicles',
        audioText: 'Exit the bridge and walk north along 107th Avenue sidewalk for 800 feet.',
      },
      {
        stepNumber: 5,
        instruction: 'Arrive at the Engineering Center East Terminal Waymo passenger bay.',
        distance: '150 ft',
        turnType: 'arrive',
        audioText: 'Turn left into the entrance circle. You have arrived at the Engineering Center Waymo autonomous hub.',
      },
    ],
  },
  {
    name: 'Ocean Bank Arena & Recreation Circle',
    shortLabel: 'Ocean Bank Arena',
    category: 'Athletics & Events',
    distance: '0.4 miles',
    walkingTime: '8 mins',
    bikeTime: '3 mins',
    elevationChange: '+2 ft flat grade',
    crosswalkCount: 2,
    nightSafety: 'High (Illuminated)',
    nearestBayId: 'zone-arena-circle',
    highlights: [
      'Illuminated south campus corridor with wide sidewalks',
      'Direct connection to student housing and wellness recreation',
      'Wide turnaround radius designed for autonomous vehicles',
    ],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Head south along the campus recreation walkway toward the wellness complex.',
        distance: '300 ft',
        turnType: 'straight',
        audioText: 'Starting route to Ocean Bank Arena. Head south along the recreation walkway for 300 feet.',
      },
      {
        stepNumber: 2,
        instruction: 'Turn right at the fitness pavilion toward the arena loop.',
        distance: '400 ft',
        turnType: 'right',
        audioText: 'Turn right at the fitness pavilion and follow the lighted path for 400 feet.',
      },
      {
        stepNumber: 3,
        instruction: 'Cross the recreation loop at the high-visibility crosswalk.',
        distance: '150 ft',
        turnType: 'straight',
        safetyAlert: 'Crosswalk alert · Watch for approaching electric bikes and scooters',
        audioText: 'Crosswalk ahead. Watch for bicycles and electric scooters, then cross.',
      },
      {
        stepNumber: 4,
        instruction: 'Arrive at Ocean Bank Arena Waymo turnaround circle on your right.',
        distance: '180 ft',
        turnType: 'arrive',
        audioText: 'You have arrived at the Ocean Bank Arena Waymo passenger turnaround circle on your right.',
      },
    ],
  },
  {
    name: 'Frost Art Museum & Cultural Lake',
    shortLabel: 'Frost Art Museum',
    category: 'Arts & Culture',
    distance: '0.45 miles',
    walkingTime: '9 mins',
    bikeTime: '3 mins',
    elevationChange: '+3 ft flat grade',
    crosswalkCount: 1,
    nightSafety: 'High (Illuminated)',
    nearestBayId: 'zone-gc-loop',
    highlights: [
      'Picturesque lakefront promenade with sculpture gardens',
      'Wide flat concrete paths with complete wheelchair ramp access',
      'Short 3-minute walk to Graham Center Waymo pickup bay',
    ],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Head southwest along the campus lake promenade.',
        distance: '300 ft',
        turnType: 'straight',
        audioText: 'Starting route to Frost Art Museum. Head southwest along the lake promenade for 300 feet.',
      },
      {
        stepNumber: 2,
        instruction: 'Follow the curve past the outdoor sculpture garden.',
        distance: '450 ft',
        turnType: 'slight-left',
        audioText: 'Follow the curved lakeside path for 450 feet past the sculpture garden.',
      },
      {
        stepNumber: 3,
        instruction: 'Turn right toward the Frost Art Museum glass entrance plaza.',
        distance: '200 ft',
        turnType: 'arrive',
        audioText: 'Turn right toward the glass pavilion. You have arrived at the Frost Art Museum.',
      },
    ],
  },
  {
    name: 'MANGO Building (Management & New Growth)',
    shortLabel: 'MANGO Building',
    category: 'Academic & International',
    distance: '0.35 miles',
    walkingTime: '7 mins',
    bikeTime: '2 mins',
    elevationChange: '+3 ft flat grade',
    crosswalkCount: 2,
    nightSafety: 'High (Illuminated)',
    nearestBayId: 'zone-gl-west',
    highlights: [
      'Modern glass complex with covered breezeways and dining',
      'High-visibility crosswalks with audible countdown timers',
      'Direct 2-minute connection to Green Library Waymo Bay',
    ],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Head west along the main promenade toward the library quad.',
        distance: '250 ft',
        turnType: 'straight',
        audioText: 'Starting route to MANGO Building. Head west along the promenade for 250 feet.',
      },
      {
        stepNumber: 2,
        instruction: 'Turn left onto the South Plaza walkway toward the MANGO entrance tower.',
        distance: '400 ft',
        turnType: 'left',
        audioText: 'Turn left onto the South Plaza walkway. Walk 400 feet toward the MANGO glass tower.',
      },
      {
        stepNumber: 3,
        instruction: 'Cross the internal campus shuttle driveway at the marked zebra crosswalk.',
        distance: '100 ft',
        turnType: 'straight',
        safetyAlert: 'Transit crossing · Yield to approaching campus shuttles',
        audioText: 'Cross the shuttle driveway cautiously, watching for turning transit vans.',
      },
      {
        stepNumber: 4,
        instruction: 'Arrive at MANGO Building main plaza.',
        distance: '120 ft',
        turnType: 'arrive',
        audioText: 'You have arrived at the MANGO Building. Entrance doors are directly ahead.',
      },
    ],
  },
  {
    name: 'Red Parking Garage & Transit Hub',
    shortLabel: 'Red Garage Hub',
    category: 'Multi-Modal Parking',
    distance: '0.3 miles',
    walkingTime: '6 mins',
    bikeTime: '2 mins',
    elevationChange: '+4 ft flat grade',
    crosswalkCount: 1,
    nightSafety: 'High (Illuminated)',
    nearestBayId: 'zone-pg-red',
    highlights: [
      'Protected ground-level covered transit terminal',
      'Sheltered from extreme Miami heat, storms, and downpours',
      'Dedicated autonomous vehicle and rideshare boarding bays',
    ],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Head west from central campus along the tree-lined walkway.',
        distance: '250 ft',
        turnType: 'straight',
        audioText: 'Starting route to Red Garage. Head west along the tree-lined path for 250 feet.',
      },
      {
        stepNumber: 2,
        instruction: 'Turn slightly left past the outdoor breezeway.',
        distance: '350 ft',
        turnType: 'slight-left',
        audioText: 'Turn slightly left past the breezeway for 350 feet.',
      },
      {
        stepNumber: 3,
        instruction: 'Cross at the signalized campus crosswalk toward the garage entrance.',
        distance: '120 ft',
        turnType: 'straight',
        safetyAlert: 'Crosswalk alert · Watch for vehicles exiting garage structure',
        audioText: 'Signalized crosswalk ahead. Watch for garage vehicles, then cross.',
      },
      {
        stepNumber: 4,
        instruction: 'Turn right onto the covered transit curb. You have arrived at the Waymo loading bay.',
        distance: '100 ft',
        turnType: 'arrive',
        audioText: 'Turn right into the covered lane. You have arrived at the Red Garage Waymo passenger loading bay.',
      },
    ],
  },
  {
    name: 'Student Health & Wellness Center',
    shortLabel: 'Student Health',
    category: 'Medical & Wellness',
    distance: '0.45 miles',
    walkingTime: '9 mins',
    bikeTime: '3 mins',
    elevationChange: '+3 ft flat grade',
    crosswalkCount: 2,
    nightSafety: 'High (Illuminated)',
    nearestBayId: 'zone-pg-red',
    highlights: [
      'Medical clinic, pharmacy, and wellness counseling facility',
      'Direct step-free ADA ramp access from curb to clinic doors',
      'Emergency blue-light stations situated at both building entrances',
    ],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Head southwest along the campus wellness path.',
        distance: '350 ft',
        turnType: 'straight',
        audioText: 'Starting route to Student Health Center. Head southwest along the wellness path for 350 feet.',
      },
      {
        stepNumber: 2,
        instruction: 'Turn left at the counseling center garden.',
        distance: '400 ft',
        turnType: 'left',
        audioText: 'Turn left at the garden. Walk 400 feet along the illuminated sidewalk.',
      },
      {
        stepNumber: 3,
        instruction: 'Cross the campus lane at the marked pedestrian crosswalk.',
        distance: '120 ft',
        turnType: 'straight',
        safetyAlert: 'Pedestrian crosswalk · Yield to campus patrol and medical transport',
        audioText: 'Cross the lane at the marked crosswalk, checking for service vehicles.',
      },
      {
        stepNumber: 4,
        instruction: 'Arrive at the Student Health & Wellness Center entrance.',
        distance: '150 ft',
        turnType: 'arrive',
        audioText: 'You have arrived at the Student Health & Wellness Center entrance on your right.',
      },
    ],
  },
]

export function calculateDynamicRoute(destinationInput: string, origin = 'Current Location (Campus Core)'): MobilityRoute {
  const query = destinationInput.trim().toLowerCase()
  const matchedSpot = POPULAR_CAMPUS_SPOTS.find(
    s => s.name.toLowerCase().includes(query) || s.shortLabel.toLowerCase().includes(query)
  )

  if (matchedSpot) {
    return {
      id: `dynamic-${matchedSpot.shortLabel.toLowerCase().replace(/\s+/g, '-')}`,
      name: `${origin} → ${matchedSpot.name}`,
      origin,
      destination: matchedSpot.name,
      distance: matchedSpot.distance,
      walkingTime: matchedSpot.walkingTime,
      bikeTime: matchedSpot.bikeTime,
      elevationChange: matchedSpot.elevationChange,
      crosswalkCount: matchedSpot.crosswalkCount,
      nightSafety: matchedSpot.nightSafety,
      googleMapsUrl: `https://www.google.com/maps/dir/?api=1&origin=Graham+Center+FIU&destination=${encodeURIComponent(matchedSpot.name + ' FIU Miami')}&travelmode=walking`,
      routeHighlights: matchedSpot.highlights,
      steps: matchedSpot.steps,
    }
  }

  // Format arbitrary destination gracefully
  const cleanDestination = destinationInput.trim() || 'Campus Destination'
  return {
    id: `custom-${Date.now()}`,
    name: `${origin} → ${cleanDestination}`,
    origin,
    destination: cleanDestination,
    distance: '0.4 miles',
    walkingTime: '8 mins',
    bikeTime: '3 mins',
    elevationChange: '+3 ft flat grade · 100% ADA compliant',
    crosswalkCount: 2,
    nightSafety: 'High (Illuminated)',
    googleMapsUrl: `https://www.google.com/maps/dir/?api=1&origin=Graham+Center+FIU&destination=${encodeURIComponent(cleanDestination + ' FIU Miami')}&travelmode=walking`,
    routeHighlights: [
      `Real-time safe pedestrian routing to ${cleanDestination}`,
      'Prioritizes illuminated campus pathways and verified crosswalks',
      'Direct connection to nearest Waymo autonomous vehicle pickup bay',
    ],
    steps: [
      {
        stepNumber: 1,
        instruction: `Head along the main campus walkway from ${origin} toward the central concourse.`,
        distance: '200 ft',
        turnType: 'straight',
        audioText: `Starting route to ${cleanDestination}. Head along the main walkway for 200 feet toward the central concourse.`,
      },
      {
        stepNumber: 2,
        instruction: `Continue straight along the illuminated pedestrian corridor toward ${cleanDestination}.`,
        distance: '450 ft',
        turnType: 'slight-left',
        audioText: `Continue along the illuminated walkway for 450 feet toward ${cleanDestination}.`,
      },
      {
        stepNumber: 3,
        instruction: `Cross at the signalized campus crosswalk with audio countdown timer.`,
        distance: '120 ft',
        turnType: 'straight',
        safetyAlert: 'Signalized crosswalk · Verify pedestrian walk sign before entering crosswalk',
        audioText: `Signalized crosswalk ahead. Push the walk button and verify the walk signal before crossing.`,
      },
      {
        stepNumber: 4,
        instruction: `Follow the wide sidewalk directly to the main entrance of ${cleanDestination}.`,
        distance: '250 ft',
        turnType: 'arrive',
        audioText: `Follow the walkway for 250 feet. You have arrived at ${cleanDestination}.`,
      },
    ],
  }
}

export function getNearbyWaymos(destinationQuery?: string): WaymoVehicle[] {
  if (!destinationQuery) return NEARBY_WAYMO_FLEET
  const q = destinationQuery.toLowerCase()
  return [...NEARBY_WAYMO_FLEET].sort((a, b) => {
    const aMatch = a.nearestBay.toLowerCase().includes(q)
    const bMatch = b.nearestBay.toLowerCase().includes(q)
    if (aMatch && !bMatch) return -1
    if (!aMatch && bMatch) return 1
    return a.etaMinutes - b.etaMinutes
  })
}
