import { geoGraticule, geoPath } from "d3-geo";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { CartesianReadout } from "../cartesian/CartesianFocus";
import { usePlotSize } from "../usePlotSize";
import { countryKeyboardOrder, infrastructureMarkers, signupCounts, visitorCounts } from "./choropleth-fixtures";
import {
  countryLevel, countryStatus, detailCountries, detailProjection, dotLattice, mapCaptions, mapScale,
  officeLocations, officeVisitorCounts, type ChoroplethVariant,
} from "./choropleth-detail-data";
import type { Coordinate } from "./geo-fixtures";
import type { DemoProps } from "./primitives";
import "./choropleth-detail.css";

type Target = { name: string; at: Coordinate; marker?: number };
type Camera = { x: number; y: number; scale: number };
const rest: Camera = { x: 0, y: 0, scale: 1 };
const graticule = geoGraticule()();
const coordinates = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pinPath = (radius: number) => `M0 0L${-.82 * radius} ${-1.33 * radius}A${radius} ${radius} 0 1 1 ${.82 * radius} ${-1.33 * radius}Z`;
const markerRadii = [5.5, 5, 6, 4.4, 5.25];
const featureNames = [...countryKeyboardOrder.keys()];
const mainShapes = [undefined, undefined, "M0 -6L6 0 0 6 -6 0Z", "M-4.4 -4.4H4.4V4.4H-4.4Z", "M0 -5.75L5.25 3.5H-5.25Z"];

function zoomAround(camera: Camera, from: Coordinate, to: Coordinate, ratio: number): Camera {
  const scale = Math.max(1, Math.min(7, camera.scale * ratio));
  const factor = scale / camera.scale;
  return { scale, x: to[0] - (from[0] - camera.x) * factor, y: to[1] - (from[1] - camera.y) * factor };
}

function pointerPair(points: Map<number, Coordinate>) {
  const [a, b] = points.values();
  if (!a || !b) return null;
  return { distance: Math.hypot(b[0] - a[0], b[1] - a[1]), midpoint: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Coordinate };
}

function screenPoint(element: SVGGraphicsElement, [x, y]: Coordinate): Coordinate {
  const matrix = element.getScreenCTM();
  if (!matrix) return [x, y];
  const point = new DOMPoint(x, y).matrixTransform(matrix);
  return [point.x, point.y];
}

