import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { Button } from "@ui-sdk/react/button";
import {
  geoBounds, geoContains, geoGraticule, geoInterpolate, geoMercator,
  geoNaturalEarth1, geoOrthographic, geoPath, type GeoProjection,
} from "d3-geo";
import { feature, merge } from "topojson-client";
import type { GeometryCollection, Topology, Polygon as TopoPolygon, MultiPolygon as TopoMultiPolygon } from "topojson-specification";
import type { Feature, FeatureCollection, LineString, MultiPolygon, Polygon } from "geojson";
import countries from "world-atlas/countries-110m.json";
import { mapFixtures, routeFixtures, type Coordinate, type Marker, type Route } from "./geo-fixtures";
import {
  Grid, HEIGHT, Legend, PLOT, WIDTH, createRandom, format, linear, number, rows, string, useVariantLoading,
  type DemoProps, type HoverInfo,
} from "./primitives";

type CountryProperties = { name?: string };
type World = Topology<{ countries: GeometryCollection<CountryProperties> }>;
type Country = Feature<Polygon | MultiPolygon, CountryProperties>;
type Rotation = [number, number];
const atlas = countries as unknown as World;
const world = feature(atlas, atlas.objects.countries) as FeatureCollection<Polygon | MultiPolygon, CountryProperties>;
const land = merge(atlas, atlas.objects.countries.geometries.filter((shape): shape is TopoPolygon<CountryProperties> | TopoMultiPolygon<CountryProperties> => (shape.type === "Polygon" || shape.type === "MultiPolygon") && shape.id !== "010"));
const mapHeight = HEIGHT;
const center: Coordinate = [WIDTH / 2, mapHeight / 2];
const graticuleLines = geoGraticule().step([10, 10])();
const worldProjection = () => geoNaturalEarth1().fitExtent([[18, 10], [WIDTH - 18, mapHeight - 8]], { type: "Sphere" }).clipExtent([[0, 0], [WIDTH, mapHeight]]);
const compactMetric = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function screenToMap(svg: SVGSVGElement, clientX: number, clientY: number): Coordinate {
  const matrix = svg.getScreenCTM();
  if (matrix) {
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return [point.x, point.y];
  }
  const box = svg.getBoundingClientRect();
  return [(clientX - box.left) * WIDTH / Math.max(1, box.width), (clientY - box.top) * mapHeight / Math.max(1, box.height)];
}
const continents = ["Europe", "Asia-Pacific", "Americas", "Africa", "Middle East"];

const cities: readonly [name: string, lon: number, lat: number, region: number][] = [
  ["Berlin", 13.4, 52.5, 0], ["London", -.13, 51.5, 0], ["Paris", 2.35, 48.85, 0], ["Oslo", 10.75, 59.91, 0],
  ["Madrid", -3.7, 40.42, 0], ["Rome", 12.5, 41.9, 0], ["Dublin", -6.26, 53.35, 0], ["Vienna", 16.37, 48.2, 0],
  ["Prague", 14.42, 50.08, 0], ["Lisbon", -9.14, 38.72, 0], ["Tokyo", 139.7, 35.7, 1], ["Seoul", 127, 37.6, 1],
  ["Taipei", 121.56, 25.03, 1], ["Singapore", 103.82, 1.3, 1], ["Sydney", 151.21, -33.87, 1], ["Mumbai", 72.88, 19.08, 1],
  ["Melbourne", 144.96, -37.81, 1], ["Bangkok", 100.5, 13.76, 1], ["New York", -74, 40.71, 2], ["Los Angeles", -118.24, 34.05, 2],
  ["Chicago", -87.63, 41.88, 2], ["Seattle", -122.33, 47.61, 2], ["Dallas", -96.8, 32.78, 2], ["Miami", -80.19, 25.76, 2],
  ["Toronto", -79.38, 43.65, 2], ["São Paulo", -46.63, -23.55, 2], ["Mexico City", -99.13, 19.43, 2], ["Cape Town", 18.43, -33.92, 3],
  ["Nairobi", 36.82, -1.29, 3], ["Dubai", 55.27, 25.2, 4],
];

function coord(lon: unknown, lat: unknown): Coordinate | undefined {
  const x = number(lon);
  const y = number(lat);
  return x === undefined || y === undefined || Math.abs(x) > 180 || Math.abs(y) > 90 ? undefined : [x, y];
}

function getMarkers(data: DemoProps["data"], id: string, forChoropleth: boolean): Marker[] {
  if (data?.rows) return rows(data).flatMap((row, i) => {
    const at = coord(row.lon, row.lat);
    if (!at) return [];
    return [{ at, label: string(row.label) ?? `Location ${i + 1}`, value: Math.max(0, number(row.value) ?? 1), category: string(row.category) ?? "Locations" }];
  });
  if (!forChoropleth) return mapFixtures(id);
  const mapSites = ["Berlin", "Tokyo", "Sydney", "New York", "São Paulo"];
  const filtered = cities.filter(([name]) => mapSites.includes(name));
  return filtered.map(([label, lon, lat, region], index) => ({ at: [lon, lat], label, value: 20 + (31 * index) % 109, category: continents[region] }));
}

function getRoutes(data: DemoProps["data"], id: string): Route[] {
  if (data?.rows) return rows(data).flatMap((row, index) => {
    const from = coord(row.fromLon, row.fromLat);
    const to = coord(row.toLon, row.toLat);
    if (!from || !to) return [];
    const label = string(row.label) ?? `Route ${index + 1}`;
    const [departure, arrival] = label.split(/\s*(?:→|\bto\b)\s*/);
    return [{ from, to, label, value: Math.max(0, number(row.value) ?? 1), category: string(row.category) ?? "Routes",
      fromName: string(row.fromName) ?? (arrival ? departure : undefined), toName: string(row.toName) ?? arrival }];
  });
  return routeFixtures(id);
}

