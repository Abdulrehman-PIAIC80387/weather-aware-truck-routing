import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource } from "maplibre-gl";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  type MapLayerMouseEvent,
  type MapRef,
  Marker,
  NavigationControl,
  ScaleControl,
  Popup,
  Source,
} from "react-map-gl/maplibre";
import type { Plan } from "../../types/plan";
import { formatDuration, formatMiles, formatTime } from "../../utils/format";
import { levelInfo } from "../../utils/risk";
import { Legend } from "../Legend";
import { bounds, checkpointPoints, gridCells, midpoint, routeSegments, truckPositions } from "./geojson";
import {
  INTERACTIVE_LAYERS,
  checkpointCircles,
  riskGrid,
  routeCasing,
  routeLines,
  truckDots,
} from "./layers";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";
const CONTIGUOUS_US = { longitude: -98.35, latitude: 39.5, zoom: 3.6 };

interface RouteMapProps {
  plan: Plan | null;
  selected: number;
  onSelect: (route: number) => void;
}

/** Lets the slider move the map through time without re-rendering React. */
export interface RouteMapHandle {
  setHour: (hour: number) => void;
}

interface Picked {
  route: number;
  position: number;
}

export const RouteMap = forwardRef<RouteMapHandle, RouteMapProps>(function RouteMap(
  { plan, selected, onSelect },
  ref,
) {
  const mapRef = useRef<MapRef>(null);
  const hourRef = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [labelLayer, setLabelLayer] = useState<string>(); // grid goes beneath place names
  const [hovered, setHovered] = useState<Picked | null>(null);
  const [opened, setOpened] = useState<Picked | null>(null);

  // Built once per plan, so react-map-gl never re-sends the same data to the map.
  const segments = useMemo(() => plan && routeSegments(plan), [plan]);
  const grid = useMemo(() => plan && gridCells(plan), [plan]);
  const trucks = useMemo(() => plan && truckPositions(plan, 0), [plan]);
  const checkpoints = useMemo(() => plan && checkpointPoints(plan), [plan]);
  const routeLayer = useMemo(() => routeLines(selected), [selected]);
  const checkpointLayer = useMemo(() => checkpointCircles(selected), [selected]);
  const truckLayer = useMemo(() => truckDots(selected), [selected]);

  // ~250 feature-state updates and a 3-point setData: no re-tiling, no React render.
  const applyHour = useCallback(
    (hour: number) => {
      hourRef.current = hour;
      const map = mapRef.current?.getMap();
      if (!plan || !map?.getSource("grid")) return;
      plan.grid.risk.forEach((hours, id) => {
        map.setFeatureState({ source: "grid", id }, { r: Number(hours[hour]) });
      });
      (map.getSource("trucks") as GeoJSONSource | undefined)?.setData(truckPositions(plan, hour));
    },
    [plan],
  );

  useImperativeHandle(ref, () => ({ setHour: applyHour }), [applyHour]);

  // Paint the current hour once the new grid source has loaded its data.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!plan || !loaded || !map) return;
    const onData = (event: { sourceId?: string; isSourceLoaded?: boolean }) => {
      if (event.sourceId === "grid" && event.isSourceLoaded) applyHour(hourRef.current);
    };
    map.on("sourcedata", onData);
    applyHour(hourRef.current);
    return () => {
      map.off("sourcedata", onData);
    };
  }, [plan, loaded, applyHour]);

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
      onLoad={(event) => {
        setLabelLayer(event.target.getStyle().layers.find((layer) => layer.type === "symbol")?.id);
        setLoaded(true);
      }}
      onClick={handleClick}
      onMouseMove={handleHover}
      onMouseLeave={() => setHovered(null)}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <ScaleControl position="bottom-left" unit="metric" maxWidth={120} />
      <ScaleControl position="bottom-left" unit="imperial" maxWidth={120} />
      {grid && (
        <Source id="grid" type="geojson" data={grid}>
          <Layer {...riskGrid} beforeId={labelLayer} />
        </Source>
      )}
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
      {trucks && (
        <Source id="trucks" type="geojson" data={trucks}>
          <Layer {...truckLayer} />
        </Source>
      )}
      {plan && <Legend />}

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
});
