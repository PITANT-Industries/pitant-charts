import { useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Toggle } from "@ui-sdk/react/toggle";
import { Cloud, PlaneTakeoff, Server, ShoppingBag, Users, Wind } from "lucide-react";
import { geoDistance, geoEqualEarth, geoGraticule, geoInterpolate, geoMercator, geoNaturalEarth1, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import countries from "world-atlas/countries-110m.json";
import { CartesianReadout } from "../cartesian/CartesianFocus";
import { usePlotSize } from "../usePlotSize";
import type { DemoProps } from "./primitives";
import {
  bubbleCategories, bubbleDefault, bubbleLoading, bubblePlaceholders, bubblePlaceholdersNarrow, bubbleRegion,
  globeDefault, globeLoading, globePlaceholders, globeSized,
  routeDefaultAirports, routeDefaultFlights, routeLoadingAirports, routeLoadingFlights,
  routePlaceholderPaths, routePlaceholders, routeRegionAirports, routeRegionFlights, windField, windStations,
  type GeoSite,
} from "./geo-detail-fixtures";
import "./geography-detail.css";

const atlas = countries as unknown as Topology<{ countries: GeometryCollection }>;
const countryShapes = feature(atlas, atlas.objects.countries).features;
const sphere = { type: "Sphere" } as const;
const wholeGrid = geoGraticule().step([20, 20])();
const metric = new Intl.NumberFormat("en");
const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];
const speeds = ["0.0 m/s–1.0 m/s", "1.0 m/s–4.2 m/s", "4.2 m/s–9.4 m/s", "9.4 m/s+"];
const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const skeletonColor = "var(--geo-placeholder)";
type Point = [number, number];

interface Target {
  key: string;
  label: string;
  at: Point;
  entries?: { name: string; color: string; value: string }[];
  bare?: string;
}

const geoTitle = {
  "bubble-map-default": ["Bubble Map", "Monthly active users by city, October 2026", "1,863,800 active users in 30 cities", "New York, London and San Francisco lead"],
  "bubble-map-categories": ["Bubble Map - Categories", "Engineering headcount by office, 2026", "2,440 engineers in 14 offices", "The Americas hold the most, APAC grows fastest"],
  "bubble-map-region": ["Bubble Map - Region", "Orders by city in Europe, Q3 2026", "121,870 orders from 20 cities", "London, Paris and Berlin take two in five"],
  "bubble-map-loading": ["Bubble Map - Loading", "Monthly active users by city, October 2026", "1,262,800 active users in 15 cities", "Turn loading off to grow the bubbles in", "Fetching active users…", "Loading cities"],
  "route-map-default": ["Route Map", "Passengers on our hub routes, October 2026", "83,000 passengers a day on 18 routes", "London to New York is the busiest route"],
  "route-map-region": ["Route Map - Region", "Domestic routes by airline, winter 2026", "15 routes from three hubs", "Atlanta, Chicago and Denver anchor the network"],
  "route-map-loading": ["Route Map - Loading", "Passengers on our hub routes, October 2026", "51,300 passengers a day on 10 routes", "Turn loading off to trace the routes in", "Fetching the network…", "Loading routes"],
  "globe-default": ["Globe", "Cloud regions we deploy to, 2026", "16 regions on six continents", "Drag the globe to see the other side"],
  "globe-sized": ["Globe - Sized Markers", "Paying customers by country, Q3 2026", "8,700 customers in the Americas", "Turn the globe east to see Europe's"],
  "globe-loading": ["Globe - Loading", "Cloud regions we deploy to, 2026", "10 regions live", "Turn loading off to grow the globe in", "Fetching regions…", "Loading regions"],
  "vector-field-default": ["Vector Field", "Surface wind, 9 November 2026, 12:00 UTC", "Gusts up to 16.6 m/s around the North Sea low", "Westerlies to the south, turning anticlockwise round the low"],
  "vector-field-stations": ["Vector Field - Stations", "Wind at the network's stations, 14:00 today", "Strongest at Summit, 21 km/h", "Wind veers to the west as it climbs inland"],
  "vector-field-loading": ["Vector Field - Loading", "Surface wind, 9 November 2026, 12:00 UTC", "187 grid points over western Europe", "Turn loading off to sweep the arrows in", "Fetching the forecast…", "Loading wind"],
} satisfies Record<string, readonly [string, string, string, string, string?, string?]>;

