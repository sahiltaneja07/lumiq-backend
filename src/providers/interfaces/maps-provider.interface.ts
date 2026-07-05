export interface GeocodeResult {
  address: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  details?: any;
}

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  geometry?: string; // polyline or similar
}

export interface IMapsProvider {
  geocode(address: string): Promise<GeocodeResult>;
  reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult>;
  getRoute(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
  ): Promise<RouteResult>;
}