function fitToSites(project: GeoProjection, sites: readonly Coordinate[]) {
  if (sites.length < 2) return;
  const points = sites.map((site) => project(site)).filter((point): point is Coordinate => point !== null);
  if (points.length < 2) return;
  const left = Math.min(...points.map(([x]) => x));
  const right = Math.max(...points.map(([x]) => x));
  const top = Math.min(...points.map(([, y]) => y));
  const bottom = Math.max(...points.map(([, y]) => y));
  const scale = Math.min(12, (WIDTH - 150) / Math.max(1, right - left), (mapHeight - 115) / Math.max(1, bottom - top));
  const [tx, ty] = project.translate();
  project.scale(project.scale() * scale).translate([center[0] - (left + (right - left) / 2 - tx) * scale, center[1] - (top + (bottom - top) / 2 - ty) * scale]);
}

function drawMarker(symbol: number, radius: number) {
  switch (symbol % 5) {
    case 1: return <rect x={-radius} y={-radius} width={2 * radius} height={2 * radius} rx={1} />;
    case 2: return <path d={`M0 ${-radius - 1}L${radius} ${radius}H${-radius}Z`} />;
    case 3: return <path d={`M0 ${-radius - 1}L${radius + 1} 0 0 ${radius + 1} ${-radius - 1} 0Z`} />;
    case 4: return <path d={`M${-radius} 0H${radius}M0 ${-radius}V${radius}`} strokeWidth={3} />;
    default: return <circle r={radius} />;
  }
}

function visibleOnGlobe(projection: GeoProjection, at: Coordinate) {
  const [x, y] = projection(at) ?? [0, 0];
  const invert = projection.invert?.([x, y]);
  if (!invert) return false;
  const difference = Math.abs((((invert[0] - at[0]) % 360) + 540) % 360 - 180);
  return difference < .01 && Math.abs(invert[1] - at[1]) < .01;
}

const countriesWithBounds = world.features.filter((shape) => shape.id !== "010").map((shape) => ({ shape, bounds: geoBounds(shape) }));
const dotCache = new Map<number, { x: number; y: number; country: string | null }[]>();
function dotPoints(step: number) {
  const existing = dotCache.get(step);
  if (existing) return existing;
  const lattice = worldProjection();
  const result: { x: number; y: number; country: string | null }[] = [];
  for (let row = 0; 4 + row * step * .86 < mapHeight; row++) {
    const y = 4 + row * step * .86;
    for (let x = 4 + row % 2 * step / 2; x < WIDTH; x += step) {
      const at = lattice.invert?.([x, y]);
      let country = null;
      if (at && Math.abs(at[0]) <= 180 && Math.abs(at[1]) <= 90 && geoContains(land, at)) {
        const [lon, lat] = at;
        const found = countriesWithBounds.find(({ shape, bounds: [[west, south], [east, north]] }) =>
          lat >= south && lat <= north && (west <= east ? lon >= west && lon <= east : lon >= west || lon <= east) && geoContains(shape, at));
        country = found?.shape.properties.name ?? "";
      }
      result.push({ x, y, country });
    }
  }
  dotCache.set(step, result);
  return result;
}

const initialPan = { x: 0, y: 0, scale: 1 };
type Pan = typeof initialPan;
const clampScale = (scale: number) => Math.max(1, Math.min(7, scale));

function scaleBetween(pan: Pan, previousAnchor: Coordinate, nextAnchor: Coordinate, scale: number): Pan {
  const factor = scale / pan.scale;
  return { scale, x: nextAnchor[0] - (previousAnchor[0] - pan.x) * factor, y: nextAnchor[1] - (previousAnchor[1] - pan.y) * factor };
}

function fitCamera(point: Coordinate, scale: number, tiltX: number, tiltY: number): Pan {
  return {
    scale,
    x: center[0] - scale * (point[0] + tiltX * (point[1] - center[1])),
    y: center[1] - scale * (point[1] + tiltY * (point[0] - center[0])),
  };
}

function dragPair(points: Map<number, Coordinate>) {
  const [a, b] = points.values();
  if (!a || !b) return null;
  return { distance: Math.hypot(a[0] - b[0], a[1] - b[1]), at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Coordinate };
}
const countryNames: Record<string, number> = { Germany: 81, France: 69, Spain: 39, Canada: 49, "United States of America": 91, Brazil: 64, Japan: 74, Australia: 47, India: 87, Norway: 26, "United Kingdom": 82, Sweden: 52, Finland: 24, Mexico: 61, Italy: 57, Netherlands: 60, Argentina: 36, Indonesia: 29, "South Africa": 23 };

