import { geoArea, geoCentroid, geoGraticule, geoPath } from "d3-geo";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { useDelayedTooltipData } from "../tooltip/use-delayed-tooltip-data";
import { usePlotSize } from "../usePlotSize";
import { useChoroplethCameraMotion } from "./choropleth-camera-motion";
import { manualMapRest as rest, mapCountryIsVisible, mapFragmentBounds } from "./choropleth-manual-zoom";
import { useChoroplethManualZoom } from "./use-choropleth-manual-zoom";
import { ChoroplethTooltip } from "./ChoroplethTooltip";
import { adaptChoroplethData, callerCountryLevel, callerMercatorCoordinates, type ChoroplethCallerData, type ChoroplethCallerMarker } from "./choropleth-caller-data";
import { countryKeyboardOrder, infrastructureMarkers, signupCounts, visitorCounts } from "./choropleth-fixtures";
import {
  countryLevel, countryStatus, detailCountries, detailProjection, dotLattice, mapCaptions, mapScale,
  officeLocations, officeVisitorCounts, type ChoroplethVariant,
} from "./choropleth-detail-data";
import type { Coordinate } from "./geo-fixtures";
import { format, NoData, type DemoProps } from "./primitives";
import "./choropleth-detail.css";

type Target = { key: string; name: string; at: Coordinate; marker?: number };
const graticule = geoGraticule()();
const coordinates = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pinPath = (radius: number) => `M0 0L${-.82 * radius} ${-1.33 * radius}A${radius} ${radius} 0 1 1 ${.82 * radius} ${-1.33 * radius}Z`;
const markerRadii = [5.5, 5, 6, 4.4, 5.25];
const featureNames = [...countryKeyboardOrder.keys()];
// This southern feature becomes inspectable when manual zoom reveals it.
featureNames.splice(featureNames.indexOf("Nepal"), 0, "Antarctica");
const mainShapes = [undefined, undefined, "M0 -6L6 0 0 6 -6 0Z", "M-4.4 -4.4H4.4V4.4H-4.4Z", "M0 -5.75L5.25 3.5H-5.25Z"];
const dotFadeStops = [[0, 0], [20, 1], [80, 1], [100, 0]];

export function ChoroplethDetail(props: DemoProps) {
  const caller = useMemo(() => adaptChoroplethData(props.data), [props.data]);
  const markerVariant = ["choropleth-markers", "choropleth-click-to-zoom", "choropleth-dot-grid", "choropleth-pointer-camera"].includes(props.example.id);
  if (caller && !caller.values.size && !caller.statuses.size && !(markerVariant && caller.markers.length)) {
    return <NoData example={props.example} compact={props.compact} />;
  }
  return <ChoroplethMap {...props} caller={caller} />;
}

