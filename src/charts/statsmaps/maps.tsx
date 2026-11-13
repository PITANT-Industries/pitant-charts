import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  geoCentroid, geoContains, geoGraticule, geoInterpolate, geoMercator,
  geoNaturalEarth1, geoOrthographic, geoPath, type GeoProjection,
} from "d3-geo";
import { feature, merge } from "topojson-client";
import type { GeometryCollection, Topology, Polygon as TopoPolygon, MultiPolygon as TopoMultiPolygon } from "topojson-specification";
import type { Feature, FeatureCollection, LineString, MultiPolygon, Polygon } from "geojson";
import countries from "world-atlas/countries-110m.json";
import {
  HEIGHT, Legend, WIDTH, createRandom, format, number, rows, string, useVariantLoading,
  type DemoProps, type HoverInfo,
} from "./primitives";

type Coordinate = [number, number];
type CountryProperties = { name?: string };
type World = Topology<{ countries: GeometryCollection<CountryProperties> }>;
type Country = Feature<Polygon | MultiPolygon, CountryProperties>;
type Rotation = [number, number];
const atlas = countries as unknown as World;
const world = feature(atlas, atlas.objects.countries) as FeatureCollection<Polygon | MultiPolygon, CountryProperties>;
const land = merge(atlas, atlas.objects.countries.geometries.filter((shape): shape is TopoPolygon<CountryProperties> | TopoMultiPolygon<CountryProperties> => (shape.type === "Polygon" || shape.type === "MultiPolygon") && shape.id !== "010"));
const mapHeight = HEIGHT;
const center: Coordinate = [WIDTH / 2, mapHeight / 2];

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

interface Marker {
  at: Coordinate;
  label: string;
  value: number;
  category: string;
}

interface Route {
  from: Coordinate;
  to: Coordinate;
  label: string;
  value: number;
  category: string;
}

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

function getMarkers(data: DemoProps["data"], region: boolean, kind: string): Marker[] {
  if (data?.rows) return rows(data).flatMap((row, i) => {
    const at = coord(row.lon, row.lat);
    if (!at) return [];
    return [{ at, label: string(row.label) ?? `Location ${i + 1}`, value: Math.max(0, number(row.value) ?? 1), category: string(row.category) ?? "Locations" }];
  });
  const mapSites = ["Berlin", "Tokyo", "Sydney", "New York", "São Paulo"];
  const globeSites = ["Berlin", "Dublin", "Tokyo", "Singapore", "Sydney", "New York", "Los Angeles", "São Paulo", "Cape Town", "Dubai"];
  const filtered = region ? cities.filter((city) => city[3] === 0) : kind === "globe" ? cities.filter(([name]) => globeSites.includes(name)) : kind === "markers" ? cities.filter(([name]) => mapSites.includes(name)) : cities;
  return filtered.map(([label, lon, lat, region], index) => ({ at: [lon, lat], label, value: 20 + (31 * index) % 109, category: continents[region] }));
}

