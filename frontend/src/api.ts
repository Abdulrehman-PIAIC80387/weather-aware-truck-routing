import type { Place, Plan, PlanRequest } from "./types/plan";

/** Free OpenStreetMap place search built for type-ahead: https://photon.komoot.io */
const PHOTON_URL = "https://photon.komoot.io/api/";
const US_BBOX = "-125,24.3,-66.8,49.5"; // contiguous US, the area the API accepts

export async function planTrip(request: PlanRequest, signal: AbortSignal): Promise<Plan> {
  const response = await fetch("/api/routes/plan/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      origin: [request.origin.latitude, request.origin.longitude],
      destination: [request.destination.latitude, request.destination.longitude],
      departure: request.departure,
      load_lb: request.loadLb,
      interval: request.interval,
    }),
    signal,
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json();
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
