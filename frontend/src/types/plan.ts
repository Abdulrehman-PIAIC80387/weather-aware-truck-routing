/** Risk level 0-4 (Low … No Travel); null when the weather is unknown. */
export type Level = 0 | 1 | 2 | 3 | 4;

export interface Conditions {
  wind_mph: number;
  gust_mph: number;
  rain_in_hr: number;
  snow_in_hr: number;
}

export interface Checkpoint {
  mile: number;
  latitude: number;
  longitude: number;
  eta: string;
  level: Level | null;
  reasons: string[];
  conditions: Conditions | null;
}

export interface Segment {
  level: Level | null;
  path: [number, number][]; // [longitude, latitude]
}

export interface PlannedRoute {
  id: string;
  distance_miles: number;
  duration_seconds: number;
  arrival: string;
  summary: {
    no_travel_miles: number;
    severe_miles: number;
    high_miles: number;
    unknown_miles: number;
    average_risk: number | null;
  };
  checkpoints: Checkpoint[];
  segments: Segment[];
}

export interface Plan {
  departure: string;
  load_lb: number;
  interval_miles: number;
  recommended: number;
  reason: string;
  unsafe: boolean;
  routes: PlannedRoute[];
  grid: {
    size: number; // cell width in degrees
    cells: [number, number][]; // cell centers, [latitude, longitude]
    risk: string[]; // per cell, one digit per hour 0..48: level 0-4, 9 = unknown
  };
}

export interface Place {
  label: string;
  latitude: number;
  longitude: number;
}

export type Interval = 10 | 25 | 50;

export interface PlanRequest {
  origin: Place;
  destination: Place;
  departure: string; // ISO 8601
  loadLb: number;
  interval: Interval;
}