export function GeoMap({ example, compact, data }: DemoProps) {
  const id = useId().replaceAll(":", "");
  const { loading, button } = useVariantLoading(example.id);
  const chart = example.family;
  const isGlobe = chart === "globe";
  const isBubble = chart === "bubble-map";
  const isRoute = chart === "route-map";
  const loadingExample = example.id.endsWith("-loading");
  const dotGrid = example.id === "choropleth-dot-grid";
  const pointerCamera = example.id === "choropleth-pointer-camera";
  const clickZoom = example.id === "choropleth-click-to-zoom";
  const camera = clickZoom || pointerCamera || dotGrid;
  const backgrounds = example.id === "choropleth-background";
  const patterns = example.id === "choropleth-patterns";
  const graticule = example.id === "choropleth-graticule";
  const markersMode = example.id === "choropleth-markers" || camera;
  const categoryMode = example.id === "bubble-map-categories" || example.id === "route-map-region";
  const sized = example.id === "globe-sized" || isBubble;
  const region = example.id.endsWith("-region");
  const mapGrid = graticule || isGlobe && !sized || clickZoom || !region && (isRoute || isBubble && !categoryMode);
  const markerMetric = isGlobe ? "Customers" : region ? "Orders" : categoryMode ? "Engineers" : "Active users";
  const [pan, setPan] = useState(initialPan);
  const [rotation, setRotation] = useState<Rotation>(() => isGlobe && sized ? [92, -23] : [-13, -23]);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tilt, setTilt] = useState<Coordinate>([0, 0]);
  const [hidden, setHidden] = useState<string[]>([]);
  const frame = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, Coordinate>());
  const drag = useRef<{ pointerId: number; x: number; y: number; initialX: number; initialY: number; active: boolean } | null>(null);
  const pinch = useRef<{ distance: number; at: Coordinate; pan: Pan } | null>(null);
  const moved = useRef(false);
  const markers = useMemo(() => isBubble || isGlobe || markersMode ? getMarkers(data, example.id, markersMode) : [], [isBubble, isGlobe, markersMode, data, example.id]);
  const routes = useMemo(() => isRoute ? getRoutes(data, example.id) : [], [isRoute, data, example.id]);
  const countriesValues = useMemo(() => {
    if (chart !== "choropleth" || !data?.rows) return new Map(Object.entries(countryNames));
    const matched = new Map<string, number>();
    for (const row of rows(data)) {
      const country = string(row.country) ?? string(row.label);
      const value = number(row.value);
      if (country && value !== undefined) matched.set(country, value);
    }
    return matched;
  }, [chart, data]);
  const projection = useMemo(() => {
    if (isGlobe) return geoOrthographic().translate(center).scale(144).rotate(rotation).clipAngle(90);
    const project = region
      ? geoMercator().translate(center).scale(111)
      : worldProjection();
    if (region) fitToSites(project, [...markers.map(({ at }) => at), ...routes.flatMap(({ from, to }) => [from, to])]);
    project.clipExtent([[0, 0], [WIDTH, mapHeight]]);
    return project;
  }, [isGlobe, rotation, region, markers, routes]);
  const path = geoPath(projection);
  const geography = useMemo(() => {
    const projectPath = geoPath(projection);
    return world.features.filter((shape) => shape.id !== "010").flatMap((shape) => {
      const d = projectPath(shape);
      if (!d) return [];
      return [{ shape, d, point: projectPath.centroid(shape), key: `country:${shape.properties.name ?? shape.id}` }];
    });
  }, [projection]);
  const dots = dotGrid ? dotPoints(compact ? 8 : 5.5) : [];
  const countryInteractive = !compact && !loading && chart === "choropleth";
  const routePath = ({ from, to }: Route) => {
    const interpolate = geoInterpolate(from, to);
    const curve: LineString = { type: "LineString", coordinates: Array.from({ length: 32 }, (_, i) => interpolate(i / 31)) };
    return path(curve) ?? "";
  };
  const routeColors = [...new Set(routes.map(({ category }) => category))];
  const markerColors = [...new Set(markers.map(({ category }) => category))];
  const groups = isRoute ? routeColors : markerColors;
  const showMarker = (marker: Marker) => !isGlobe || visibleOnGlobe(projection, marker.at);
  const markerMaximum = Math.max(1, ...markers.map(({ value }) => value));
  const routeMaximum = Math.max(1, ...routes.map(({ value }) => value));
  const screenMarkers = markers.flatMap((marker, index) => {
    const position = projection(marker.at);
    if (!position || !showMarker(marker) || hidden.includes(marker.category)) return [];
    const [x, y] = position;
    const radius = sized ? Math.sqrt(marker.value / markerMaximum) * (isBubble ? 19 : 14) : 4.8;
    return [{ ...marker, index, x, y, radius, key: `marker:${index}`, hint: { x, y, lines: [marker.label, sized ? `${data ? "Value" : markerMetric}: ${format.format(marker.value)}` : ""].filter(Boolean) } }];
  });
  const visibleRoutes = routes.filter(({ category }) => !hidden.includes(category)).flatMap((route) => {
    const d = routePath(route);
    if (!d) return [];
    const [x, y] = projection(geoInterpolate(route.from, route.to)(.5)) ?? center;
    return [{ route, d, key: `route:${route.label}:${routes.indexOf(route)}`, hint: { x, y, lines: [route.label,
      data ? `Passengers: ${format.format(route.value)}` : region ? `Schedule: ${format.format(route.value)} flights a week` : `Passengers: ${format.format(route.value)} a day`] } }];
  });
  const airportMap = new Map<string, { key: string; at: Coordinate; label: string; routes: number }>();
  visibleRoutes.forEach(({ route }) => ([[route.from, route.fromName], [route.to, route.toName]] as const).forEach(([at, name]) => {
    const key = at.join(",");
    const airport = airportMap.get(key);
    if (airport) airport.routes++;
    else airportMap.set(key, { key: `airport:${key}`, at, label: name ?? `${format.format(at[1])}°, ${format.format(at[0])}°`, routes: 1 });
  }));
  const screenAirports = [...airportMap.values()].flatMap(({ key, at, label, routes }) => {
    const point = projection(at);
    return point ? [{ key, at: point, hint: { x: point[0], y: point[1], lines: [label, `Routes: ${routes}`] } }] : [];
  });
  const valueExtent = Math.max(1, ...countriesValues.values());
  const countryValueMode = example.id === "choropleth-values" || backgrounds || clickZoom || dotGrid;
  const countryHint = (shape: Country, x: number, y: number): HoverInfo => {
    const name = shape.properties.name ?? String(shape.id ?? "Country");
    const value = countriesValues.get(name) ?? 0;
    return { x, y, lines: [name, countryValueMode ? `Value: ${format.format(value)}` : ""].filter(Boolean) };
  };
  const targets = [
    ...screenMarkers.map(({ key, hint, x, y }) => ({ key, hint, at: [x, y] as Coordinate })),
    ...screenAirports,
    ...visibleRoutes.map(({ key, hint }) => ({ key, hint, at: [hint.x, hint.y] as Coordinate })),
    ...(countryInteractive ? geography.filter(({ point }) => point.every(Number.isFinite)).map(({ shape, point, key }) => ({ key, at: point, hint: countryHint(shape, ...point) })) : []),
  ];
  const keyboardTarget = targets.find(({ key }) => key === focus);
  const active = loading ? null : hover ?? keyboardTarget?.hint ?? null;
  const tiltX = selected ? -.105 : dotGrid ? -.06 : pointerCamera ? tilt[0] : 0;
  const tiltY = selected ? .045 : pointerCamera ? tilt[1] : 0;
  const matrix = `matrix(1, ${tiltY}, ${tiltX}, 1, ${-tiltX * center[1]}, ${-tiltY * center[0]})`;
  const transformHint = (hint: HoverInfo) => isGlobe ? hint : {
    ...hint, x: (hint.x + tiltX * (hint.y - center[1])) * pan.scale + pan.x,
    y: (hint.y + tiltY * (hint.x - center[0])) * pan.scale + pan.y,
  };
  const pointInFrame = (event: PointerEvent<SVGSVGElement>) => screenToMap(event.currentTarget, event.clientX, event.clientY);
  const reset = () => {
    setPan(initialPan);
    setRotation(isGlobe && sized ? [92, -23] : [-13, -23]);
    setTilt([0, 0]);
    setSelected(null);
    setHover(null);
    setFocus(null);
  };
  const zoomAt = (key: string, at: Coordinate) => {
    if (selected === key) { reset(); return; }
    setPan(fitCamera(at, dotGrid ? 2.45 : 2.8, -.105, .045));
    setSelected(key);
    setHover(null);
  };
  const clickTarget = (event: MouseEvent<SVGElement>, key: string, at: Coordinate) => {
    event.stopPropagation();
    if (!moved.current) zoomAt(key, at);
  };
  const startDrag = (pointerId: number, [x, y]: Coordinate) => {
    drag.current = { pointerId, x, y, initialX: isGlobe ? rotation[0] : pan.x, initialY: isGlobe ? rotation[1] : pan.y, active: false };
  };
  const down = (event: PointerEvent<SVGSVGElement>) => {
    if (compact || loading || event.button !== 0) return;
    const point = pointInFrame(event);
    if (!pointers.current.size) moved.current = false;
    pointers.current.set(event.pointerId, point);
    if (!drag.current) startDrag(event.pointerId, point);
    if (isGlobe || pointers.current.size !== 2) return;
    const pair = dragPair(pointers.current);
    if (!pair || pair.distance < 1) return;
    pinch.current = { ...pair, pan };
    moved.current = true;
    drag.current = null;
    setHover(null);
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (compact || loading) return;
    const [x, y] = pointInFrame(event);
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, [x, y]);
    if (pinch.current) {
      const pair = dragPair(pointers.current);
      if (!pair) return;
      const { at, distance, pan: original } = pinch.current;
      setPan(scaleBetween(original, at, pair.at, clampScale(original.scale * pair.distance / distance)));
      return;
    }
    const state = drag.current;
    if (!state) {
      if (pointerCamera && !selected && event.pointerType !== "touch") setTilt([(x / WIDTH - .5) * .21, (.5 - y / mapHeight) * .13]);
      return;
    }
    if (state.pointerId !== event.pointerId) return;
    const dx = x - state.x;
    const dy = y - state.y;
    if (!state.active && Math.hypot(dx, dy) <= 4) return;
    if (!state.active) {
      state.active = true;
      moved.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setHover(null);
    }
    if (isGlobe) setRotation([state.initialX + dx * .43, Math.max(-85, Math.min(85, state.initialY - dy * .43))]);
    else setPan((prev) => ({ ...prev, x: state.initialX + dx, y: state.initialY + dy }));
  };
  const end = (event: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    if (pinch.current && pointers.current.size < 2) pinch.current = null;
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
    if (!drag.current && pointers.current.size === 1) {
      const [remainingId, point] = pointers.current.entries().next().value!;
      startDrag(remainingId, point);
    }
  };
  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape") {
      if (!active && !selected && pan === initialPan && tilt.every((value) => value === 0) && rotation[0] === (isGlobe && sized ? 92 : -13) && rotation[1] === -23) return;
      event.preventDefault();
      event.stopPropagation();
      reset();
      return;
    }
    if (camera && keyboardTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      zoomAt(keyboardTarget.key, keyboardTarget.at);
      return;
    }
    if (!isGlobe && ["+", "=", "-"].includes(event.key)) {
      event.preventDefault();
      setPan((prev) => scaleBetween(prev, center, center, clampScale(prev.scale * (event.key === "-" ? 1 / 1.4 : 1.4))));
      return;
    }
    const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (direction === undefined && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    if (event.shiftKey && direction !== undefined) {
      const horizontal = event.key === "ArrowRight" || event.key === "ArrowLeft";
      if (isGlobe) setRotation(([x, y]) => horizontal ? [x + direction * 10, y] : [x, Math.max(-85, Math.min(85, y + direction * 10))]);
      else setPan((prev) => ({ ...prev, x: prev.x - (horizontal ? direction * 28 : 0), y: prev.y - (horizontal ? 0 : direction * 28) }));
      return;
    }
    if (!targets.length) return;
    setHover(null);
    const index = targets.findIndex(({ key }) => key === focus);
    const next = event.key === "Home" ? 0 : event.key === "End" ? targets.length - 1 : index < 0 ? direction === -1 ? targets.length - 1 : 0 : (index + (direction ?? 0) + targets.length) % targets.length;
    setFocus(targets[next].key);
  }
  useEffect(() => {
    if (compact || isGlobe || loading || !frame.current) return;
    const svg = frame.current;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = screenToMap(svg, event.clientX, event.clientY);
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? mapHeight : 1);
      setPan((prev) => scaleBetween(prev, point, point, clampScale(prev.scale * Math.exp(-delta * .0017))));
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [compact, isGlobe, loading]);
  const controls = <>
    {button}
    {!loading && <Button className="stat-control" onClick={reset}>Reset view</Button>}
  </>;
  const displayHint = active && transformHint(active);
  const categoryColor = (name: string) => `var(--chart-${groups.indexOf(name) % 8 + 1})`;
  const countryFill = (shape: Country) => {
    const label = shape.properties.name ?? "";
    if (selected === `country:${label}`) return "var(--chart-2)";
    if (patterns) {
      const value = countriesValues.get(label) ?? 0;
      return value > 67 ? "var(--chart-1)" : value > 23 ? `url(#${id}-market)` : "var(--muted)";
    }
    if (countryValueMode) {
      const value = countriesValues.get(label) ?? 0;
      return value ? `color-mix(in srgb, var(--chart-1) ${Math.max(1, Math.ceil(4 * value / valueExtent)) * 21}%, var(--muted))` : "var(--muted)";
    }
    if (graticule) {
      const value = [...label].reduce((sum, n) => sum + n.charCodeAt(0), 0) % 4;
      return `color-mix(in srgb, var(--chart-1) ${17 + value * 9}%, var(--muted))`;
    }
    if (isBubble || isRoute) return "var(--muted)";
    return "color-mix(in srgb, var(--chart-1) 17%, var(--muted))";
  };
  const viewport = isGlobe ? undefined : `translate(${pan.x}px,${pan.y}px) scale(${pan.scale}) ${matrix}`;
  const showBubbleScale = !loading && isBubble && !region && (!loadingExample || Boolean(data)) && markers.some(({ value }) => value > 0);
  const sizeKeys = data ? [markerMaximum, markerMaximum / 4, markerMaximum / 16] : categoryMode ? [420, 110, 26] : [180000, 46000, 12000];
  return (
    <div className={`stat-demo stat-map ${compact ? "stat-compact" : ""}`}>
      {!compact && <div className="stat-controls">{controls}</div>}
      <div className="stat-frame">
        <svg ref={frame} className={`stat-svg stat-map-svg ${compact ? "" : "stat-map-pan"} ${loading ? "stat-loading" : ""}`} viewBox={`0 0 ${WIDTH} ${mapHeight}`} role="img" aria-roledescription="map" aria-label={example.title} aria-busy={loading || undefined}
          tabIndex={compact || loading ? undefined : 0} onKeyDown={onKeyDown} onBlur={() => setFocus(null)}
          onFocus={(event) => { if (event.target === event.currentTarget && !pointers.current.size) setFocus(targets[0]?.key ?? null); }}
          onPointerMove={move}
          onPointerDown={down}
          onPointerUp={end}
          onPointerCancel={(event) => { end(event); setHover(null); }}
          onPointerLeave={(event) => {
            if (!drag.current?.active && !pinch.current) end(event);
            setHover(null);
            if (pointerCamera && !selected) setTilt([0, 0]);
          }}
          onClick={camera && !compact ? () => { if (!moved.current) reset(); } : undefined}
        >
          <desc>{isGlobe ? "Drag or hold Shift and press an arrow key to rotate. Use the arrow keys to inspect visible locations." : `Drag to pan or use Shift with the arrow keys. Scroll, pinch or press Plus and Minus to zoom. Use the arrow keys to inspect data.${camera ? " Press Enter to fly to a location and Escape to fly back." : ""}`}</desc>
          <defs>
            <clipPath id={`${id}-bounds`}><rect width={WIDTH} height={mapHeight} rx="9" /></clipPath>
            <pattern id={`${id}-market`} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="var(--muted)" /><path d="M0 0v6" stroke="var(--chart-2)" strokeWidth="2" /></pattern>
            <pattern id={`${id}-backdrop`} width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><path d="M0 0v10" stroke="var(--border)" strokeWidth="1" /></pattern>
            <pattern id={`${id}-dots`} width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r=".62" fill="var(--chart-1)" opacity=".22" /></pattern>
            <radialGradient id={`${id}-ocean`} cx="36%" cy="31%" r="70%"><stop stopColor="var(--chart-1)" stopOpacity=".09" /><stop offset="90%" stopColor="var(--chart-1)" stopOpacity=".015" /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity=".13" /></radialGradient>
          </defs>
          {backgrounds && <rect width={WIDTH} height={mapHeight} fill={`url(#${id}-backdrop)`} />}
          {pointerCamera && <rect className="stat-map-backdrop" width={WIDTH} height={mapHeight} fill={`url(#${id}-dots)`} />}
          {isGlobe && <circle className={loading ? "stat-load" : loadingExample ? "stat-globe-reveal" : undefined} data-globe-disc="" cx={center[0]} cy={center[1]} r={projection.scale()} fill={`url(#${id}-ocean)`} stroke="var(--border)" />}
          <g clipPath={`url(#${id}-bounds)`}>
            <g className={!isGlobe ? "stat-map-viewport" : undefined} style={viewport ? { transform: viewport, transitionDuration: camera && !drag.current?.active && !pinch.current ? selected || !pointerCamera ? undefined : ".16s" : "0s" } : undefined}>
              {mapGrid && <path d={path(graticuleLines) ?? undefined} fill="none" stroke="var(--border)" strokeWidth=".7" opacity={clickZoom && selected ? .25 : .9} pointerEvents="none" />}
              {!dotGrid && geography.map(({ shape, d, point, key }, index) => {
                const hint = countryHint(shape, ...point);
                const current = hover?.lines[0] === hint.lines[0] || !hover && focus === key;
                const fill = current ? "var(--chart-2)" : countryFill(shape);
                return <path key={shape.id ?? index} data-map-location={countryInteractive ? key : undefined} className={isGlobe && loading ? "stat-load" : isGlobe && loadingExample ? "stat-globe-reveal" : undefined} d={d} fill={fill} fillOpacity={pointerCamera && !current ? .68 : 1} stroke="var(--background)" strokeWidth={isGlobe ? .47 : .57}
                  onPointerEnter={countryInteractive ? () => !drag.current?.active && point.every(Number.isFinite) && setHover(hint) : undefined}
                  onPointerLeave={countryInteractive ? () => setHover(null) : undefined}
                  onClick={countryInteractive && camera && point.every(Number.isFinite) ? (event) => clickTarget(event, key, point) : undefined}
                />;
              })}
              {dotGrid && <g pointerEvents="none" aria-hidden="true">{dots.map(({ x, y, country }, index) => {
                const value = country === null ? 0 : countriesValues.get(country) ?? 0;
                const highlighted = country !== null && (selected === `country:${country}` || active?.lines[0] === country);
                return <circle key={index} className={country === null ? "stat-ocean-dot" : "stat-land-dot"} cx={x} cy={y}
                  r={country === null ? 1.05 : selected ? 1.85 : 1.55}
                  fill={highlighted || value > 0 ? "var(--chart-1)" : "var(--muted-foreground)"}
                  opacity={country === null ? selected ? .018 : .065 : highlighted ? 1 : value > 0 ? .37 + .58 * value / valueExtent : .29} />;
              })}</g>}
              {dotGrid && countryInteractive && geography.map(({ shape, d, point, key }, index) => <path key={shape.id ?? index} data-map-location={key} d={d} fill="transparent"
                onPointerEnter={() => !drag.current?.active && point.every(Number.isFinite) && setHover(countryHint(shape, ...point))} onPointerLeave={() => setHover(null)}
                onClick={point.every(Number.isFinite) ? (event) => clickTarget(event, key, point) : undefined} />)}
              {(loading ? visibleRoutes.slice(0, 8) : visibleRoutes).map(({ route, d, hint, key }, index) => (
                <g key={key}>
                  <path data-route={route.label} className={loading ? "stat-load" : loadingExample ? "stat-route-reveal" : undefined} style={{ "--stat-delay": `${index * 41}ms` } as CSSProperties} pathLength={loadingExample && !loading ? 1 : undefined} d={d} fill="none" fillOpacity={0} stroke={categoryColor(route.category)} strokeWidth={1 + 2.3 * route.value / routeMaximum} opacity={active && active !== hint ? .24 : .82} />
                  {!compact && !loading && <path d={d} fill="none" stroke="transparent" strokeWidth="12" onPointerEnter={() => setHover(hint)} onPointerLeave={() => setHover(null)} />}
                </g>
              ))}
              {(loading ? screenAirports.slice(0, 8) : screenAirports).map(({ key, at: [x, y], hint }) => <g key={key}
                onPointerEnter={!compact && !loading ? () => setHover(hint) : undefined} onPointerLeave={!compact ? () => setHover(null) : undefined}>
                <circle data-airport={hint.lines[0]} className={loading ? "stat-load" : undefined} cx={x} cy={y} r={active === hint ? 5 : 3.5} fill="var(--foreground)" stroke="var(--background)" strokeWidth=".8" />
                {!compact && !loading && <circle cx={x} cy={y} r="9" fill="transparent" />}
              </g>)}
              {screenMarkers.map((marker) => {
                const { x, y, radius, hint, key, index, category, label } = marker;
                const color = categoryMode ? categoryColor(category) : `var(--chart-${sized && isGlobe || region || markersMode ? 2 : 1})`;
                const current = active?.lines[0] === label || selected === key;
                return <g key={key} data-map-location={key} data-marker-value={marker.value} transform={`translate(${x} ${y})`}
                  opacity={active && !current && chart !== "choropleth" ? .48 : 1}
                  onPointerEnter={!compact && !loading ? () => !drag.current?.active && setHover(hint) : undefined} onPointerLeave={!compact ? () => setHover(null) : undefined}
                  onClick={!compact && camera ? (event) => clickTarget(event, key, [x, y]) : undefined}
                >
                  {markersMode && (pointerCamera || dotGrid || !index) && !compact && <circle className="stat-map-pulse" r={radius + 3} fill="none" stroke={color} strokeWidth="1.5" />}
                  {markersMode ? pointerCamera
                    ? <><path d="M0 6C-2 3-5 0-5-3a5 5 0 0 1 10 0C5 0 2 3 0 6Z" fill={color} stroke="var(--background)" strokeWidth=".85" /><circle cy="-3" r="1.6" fill="var(--background)" /></>
                    : <g fill={color} stroke="var(--chart-2)">{drawMarker(camera ? 0 : index, radius)}</g>
                    : <circle className={loading ? "stat-load" : loadingExample ? "stat-bubble-reveal" : undefined} style={{ "--stat-delay": `${index * 31}ms` } as CSSProperties} r={current && !sized ? radius + 2 : radius} fill={color} fillOpacity={sized ? .52 : .82} stroke="var(--background)" strokeWidth={current ? 2 : 1.1} />}
                  {markersMode && !pointerCamera && !dotGrid && <text className="stat-axis" y={-radius - 6} textAnchor="middle" paintOrder="stroke" stroke="var(--background)" strokeWidth="2">{label}</text>}
                </g>;
              })}
            </g>
          </g>
        </svg>
        {!compact && loading && <div className="stat-loading-label" role="status">Loading {isBubble ? "cities" : isRoute ? "routes" : "regions"}</div>}
        {!compact && displayHint && <div className="stat-hint" role="status" style={{ left: `${Math.min(83, Math.max(17, displayHint.x * 100 / WIDTH))}%`, top: `${Math.min(89, Math.max(22, displayHint.y * 100 / mapHeight))}%` }}>
          {displayHint.lines.map((line, index) => <div key={index}>{line}</div>)}
        </div>}
      </div>
      {categoryMode && groups.length > 0 && <Legend entries={groups.map((name) => ({ name, color: categoryColor(name) }))} active={groups.filter((name) => !hidden.includes(name))} onToggle={compact ? undefined : (name) => setHidden((current) => current.includes(name) ? current.filter((n) => n !== name) : [...current, name])} />}
      {showBubbleScale && <div className="stat-legend" aria-label="Bubble size scale">
        <strong>{data ? "Value" : markerMetric}</strong>
        {sizeKeys.map((value) => <span key={value}><i style={{ width: Math.sqrt(value / markerMaximum) * 14, height: Math.sqrt(value / markerMaximum) * 14, borderRadius: "50%", background: "var(--chart-1)", opacity: .6 }} />{value >= 1000 ? compactMetric.format(value).toLowerCase() : format.format(value)}</span>)}
      </div>}
      {countryValueMode && !camera && <Legend entries={[{ name: "No data", color: "var(--muted)" }, { name: "Low", color: "color-mix(in srgb, var(--chart-1) 24%, var(--muted))" }, { name: "High", color: "var(--chart-1)" }]} />}
    </div>
  );
}