type GeoVariant = keyof typeof geoTitle;

const chartColor = (index: number) => palette[index] ?? palette[0];
const windColor = (index: number) => `var(--geo-scale-${index + 2})`;
const revealDelay = (index: number) => ({ "--geo-delay": `${index * 12}ms` }) as CSSProperties;
const heading = (x: number, y: number) => `${Math.abs(x)}°${x < 0 ? "W" : "E"}, ${y}°N`;

function mapLegend(slug: GeoVariant, loading: boolean): ReactNode {
  if (loading) return null;
  if (slug === "vector-field-default") return <div className="geo-detail-legend">
    <span>Wind speed</span>{speeds.map((label, index) => <span key={label}><i className="geo-square" style={{ backgroundColor: windColor(index) }} />{label}</span>)}
  </div>;
  if (slug === "route-map-region") return <div className="geo-detail-legend">
    {["Northwind", "Lakeline", "Sunrise"].map((label, index) => <span key={label}><i style={{ backgroundColor: chartColor(index) }} />{label}</span>)}
  </div>;
  if (slug !== "bubble-map-default" && slug !== "bubble-map-categories") return null;
  const category = slug === "bubble-map-categories";
  const sizes = category ? ["420", "110", "26"] : ["180k", "46k", "12k"];
  return <>
    <div className="geo-detail-legend geo-detail-size-legend" aria-label="Bubble size scale">
      <span>{category ? "Engineers" : "Active users"}</span>
      {sizes.map((label, index) => <span key={label}>
        <i style={{ width: (category ? 36 : 44) / 2 ** index, height: (category ? 36 : 44) / 2 ** index, backgroundColor: chartColor(0) }} />{label}
      </span>)}
    </div>
    {category && <div className="geo-detail-legend">
      {["Americas", "EMEA", "APAC"].map((label, index) => <span key={label}><i style={{ backgroundColor: chartColor(index) }} />{label}</span>)}
    </div>}
  </>;
}

