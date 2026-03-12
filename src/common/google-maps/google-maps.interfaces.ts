export interface Coordinates {
  lat: number;
  lng: number;
  label?: string;
}

export interface OptimizeRouteInput {
  origin: Coordinates;
  stops: Array<Coordinates & { externalId: string }>;
  profile?: string;
  useRoundTrip?: boolean;
}

export interface OptimizeRouteResult {
  distanceKm: number;
  durationMin: number;
  geometry: string | null;
  waypoints: GoogleMapsWaypoint[];
  legs: GoogleMapsLeg[];
  requestId?: string;
}

export interface ForwardGeocodeResult {
  id: string;
  label: string;
  lat: number;
  lng: number;
  country?: string;
  region?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  postalCode?: string;
  accuracy?: string;
}

export interface ForwardGeocodeResponse {
  results: ForwardGeocodeResult[];
  primary: ForwardGeocodeResult | null;
}

export interface ForwardGeocodeOptions {
  limit?: number;
  proximity?: Coordinates;
  country?: string;
  language?: string;
  types?: string[];
  bbox?: string | null;
  fuzzyMatch?: boolean;
  autocomplete?: boolean;
  skipRelaxed?: boolean;
}

export interface ReverseGeocodeResult {
  formattedAddress: string;
  country?: string;
  adminArea?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  placeId?: string;
  accuracy?: string;
  lat: number;
  lng: number;
  provider: string;
  context?: Record<string, string | undefined>;
}

export interface PointToPointMetrics {
  distanceKm: number;
  durationMin: number | null;
  geometry?: string | null;
  source: 'google-maps' | 'haversine';
}

export interface GoogleMapsWaypoint {
  name: string;
  location: [number, number];
  waypoint_index: number;
  original_index?: number;
  placeId?: string;
}

export interface GoogleMapsLeg {
  distance: number;
  duration: number;
}