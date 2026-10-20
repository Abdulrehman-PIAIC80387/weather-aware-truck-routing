import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  type MapLayerMouseEvent,
  type MapRef,
  Marker,
  NavigationControl,
  Popup,
  Source,
} from "react-map-gl/maplibre";
import type { Plan } from "../../types/plan";
import { formatDuration, formatMiles, formatTime } from "../../utils/format";
import { levelInfo } from "../../utils/risk";
import { bounds, checkpointPoints, midpoint, routeSegments } from "./geojson";
import { INTERACTIVE_LAYERS, checkpointCircles, routeCasing, routeLines } from "./layers";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const CONTIGUOUS_US = { longitude: -98.35, latitude: 39.5, zoom: 3.6 };

interface RouteMapProps {
  plan: Plan | null;
  selected: number;
  onSelect: (route: number) => void;
}

interface Picked {
  route: number;
  position: number;
}

export function RouteMap({ plan, selected, onSelect }: RouteMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState<Picked | null>(null);
  const [opened, setOpened] = useState<Picked | null>(null);

  // Built once per plan, so react-map-gl never re-sends the same data to the map.
  const segments = useMemo(() => plan && routeSegments(plan), [plan]);
  const checkpoints = useMemo(() => plan && checkpointPoints(plan), [plan]);
  const routeLayer = useMemo(() => routeLines(selected), [selected]);
  const checkpointLayer = useMemo(() => checkpointCircles(selected), [selected]);

  useEffect(() => {
    setOpened(null);
    if (plan && loaded) mapRef.current?.fitBounds(bounds(plan), { padding: 60, duration: 800 });
  }, [plan, loaded]);

  function pick(event: MapLayerMouseEvent): { layer: string; picked: Picked } | null {
    const feature = event.features?.[0];
    if (!feature) return null;
    const { route, position } = feature.properties as Picked;
    return { layer: feature.layer.id, picked: { route, position } };
  }

  function handleClick(event: MapLayerMouseEvent) {
    const hit = pick(event);
    if (!hit) return;
    onSelect(hit.picked.route);
    setOpened(hit.layer === "checkpoints" ? hit.picked : null);
  }

  function handleHover(event: MapLayerMouseEvent) {
    const hit = pick(event);
    const next = hit?.layer === "checkpoints" ? hit.picked : null;
    if (next?.route !== hovered?.route || next?.position !== hovered?.position) setHovered(next);
  }

  const checkpointAt = (picked: Picked | null) =>
    picked && plan?.routes[picked.route]?.checkpoints[picked.position];
  const hoveredCheckpoint = checkpointAt(hovered);
  const openedCheckpoint = checkpointAt(opened);
  const destination = plan?.routes[selected]?.checkpoints.at(-1);

  return (
    <Map
      ref={mapRef}
      initialViewState={CONTIGUOUS_US}
      mapStyle={MAP_STYLE}
      interactiveLayerIds={INTERACTIVE_LAYERS}
      cursor={hovered ? "pointer" : "grab"}
      onLoad={() => setLoaded(true)}
      onClick={handleClick}
      onMouseMove={handleHover}
      onMouseLeave={() => setHovered(null)}
    >
      <NavigationControl position="top-right" showCompass={false} />
      {segments && (
        <Source id="routes" type="geojson" data={segments}>
          <Layer {...routeCasing} />
          <Layer {...routeLayer} />
        </Source>
      )}
      {checkpoints && (
        <Source id="checkpoints" type="geojson" data={checkpoints}>
          <Layer {...checkpointLayer} />
        </Source>
      )}

      {plan?.routes.map((route, index) => {
        const [longitude, latitude] = midpoint(route);
        const severe = route.summary.severe_miles;
        const noTravel = route.summary.no_travel_miles;
        return (
          <Marker key={route.id} longitude={longitude} latitude={latitude} anchor="bottom">
            <button
              type="button"
              className={`route-label ${index === selected ? "selected" : ""}`}
              onClick={() => onSelect(index)}
            >
              <strong>{route.id}</strong> · {formatDuration(route.duration_seconds)} ·{" "}
              {formatMiles(severe)} severe
              {noTravel > 0 && ` · ${formatMiles(noTravel)} no travel`}
              {index === plan.recommended && " · ★ Recommended"}
            </button>
          </Marker>
        );
      })}

      {destination && plan && (
        <Marker longitude={destination.longitude} latitude={destination.latitude} anchor="top">
          <div className="destination-label">
            Arrive {formatTime(plan.routes[selected].arrival)}
          </div>
        </Marker>
      )}

      {hoveredCheckpoint && !openedCheckpoint && (
        <Popup
          longitude={hoveredCheckpoint.longitude}
          latitude={hoveredCheckpoint.latitude}
          closeButton={false}
          offset={10}
          className="map-tooltip"
        >
          Mile {Math.round(hoveredCheckpoint.mile)} · {formatTime(hoveredCheckpoint.eta)} ·{" "}
          {levelInfo(hoveredCheckpoint.level).label}
        </Popup>
      )}

      {openedCheckpoint && (
        <Popup
          longitude={openedCheckpoint.longitude}
          latitude={openedCheckpoint.latitude}
          offset={10}
          onClose={() => setOpened(null)}
        >
          <strong>
            Mile {Math.round(openedCheckpoint.mile)} · {levelInfo(openedCheckpoint.level).label}
          </strong>
          <div>ETA {formatTime(openedCheckpoint.eta)}</div>
          {openedCheckpoint.conditions ? (
            <div className="muted">
              Wind {openedCheckpoint.conditions.wind_mph} mph (gusts{" "}
              {openedCheckpoint.conditions.gust_mph}) · Rain{" "}
              {openedCheckpoint.conditions.rain_in_hr} in/hr · Snow{" "}
              {openedCheckpoint.conditions.snow_in_hr} in/hr
            </div>
          ) : (
            <div className="muted">No forecast for this time.</div>
          )}
          {openedCheckpoint.reasons.map((reason) => (
            <div key={reason}>⚠ {reason}</div>
          ))}
        </Popup>
      )}
    </Map>
  );
}
