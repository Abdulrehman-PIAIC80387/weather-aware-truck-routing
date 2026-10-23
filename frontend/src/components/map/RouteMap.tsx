import "maplibre-gl/dist/maplibre-gl.css";
import type { Point } from "geojson";
import type { CanvasSource, GeoJSONSource, MapGeoJSONFeature } from "maplibre-gl";
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
import { BASEMAPS, type BasemapId, applyNavyBasemap } from "./basemap";
import {
  bounds,
  checkpointPoints,
  levelBounds,
  levelsPresent,
  midpoint,
  routeSegments,
  truckPositions,
} from "./geojson";
import {
  INTERACTIVE_LAYERS,
  riskAreas,
  checkpointCircles,
  checkpointClusters,
  clusterCounts,
  routeCasing,
  routeLines,
  truckDots,
} from "./layers";
import { riskRaster } from "./riskContours";

const CONTIGUOUS_US = { longitude: -98.35, latitude: 39.5, zoom: 3.6 };

interface RouteMapProps {
  plan: Plan | null;
  basemap: BasemapId;
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
  { plan, basemap, selected, onSelect },
  ref,
) {
  const mapRef = useRef<MapRef>(null);
  const hourRef = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;
  const [hovered, setHovered] = useState<Picked | null>(null);
  const [pointer, setPointer] = useState(false);
  const [focus, setFocus] = useState<number | null>(null); // legend level shown alone
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const [opened, setOpened] = useState<Picked | null>(null);

  // Built once per plan, so react-map-gl never re-sends the same data to the map.
  const segments = useMemo(() => plan && routeSegments(plan), [plan]);
  const raster = useMemo(() => plan && riskRaster(plan), [plan]);
  const trucks = useMemo(() => plan && truckPositions(plan, 0), [plan]);
  const checkpoints = useMemo(() => plan && checkpointPoints(plan, focus), [plan, focus]);
  const present = useMemo(() => (plan ? levelsPresent(plan) : new Set<number>()), [plan]);
  const casingLayer = useMemo(
    () => routeCasing(BASEMAPS[basemap].casing, focus),
    [basemap, focus],
  );
  const routeLayer = useMemo(() => routeLines(selected, focus), [selected, focus]);
  const checkpointLayer = useMemo(() => checkpointCircles(selected), [selected]);
  const truckLayer = useMemo(() => truckDots(selected), [selected]);

  // Redraws the risk curves on their canvas, uploads it once, and moves the trucks.
  // A few milliseconds per slider step, with no React render.
  const applyHour = useCallback(
    (hour: number) => {
      hourRef.current = hour;
      if (!plan || !raster) return;
      raster.draw(hour, focusRef.current);
      const map = mapRef.current?.getMap();
      const grid = map?.getSource("grid") as CanvasSource | undefined;
      if (map && grid) {
        grid.play(); // the next frame re-reads the canvas into the map texture
        map.once("render", () => grid.pause());
      }
      (map?.getSource("trucks") as GeoJSONSource | undefined)?.setData(truckPositions(plan, hour));
    },
    [plan, raster],
  );

  useEffect(() => applyHour(hourRef.current), [focus, applyHour]);

  // react-map-gl has no canvas source, so the risk layer is managed here: added for each
  // plan and again after a base map change reloads the style, beneath the place labels.
  const addRiskAreas = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map?.style?._loaded) return; // style JSON ready (tiles may still be loading)
    if (map.getLayer(riskAreas.id)) map.removeLayer(riskAreas.id);
    if (map.getSource("grid")) map.removeSource("grid");
    if (!raster) return;
    const { canvas, coordinates } = raster;
    map.addSource("grid", { type: "canvas", canvas, coordinates, animate: false });
    map.addLayer(riskAreas, BASEMAPS[basemapRef.current].labelLayer);
    applyHour(hourRef.current);
  }, [raster, applyHour]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!loaded || !map) return;
    addRiskAreas();
    map.on("style.load", addRiskAreas);
    return () => {
      map.off("style.load", addRiskAreas);
    };
  }, [loaded, addRiskAreas]);

  useImperativeHandle(ref, () => ({ setHour: applyHour }), [applyHour]);

  useEffect(() => {
    setOpened(null);
    setFocus(null);
    if (plan && loaded) mapRef.current?.fitBounds(bounds(plan), { padding: 60, duration: 800 });
  }, [plan, loaded]);

  function pick(event: MapLayerMouseEvent): { layer: string; picked: Picked } | null {
    const feature = event.features?.[0];
    if (!feature) return null;
    const { route, position } = feature.properties as Picked;
    return { layer: feature.layer.id, picked: { route, position } };
  }

  function focusLevel(level: number | null) {
    setFocus(level);
    setOpened(null);
    const area = plan && level !== null && levelBounds(plan, selected, level);
    if (area) mapRef.current?.fitBounds(area, { padding: 80, duration: 800, maxZoom: 9 });
  }

  async function zoomIntoCluster(feature: MapGeoJSONFeature) {
    const map = mapRef.current?.getMap();
    const source = map?.getSource("checkpoints") as GeoJSONSource | undefined;
    if (!map || !source) return;
    const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
    const [longitude, latitude] = (feature.geometry as Point).coordinates;
    map.easeTo({ center: [longitude, latitude], zoom, duration: 600 });
  }

  function handleClick(event: MapLayerMouseEvent) {
    const cluster = event.features?.find((feature) => feature.layer.id === "clusters");
    if (cluster) {
      void zoomIntoCluster(cluster);
      return;
    }
    const hit = pick(event);
    if (!hit) return;
    onSelect(hit.picked.route);
    setOpened(hit.layer === "checkpoints" ? hit.picked : null);
  }

  function handleHover(event: MapLayerMouseEvent) {
    if (Boolean(event.features?.length) !== pointer) setPointer(!pointer);
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
      mapStyle={BASEMAPS[basemap].url}
      styleDiffing={false}
      interactiveLayerIds={INTERACTIVE_LAYERS}
      cursor={pointer ? "pointer" : "grab"}
      onLoad={(event) => {
        // A base map change reloads the style; react-map-gl re-adds our layers after it.
        const map = event.target;
        // Narrow maps start with the credits expanded over the scale bars; start them
        // collapsed to the (i) button, which still opens them.
        map.getContainer().querySelector(".maplibregl-compact")?.classList.remove("maplibregl-compact-show");
        const recolour = () => basemapRef.current === "navy" && applyNavyBasemap(map);
        map.on("style.load", recolour);
        recolour();
        setLoaded(true);
      }}
      onClick={handleClick}
      onMouseMove={handleHover}
      onMouseLeave={() => {
        setHovered(null);
        setPointer(false);
      }}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <ScaleControl position="bottom-left" unit="metric" maxWidth={120} />
      <ScaleControl position="bottom-left" unit="imperial" maxWidth={120} />
      {segments && (
        <Source id="routes" type="geojson" data={segments}>
          <Layer {...casingLayer} />
          <Layer {...routeLayer} />
        </Source>
      )}
      {checkpoints && (
        <Source
          id="checkpoints"
          type="geojson"
          data={checkpoints}
          cluster
          clusterRadius={50}
          clusterMaxZoom={7}
          clusterProperties={{ worst: ["max", ["get", "risk"]] }}
        >
          <Layer {...checkpointClusters} />
          <Layer {...clusterCounts} />
          <Layer {...checkpointLayer} />
        </Source>
      )}
      {trucks && (
        <Source id="trucks" type="geojson" data={trucks}>
          <Layer {...truckLayer} />
        </Source>
      )}
      {plan && <Legend focus={focus} present={present} onFocus={focusLevel} />}

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
