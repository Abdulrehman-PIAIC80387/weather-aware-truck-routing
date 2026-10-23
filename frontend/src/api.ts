import type { Place, Plan, PlanRequest } from "./types/plan";

/** Free OpenStreetMap place search built for type-ahead: https://photon.komoot.io */
const PHOTON_URL = "https://photon.komoot.io/api/";
const US_BBOX = "-125,24.3,-66.8,49.5"; // contiguous US, the area the API accepts

/** Backend origin when it is hosted separately (e.g. Render); empty means same origin. */
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const WEATHER_VARIABLES = "wind_speed_10m,wind_gusts_10m,rain,showers,snowfall";
const WEATHER_BATCH = 150; // locations per request, keeps the URL short

interface WeatherWindow {
  points: [number, number][];
  start_hour: string;
  end_hour: string;
}

/**
 * Plans a trip in three steps so the forecast uses the visitor's own Open-Meteo quota
 * (a shared server IP gets rate limited): forecast points → weather → risk and ranking.
 */
export async function planTrip(request: PlanRequest, signal: AbortSignal): Promise<Plan> {
  const trip = {
    origin: [request.origin.latitude, request.origin.longitude],
    destination: [request.destination.latitude, request.destination.longitude],
    departure: request.departure,
    load_lb: request.loadLb,
    interval: request.interval,
  };
  const forecastWindow = await postJson<WeatherWindow>("/api/routes/weather-points/", trip, signal);
  const hourly = await fetchForecasts(forecastWindow, signal);
  return postJson<Plan>("/api/routes/plan/", { ...trip, hourly }, signal);
}

async function postJson<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json();
}

async function fetchForecasts({ points, start_hour, end_hour }: WeatherWindow, signal: AbortSignal) {
  const batches = [];
  for (let i = 0; i < points.length; i += WEATHER_BATCH) {
    batches.push(points.slice(i, i + WEATHER_BATCH));
  }
  const results = await Promise.all(
    batches.map(async (batch) => {
      const params = new URLSearchParams({
        latitude: batch.map(([lat]) => lat).join(","),
        longitude: batch.map(([, lon]) => lon).join(","),
        hourly: WEATHER_VARIABLES,
        wind_speed_unit: "mph",
        precipitation_unit: "inch",
        timezone: "GMT",
        start_hour,
        end_hour,
      });
      const response = await fetch(`${OPEN_METEO_URL}?${params}`, { signal });
      if (response.status === 429) throw new Error("The weather service is busy. Please retry in a minute.");
      if (!response.ok) throw new Error("The weather service is unavailable. Please try again.");
      const body = await response.json();
      const locations = Array.isArray(body) ? body : [body]; // one location is not a list
      return locations.map((location: { hourly: Record<string, unknown> }) => location.hourly);
    }),
  );
  return results.flat();
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as Record<string, unknown>;
    if (typeof body.detail === "string") return body.detail;
    return Object.entries(body)
      .map(([field, messages]) => `${field}: ${([] as unknown[]).concat(messages).join(" ")}`)
      .join("; ");
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { countrycode?: string; name?: string; city?: string; state?: string };
}

export async function searchPlaces(text: string, signal: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: text, limit: "10", lang: "en", bbox: US_BBOX });
  const response = await fetch(`${PHOTON_URL}?${params}`, { signal });
  if (!response.ok) throw new Error("Place search is unavailable.");
  const { features } = (await response.json()) as { features: PhotonFeature[] };
  return features
    .filter((feature) => feature.properties.countrycode === "US")
    .slice(0, 6)
    .map(({ geometry, properties: p }) => {
      const [longitude, latitude] = geometry.coordinates;
      const label = [...new Set([p.name, p.city, p.state].filter(Boolean))].join(", ");
      return { label, latitude, longitude };
    });
}