function mapModel(slug: GeoVariant, width: number, height: number, rotation: Point) {
  const globe = slug.startsWith("globe-");
  const bubble = slug.startsWith("bubble-map-");
  const route = slug.startsWith("route-map-");
  const region = slug.endsWith("-region");
  const categories = slug.endsWith("-categories");
  const size = slug === "globe-sized";
  const initial = slug.endsWith("-loading");
  const flatGrid = !globe && !region && !categories;
  const showGrid = flatGrid || globe && !size;
  const markers = bubble ? region ? bubbleRegion : categories ? bubbleCategories : initial ? bubbleLoading : bubbleDefault
    : globe ? size ? globeSized : initial ? globeLoading : globeDefault : [];
  const airports = route ? region ? routeRegionAirports : initial ? routeLoadingAirports : routeDefaultAirports : [];
  const flights = route ? region ? routeRegionFlights : initial ? routeLoadingFlights : routeDefaultFlights : [];
  const extent = (padding: number): [Point, Point] => {
    const x = Math.min(padding, width / 3);
    const y = Math.min(padding, height / 3);
    return [[x, y], [width - x, height - y]];
  };
  const projection = globe
    ? geoOrthographic().translate([width / 2, height / 2]).scale(Math.max(1, Math.min(width, height) / 2 - 2)).rotate(rotation).clipAngle(90)
    : region ? geoMercator().fitExtent(extent(bubble ? 34 : 24), {
      type: "MultiPoint", coordinates: [...markers, ...airports].map(([, lon, lat]) => [lon, lat]),
    })
      : (categories ? geoNaturalEarth1() : geoEqualEarth().rotate([route ? -20 : -10, 0])).fitExtent(extent(4), sphere);
  if (!globe && !region) projection.clipExtent([[0, 0], [width, height]]);
  const path = geoPath(projection);
  const countries = countryShapes.flatMap((shape, index) => {
    const d = path(shape);
    return d ? [{ d, id: shape.id ?? index }] : [];
  });
  const max = Math.max(1, ...markers.map(([, , , value]) => value));
  const maxRadius = globe ? size ? 14 : 5 : region ? 26 : categories ? 18 : 22;
  const label = size ? "Customers" : region ? "Orders" : categories ? "Engineers" : "Active users";
  const markerTargets = markers.flatMap(([name, longitude, latitude, value, category]: GeoSite, rank) => {
    const pos: Point = [longitude, latitude];
    const at = projection(pos);
    if (!at || (globe && geoDistance([-rotation[0], -rotation[1]], pos) >= Math.PI / 2)) return [];
    const color = chartColor(category);
    const target: Target = { key: name, label: name, at, entries: !globe || size ? [{ name: label, color, value: metric.format(value) }] : undefined };
    return [{ target, color, rank, value, radius: Math.sqrt(value / max) * maxRadius }];
  });
  const byName = new Map(airports.map(([name, x, y]) => [name, [x, y] as Point]));
  const routeMarks = flights.flatMap(([from, to, value, category, longitude, latitude, rank]) => {
    const start = byName.get(from);
    const end = byName.get(to);
    if (!start || !end) return [];
    const coordinates = [start, end];
    const d = path({ type: "LineString", coordinates });
    const at = projection([longitude, latitude]) ?? projection(geoInterpolate(start, end)(.5)) ?? [width / 2, height / 2];
    if (!d) return [];
    const label = from + " → " + to;
    const color = chartColor(category);
    const size = region ? value >= 30 ? 3.5 : 2.67 : value >= 7_000 ? 4 : value >= 2_500 ? 3 : 2;
    const target: Target = { key: label, label, at, entries: [{ name: region ? "Schedule" : "Passengers", color, value: metric.format(value) + (region ? " flights a week" : " a day") }] };
    return [{ target, d, size, color, rank }];
  });
  const airportMarks = airports.flatMap(([name, longitude, latitude, rank]) => {
    const at = projection([longitude, latitude]);
    if (!at) return [];
    const count = flights.filter(([from, to]) => name === from || name === to).length;
    const target: Target = { key: name, label: name, at, entries: [{ name: "Routes", color: "var(--muted-foreground)", value: String(count) }] };
    return [{ target, rank }];
  });
  const targets = [...markerTargets, ...routeMarks, ...airportMarks].sort((a, b) => a.rank - b.rank).map(row => row.target);
  return { globe, bubble, route, region, categories, flatGrid, showGrid, size, initial, countries, markerTargets, routeMarks, airportMarks, targets,
    sphere: globe || flatGrid ? path(sphere) : null, grid: showGrid ? path(wholeGrid) : null };
}