function ChoroplethMap({ example, compact = false, caller }: DemoProps & { caller?: ChoroplethCallerData }) {
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
  const { plot, width, height: measuredHeight } = usePlotSize<HTMLDivElement>(577, 324.5625);
  const height = compact ? measuredHeight : width * 9 / 16;
  const motionPreference = useRef<MediaQueryList>(null);
  const manual = useChoroplethManualZoom({ host: plot, active: pannable && !compact });
  const camera = manual.view;
  const didDrag = manual.didDrag;
  const [pitch, setPitch] = useState(0);
  const [focus, setFocus] = useState<Target>();
  const [hover, setHover] = useState<{ target: Target; point: Coordinate }>();
  const keyboardCountry = useRef<Target | undefined>(undefined);
  const keyboardMarker = useRef<Target | undefined>(undefined);
  const markerUnderlay = useRef<Target | undefined>(undefined);
  const [selectionState, setSelection] = useState<Target>();
  const [tooltipGrace, setTooltipGrace] = useState(false);
  const selectionSize = useRef<{ width: number; height: number } | null>(null);
  const projection = useMemo(() => detailProjection(width, height), [width, height]);
  const model = useMemo(() => {
    const path = geoPath(projection);
    const areas = detailCountries.map((country, index) => {
      const name = country.properties.name;
      const rings = country.geometry.type === "Polygon" ? [country.geometry.coordinates] : country.geometry.coordinates;
      // Frame the largest landmass, so overseas territories do not skew focus.
      const mainland = rings.reduce((best, coordinates) => geoArea({ type: "Polygon", coordinates }) > geoArea({ type: "Polygon", coordinates: best }) ? coordinates : best);
      const [[x0, y0], [x1, y1]] = path.bounds({ type: "Polygon", coordinates: mainland });
      const view = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2,
        k: Math.min(dots ? 2 : 6, Math.max(1, .7 * Math.min(width / (x1 - x0 || 1), height / (y1 - y0 || 1)))) };
      const d = path(country) ?? "";
      const status = caller?.statuses.get(name);
      const level = caller ? patterns && status ? status === "live" ? 4 : 0
        : caller.values.size ? callerCountryLevel(caller, name)
          : clickable || dots || background || patterns || variant === "choropleth-values" ? 0 : countryLevel(variant, name, index)
        : countryLevel(variant, name, index);
      return { key: `country:${name}`, name, marker: undefined, d, at: projection(geoCentroid(country)) as Coordinate, view,
        level, fragments: mapFragmentBounds(d) };
    });
    return { areas, grid: showGraticule ? path(graticule) : null, lattice: dots ? dotLattice(width, height, projection, areas) : null };
  }, [compact, dots, height, projection, showGraticule, variant, width, caller, patterns, clickable, background]);
  const targets = useMemo(() => {
    const byName = new Map(model.areas.map(area => [area.name, area]));
    return featureNames.flatMap(name => {
      const area = byName.get(name);
      return !compact && area?.at.every(Number.isFinite) && mapCountryIsVisible(area.fragments, camera, width, height) ? [area] : [];
    });
  }, [model, camera, compact, width, height]);
  const markerData = useMemo(() => {
    const locations: readonly ChoroplethCallerMarker[] = !(infrastructure || flyable) ? [] : caller ? caller.markers
      : infrastructure ? infrastructureMarkers.map(({ label, at, value }, index) => ({ key: `marker:${index}`, name: label, at, value, hasValue: false }))
        : officeLocations.map(([name, lon, lat], index) => ({ key: `marker:${index}`, name, at: [lon, lat] as Coordinate, value: 1, hasValue: false }));
    return locations.map((location, marker) => ({
      ...location, at: projection(caller ? callerMercatorCoordinates(location.at) : location.at) as Coordinate, marker,
      location: `${coordinates.format(location.at[1])}°, ${coordinates.format(location.at[0])}°`,
    }));
  }, [flyable, infrastructure, projection, caller]);
  const resolveTarget = (target?: Target) => target?.marker === undefined
    ? model.areas.find(area => area.key === target?.key) : markerData.find(marker => marker.key === target.key);
  const inspection = hover?.target ?? focus;
  const active = resolveTarget(inspection);
  const selection = selectionSize.current?.width === width && selectionSize.current.height === height ? resolveTarget(selectionState) : undefined;
  const tooltipRequest = useMemo(() => {
    if (!active) return null;
    const point: Coordinate = [...active.at];
    if (active.marker === undefined) {
      point[0] = Math.max(60, Math.min(width - 60, point[0]));
      point[1] = Math.max(60, Math.min(height - 60, point[1]));
    }
    point[0] = point[0] * camera.scale + camera.x;
    point[1] = point[1] * camera.scale + camera.y;
    return { target: active, point };
  }, [active, camera, width, height]);
  const tooltip = useDelayedTooltipData(tooltipRequest, 0, inspection && !active ? 0 : tooltipGrace ? 120 : 0);
  const selectedTarget = selection;
  const view = selectedTarget ? "view" in selectedTarget ? selectedTarget.view
    : { cx: selectedTarget.at[0], cy: selectedTarget.at[1], k: dots ? 2 : 4 }
    : { cx: width / 2, cy: height / 2, k: 1 };
  const scale = selectedTarget ? view.k : camera.scale;
  const x = selectedTarget ? width / 2 - view.cx * scale : camera.x;
  const y = selectedTarget ? height / 2 - view.cy * scale : camera.y;
  const rotateX = selectedTarget ? pointerCamera ? 28 : 24 : dots ? 30 : pointerCamera ? 18 : 0;
  const rotateY = selectedTarget ? (view.cx < width / 2 ? 1 : -1) * (pointerCamera ? 14 : dots ? 10 : 18) : pointerCamera ? pitch : 0;
  const motion = useChoroplethCameraMotion({ active: flyable && !compact, width, height,
    target: view, tilt: rotateX, yaw: rotateY, pointer: pointerCamera && !selectedTarget });
  const transformed = motion.viewport;
  const angle = rotateX || rotateY
    ? `perspective(1600px) translateY(10%) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10%)`
    : undefined;

  useEffect(() => {
    if (selectionState && !selection) setSelection(undefined);
  }, [selectionState, selection]);

  useEffect(() => {
    selectionSize.current = null;
    setPitch(0);
    setSelection(undefined);
    setFocus(undefined);
    setHover(undefined);
    keyboardCountry.current = undefined;
    keyboardMarker.current = undefined;
    markerUnderlay.current = undefined;
  }, [width, height]);

  useEffect(() => {
    if (!pointerCamera || compact) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    motionPreference.current = preference;
    const update = () => { if (preference.matches) setPitch(0); };
    preference.addEventListener("change", update);
    return () => {
      motionPreference.current = null;
      preference.removeEventListener("change", update);
    };
  }, [compact, pointerCamera]);

  function localPoint(clientX: number, clientY: number): Coordinate {
    const bounds = plot.current?.getBoundingClientRect();
    return [clientX - (bounds?.left ?? 0), clientY - (bounds?.top ?? 0)];
  }

  function reset(clearInspection = true) {
    selectionSize.current = null;
    setPitch(0);
    setSelection(undefined);
    if (clearInspection) { setTooltipGrace(false); setFocus(undefined); setHover(undefined); keyboardCountry.current = undefined; keyboardMarker.current = undefined; markerUnderlay.current = undefined; }
  }

  function fly(target: Target) {
    if (!flyable || compact || didDrag.current) return;
    if (selection?.key === target.key) { reset(false); return; }
    selectionSize.current = { width, height };
    setSelection(target);
    setHover(current => current?.target.key === target.key ? current : undefined);
    setFocus(current => current?.key === target.key ? current : undefined);
  }

  function key(event: KeyboardEvent<SVGSVGElement>) {
    if (!pannable && event.key === "Escape" && (selection || active || camera !== rest || pitch)) {
      const onMarker = (event.target as Element).hasAttribute("data-map-marker");
      if (onMarker && !selection && camera === rest && !pitch) return;
      event.preventDefault();
      event.stopPropagation();
      reset(!onMarker);
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
    const current = targets.findIndex(target => target.key === focus?.key);
    const end = targets.length - 1;
    const index = event.key === "Home" ? 0 : event.key === "End" ? end :
      Math.min(end, Math.max(0, current + (arrow[0] || arrow[1])));
    keyboardCountry.current = targets[index];
    keyboardMarker.current = undefined;
    markerUnderlay.current = undefined;
    setFocus(targets[index]);
    setHover(undefined);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (compact) return;
    const point = localPoint(event.clientX, event.clientY);
    if (pointerCamera && !selection && event.pointerType !== "touch" && motionPreference.current?.matches === false) {
      setPitch(Math.max(-14, Math.min(14, (.5 - point[0] / width) * 28)));
    }
  }

  function highlight(target: Target, event: PointerEvent<SVGElement>) {
    if (compact || manual.isInteracting() || selection && selection.key !== target.key) return;
    if (keyboardCountry.current && document.activeElement === motion.svg.current) {
      // The chart retains its first inspected marker as keyboard context.
      if (target.marker !== undefined) {
        if (!keyboardMarker.current) keyboardMarker.current = target;
        const underlay = document.elementsFromPoint(event.clientX, event.clientY).find(element =>
          element instanceof SVGPathElement && element.ownerSVGElement === motion.svg.current && element.getAttribute("data-map-location")?.startsWith("country:"));
        const name = underlay?.getAttribute("data-map-location")?.slice("country:".length);
        markerUnderlay.current = model.areas.find(area => area.name === name);
      }
    } else setFocus(undefined);
    setTooltipGrace(target.marker === undefined);
    setHover(current => current?.target === target ? current : { target, point: localPoint(event.clientX, event.clientY) });
  }

  const tooltipTarget = tooltip?.target;
  const dataValue = tooltipTarget && (caller ? caller.values.get(tooltipTarget.name) : variant === "choropleth-values" ? visitorCounts.get(tooltipTarget.name)
    : background ? signupCounts.get(tooltipTarget.name) : clickable || dots ? officeVisitorCounts.get(tooltipTarget.name) : undefined);
  const marker = tooltipTarget?.marker === undefined ? undefined : markerData[tooltipTarget.marker];
  const activeArea = active?.marker === undefined ? model.areas.find(area => area.name === active?.name) : undefined;
  const activeDotPath = activeArea && model.lattice?.byCountry.get(activeArea.name);
  const status = tooltipTarget && (caller ? caller.statuses.get(tooltipTarget.name) : countryStatus(tooltipTarget.name));
  const entries = useMemo(() => {
    const result: { name: string; value: string | number; color: string }[] = [];
    if (marker) {
      result.push({ name: "Location", value: marker.location, color: "var(--choropleth-marker-muted)" });
      if (caller && marker.hasValue) result.push({ name: "Value", value: marker.value, color: "var(--chart-1)" });
      if (caller && marker.category) result.push({ name: "Category", value: marker.category, color: "var(--choropleth-marker-muted)" });
    } else {
      if (dataValue !== undefined) result.push({ name: background ? "Sign-ups" : caller && variant !== "choropleth-values" ? "Value" : "Visitors",
        value: !caller && (clickable || dots) ? `${dataValue}k` : dataValue, color: "var(--chart-1)" });
      if (caller && !patterns && status) result.push({ name: "Status", value: status, color: "var(--choropleth-marker-muted)" });
    }
    return result;
  }, [marker, dataValue, background, clickable, dots, caller, variant, patterns, status]);
  const readoutTitle = tooltipTarget && (patterns && !marker && status ? `${tooltipTarget.name}: ${status}` : tooltipTarget.name);
  const stroke = "var(--choropleth-border)";
  const fillArea = (name: string, level: number) => patterns && (caller ? caller.statuses.get(name) : countryStatus(name)) === "beta" ? `url(#${id}-beta)` : mapScale(level);
  let [summary, description]: [string, string] = [...mapCaptions[variant]];
  if (caller) {
    if (variant === "choropleth-values") summary = `${format.format(caller.total)} visitors from ${caller.values.size} countries`;
    if (patterns) {
      const states = [...caller.statuses.values()];
      summary = states.length ? `Live in ${states.filter(value => value === "live").length} countries, in beta in ${states.filter(value => value === "beta").length} more` : `${caller.values.size} countries`;
      if (!states.length) description = "Darker countries have higher values; grey countries have none";
    }
    if (infrastructure) summary = `${markerData.length} locations`;
    if (clickable) summary = "Click a country or a location to zoom in";
  }
  return <div className="choropleth-detail" data-choropleth={variant} data-compact={compact}>
    <div ref={plot} className="choropleth-stage" data-pannable={pannable} data-dragging={manual.isDragging} data-flying={flyable}
      data-selected={selectedTarget?.name} onPointerMove={move}
      onPointerLeave={event => {
        if (event.pointerType !== "touch") {
          setTooltipGrace(false);
          setHover(undefined);
          setFocus(keyboardCountry.current && document.activeElement === motion.svg.current ? keyboardMarker.current ?? keyboardCountry.current : undefined);
        }
        setPitch(0);
      }}>
      {(background || pointerCamera) && <svg className="choropleth-backdrop" aria-hidden="true" viewBox={`0 0 ${width} ${height}`} data-map-backdrop="" opacity={selection && pointerCamera ? 0 : 1}>
        <defs><pattern id={`${id}-backdrop`} width="6" height="6" patternUnits="userSpaceOnUse">
          {background ? <path d="M-1 1 1 -1M0 6 6 0M5 7 7 5" stroke="var(--border)" strokeWidth=".65" />
            : <circle cx="3" cy="3" r=".7" fill="var(--muted-foreground)" opacity=".35" />}
        </pattern></defs>
        <rect width={width} height={height} fill={`url(#${id}-backdrop)`} />
      </svg>}
      <svg ref={motion.svg} className="choropleth-svg cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} data-choropleth-width={width} data-choropleth-height={height}
        style={flyable && !compact ? undefined : { transform: angle }} role="img" aria-roledescription="map" aria-label={example.title} tabIndex={compact ? undefined : 0}
        aria-describedby={compact ? undefined : `${id}-keys`}
        onFocus={compact ? undefined : event => {
          if (event.target !== event.currentTarget) return;
          keyboardCountry.current = undefined;
          keyboardMarker.current = undefined;
          markerUnderlay.current = undefined;
          setTooltipGrace(false);
          setFocus(targets[0]);
          setHover(undefined);
        }}
        onBlur={() => { keyboardCountry.current = undefined; keyboardMarker.current = undefined; markerUnderlay.current = undefined; setTooltipGrace(false); setFocus(undefined); }} onKeyDown={compact ? undefined : key}
        onClick={flyable && !compact ? () => { if (!didDrag.current) reset(); } : undefined}>
        {!compact && <desc id={`${id}-keys`}>Use arrow keys to inspect visible countries and locations. {pannable ? "Drag to pan, scroll or pinch to zoom. " : ""}{flyable ? "Press Enter to zoom to the selected place. Escape resets the view." : ""}</desc>}
        <defs>
          {patterns && <pattern id={`${id}-beta`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="var(--choropleth-scale-2)" />
            <path d="M-1 1 1 -1M0 6 6 0M5 7 7 5" stroke="var(--choropleth-scale-4)" strokeWidth="2" />
          </pattern>}
          {dots && <>
            <linearGradient id={`${id}-dot-fade-x`}>
              {dotFadeStops.map(([offset, opacity]) => <stop key={offset} offset={`${offset}%`} stopColor="white" stopOpacity={opacity} />)}
            </linearGradient>
            <linearGradient id={`${id}-dot-fade-y`} x2="0" y2="1">
              {dotFadeStops.map(([offset, opacity]) => <stop key={offset} offset={`${offset}%`} stopColor="white" stopOpacity={opacity} />)}
            </linearGradient>
            <mask id={`${id}-dot-mask-x`} x="0" y="0" width={width} height={height} maskUnits="userSpaceOnUse">
              <rect width={width} height={height} fill={`url(#${id}-dot-fade-x)`} />
            </mask>
            <mask id={`${id}-dot-mask`} x="0" y="0" width={width} height={height} maskUnits="userSpaceOnUse">
              <g mask={`url(#${id}-dot-mask-x)`}>
                <rect width={width} height={height} fill={`url(#${id}-dot-fade-y)`} />
              </g>
            </mask>
          </>}
        </defs>
        <g ref={transformed} className="choropleth-viewport" data-map-viewport="" style={flyable && !compact ? undefined : { transform: `translate(${x}px,${y}px) scale(${scale})` }}>
          {model.grid && <path data-map-graticule="" d={model.grid} fill="none" stroke="var(--border)" strokeWidth=".5" vectorEffect="non-scaling-stroke" opacity={selection ? 0 : 1} />}
          {model.lattice && <g aria-hidden="true" fill="none" strokeLinecap="round" pointerEvents="none" mask={`url(#${id}-dot-mask)`}>
            <path data-map-ocean="" d={model.lattice.ocean} stroke={mapScale(1)} strokeWidth="2.695" opacity={selectedTarget ? 0 : .35} />
            <g ref={motion.land} data-map-dot-land="" strokeWidth={selectedTarget ? 6.3 : 4.9}>
              <g data-map-dot-regions="" opacity={activeArea ? .5 : 1}>
                {model.lattice.land.map(({ level, path }) => <path key={level} d={path} data-map-land={level} stroke={mapScale(level)} />)}
              </g>
              {activeArea && activeDotPath && <path data-map-dot-focus={activeArea.name} d={activeDotPath} stroke={mapScale(activeArea.level)} />}
            </g>
          </g>}
          {model.areas.map(area => <path key={area.name} data-map-location={area.key} data-map-level={area.level} data-market-status={patterns ? caller ? caller.statuses.get(area.name) : countryStatus(area.name) : undefined}
            d={area.d} fill={dots ? "transparent" : fillArea(area.name, area.level)} stroke={dots ? "none" : stroke} strokeWidth=".5" strokeLinejoin="round"
            vectorEffect="non-scaling-stroke" opacity={activeArea && activeArea.name !== area.name && !dots ? .4 : 1}
            onPointerMove={compact ? undefined : event => highlight(area, event)}
            onPointerLeave={event => { if (event.pointerType !== "touch" && (!keyboardCountry.current || document.activeElement !== motion.svg.current)) setHover(undefined); }}
            onClick={compact ? undefined : event => { event.stopPropagation(); if (flyable) fly(area); else if (!didDrag.current) setFocus(area); }} />)}
          {activeArea && !dots && <path data-map-country-focus="" d={activeArea.d} fill={fillArea(activeArea.name, activeArea.level)}
            stroke="var(--foreground)" strokeWidth=".85" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
        </g>
        {markerData.map(target => {
          const index = target.marker;
          const slot = index % markerRadii.length;
          const radius = infrastructure ? markerRadii[slot] : pointerCamera ? 5 : dots ? 6 : 4.5;
          const pin = pointerCamera || infrastructure && slot === 0;
          const shape = pin ? pinPath(radius) : infrastructure ? mainShapes[slot] : undefined;
          const fill = infrastructure ? `var(--chart-${slot + 1})` : pointerCamera ? "var(--chart-1)" : dots ? "var(--chart-2)" : "var(--foreground)";
          const pulse = !compact && (pointerCamera || infrastructure && index === 0 || active?.key === target.key);
          const inspectable = !compact && (flyable || infrastructure && !!caller);
          return <g key={target.key} ref={motion.markerRef(target.key, target.at)} className="choropleth-marker" data-map-marker={target.name} data-map-marker-key={target.key} data-marker-value={caller ? target.value : undefined}
            style={flyable && !compact ? undefined : { transform: `translate(${target.at[0] * scale + x}px,${target.at[1] * scale + y}px)` }}
            role={inspectable ? flyable ? "button" : "img" : undefined} tabIndex={inspectable ? 0 : undefined}
            aria-label={inspectable ? flyable ? `Zoom to ${target.name}` : `${target.name}: map location` : undefined}
            onFocus={compact ? undefined : () => { if (!selection || selection.key === target.key) { setFocus(target); setHover(undefined); } }}
            onKeyDown={!flyable || compact ? undefined : event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); fly(target); } }}
            onPointerMove={compact ? undefined : event => highlight(target, event)}
            onPointerLeave={event => {
              if (event.pointerType === "touch") return;
              if (!keyboardCountry.current || document.activeElement !== motion.svg.current) { setHover(undefined); setFocus(undefined); }
              else if (!selection && event.relatedTarget === motion.svg.current && markerUnderlay.current) {
                setTooltipGrace(true);
                setHover({ target: markerUnderlay.current, point: localPoint(event.clientX, event.clientY) });
              }
            }}
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
      {!compact && <ChoroplethTooltip host={plot} scene={motion.svg} width={width} height={height} label={readoutTitle} entries={entries} point={tooltip?.point}
        identity={tooltipTarget?.marker === undefined ? "country" : tooltipTarget.key} />}
    </div>
    {!compact && <div className="choropleth-summary"><strong>{summary}</strong><span>{description}</span></div>}
  </div>;
}