interface Vector {
  at: Coordinate;
  direction: number;
  speed: number;
  label: string;
}

const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const windThresholds = [1, 4.2, 9.4];
const windColors = ["25%", "44%", "66%", "100%"].map((intensity) => `color-mix(in srgb, var(--chart-1) ${intensity}, var(--muted-foreground))`);
const degrees = (value: number, minus: string, plus: string) => `${format.format(Math.abs(value))}°${value < 0 ? minus : plus}`;

function getVectors(data: DemoProps["data"], stations: boolean): Vector[] {
  if (data?.rows) return rows(data).flatMap((row, index) => {
    const at = coord(row.lon, row.lat);
    const direction = number(row.direction);
    const speed = number(row.speed);
    return at && direction !== undefined && speed !== undefined ? [{ at, direction, speed: Math.max(0, speed), label: string(row.label) ?? `Station ${index + 1}` }] : [];
  });
  if (stations) return [
    [4, 9, "Marina"], [8, 12, "Harbor"], [8, 19, "Pier"], [10, 24, "West Park"], [12, 7, "Depot"], [12, 32, "University"],
    [15, 16, "Stadium"], [16, 22, "Library"], [17, 33, "Northgate"], [19, 40, "Lake"], [21, 9, "Terminal"], [22, 17, "Orchard"],
    [23, 27, "Meadow"], [24, 42, "Reservoir"], [26, 13, "Museum"], [27, 22, "Canyon"], [28, 36, "Ridge"], [30, 27, "Summit"],
    [32, 12, "Quarry"], [33, 40, "Valley"], [35, 18, "Airport"], [37, 31, "Bridge"], [40, 23, "Foothills"], [42, 41, "East Hill"],
  ].map(([x, y, label], index) => ({ at: [Number(x), Number(y)], direction: label === "Summit" ? 275 : label === "Harbor" ? 245 : label === "Stadium" ? 270 : 218 + index * 3,
    speed: label === "Summit" ? 21 : label === "Harbor" ? 9 : label === "Stadium" ? 11 : 6 + (index * 7 % 14), label: String(label) }));
  const random = createRandom(82421);
  const out: Vector[] = [];
  for (let col = 0; col < 17; col++) {
    for (let row = 0; row < 11; row++) {
      const lon = -15 + col * 2.5;
      const lat = 60 - row * 2.5;
      const low = Math.hypot((lon - 2.5) * .71, lat - 52.5);
      const strongest = lon === 2.5 && lat === 52.5;
      const bearing = (Math.atan2(lat - 55, lon - 5) * 180 / Math.PI + 122 + 360) % 360;
      out.push({ at: [lon, lat], direction: strongest ? 124 : bearing, speed: strongest ? 16.64 : Math.max(1.04, Math.min(16.2, 4.1 + 9 * Math.exp(-low / 8.3) + random() * 3.9)),
        label: `${degrees(lon, "W", "E")}, ${degrees(lat, "S", "N")}` });
    }
  }
  return out;
}