function vectorModel(slug: GeoVariant, width: number, height: number, compact: boolean) {
  const stations = slug === "vector-field-stations";
  const left = compact ? 18 : stations ? 59 : 56;
  const right = Math.max(left + 1, width - (compact ? 15 : stations ? 31 : 28));
  const top = compact ? 14 : stations ? 27 : 24;
  const bottom = Math.max(top + 1, height - (compact ? 20 : stations ? 47 : 44));
  const x = (value: number) => left + (right - left) * (stations ? value : value + 12.5) / 40;
  const y = (value: number) => bottom - (bottom - top) * (stations ? value / 50 : (value - 35) / 25);
  const xTicks = stations ? [0, 10, 20, 30, 40] : [-10, 0, 10, 20];
  const yTicks = stations ? [0, 10, 20, 30, 40, 50] : [35, 40, 45, 50, 55, 60];
  const marks = (stations ? windStations : windField).map(([lon, lat, name, speed, bearing, bucket, dx, dy, leftX, leftY, rightX, rightY]) => {
    const at: Point = [x(lon), y(lat)];
    const label = stations ? name : heading(lon, lat);
    const color = stations ? chartColor(1) : windColor(bucket);
    const target: Target = { key: label, label, at,
      entries: stations ? undefined : [{ name: "Speed", color, value: speed.toFixed(1) + " m/s" }, { name: "Direction", color, value: compass[Math.round(bearing / 45) % 8] + " " + bearing + "°" }],
      bare: stations ? speed + " km/h toward " + bearing + "°" : undefined,
    };
    const scale = compact ? .55 : 1;
    const x1 = at[0] - dx * scale / 2;
    const y1 = at[1] - dy * scale / 2;
    const x2 = at[0] + dx * scale / 2;
    const y2 = at[1] + dy * scale / 2;
    return { target, lon, lat, color, line: `M${x1},${y1}L${x2},${y2}m${leftX * scale},${leftY * scale}L${x2},${y2}l${rightX * scale},${rightY * scale}` };
  });
  const targets = [...marks].sort((a, b) => a.lon - b.lon || b.lat - a.lat).map(row => row.target);
  return { stations, left, right, top, bottom, x, y, xTicks, yTicks, marks, targets };
}

function ChartMark({ target, selected, compact, onPick, children }: { target: Target; selected?: Target; compact?: boolean; onPick: (target?: Target) => void; children: ReactNode }) {
  return <g data-geo-mark={target.key} opacity={selected && target.key !== selected.key ? .32 : undefined}
    onPointerEnter={!compact ? event => { if (event.pointerType !== "touch") onPick(target); } : undefined}
    onPointerLeave={!compact ? event => { if (event.pointerType !== "touch") onPick(); } : undefined}>{children}</g>;
}

