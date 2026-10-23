# Weather-Aware Truck Routing

A web app that helps a truck driver choose the safest route based on weather, load weight
and travel time. Enter an origin, destination, departure time and load weight. The app:

- plans **3 truck routes**;
- checks the forecast at every checkpoint **for the time the truck will be there**;
- rates each checkpoint with the assessment's risk and load rules;
- recommends the best route;
- draws everything on a map, with **0–48 hour weather risk areas** and a time slider.

- **Backend:** Django 6 + Django REST Framework, OpenAPI docs (Swagger / ReDoc)
- **Frontend:** React 18 + TypeScript + Vite + MapLibre GL (WebGL), served by nginx
- **APIs:** [TomTom Routing](https://developer.tomtom.com) (truck mode, free key) ·
  [Open-Meteo](https://open-meteo.com) (forecast, no key) ·
  [Photon](https://photon.komoot.io) (place search, no key) ·
  [OpenFreeMap](https://openfreemap.org) (map tiles, no key)

## Features

**Planning**
- 3 distinct truck routes from TomTom's truck mode, routed for the truck's gross weight.
- Weather checkpoints every **10, 25 or 50 miles**, each rated with the forecast for
  the time the truck reaches it.
- Risk levels from the assessment's table and load rules. Missing forecasts show as
  **Unknown**, never Low.
- The recommended route, with a one-line reason ("Fewest Severe miles (0 vs 42)").
- A **"No route is safe at this departure"** banner when even the best route has Severe
  or No Travel miles.

**Map**
- Routes coloured by risk along each stretch. Click a route line or a card to select it.
- Checkpoints show the ETA and level on hover, and wind, gusts, rain, snow and the
  reason for the level on click.
- On-map route labels (time, severe miles, ★ Recommended) and an arrival-time marker.
- **Smooth weather risk areas** for 0–48 h after departure, with a time slider, a
  **Play** button, and truck dots showing where each truck is at that hour.
- **Clickable legend:** pick a level to show only its areas, route stretches and
  checkpoints, and zoom to them. Levels absent from the trip are greyed out.
- **Checkpoint clusters** when zoomed out, counted and coloured by their worst level.
  Click a cluster to zoom in.
- **Base map switcher** (Navy / Dark / Light). The choice is remembered in the browser.
- **Scale bars** in kilometres and miles.

**Interface**
- Dark navy and teal theme with a site header. The date-time picker matches the theme.
- US place search with type-ahead suggestions (Photon).
- Load weight in **lb or kg** (remembered). It is always sent to the API in pounds,
  because the load rules are defined in pounds.
- **Collapsible side panel:** hide it to give the map the full width; your inputs are kept.
- Mobile layout: the map stays on top and the panel scrolls below it.
- Loading and error states, and a new search cancels the one in flight.

## Quick start

```bash
cp .env.example .env          # then set TOMTOM_API_KEY=<your key>
docker compose up --build
```

| URL | What |
|-----|------|
| http://localhost:3020 | Web app |
| http://localhost:8020/api/docs/ | Swagger UI |
| http://localhost:8020/api/redoc/ | ReDoc |

Ports come from `.env` (`BACKEND_PORT`, `FRONTEND_PORT`).

## Deploy to Render (free)

[`render.yaml`](render.yaml) is a Render Blueprint for two free services:

| Service | Type | URL |
|---------|------|-----|
| `weather-aware-truck-routing-api` | Web service (Docker, `backend/Dockerfile`) | `https://weather-aware-truck-routing-api.onrender.com` |
| `weather-aware-truck-routing` | Static site (`frontend`, Vite build) | `https://weather-aware-truck-routing.onrender.com` |

1. Push the repo to GitHub.
2. In Render: **New → Blueprint**, then pick this repository.
3. Enter `TOMTOM_API_KEY` when asked. Every other setting comes from the Blueprint:
   `DJANGO_DEBUG=0`, a generated `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS=.onrender.com`,
   and CORS for the static site.
4. **Check the URLs.** If Render gives a service a different subdomain (the name was
   taken), set `VITE_API_BASE` on the static site and `CORS_ALLOWED_ORIGINS` on the API to
   the real URLs, then redeploy both.

The frontend calls the API directly at `VITE_API_BASE` (set at build time); the backend
allows that origin through CORS.

**Free-tier behaviour:**
- The API sleeps after 15 minutes without traffic, so the first plan after a pause takes
  about a minute while it wakes up.
- Its file cache resets on every restart.
- Open-Meteo's free limit is per IP, and Render's outbound IPs are shared and often
  limited. So the **browser fetches the forecasts**, using each visitor's own quota:
  `POST /api/routes/weather-points/` lists the forecast points, the browser downloads
  them from Open-Meteo, and `POST /api/routes/plan/` receives them as `hourly`. All risk
  and ranking logic still runs in Python. Without `hourly`, `/plan/` fetches the
  weather itself (e.g. from curl or Swagger).

## API

`POST /api/routes/plan/`

```json
{
  "origin": [41.8781, -87.6298],
  "destination": [39.7392, -104.9903],
  "departure": "2026-10-21T14:00:00Z",
  "load_lb": 42000,
  "interval": 25
}
```

**Validation:**
- Points must be inside the contiguous US, and origin and destination must differ.
- Departure must be no more than 1 h in the past and at most 7 days ahead.
- Load must be 0–80,000 lb.
- Interval must be 10, 25 or 50 miles.

Response (abridged):

```json
{
  "recommended": 2,
  "reason": "Fewest High miles (0 vs 70)",
  "unsafe": false,
  "routes": [
    {
      "id": "A", "distance_miles": 2916.7, "duration_seconds": 150480,
      "arrival": "2026-10-23T08:48:00+00:00",
      "summary": { "no_travel_miles": 0, "severe_miles": 0, "high_miles": 70.0,
                   "unknown_miles": 0, "average_risk": 0.05 },
      "checkpoints": [
        { "mile": 250, "latitude": 40.1, "longitude": -79.2, "eta": "2026-10-21T18:10:00+00:00",
          "level": 2, "reasons": ["Wind 38 mph"],
          "conditions": { "wind_mph": 38.2, "gust_mph": 51.0, "rain_in_hr": 0.02, "snow_in_hr": 0 } }
      ],
      "segments": [{ "level": 2, "path": [[-79.2, 40.1], "..."] }]
    }
  ],
  "grid": { "size": 0.5, "cells": [[40.25, -79.75], "..."], "risk": ["0001122233…", "..."] }
}
```

- **`level` values:** `0` Low, `1` Moderate, `2` High, `3` Severe, `4` No Travel, `null` Unknown.
- **`grid.risk`:** one 49-character string per cell, one digit per hour 0–48 after departure, with `9` for unknown.
- **Error responses:**
  - `400` names the invalid fields;
  - `422` means no truck route exists;
  - `502` means the routing or weather service failed, with a readable `detail`.

Identical requests are served from a 1-hour cache.

## How it works

1. **Routes.**
   - One TomTom request: `travelMode=truck`, `vehicleCommercial`, gross `vehicleWeight`, 2 alternatives.
   - Near-duplicate alternatives are dropped (more than 90% shared road).
   - TomTom's `progress` table gives distance and driving time along each route. Every
     point gets its mile and its driving time from the start.
2. **Checkpoints.**
   - Placed at mile 0, every 10 / 25 / 50 miles, and at the destination.
   - `ETA = departure + TomTom driving time to that mile`, so slow stretches push later ETAs back.
   - Each checkpoint represents the road from halfway to the previous checkpoint to
     halfway to the next. These miles add up to the route length.
3. **Weather.**
   - Checkpoints and the heatmap share one grid of forecast cells around all 3 routes.
     Cells start at 0.25° and grow on long trips to stay within ≤ 250 locations,
     because Open-Meteo's free limit is 600 locations per minute.
   - Forecasts are fetched in parallel batches of 150 locations and cached for 1 hour.
   - Open-Meteo reports rain, showers, snowfall and gusts as totals for the **hour
     ending** at each timestamp. A reading at time *t* uses the hour ending after *t*;
     only sustained wind is interpolated between hours.
   - Rain = `rain + showers` (never `precipitation`, which also counts snow as water).
4. **Risk** at each checkpoint (rules below). If the forecast is missing, the level is
   **Unknown** — never Low.
5. **Recommendation** (rules below).
6. **Display.**
   - The response carries every route as risk-coloured stretches, every checkpoint and
     the 0–48 h risk for each forecast cell.
   - The browser traces the cells into smooth risk areas for each slider hour.
   - Moving the slider, filtering by legend level or switching base maps makes no
     further API calls.

### Risk rules

| Condition | Low | Moderate | High | Severe | No Travel |
|-----------|-----|----------|------|--------|-----------|
| Wind (mph) | < 25 | 25–34 | 35–44 | 45–54 | ≥ 55 |
| Rain (in/hr) | < 0.10 | 0.10–0.25 | 0.25–0.50 | 0.50–1.00 | > 1.00 |
| Snow (in/hr) | < 0.5 | 0.5–1.0 | 1.0–2.0 | 2.0–3.0 | > 3.0 |

- **Shared boundaries:** the table's ranges share endpoints, so each band **includes its
  lower bound and excludes its upper bound**. Decimal readings land in exactly one band
  (34.6 mph → Moderate, 0.25 in/hr rain → High).
- **No Travel threshold:** it starts at ≥ 55 mph wind, but only **above** 1.00 in/hr rain
  and 3.0 in/hr snow, exactly as written (1.00 rain and 3.0 snow are Severe).
- **Load rules** apply to the wind band:
  - ≥ 55 mph → No Travel for any load;
  - 45–54 mph with a load over 30,000 lb → No Travel;
  - 35–44 mph with a load over 40,000 lb → Severe.
- **Checkpoint level** = the worst of wind (after load rules), rain and snow. The response
  names what set it, e.g. `"Wind 47 mph + 36,000 lb load"`.

### Recommendation

Routes are compared on these keys in order, and the first difference decides:

1. **Fewest No Travel miles.** Added ahead of the brief's list because No Travel is
   worse than Severe. It never changes the order the brief's keys would give.
2. **Fewest Severe miles**
3. **Fewest High miles**
4. **Lowest average risk** (distance-weighted mean of levels 0–4, excluding Unknown).
   Averages within **0.10** count as equal, so a route hours longer can't win on a
   meaningless 0.01 difference. This is how risk is balanced against travel time.
5. **Shortest travel time**

Miles are compared at 0.1 precision. The response explains the choice against the
runner-up. If even the best route has Severe or No Travel miles, the UI shows a
**"No route is safe at this departure"** banner.

## UI and performance

- **Map:** WebGL rendering through MapLibre GL.
  - Routes are drawn as segments coloured by checkpoint risk. The selected route is
    wider and on top.
  - Checkpoints show the ETA and level on hover, and conditions and reasons on click.
  - On-map labels give each route's time and severe miles, mark the recommended route,
    and show the arrival time.
- **Risk areas (the "heatmap"):** smooth curves of each risk level at the slider hour.
  - The forecast grid is interpolated and traced into contour bands (d3-contour).
  - The bands are painted opaque onto a canvas, highest level last, and the map shows
    that canvas at one opacity. Bands never blend, so every colour on the map is a real
    level from the legend.
  - A blurred density heatmap was rejected because it adds overlapping values together
    and can show risk levels no area actually has.
- **Smooth slider:** each step redraws the canvas and uploads it to the map once,
  without re-sending map data or re-rendering React. That costs about 13 ms of script
  the first time an hour is shown, and less once it is cached.
  - A **Play** button animates the 48 hours.
  - A truck dot shows where each truck is at the slider hour.
- **Legend filter and clusters:** clicking a legend level shows only its areas, route
  stretches and checkpoints, and zooms to them. Zoomed out, checkpoints merge into
  counted clusters coloured by their worst level.
- **Small responses:** route lines are simplified (Douglas–Peucker), risk is sent as
  digit strings, and JSON is gzipped. New York → Los Angeles at 10-mile checkpoints is
  82 KB over the wire.
- **Built files:** MapLibre is split into its own cached chunk, and hashed assets are
  cached for a year.

## Assumptions and limitations

- **"Wind" is sustained 10 m wind speed.** The table's 25/35/45/55 mph bands match
  sustained-wind practice; gusts run 1.3–1.6× higher and would rate ordinary days
  Severe. Gusts are shown for information.
- **TomTom gets the gross weight:** load + an assumed 35,000 lb empty tractor-trailer.
  The risk rules use the load weight, as the brief states.
- **No `departAt` is sent to TomTom.** With a future departure, TomTom returns only one
  route on long trips. Routes therefore use current conditions; the departure still sets
  every weather ETA.
- **No rest breaks:** ETAs use driving time only, with no Hours-of-Service breaks.
- **Coarser weather on long trips:** cells grow up to 2° (about 140 mi) to stay within
  the free forecast limit, and a checkpoint reads its cell's forecast.
- **Fewer than 3 routes is possible.** If TomTom returns fewer distinct routes (some
  short trips), the app shows the ones it has.
- **Free API terms:** Open-Meteo's free tier is for non-commercial use, which suits this
  assessment; set `OPEN_METEO_URL` to a paid endpoint for production. Only the
  contiguous US is supported.

## Project layout

```
backend/
├── config/        settings, URLs, OpenAPI
├── routes/
│   ├── routing.py     TomTom client → routes with distance/time per point
│   ├── sampling.py    checkpoints, ETAs, represented miles
│   ├── grid.py        shared weather grid around the routes
│   ├── recommend.py   route summaries, ranking, reason
│   ├── planner.py     orchestration
│   ├── response.py    JSON shaping, line simplification
│   ├── serializers.py / views.py   POST /api/routes/plan/
│   └── tests/
└── weather/
    ├── client.py      Open-Meteo batched fetch, cache, value at a time
    ├── risk.py        thresholds + load rules
    └── tests/
frontend/src/
├── api.ts         plan request, place search
├── hooks/         usePlan, useGeocode
├── components/    PlanForm, LocationInput, RouteCards, CheckpointList,
│                  UnsafeBanner, HeatmapSlider, Legend
├── components/map/  RouteMap, layers (styles), geojson (pure builders),
│                    riskContours (curves), basemap (Navy/Dark/Light)
├── types/         API types
└── utils/         risk colours/labels, formatting
```

## Development

Backend (Python 3.12+):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
export TOMTOM_API_KEY=<your key>
python manage.py runserver 8020
```

Frontend (another terminal):

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173, /api is proxied to :8020
```

Lint (PEP8 via [ruff](https://docs.astral.sh/ruff/)) and tests (52, no network needed):

```bash
cd backend
ruff format --check . && ruff check .
python manage.py test
```

### Configuration (environment variables)

| Variable | Default | Purpose |
|----------|---------|---------|
| `TOMTOM_API_KEY` | — (required) | TomTom Routing key |
| `OPEN_METEO_URL` | `https://api.open-meteo.com/v1/forecast` | Forecast endpoint |
| `WEATHER_CACHE_SECONDS` | `3600` | Forecast cache lifetime |
| `PLAN_CACHE_SECONDS` | `3600` | Whole-plan cache lifetime |
| `CACHE_DIR` | `backend/.cache` | File cache shared by gunicorn workers |
| `DJANGO_DEBUG` / `DJANGO_ALLOWED_HOSTS` / `DJANGO_SECRET_KEY` | dev values | Django |