export function VectorField({ example, compact, data }: DemoProps) {
  const id = useId().replaceAll(":", "");
  const { loading, button } = useVariantLoading(example.id);
  const [active, setActive] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const stations = example.id === "vector-field-stations";
  const loadingExample = example.id === "vector-field-loading";
  const vectors = useMemo(() => getVectors(data, stations), [data, stations]);
  const model = useMemo(() => {
    const projection = geoMercator().translate(center).scale(110).clipExtent([[0, 0], [WIDTH, mapHeight]]);
    fitToSites(projection, vectors.map(({ at }) => at));
    const path = geoPath(projection);
    const d = data ? path(land) : undefined;
    const x = linear(stations ? [0, 48] : [-16.5, 26.5], [PLOT.left, PLOT.right]);
    const y = linear(stations ? [0, 53] : [33.5, 61.5], [PLOT.bottom, PLOT.top]);
    const max = Math.max(1, ...vectors.map(({ speed }) => speed));
    const marks = vectors.map((vector) => {
      const [px, py] = data ? projection(vector.at) ?? center : [x(vector.at[0]), y(vector.at[1])];
      const length = 4 + vector.speed / max * 21;
      const direction = ((vector.direction % 360) + 360) % 360;
      const bearing = (direction - 90) * Math.PI / 180;
      const dx = Math.cos(bearing) * length;
      const dy = Math.sin(bearing) * length;
      const speed = `${format.format(vector.speed)} ${!data && stations ? "km/h" : "m/s"}`;
      const hint = { x: px, y: py, lines: stations && !data ? [vector.label, `${speed} toward ${format.format(direction)}°`] : [vector.label, `Speed: ${speed}`, `Direction: ${compass[Math.round(direction / 45) % 8]} ${Math.round(direction)}°`] };
      const bucket = windThresholds.findIndex((threshold) => vector.speed < threshold);
      return { x: px, y: py, dx, dy, hint, color: stations ? "var(--chart-2)" : windColors[bucket < 0 ? 3 : bucket] };
    });
    return { d, x, y, marks };
  }, [data, stations, vectors]);
  const placeholders = loading && !data ? Array.from({ length: 325 }, (_, i) => {
    const x = PLOT.left + (i % 25 + .5) * (PLOT.right - PLOT.left) / 25;
    const y = PLOT.top + (Math.floor(i / 25) + .5) * (PLOT.bottom - PLOT.top) / 13;
    return { x, y, dx: 0, dy: 0, color: "var(--muted-foreground)", hint: { x, y, lines: [] } };
  }) : model.marks;
  const xTicks = stations ? [0, 10, 20, 30, 40] : [-10, 0, 10, 20];
  const yTicks = stations ? [0, 10, 20, 30, 40, 50] : [35, 40, 45, 50, 55, 60];
  const index = hover ?? active;
  const hint = index === null || loading ? undefined : model.marks[index]?.hint;
  return (
    <div className={`stat-demo stat-map ${compact ? "stat-compact" : ""}`}>
      {!compact && button && <div className="stat-controls">{button}</div>}
      <div className="stat-frame">
        <svg className={`stat-svg ${loading ? "stat-loading" : ""}`} viewBox={`0 0 ${WIDTH} ${mapHeight}`} role="img" aria-label={example.title} aria-busy={loading || undefined}
          tabIndex={compact || loading || !vectors.length ? undefined : 0}
          onFocus={() => setActive(0)} onBlur={() => setActive(null)}
          onKeyDown={(event) => {
            const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setActive(null); setHover(null); return; }
            if (step === undefined && event.key !== "Home" && event.key !== "End") return;
            event.preventDefault();
            setHover(null);
            setActive(event.key === "Home" ? 0 : event.key === "End" ? vectors.length - 1 : ((active ?? 0) + (step ?? 0) + vectors.length) % vectors.length);
          }}>
          <defs>
            <clipPath id={`${id}-vector-clip`}><rect width={WIDTH} height={mapHeight} rx="9" /></clipPath>
            <marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 1L9 5 0 9" fill="none" stroke="context-stroke" strokeWidth="1.6" /></marker>
          </defs>
          {!data && <Grid x={xTicks.map(model.x)} xLabels={xTicks.map((value) => stations ? `${value} km` : degrees(value, "W", "E"))} y={yTicks.map(model.y)} yLabels={yTicks.map((value) => stations ? `${value} km` : degrees(value, "S", "N"))} hideVertical={!stations} />}
          <g clipPath={`url(#${id}-vector-clip)`}>
            {model.d && <path d={model.d} fill="color-mix(in srgb, var(--chart-1) 13%, var(--muted))" stroke="var(--background)" strokeWidth="1" />}
            {!vectors.length && <text className="stat-axis" x={center[0]} y={center[1]} textAnchor="middle">No data to display</text>}
            {placeholders.map(({ x, y, dx, dy, color, hint: pointHint }, i) => {
              const a = Math.atan2(y - center[1], x - center[0]) + Math.PI / 2;
              const endX = x + (loading ? 10 * Math.cos(a) : dx);
              const endY = y + (loading ? 10 * Math.sin(a) : dy);
              const line = `M${x} ${y}L${endX} ${endY}`;
              return <g key={i} opacity={index === i ? 1 : hint ? .38 : .88}>
                <path data-vector={pointHint.lines[0] ?? "placeholder"} className={loading ? "stat-load" : loadingExample ? "stat-vector-reveal" : undefined} style={{ "--stat-delay": `${Math.max(0, x - PLOT.left) * .63}ms` } as CSSProperties} d={line} fill="none" fillOpacity={0} stroke={color} strokeWidth={index === i ? 2.3 : 1.45} markerEnd={`url(#${id}-arrow)`} />
                {!compact && !loading && <path d={line} fill="none" stroke="transparent" strokeWidth="13" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />}
              </g>;
            })}
          </g>
        </svg>
        {!compact && loading && <div className="stat-loading-label" role="status">Loading wind</div>}
        {!compact && hint && <div className="stat-hint" role="status" style={{ left: `${Math.min(83, Math.max(17, hint.x * 100 / WIDTH))}%`, top: `${Math.min(89, Math.max(22, hint.y * 100 / mapHeight))}%` }}>
          {hint.lines.map((line, index) => <div key={index}>{line}</div>)}
        </div>}
      </div>
      {!data && !stations && !loading && <Legend entries={["0.0 m/s–1.0 m/s", "1.0 m/s–4.2 m/s", "4.2 m/s–9.4 m/s", "9.4 m/s+"].map((name, i) => ({ name, color: windColors[i] }))} />}
    </div>
  );
}