export function ChoroplethDetail({ example, compact = false }: DemoProps) {
  const variant = example.id as ChoroplethVariant;
  const id = useId().replaceAll(":", "");
  const clickable = variant === "choropleth-click-to-zoom";
  const pointerCamera = variant === "choropleth-pointer-camera";
  const dots = variant === "choropleth-dot-grid";
  const infrastructure = variant === "choropleth-markers";
  const background = variant === "choropleth-background";
  const patterns = variant === "choropleth-patterns";
  const showGraticule = clickable || variant === "choropleth-graticule";
  const flyable = clickable || pointerCamera || dots;
  const pannable = background || variant === "choropleth-default";
  const { plot, width, height } = usePlotSize<HTMLDivElement>(577, 324.5625);
  const transformed = useRef<SVGGElement>(null);
  const pointers = useRef(new Map<number, Coordinate>());
  const drag = useRef<{ id: number; start: Coordinate; origin: Camera; moved: boolean } | null>(null);
  const pinch = useRef<{ distance: number; midpoint: Coordinate; origin: Camera } | null>(null);
  const didDrag = useRef(false);
  const [camera, setCamera] = useState<Camera>(rest);
  const [pitch, setPitch] = useState(0);
  const [focus, setFocus] = useState<Target>();
  const [hover, setHover] = useState<{ target: Target; point: Coordinate }>();
  const [selection, setSelection] = useState<Target>();
  const projection = useMemo(() => detailProjection(width, height), [width, height]);
  const model = useMemo(() => {
    const path = geoPath(projection);
    const areas = detailCountries.map((country, index) => {
      const name = country.properties.name;
      const rings = country.geometry.type === "Polygon" ? [country.geometry.coordinates] : country.geometry.coordinates;
      const keyboardVisible = !compact && rings.some(coordinates => {
        const [[left, top], [right, bottom]] = path.bounds({ type: "Polygon", coordinates });
        return Math.min(width, right) - Math.max(0, left) >= 2 && Math.min(height, bottom) - Math.max(0, top) >= 2;
      });
      return { name, d: path(country) ?? "", at: path.centroid(country) as Coordinate,
        level: countryLevel(variant, name, index), keyboardVisible };
    });
    return { areas, grid: showGraticule ? path(graticule) : null, lattice: dots ? dotLattice(width, height, projection) : null };
  }, [compact, dots, height, projection, showGraticule, variant, width]);
  const targets = useMemo(() => {
    const byName = new Map(model.areas.map(area => [area.name, area]));
    return featureNames.flatMap(name => {
      const area = byName.get(name);
      return area?.keyboardVisible && area.at.every(Number.isFinite) ? [area] : [];
    });
  }, [model]);
  const markerData = useMemo(() => {
    const locations = infrastructure ? infrastructureMarkers.map(({ label, at }) => [label, ...at] as const)
      : flyable ? officeLocations : [];
    return locations.map(([name, lon, lat], marker) => ({
      name, at: projection([lon, lat]) as Coordinate, marker,
      location: `${coordinates.format(lat)}°, ${coordinates.format(lon)}°`,
    }));
  }, [flyable, infrastructure, projection]);
  const active = hover?.target ?? focus;
  const selectedTarget = selection && (selection.marker === undefined ? model.areas.find(target => target.name === selection.name)
    : markerData[selection.marker]);
  const scale = selectedTarget ? dots ? 2 : 4 : camera.scale;
  const x = selectedTarget ? width / 2 - selectedTarget.at[0] * scale : camera.x;
  const y = selectedTarget ? height / 2 - selectedTarget.at[1] * scale : camera.y;
  const rotateX = selectedTarget ? pointerCamera ? 28 : 24 : dots ? 30 : pointerCamera ? 18 : 0;
  const rotateY = selectedTarget ? pointerCamera ? 14 : dots ? 10 : 18 : pointerCamera ? pitch : 0;
  const angle = rotateX || rotateY
    ? `perspective(1600px) translateY(10%) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10%)`
    : undefined;

  function localPoint(clientX: number, clientY: number): Coordinate {
    const bounds = plot.current?.getBoundingClientRect();
    return [clientX - (bounds?.left ?? 0), clientY - (bounds?.top ?? 0)];
  }

  useEffect(() => {
    const element = plot.current;
    if (!element || !pannable || compact) return;
    function wheel(event: WheelEvent) {
      if (!element) return;
      event.preventDefault();
      const bounds = element.getBoundingClientRect();
      const point: Coordinate = [event.clientX - bounds.left, event.clientY - bounds.top];
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1;
      setHover(undefined);
      setCamera(current => zoomAround(current, point, point, Math.exp(-event.deltaY * unit * .0017)));
    }
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [compact, pannable, plot]);

  function reset() {
    setCamera(rest);
    setPitch(0);
    setSelection(undefined);
    setFocus(undefined);
    setHover(undefined);
  }

  function fly(target: Target) {
    if (!flyable || compact || didDrag.current) return;
    if (selection?.name === target.name) { reset(); return; }
    setSelection(target);
    setHover(undefined);
    setFocus(undefined);
  }

  function key(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && (selection || active || camera !== rest || pitch)) {
      event.preventDefault();
      event.stopPropagation();
      reset();
      return;
    }
    const center: Coordinate = [width / 2, height / 2];
    if (pannable && ["+", "=", "-"].includes(event.key)) {
      event.preventDefault();
      setCamera(current => zoomAround(current, center, center, event.key === "-" ? 1 / 1.4 : 1.4));
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && focus && flyable) {
      event.preventDefault();
      fly(focus);
      return;
    }
    const arrows: Record<string, Coordinate> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const arrow = arrows[event.key];
    if (!arrow && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    if (arrow && event.shiftKey && pannable) {
      setCamera(current => ({ ...current, x: current.x - arrow[0] * 24, y: current.y - arrow[1] * 24 }));
      return;
    }
    const current = targets.findIndex(target => target.name === focus?.name);
    const end = targets.length - 1;
    const index = event.key === "Home" ? 0 : event.key === "End" ? end :
      Math.min(end, Math.max(0, current + (arrow[0] || arrow[1])));
    setFocus(targets[index]);
    setHover(undefined);
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    if (compact || event.button !== 0) return;
    didDrag.current = false;
    if (!pannable) return;
    const point = localPoint(event.clientX, event.clientY);
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 1) drag.current = { id: event.pointerId, start: point, origin: camera, moved: false };
    else {
      const pair = pointerPair(pointers.current);
      if (pair?.distance) pinch.current = { ...pair, origin: camera };
      didDrag.current = true;
      drag.current = null;
    }
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (compact) return;
    const point = localPoint(event.clientX, event.clientY);
    if (pointerCamera && !selection && event.pointerType !== "touch") setPitch(Math.max(-16, Math.min(16, (point[0] / width - .5) * 32)));
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, point);
    const pendingPinch = pinch.current;
    if (pendingPinch) {
      const pair = pointerPair(pointers.current);
      if (pair) setCamera(zoomAround(pendingPinch.origin, pendingPinch.midpoint, pair.midpoint, pair.distance / pendingPinch.distance));
      setHover(undefined);
      return;
    }
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    const dx = point[0] - state.start[0], dy = point[1] - state.start[1];
    if (!state.moved && Math.hypot(dx, dy) < 4) return;
    if (!state.moved) event.currentTarget.setPointerCapture(event.pointerId);
    state.moved = true;
    didDrag.current = true;
    setHover(undefined);
    setCamera({ ...state.origin, x: state.origin.x + dx, y: state.origin.y + dy });
  }

  function end(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (drag.current?.id === event.pointerId) drag.current = null;
    if (pointers.current.size < 2) pinch.current = null;
  }

  function highlight(target: Target, event: PointerEvent<SVGElement>) {
    if (compact || drag.current?.moved || pinch.current) return;
    setHover({ target, point: localPoint(event.clientX, event.clientY) });
  }

  const dataValue = active && (variant === "choropleth-values" ? visitorCounts.get(active.name)
    : background ? signupCounts.get(active.name) : clickable || dots ? officeVisitorCounts.get(active.name) : undefined);
  const marker = active?.marker === undefined ? undefined : markerData[active.marker];
  const activeArea = active?.marker === undefined ? model.areas.find(area => area.name === active?.name) : undefined;
  const entries = marker ? [{ name: "Location", value: marker.location }]
    : dataValue === undefined ? [] : [{ name: background ? "Sign-ups" : "Visitors", value: clickable || dots ? `${dataValue}k` : dataValue }];
  const readoutTitle = active && (patterns && !marker ? `${active.name}: ${countryStatus(active.name)}` : active.name);
  let hint = hover?.point ?? active?.at;
  if (!hover && hint && transformed.current && plot.current) {
    const root = plot.current.getBoundingClientRect();
    const absolute = screenPoint(transformed.current, hint);
    hint = [absolute[0] - root.left, absolute[1] - root.top];
  }
  const stroke = "var(--choropleth-border)";
  const fillArea = (name: string, level: number) => patterns && countryStatus(name) === "beta" ? `url(#${id}-beta)` : mapScale(level);
  const [summary, description] = mapCaptions[variant];
  return <div className="choropleth-detail" data-choropleth={variant} data-compact={compact}>
    <div ref={plot} className="choropleth-stage" data-pannable={pannable} data-flying={flyable}
      data-selected={selection?.name} onPointerDown={down} onPointerMove={move} onPointerUp={end}
      onPointerCancel={end} onPointerLeave={event => { if (!drag.current?.moved) end(event); if (event.pointerType !== "touch") setHover(undefined); setPitch(0); }}>
      {(background || pointerCamera) && <svg className="choropleth-backdrop" aria-hidden="true" viewBox={`0 0 ${width} ${height}`} data-map-backdrop="">
        <defs><pattern id={`${id}-backdrop`} width="6" height="6" patternUnits="userSpaceOnUse">
          {background ? <path d="M-1 1 1 -1M0 6 6 0M5 7 7 5" stroke="var(--border)" strokeWidth=".65" />
            : <circle cx="3" cy="3" r=".7" fill="var(--muted-foreground)" opacity=".35" />}
        </pattern></defs>
        <rect width={width} height={height} fill={`url(#${id}-backdrop)`} opacity={selection && pointerCamera ? .18 : 1} />
      </svg>}
      <svg className="choropleth-svg cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} data-choropleth-width={width} data-choropleth-height={height}
        style={{ transform: angle }} role="img" aria-roledescription="map" aria-label={example.title} tabIndex={compact ? undefined : 0}
        aria-describedby={compact ? undefined : `${id}-keys`} onBlur={() => setFocus(undefined)} onKeyDown={compact ? undefined : key}
        onClick={flyable && !compact ? () => { if (!didDrag.current) reset(); } : undefined}>
        {!compact && <desc id={`${id}-keys`}>Use arrow keys to inspect countries and locations. {pannable ? "Drag to pan, scroll or pinch to zoom. " : ""}{flyable ? "Press Enter to zoom to the selected place. " : ""}Escape resets the view.</desc>}
        <defs><pattern id={`${id}-beta`} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="var(--choropleth-scale-2)" />
          <path d="M-1 1 1 -1M0 6 6 0M5 7 7 5" stroke="var(--choropleth-scale-4)" strokeWidth="2" />
        </pattern></defs>
        <g ref={transformed} className="choropleth-viewport" data-map-viewport="" style={{ transform: `translate(${x}px,${y}px) scale(${scale})` }}>
          {model.grid && <path data-map-graticule="" d={model.grid} fill="none" stroke="var(--border)" strokeWidth=".5" vectorEffect="non-scaling-stroke" opacity={selection ? .15 : 1} />}
          {model.lattice && <g aria-hidden="true" fill="none" strokeLinecap="round">
            <path data-map-ocean="" d={model.lattice.ocean} stroke={mapScale(1)} strokeWidth="2.695" opacity={selection ? .04 : .35} />
            {model.lattice.land.map(({ name, path }) => <path key={name} d={path} data-map-land={name} stroke={mapScale(countryLevel(variant, name, 0))}
              strokeWidth={selection ? 6.3 : 4.9} opacity={activeArea && activeArea.name !== name ? .5 : 1} />)}
          </g>}
          {model.areas.map(area => <path key={area.name} data-map-location={`country:${area.name}`} data-map-level={area.level} data-market-status={patterns ? countryStatus(area.name) : undefined}
            d={area.d} fill={dots ? "transparent" : fillArea(area.name, area.level)} stroke={dots ? "none" : stroke} strokeWidth=".5" strokeLinejoin="round"
            vectorEffect="non-scaling-stroke" opacity={activeArea && activeArea.name !== area.name && !dots ? .4 : 1}
            onPointerMove={compact ? undefined : event => highlight(area, event)} onPointerLeave={event => { if (event.pointerType !== "touch") setHover(undefined); }}
            onClick={compact ? undefined : event => { event.stopPropagation(); if (flyable) fly(area); else if (!didDrag.current) setFocus(area); }} />)}
          {activeArea && !dots && <path data-map-country-focus="" d={activeArea.d} fill={fillArea(activeArea.name, activeArea.level)}
            stroke="var(--foreground)" strokeWidth=".85" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
        </g>
        {markerData.map(target => {
          const index = target.marker;
          const radius = infrastructure ? markerRadii[index] : pointerCamera ? 5 : dots ? 6 : 4.5;
          const pin = pointerCamera || infrastructure && index === 0;
          const shape = pin ? pinPath(radius) : infrastructure ? mainShapes[index] : undefined;
          const fill = infrastructure ? `var(--chart-${index + 1})` : pointerCamera ? "var(--chart-1)" : dots ? "var(--chart-2)" : "var(--foreground)";
          const pulse = !compact && (pointerCamera || infrastructure && index === 0 || active?.name === target.name);
          return <g key={target.name} className="choropleth-marker" data-map-marker={target.name} style={{ transform: `translate(${target.at[0] * scale + x}px,${target.at[1] * scale + y}px)` }}
            onPointerMove={compact ? undefined : event => highlight(target, event)} onPointerLeave={event => { if (event.pointerType !== "touch") setHover(undefined); }}
            onClick={compact ? undefined : event => { event.stopPropagation(); if (flyable) fly(target); else setFocus(target); }}>
            {!compact && <circle data-map-marker-hit="" r="22" cy={pin ? -1.14 * radius : 0} fill="transparent" />}
            {pulse && <circle className="choropleth-marker-pulse" r={radius} cy={pin ? -1.9 * radius : 0} stroke={fill} strokeWidth="1.5" fill="none"
              style={{ "--pulse-delay": `${-index * 110}ms` } as CSSProperties} />}
            {shape ? <path data-map-marker-shape="" d={shape} fill={fill} />
              : <circle data-map-marker-shape="" r={radius} fill={fill} stroke={infrastructure ? "var(--background)" : undefined} strokeWidth="1.5" />}
            {pin && <circle cy={-1.9 * radius} r={.38 * radius} fill="var(--background)" />}
            {infrastructure && !compact && <text x={radius + 6} y={pin ? -1.9 * radius : 0} dy=".35em">{target.name}</text>}
          </g>;
        })}
      </svg>
      {!compact && active && readoutTitle && hint && <div className="choropleth-tooltip"
        style={{ left: Math.max(0, Math.min(width - 174, hint[0] + 12)), top: Math.max(0, Math.min(height - 58, hint[1] + 10)) }}>
        {entries.length ? <CartesianReadout label={readoutTitle} entries={entries.map(entry => ({ ...entry, color: "transparent" }))} />
          : <span className="choropleth-country-name" role="status">{readoutTitle}</span>}
      </div>}
    </div>
    {!compact && <div className="choropleth-summary"><strong>{summary}</strong><span>{description}</span></div>}
  </div>;
}