export function GeographyDetail({ example, compact }: DemoProps) {
  const slug = example.id as GeoVariant;
  const id = useId();
  const [title, description, summary, footnote, pending, loadingLabel] = geoTitle[slug] as readonly [string, string, string, string, string?, string?];
  const [loading, setLoading] = useState(Boolean(pending));
  const [selectedKey, setSelectedKey] = useState<string>();
  const baseRotation: Point = slug === "globe-sized" ? [60, -15] : [-12, -30];
  const [rotation, setRotation] = useState<Point>(baseRotation);
  const dragging = useRef<{ x: number; y: number; rotation: Point; moved: boolean } | null>(null);
  const { plot, width, height } = usePlotSize<SVGSVGElement>(577, 288.5);
  const vector = slug.startsWith("vector-field-");
  const globe = slug.startsWith("globe-");
  const aspect = globe || slug === "bubble-map-region" ? "4 / 3" : vector || slug === "route-map-region" ? "16 / 9" : "2 / 1";
  const map = useMemo(() => vector ? undefined : mapModel(slug, width, height, rotation), [slug, width, height, rotation, vector]);
  const arrows = useMemo(() => vector ? vectorModel(slug, width, height, Boolean(compact)) : undefined, [slug, width, height, compact, vector]);
  const targets = map?.targets ?? arrows?.targets ?? [];
  const selected = loading ? undefined : targets.find(target => target.key === selectedKey);
  const select = (target?: Target) => {
    if (!loading && !dragging.current?.moved) setSelectedKey(target?.key);
  };
  const position = (event: PointerEvent<SVGSVGElement>) => {
    const inverse = event.currentTarget.getScreenCTM()?.inverse();
    return inverse ? new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse) : new DOMPoint(event.nativeEvent.offsetX, event.nativeEvent.offsetY);
  };
  function move(event: PointerEvent<SVGSVGElement>) {
    if (compact || loading) return;
    const at = position(event);
    const drag = dragging.current;
    if (drag) {
      const dx = at.x - drag.x, dy = at.y - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      if (!drag.moved) event.currentTarget.setPointerCapture(event.pointerId);
      drag.moved = true;
      const degrees = 180 / Math.max(1, height);
      setSelectedKey(undefined);
      setRotation([drag.rotation[0] + dx * degrees, Math.max(-89, Math.min(89, drag.rotation[1] - dy * degrees))]);
      return;
    }
    if (!vector) return;
    const nearest = targets.reduce<{ target?: Target; distance: number }>((best, target) => {
      const distance = Math.hypot(target.at[0] - at.x, target.at[1] - at.y);
      return distance < best.distance ? { target, distance } : best;
    }, { distance: 17 });
    select(nearest.target);
  }
  function endPointer(event: PointerEvent<SVGSVGElement>) {
    const moved = dragging.current?.moved;
    dragging.current = null;
    if (compact || loading || moved || event.pointerType !== "touch") return;
    const targetKey = (event.target as Element).closest("[data-geo-mark]")?.getAttribute("data-geo-mark");
    const exact = targets.find(target => target.key === targetKey);
    if (exact) {
      select(exact);
      return;
    }
    const at = position(event);
    const nearest = targets.reduce<{ target?: Target; distance: number }>((best, target) => {
      const distance = Math.hypot(target.at[0] - at.x, target.at[1] - at.y);
      return distance < best.distance ? { target, distance } : best;
    }, { distance: 23 });
    if (nearest.target) select(nearest.target);
  }
  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (loading) return;
    const direction = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (globe && event.shiftKey && direction !== undefined) {
      event.preventDefault();
      const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
      setRotation(([x, y]) => horizontal ? [x + direction * 12, y] : [x, Math.max(-89, Math.min(89, y + direction * 12))]);
      setSelectedKey(undefined);
      return;
    }
    if (event.key === "Escape" && selected) {
      event.preventDefault();
      event.stopPropagation();
      select();
    }
    if (direction === undefined && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const current = targets.findIndex(target => target.key === selectedKey);
    const next = event.key === "Home" ? 0 : event.key === "End" ? targets.length - 1 : Math.min(targets.length - 1, Math.max(0, current + (direction ?? 0)));
    select(targets[next]);
  }
  const footerIcon = vector ? Wind : globe ? Server : slug.startsWith("route-map-") ? PlaneTakeoff : slug === "bubble-map-region" ? ShoppingBag : Users;
  const FooterIcon = pending ? Cloud : footerIcon;
  const legend = !compact && mapLegend(slug, loading);
  const globeRadius = Math.max(1, Math.min(width, height) / 2 - 2);
  const tooltipWidth = Math.min(205, width - 8);
  const loadingBubbleSites = width < 300 ? bubblePlaceholdersNarrow : bubblePlaceholders;
  const loadingColumns = arrows ? Math.max(2, Math.min(25, Math.floor((arrows.right - arrows.left) / 32))) : 0;
  const loadingRows = arrows ? Math.max(1, Math.min(13, Math.floor((arrows.bottom - arrows.top) / 32))) : 0;
  const tooltipX = selected ? Math.max(0, Math.min(width - tooltipWidth, selected.at[0] + 16 <= width - tooltipWidth
    ? selected.at[0] + 16 : selected.at[0] - tooltipWidth - 16)) : 0;
  const tooltipY = selected ? Math.max(4, Math.min(height - 92, selected.at[1] - 34)) : 0;
  return <div className="geo-detail" data-geo-variant={slug} data-compact={compact || undefined} style={{ "--geo-aspect": aspect } as CSSProperties}>
    {!compact && <header className="geo-detail-header">
      <div id={id + "-title"}>{title}</div><p>{description}</p>
      {pending && <Toggle className="geo-detail-loading-control" pressed={loading} onPressedChange={next => { setLoading(next); setSelectedKey(undefined); }}>
        {loading && <span className="geo-loading-dot" aria-hidden="true" />}Loading
      </Toggle>}
    </header>}
    <div className="geo-detail-content">
      <div className="geo-detail-surface">
        <svg ref={plot} className="geo-detail-plot cartesian-focus-surface" data-rotatable={globe && !loading || undefined}
          viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart" aria-busy={loading || undefined}
          aria-label={title} aria-describedby={id + "-desc"} tabIndex={compact || loading ? undefined : 0}
          onKeyDown={keyboard} onBlur={() => select()}
          onPointerDown={event => {
            if (compact || loading || !globe || event.button !== 0) return;
            const at = position(event);
            dragging.current = { x: at.x, y: at.y, rotation, moved: false };
          }}
          onPointerMove={move}
          onPointerUp={endPointer}
          onPointerCancel={() => { dragging.current = null; select(); }}
          onPointerLeave={event => { if (!dragging.current?.moved) dragging.current = null; if (event.pointerType !== "touch") select(); }}>
          <desc id={id + "-desc"}>{loading ? loadingLabel : summary}{!loading && !compact && " Use the arrow keys to inspect data."}{!loading && globe && !compact && " Drag or hold Shift and use the arrow keys to rotate."}</desc>
          <defs>
            <linearGradient id={id + "-grid"}><stop stopColor="var(--border)" stopOpacity="0" /><stop offset=".1" stopColor="var(--border)" /><stop offset=".9" stopColor="var(--border)" /><stop offset="1" stopColor="var(--border)" stopOpacity="0" /></linearGradient>
            <clipPath id={id + "-bounds"}><rect width={width} height={height} /></clipPath>
          </defs>
          {map && <g aria-hidden="true" clipPath={`url(#${id}-bounds)`}>
            {map.sphere && <path d={map.sphere} fill={globe ? loading ? skeletonColor : "var(--geo-scale-1)" : "none"} fillOpacity={globe && loading ? .35 : undefined}
              stroke={globe && loading ? skeletonColor : "var(--border)"} />}
            <g opacity={globe && loading ? .35 : undefined}>
              {map.countries.map(({ d, id }) => <path key={id} data-geo-country="" d={d} fill={globe ? loading ? skeletonColor : "var(--geo-scale-2)" : "var(--muted)"}
                stroke={globe ? "var(--geo-scale-1)" : "var(--geo-canvas)"} strokeWidth=".5" />)}
            </g>
            {map.grid && <path d={map.grid} fill="none" stroke="var(--border)" strokeWidth=".5" />}
            {!loading && <>
              {[...map.routeMarks].sort((a, b) => a.size - b.size).map(({ target, d, color, size }, index) =>
                <ChartMark key={target.key} target={target} selected={selected} onPick={select} compact={compact}>
                  <path data-geo-route="" d={d} fill="none" stroke={color} strokeWidth={size} strokeOpacity={map.region ? .9 : .8}
                    className={pending ? "geo-route-reveal" : undefined} style={revealDelay(index)} pathLength={1} />
                  {!compact && <path d={d} stroke="transparent" strokeWidth={12} fill="none" />}
                </ChartMark>)}
              {map.airportMarks.map(({ target }) => <ChartMark key={target.key} target={target} selected={selected} onPick={select} compact={compact}>
                <circle data-geo-airport="" cx={target.at[0]} cy={target.at[1]} r={map.region ? 4 : 3.5} fill="var(--muted-foreground)" stroke="var(--geo-canvas)" strokeWidth="1.5" />
                {!compact && <circle cx={target.at[0]} cy={target.at[1]} r={8} fill="transparent" />}
              </ChartMark>)}
              {[...map.markerTargets].sort((a, b) => b.radius - a.radius).map(({ target, radius, color, value }, index) => <ChartMark
                key={target.key} target={target} selected={selected} onPick={select} compact={compact}>
                <circle data-geo-value={value} cx={target.at[0]} cy={target.at[1]} r={radius * (compact ? .63 : 1)} fill={color}
                  fillOpacity={globe ? undefined : map.categories ? .8 : .65} stroke="var(--geo-canvas)" strokeWidth={globe ? 1.5 : 1}
                  className={pending ? "geo-mark-reveal" : undefined} style={revealDelay(index)} />
              </ChartMark>)}
            </>}
            {loading && <g opacity=".74">
              {map.route && <g transform={`scale(${width / 577} ${height / 288.5})`}>
                {routePlaceholderPaths.map((d) => <path key={d} data-geo-placeholder="" d={d} fill="none" stroke={skeletonColor} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />)}
              </g>}
              {(map.bubble ? loadingBubbleSites : map.route ? routePlaceholders : globePlaceholders).map(([x, y, r], index) =>
                <circle key={index} data-geo-placeholder=""
                  cx={globe ? width / 2 + (x - 288.5) * globeRadius / 214.375 : x * width / (map.bubble && width < 300 ? 286 : 577)}
                  cy={globe ? height / 2 + (y - 216.375) * globeRadius / 214.375 : y * height / (map.bubble && width < 300 ? 143 : 288.5)}
                  r={r * (compact ? .6 : 1)} fill={skeletonColor} stroke="var(--geo-canvas)" fillOpacity={map.bubble ? .65 : 1} />)}
            </g>}
          </g>}
          {arrows && <g aria-hidden="true">
            <g stroke={`url(#${id}-grid)`} strokeDasharray="4 4">
              {arrows.yTicks.map(v => <line key={v} x1={arrows.left} x2={arrows.right} y1={arrows.y(v)} y2={arrows.y(v)} />)}
              {arrows.stations && arrows.xTicks.map(v => <line key={v} x1={arrows.x(v)} x2={arrows.x(v)} y1={arrows.top} y2={arrows.bottom} />)}
            </g>
            {!compact && <g fill="var(--muted-foreground)" fontSize={12}>
              {arrows.xTicks.map(v => <text key={v} x={arrows.x(v)} y={height - 8} textAnchor="middle">{arrows.stations ? v + " km" : Math.abs(v) + (v < 0 ? "°W" : "°E")}</text>)}
              {arrows.yTicks.map(v => <text key={v} x={36} y={arrows.y(v)} textAnchor="end" dominantBaseline="middle">{v + (arrows.stations ? " km" : "°N")}</text>)}
            </g>}
            {loading ? <g clipPath={`url(#${id}-bounds)`} opacity=".62">
              {Array.from({ length: loadingColumns * loadingRows }, (_, index) => {
                const col = index % loadingColumns, row = Math.floor(index / loadingColumns);
                const x = arrows.left + (arrows.right - arrows.left) * (col + .5) / loadingColumns;
                const y = arrows.top + (arrows.bottom - arrows.top) * (row + .5) / loadingRows;
                const angle = .34 * Math.sin(col / 6 + row / 4) - .25;
                return <path key={index} data-geo-placeholder="" transform={`translate(${x} ${y}) rotate(${angle * 180 / Math.PI})`}
                  d="M-9 0H9M5-2.5L9 0 5 2.5" fill="none" stroke={skeletonColor} strokeWidth="1.5" strokeLinecap="round" />;
              })}
            </g> : arrows.marks.map(({ target, color, line }, index) => <ChartMark key={target.key} target={target} selected={selected} onPick={select} compact={compact}>
              <path data-geo-vector="" d={line} fill="none" stroke={color} strokeWidth={arrows.stations ? 2 : 1.5}
                strokeLinecap="round" strokeLinejoin="round" className={pending ? "geo-vector-reveal" : undefined} style={revealDelay(index % 17)} />
            </ChartMark>)}
          </g>}
        </svg>
        {!compact && loading && <div className="geo-detail-loading-label" role="status"><span className="geo-loading-dot" aria-hidden="true" />{loadingLabel}</div>}
        {!compact && <div role="status" className="geo-detail-readout" style={{ left: tooltipX, top: tooltipY }}>
          {selected && (selected.bare || !selected.entries
            ? <div className="cartesian-focus-readout"><div className="cartesian-focus-readout-title">{selected.label}</div>{selected.bare && <p>{selected.bare}</p>}</div>
            : <CartesianReadout live={false} label={selected.label} entries={selected.entries} />)}
        </div>}
      </div>
      {legend}
    </div>
    {!compact && <footer className="geo-detail-footer"><div>{loading ? pending : summary} <FooterIcon size={16} aria-hidden="true" /></div><p>{footnote}</p></footer>}
  </div>;
}