function getRoutes(data: DemoProps["data"], regional: boolean): Route[] {
  if (data?.rows) return rows(data).flatMap((row, index) => {
    const from = coord(row.fromLon, row.fromLat);
    const to = coord(row.toLon, row.toLat);
    if (!from || !to) return [];
    return [{ from, to, label: string(row.label) ?? `Route ${index + 1}`, value: Math.max(0, number(row.value) ?? 1), category: string(row.category) ?? "Routes" }];
  });
  const city = (name: string) => cities.find(([n]) => n === name)!;
  const connections = regional
    ? [["Los Angeles", "New York"], ["Los Angeles", "Chicago"], ["Seattle", "Dallas"], ["Seattle", "New York"], ["Dallas", "New York"], ["Dallas", "Miami"], ["Chicago", "Miami"], ["Chicago", "New York"], ["Chicago", "Seattle"]]
    : [["New York", "London"], ["New York", "São Paulo"], ["New York", "Los Angeles"], ["London", "Cape Town"], ["London", "Berlin"], ["London", "Dubai"], ["Tokyo", "Seattle"], ["Tokyo", "Sydney"], ["Tokyo", "Singapore"], ["Dubai", "Tokyo"], ["Dubai", "Mumbai"], ["Dubai", "Nairobi"]];
  return connections.map(([fromName, toName], index) => {
    const [, a, b] = city(fromName);
    const [, c, d] = city(toName);
    return { from: [a, b], to: [c, d], label: `${fromName} → ${toName}`, value: 80 + index * 97 % 510, category: regional ? ["Pacific Air", "NorthStar", "Continental"][Math.floor(index / 3)] : fromName };
  });
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

const dotCache = new Map<number, Coordinate[]>();
const dotBackdrop = geoOrthographic().translate(center).scale(153).rotate([-13, -23]);
function dotPoints(step: number) {
  const existing = dotCache.get(step);
  if (existing) return existing;
  const lattice = geoNaturalEarth1().fitExtent([[20, 12], [WIDTH - 20, mapHeight - 12]], { type: "Sphere" });
  const result: Coordinate[] = [];
  for (let y = 3; y < mapHeight; y += step * .86) {
    for (let x = Math.floor(y / (step * .86)) % 2 * step / 2; x < WIDTH; x += step) {
      const at = lattice.invert?.([x, y]);
      if (at && Math.abs(at[0]) <= 180 && Math.abs(at[1]) <= 82 && geoContains(land, at)) result.push(at);
    }
  }
  dotCache.set(step, result);
  return result;
}

const initialPan = { x: 0, y: 0, scale: 1 };
const countryNames: Record<string, number> = { Germany: 81, France: 69, Spain: 39, Canada: 49, "United States of America": 91, Brazil: 64, Japan: 74, Australia: 47, India: 87, Norway: 26, "United Kingdom": 82, Sweden: 52, Finland: 24, Mexico: 61, Italy: 57, Netherlands: 60, Argentina: 36, Indonesia: 29, "South Africa": 23 };

export function GeoMap({ example, compact, data }: DemoProps) {
  const id = useId().replaceAll(":", "");
  const { loading, button } = useVariantLoading(example.id);
  const chart = example.family;
  const isGlobe = chart === "globe";
  const dotGrid = example.id === "choropleth-dot-grid";
  const pointerCamera = example.id === "choropleth-pointer-camera";
  const rotating = isGlobe || dotGrid || pointerCamera;
  const clickZoom = example.id === "choropleth-click-to-zoom";
  const backgrounds = example.id === "choropleth-background";
  const patterns = example.id === "choropleth-patterns";
  const graticule = example.id === "choropleth-graticule";
  const markersMode = example.id === "choropleth-markers" || clickZoom || pointerCamera;
  const categoryMode = example.id === "bubble-map-categories" || example.id === "route-map-region";
  const sized = example.id === "globe-sized" || chart === "bubble-map";
  const region = example.id.endsWith("-region");
  const [pan, setPan] = useState(initialPan);
  const [rotation, setRotation] = useState<Rotation>(() => isGlobe && sized ? [92, -23] : [-13, -23]);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [cameraTarget, setCameraTarget] = useState<Rotation | null>(null);
  const frame = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; initialX: number; initialY: number; active: boolean } | null>(null);
  const markers = useMemo(() => chart === "bubble-map" || isGlobe || markersMode
    ? getMarkers(data, region, markersMode ? "markers" : chart)
    : [], [chart, isGlobe, markersMode, data, region]);
  const routes = useMemo(() => chart === "route-map" ? getRoutes(data, region) : [], [chart, data, region]);
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
  useEffect(() => {
    if (!cameraTarget) return;
    const from: Rotation = [...rotation];
    const deltaLon = ((cameraTarget[0] - from[0] + 540) % 360) - 180;
    const deltaLat = cameraTarget[1] - from[1];
    const began = performance.now();
    let raf = 0;
    const animate = (now: number) => {
      const t = Math.min(1, (now - began) / 430);
      const progress = 1 - (1 - t) ** 3;
      setRotation([from[0] + deltaLon * progress, from[1] + deltaLat * progress]);
      if (t < 1) raf = requestAnimationFrame(animate);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setRotation(cameraTarget);
    else raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
    // Rotation changes during the transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraTarget]);
  const projection = useMemo(() => {
    if (rotating) return geoOrthographic().translate(center).scale(dotGrid ? 155 : pointerCamera ? 153 : 144).rotate([rotation[0], rotation[1], dotGrid ? -10 : 0]).clipAngle(90);
    const project = region
      ? geoMercator().translate(center).scale(111)
      : geoNaturalEarth1().fitExtent([[18, 10], [WIDTH - 18, mapHeight - 8]], { type: "Sphere" });
    if (region) fitToSites(project, [...markers.map(({ at }) => at), ...routes.flatMap(({ from, to }) => [from, to])]);
    project.clipExtent([[0, 0], [WIDTH, mapHeight]]);
    return project;
  }, [rotating, dotGrid, pointerCamera, rotation, region, markers, routes]);
  const path = geoPath(projection);
  const geography = useMemo(() => {
    const projectPath = geoPath(projection);
    return world.features.filter((shape) => shape.id !== "010").flatMap((shape) => {
      const d = projectPath(shape);
      if (!d) return [];
      return [{ shape, d, point: projectPath.centroid(shape) }];
    });
  }, [projection]);
  const dots = dotGrid || pointerCamera ? dotPoints(compact ? 9 : 6.5) : [];
  const dotProjection = pointerCamera ? dotBackdrop : projection;
  const showDots = dots.flatMap((at) => {
    const screen = dotProjection(at);
    return screen && visibleOnGlobe(dotProjection, at) ? [screen] : [];
  });
  const showCountries = !dotGrid;
  const countryInteractive = !compact && !loading && chart === "choropleth" && !pointerCamera;
  const routePath = ({ from, to }: Route) => {
    const interpolate = geoInterpolate(from, to);
    const curve: LineString = { type: "LineString", coordinates: Array.from({ length: 32 }, (_, i) => interpolate(i / 31)) };
    return path(curve) ?? "";
  };
  const routeColors = [...new Set(routes.map(({ category }) => category))];
  const markerColors = [...new Set(markers.map(({ category }) => category))];
  const groups = chart === "route-map" ? routeColors : markerColors;
  const showMarker = (marker: Marker) => !rotating || visibleOnGlobe(projection, marker.at);
  const markerMaximum = Math.max(1, ...markers.map(({ value }) => value));
  const routeMaximum = Math.max(1, ...routes.map(({ value }) => value));
  const screenMarkers = markers.flatMap((marker, index) => {
    const position = projection(marker.at);
    if (!position || !showMarker(marker) || hidden.includes(marker.category)) return [];
    const [x, y] = position;
    const radius = sized ? Math.max(2.7, Math.sqrt(marker.value / markerMaximum) * (chart === "bubble-map" ? 14 : 10)) : 4.8;
    return [{ ...marker, index, x, y, radius, hint: { x, y, lines: [marker.label, categoryMode ? marker.category : "", sized ? `Value: ${format.format(marker.value)}` : ""].filter(Boolean) } }];
  });
  const visibleRoutes = routes.filter(({ category }) => !hidden.includes(category)).flatMap((route) => {
    const d = routePath(route);
    if (!d) return [];
    const [x, y] = projection(geoInterpolate(route.from, route.to)(.5)) ?? center;
    return [{ route, d, hint: { x, y, lines: [route.label, categoryMode ? route.category : "", `Passengers: ${format.format(route.value)}`].filter(Boolean) } }];
  });
  const transformHint = (hint: HoverInfo) => !rotating ? { ...hint, x: hint.x * pan.scale + pan.x, y: hint.y * pan.scale + pan.y } : hint;
  const valueExtent = Math.max(1, ...countriesValues.values());
  const countryValueMode = example.id === "choropleth-values" || backgrounds;
  const countryHint = (shape: Country, x: number, y: number): HoverInfo => {
    const name = shape.properties.name ?? String(shape.id ?? "Country");
    const value = countriesValues.get(name) ?? 0;
    return { x, y, lines: [name, countryValueMode ? `Value: ${format.format(value)}` : ""].filter(Boolean) };
  };
  const hints = [
    ...screenMarkers.map(({ hint }) => hint),
    ...visibleRoutes.map(({ hint }) => hint),
    ...(countryInteractive ? geography.filter(({ point }) => point.every(Number.isFinite)).map(({ shape, point }) => countryHint(shape, ...point)) : []),
  ];
  const active = loading ? null : hover ?? (focus === null ? null : hints[focus]) ?? null;
  const pointInFrame = (event: PointerEvent<SVGSVGElement>) => screenToMap(event.currentTarget, event.clientX, event.clientY);
  const reset = () => {
    setPan(initialPan);
    setRotation(isGlobe && sized ? [92, -23] : [-13, -23]);
    setCameraTarget(null);
    setSelected(null);
    setHover(null);
    setFocus(null);
  };
  const rotateTo = (position: Coordinate) => setCameraTarget([-position[0], -position[1]]);
  const zoomAt = (point: Coordinate) => {
    setPan({ scale: 2.25, x: center[0] - point[0] * 2.25, y: center[1] - point[1] * 2.25 });
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (compact || loading) return;
    const [x, y] = pointInFrame(event);
    if (pointerCamera && !drag.current) {
      setRotation([(x / WIDTH - .5) * 110 - 12, (.5 - y / mapHeight) * 48 - 20]);
      return;
    }
    if (!drag.current) return;
    const dx = x - drag.current.x;
    const dy = y - drag.current.y;
    if (!drag.current.active && Math.hypot(dx, dy) <= 4) return;
    if (!drag.current.active) {
      drag.current.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setHover(null);
    }
    if (rotating) setRotation([drag.current.initialX + dx * .43, Math.max(-85, Math.min(85, drag.current.initialY - dy * .43))]);
    else setPan((prev) => ({ ...prev, x: drag.current!.initialX + dx, y: drag.current!.initialY + dy }));
  };
  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      reset();
      return;
    }
    const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (direction === undefined && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    if (rotating && event.shiftKey && direction !== undefined) {
      setRotation(([x, y]) => event.key === "ArrowRight" || event.key === "ArrowLeft" ? [x + direction * 10, y] : [x, Math.max(-85, Math.min(85, y + direction * 10))]);
      return;
    }
    if (!hints.length) return;
    setHover(null);
    setFocus(event.key === "Home" ? 0 : event.key === "End" ? hints.length - 1 : ((focus ?? 0) + (direction ?? 0) + hints.length) % hints.length);
  }
  useEffect(() => {
    if (compact || rotating || loading || !frame.current) return;
    const svg = frame.current;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const [x, y] = screenToMap(svg, event.clientX, event.clientY);
      setPan((prev) => {
        const scale = Math.min(7, Math.max(1, prev.scale * Math.exp(-event.deltaY * .0017)));
        return { scale, x: x - (x - prev.x) * scale / prev.scale, y: y - (y - prev.y) * scale / prev.scale };
      });
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [compact, rotating, loading]);
  const controls = <>
    {button}
    {!loading && <button className="stat-control" type="button" onClick={reset}>Reset view</button>}
  </>;
  const displayHint = active && transformHint(active);
  const tilt = clickZoom && selected ? " skewX(-6deg) scaleY(.91)" : "";
  const categoryColor = (name: string) => `var(--chart-${groups.indexOf(name) % 8 + 1})`;
  const countryFill = (shape: Country) => {
    const label = shape.properties.name ?? "";
    if (selected === label) return "var(--chart-2)";
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
    return "color-mix(in srgb, var(--chart-1) 17%, var(--muted))";
  };
  return (
    <div className={`stat-demo stat-map ${compact ? "stat-compact" : ""}`}>
      {!compact && <div className="stat-controls">{controls}</div>}
      <div className="stat-frame">
        <svg ref={frame} className={`stat-svg stat-map-svg ${compact ? "" : "stat-map-pan"} ${loading ? "stat-loading" : ""}`} viewBox={`0 0 ${WIDTH} ${mapHeight}`} role="img" aria-label={example.title} aria-busy={loading || undefined}
          tabIndex={compact || loading ? undefined : 0} onKeyDown={onKeyDown} onBlur={() => setFocus(null)}
          onPointerMove={move}
          onPointerDown={(event) => {
            if (compact || loading || event.button !== 0) return;
            const [x, y] = pointInFrame(event);
            setCameraTarget(null);
            drag.current = { x, y, initialX: rotating ? rotation[0] : pan.x, initialY: rotating ? rotation[1] : pan.y, active: false };
          }}
          onPointerUp={() => { if (drag.current) drag.current = null; }}
          onPointerCancel={() => { drag.current = null; setHover(null); }}
          onPointerLeave={() => { if (!drag.current?.active) drag.current = null; setHover(null); }}
        >
          <defs>
            <clipPath id={`${id}-bounds`}><rect width={WIDTH} height={mapHeight} rx="9" /></clipPath>
            <pattern id={`${id}-market`} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="var(--muted)" /><path d="M0 0v6" stroke="var(--chart-2)" strokeWidth="2" /></pattern>
            <pattern id={`${id}-backdrop`} width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><path d="M0 0v10" stroke="var(--border)" strokeWidth="1" /></pattern>
            <radialGradient id={`${id}-ocean`} cx="36%" cy="31%" r="70%"><stop stopColor="var(--chart-1)" stopOpacity=".09" /><stop offset="90%" stopColor="var(--chart-1)" stopOpacity=".015" /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity=".13" /></radialGradient>
          </defs>
          {backgrounds && <rect width={WIDTH} height={mapHeight} fill={`url(#${id}-backdrop)`} />}
          {rotating && <circle className={loading ? "stat-load" : undefined} cx={center[0]} cy={center[1]} r={projection.scale()} fill={`url(#${id}-ocean)`} stroke="var(--border)" />}
          <g clipPath={`url(#${id}-bounds)`}>
            <g className={clickZoom ? "stat-map-viewport" : undefined} style={rotating ? undefined : { transform: `translate(${pan.x}px,${pan.y}px) scale(${pan.scale})${tilt}` }}>
              {(graticule || isGlobe || pointerCamera) && <path d={path(geoGraticule().step([10, 10])()) ?? undefined} fill="none" stroke="var(--border)" strokeWidth=".7" opacity=".9" />}
              {showCountries && geography.map(({ shape, d, point }, index) => {
                const name = shape.properties.name ?? "";
                const hint = countryHint(shape, ...point);
                const fill = hover?.lines[0] === name ? "var(--chart-2)" : countryFill(shape);
                return <path key={shape.id ?? index} className={loading ? "stat-load" : undefined} d={d} fill={fill} fillOpacity={pointerCamera ? .27 : 1} stroke="var(--background)" strokeWidth={rotating ? .47 : .57}
                  onPointerEnter={countryInteractive ? () => !drag.current?.active && point.every(Number.isFinite) && setHover(hint) : undefined}
                  onPointerLeave={countryInteractive ? () => setHover(null) : undefined}
                  onClick={countryInteractive && clickZoom ? () => { zoomAt(point); setSelected(name); } : undefined}
                />;
              })}
              {(dotGrid || pointerCamera) && showDots.map(([x, y], index) => <circle key={index} cx={x} cy={y} r={dotGrid ? 1.7 : 1.05} fill="var(--chart-1)" opacity={dotGrid ? .65 : .3} />)}
              {dotGrid && !compact && geography.map(({ shape, d, point }, index) => <path key={shape.id ?? index} d={d} fill="transparent"
                onPointerEnter={() => point.every(Number.isFinite) && setHover(countryHint(shape, ...point))} onPointerLeave={() => setHover(null)}
                onClick={() => { rotateTo(geoCentroid(shape)); setSelected(shape.properties.name ?? null); }} />)}
              {visibleRoutes.map(({ route, d, hint }, index) => (
                <g key={index}>
                  <path className={loading ? "stat-load" : undefined} d={d} fill="none" fillOpacity={0} stroke={categoryColor(route.category)} strokeWidth={1 + 2.3 * route.value / routeMaximum} opacity={active && active !== hint ? .24 : .82} />
                  {!compact && !loading && <path d={d} fill="none" stroke="transparent" strokeWidth="12" onPointerEnter={() => setHover(hint)} onPointerLeave={() => setHover(null)} />}
                  {[route.from, route.to].map((at, end) => {
                    const [x, y] = projection(at) ?? [-10, -10];
                    return <circle className={loading ? "stat-load" : undefined} key={end} cx={x} cy={y} r="2.4" fill={categoryColor(route.category)} />;
                  })}
                </g>
              ))}
              {screenMarkers.map((marker) => {
                const { x, y, radius, hint, index, category, label } = marker;
                const color = categoryMode ? categoryColor(category) : `var(--chart-${chart === "bubble-map" ? 1 : 2})`;
                return <g key={index} transform={`translate(${x} ${y})`} className={loading ? "stat-load" : undefined}
                  opacity={active && active !== hint && chart !== "choropleth" ? .48 : 1}
                  onPointerEnter={!compact && !loading ? () => setHover(hint) : undefined} onPointerLeave={!compact ? () => setHover(null) : undefined}
                  onClick={!compact && clickZoom ? () => { zoomAt([x, y]); setSelected(label); } : undefined}
                >
                  {markersMode && (pointerCamera || !index) && !compact && <circle className="stat-map-pulse" r={radius + 3} fill="none" stroke={color} strokeWidth="1.5" />}
                  {markersMode ? <g fill={color} stroke="var(--chart-2)">{drawMarker(index, radius)}</g>
                    : <circle className={loading ? "stat-load" : undefined} r={active === hint ? radius + 2 : radius} fill={color} fillOpacity={sized ? .5 : .75} stroke={color} strokeWidth="1.2" />}
                  {markersMode && !pointerCamera && <text className="stat-axis" y={-radius - 6} textAnchor="middle" paintOrder="stroke" stroke="var(--background)" strokeWidth="2">{label}</text>}
                </g>;
              })}
            </g>
          </g>
        </svg>
        {!compact && displayHint && <div className="stat-hint" role="status" style={{ left: `${Math.min(83, Math.max(17, displayHint.x * 100 / WIDTH))}%`, top: `${Math.min(89, Math.max(22, displayHint.y * 100 / mapHeight))}%` }}>
          {displayHint.lines.map((line, index) => <div key={index}>{line}</div>)}
        </div>}
      </div>
      {categoryMode && groups.length > 0 && <Legend entries={groups.map((name) => ({ name, color: categoryColor(name) }))} active={groups.filter((name) => !hidden.includes(name))} onToggle={compact ? undefined : (name) => setHidden((current) => current.includes(name) ? current.filter((n) => n !== name) : [...current, name])} />}
      {categoryMode && sized && markers.length > 0 && <div className="stat-legend" aria-label="Bubble size scale">
        {[.25, .5, 1].map((fraction) => <span key={fraction}><i style={{ width: Math.sqrt(fraction) * 12, height: Math.sqrt(fraction) * 12, borderRadius: "50%", background: "var(--chart-1)", opacity: .6 }} />{format.format(markerMaximum * fraction)}</span>)}
      </div>}
      {countryValueMode && <Legend entries={[{ name: "No data", color: "var(--muted)" }, { name: "Low", color: "color-mix(in srgb, var(--chart-1) 24%, var(--muted))" }, { name: "High", color: "var(--chart-1)" }]} />}
    </div>
  );
}

interface Vector {
  at: Coordinate;
  direction: number;
  speed: number;
  label: string;
}

function getVectors(data: DemoProps["data"], stations: boolean): Vector[] {
  if (data?.rows) return rows(data).flatMap((row, index) => {
    const at = coord(row.lon, row.lat);
    const direction = number(row.direction);
    const speed = number(row.speed);
    return at && direction !== undefined && speed !== undefined ? [{ at, direction, speed: Math.max(0, speed), label: string(row.label) ?? `Station ${index + 1}` }] : [];
  });
  const random = createRandom(82421);
  const out: Vector[] = [];
  for (let row = 0; row < (stations ? 4 : 10); row++) {
    for (let col = 0; col < (stations ? 6 : 15); col++) {
      const lon = -15 + col * (stations ? 6 : 2.5) + (stations ? (random() - .5) * 6 : 0);
      const lat = 36 + row * (stations ? 6 : 2.5) + (stations ? (random() - .5) * 4 : 0);
      out.push({ at: [lon, lat], direction: 31 + 30 * Math.sin(lon / 8) + 82 * Math.cos(lat / 10), speed: 3 + 14 * random(), label: stations ? `Station ${String(row * 6 + col + 1).padStart(2, "0")}` : `${format.format(lat)}° N, ${format.format(lon)}° E` });
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
  const vectors = useMemo(() => getVectors(data, stations), [data, stations]);
  const model = useMemo(() => {
    const projection = geoMercator().translate(center).scale(110).clipExtent([[0, 0], [WIDTH, mapHeight]]);
    fitToSites(projection, vectors.map(({ at }) => at));
    const path = geoPath(projection);
    const d = path(land);
    const graticule = path(geoGraticule().step([10, 10])());
    const max = Math.max(1, ...vectors.map(({ speed }) => speed));
    const marks = vectors.map((vector) => {
      const [x, y] = projection(vector.at) ?? center;
      const length = 4 + vector.speed / max * 21;
      const bearing = (vector.direction - 90) * Math.PI / 180;
      const dx = Math.cos(bearing) * length;
      const dy = Math.sin(bearing) * length;
      const hint = { x, y, lines: [vector.label, `${format.format(vector.speed)} m/s`, `Direction ${format.format(((vector.direction % 360) + 360) % 360)}°`] };
      return { x, y, dx, dy, hint, opacity: .28 + .68 * vector.speed / max };
    });
    return { d, graticule, marks };
  }, [vectors]);
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
            <marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5 0 10Z" fill={loading ? "var(--muted-foreground)" : "var(--chart-1)"} /></marker>
          </defs>
          <g clipPath={`url(#${id}-vector-clip)`}>
            <path d={model.graticule ?? undefined} fill="none" stroke="var(--border)" strokeWidth=".7" />
            <path d={model.d ?? undefined} fill="color-mix(in srgb, var(--chart-1) 13%, var(--muted))" stroke="var(--background)" strokeWidth="1" />
            {!vectors.length && <text className="stat-axis" x={center[0]} y={center[1]} textAnchor="middle">No data to display</text>}
            {model.marks.map(({ x, y, dx, dy, opacity }, i) => {
              const a = Math.atan2(y - center[1], x - center[0]) + Math.PI / 2;
              const endX = x + (loading ? 10 * Math.cos(a) : dx);
              const endY = y + (loading ? 10 * Math.sin(a) : dy);
              const line = `M${x} ${y}L${endX} ${endY}`;
              return <g key={i} opacity={index === i ? 1 : hint ? .38 : opacity}>
                <path className={loading ? "stat-load" : undefined} d={line} fill="none" fillOpacity={0} stroke="var(--chart-1)" strokeWidth={index === i ? 2.3 : 1.45} markerEnd={`url(#${id}-arrow)`} />
                {stations && <circle cx={x} cy={y} r="2.2" fill="var(--chart-2)" />}
                {!compact && !loading && <path d={line} fill="none" stroke="transparent" strokeWidth="13" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />}
              </g>;
            })}
          </g>
        </svg>
        {!compact && hint && <div className="stat-hint" role="status" style={{ left: `${Math.min(83, Math.max(17, hint.x * 100 / WIDTH))}%`, top: `${Math.min(89, Math.max(22, hint.y * 100 / mapHeight))}%` }}>
          {hint.lines.map((line, index) => <div key={index}>{line}</div>)}
        </div>}
      </div>
    </div>
  );
}
