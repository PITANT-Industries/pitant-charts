import { area, curveCatmullRom, curveMonotoneX, curveStepAfter, line, type CurveFactory } from "d3-shape";
import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { Choices } from "../../ui/Choices";
import { usePlotSize } from "../usePlotSize";
import { CartesianDatePill, CartesianFocusPoint, CartesianReadout, cartesianPillWidth } from "./CartesianFocus";
import { loadingOrders } from "./area-fixtures";
import type { CartesianData } from "./data";
import { lineDateLabel } from "./line-format";
import { colorFor, valueFormat, type ChartTheme } from "./options";
import "./area-catalog.css";

const variants = {
  "area-default": { maximum: 28_000, step: 5000, topOpacity: .3, fadeFill: true, fadeStroke: true },
  "area-fill": { maximum: 4500, step: 1000, topOpacity: .6, bottomOpacity: .05, fadeFill: true, showStroke: false },
  "area-gradient-fill": { maximum: 12_000, step: 2000, topOpacity: .7, bottomOpacity: .05 },
  "area-pattern": { maximum: 6000, step: 1000, topOpacity: 0, texture: "diagonal", strokeWidth: 2.5 },
  "area-mixed": { maximum: 500, step: 100, topOpacity: .4, texture: "dots" },
  "area-background": { maximum: 2200, step: 0, topOpacity: .4 },
  "area-small-multiples": { maximum: 4500, step: 2000, topOpacity: .4 },
  "area-date-highlights": { maximum: 45, step: 10, topOpacity: .4 },
  "area-value-labels": { maximum: 4500, step: 1000, topOpacity: .3 },
  "area-dual-axis": { maximum: 7000, step: 1000, topOpacity: .3 },
  "area-steps": { maximum: 8, step: 2, topOpacity: .3 },
  "area-selection": { maximum: 14_000, step: 2000, topOpacity: .3 },
  "area-pattern-fade": { maximum: 35_000, step: 5000, topOpacity: 0, texture: "diagonal", fadeFill: true, fadeStroke: true },
  "area-fade-bottom": { maximum: 1200, step: 200, topOpacity: .5 },
  "area-custom-labels": { maximum: 65, step: 10, topOpacity: .3 },
  "area-loading": { maximum: 700, step: 100, topOpacity: .3, fadeFill: true, fadeStroke: true },
} satisfies Record<string, AreaSpec>;

interface AreaSpec {
  maximum: number;
  step: number;
  topOpacity: number;
  bottomOpacity?: number;
  texture?: "diagonal" | "dots";
  fadeFill?: boolean;
  fadeStroke?: boolean;
  showStroke?: boolean;
  strokeWidth?: number;
}
type Variant = keyof typeof variants;
type LoadingState = "Pulse" | "Sweep" | "Loaded";
type Range = [first: number, last: number];
type Position = { x: number; y: number; value: number };
type Props = { variant: Variant; label: string; data: CartesianData; compact: boolean; theme: ChartTheme; demo?: boolean };
const modes = (["Pulse", "Sweep", "Loaded"] as const).map(value => ({ value, label: value }));
const totals = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const red = "var(--chart-negative, #db5875)";
const rgb = (index: number, fallback: string) => `var(--chart-${index + 1}, ${fallback})`;
const rounded = (value: number) => Number(value.toFixed(2));
const stepIndexes = (count: number, step: number) => Array.from({ length: Math.ceil(count / step) }, (_, index) => index * step);

export function isCatalogArea(id: string): id is Variant {
  return Object.hasOwn(variants, id);
}

function localTime(date: unknown) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).valueOf();
}

function xTicks(variant: Variant, count: number, width: number, demo: boolean) {
  if (!demo) return [...new Set([...stepIndexes(count, Math.max(1, Math.round(count / (width < 420 ? 2 : 5)))), count - 1])];
  if (variant === "area-value-labels") return [0, 11, 22];
  if (variant === "area-date-highlights") return width < 340 ? [0, 21] : [0, 7, 14, 21];
  if (variant === "area-custom-labels") {
    if (width < 400) return [0, 11];
    if (width < 500) return [0, 4, 8, 11];
    return [0, 3, 6, 9, 11];
  }
  if (count === 31) return width < 340 ? [0, 15, 30] : [0, 10, 20, 30];
  return width < 340 ? [0, 15, 29] : [0, 7, 15, 22, 29];
}

function guideTicks(maximum: number, minimum: number, interval: number) {
  if (interval <= 0) return [];
  const first = Math.ceil(minimum / interval);
  const count = Math.floor(maximum / interval) - first + 1;
  return Array.from({ length: count }, (_, index) => (first + index) * interval);
}

function recordExtents(values: readonly (number | null)[], fallback: number) {
  let minimum = 0;
  let maximum = 0;
  for (const value of values) {
    if (value === null || !Number.isFinite(value)) continue;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  return { minimum, maximum: Math.max(1, fallback, maximum) };
}

function compactAxis(value: number) {
  return value >= 1000 ? `${value / 1000}k` : String(value);
}

function weekendRanges(data: CartesianData) {
  return data.categories.flatMap((_, index) => {
    const date = new Date(localTime(data.rows?.[index]?.date));
    return date.getDay() === 6 ? [[index, Math.min(index + 2, data.categories.length - 1)] as const] : [];
  });
}

const stepCurve: CurveFactory = context => {
  let previous: Position | undefined;
  let lower = false;
  let isArea = false;
  return {
    areaStart() { isArea = true; lower = false; },
    areaEnd() { isArea = false; },
    lineStart() { previous = undefined; },
    lineEnd() {
      if (isArea && lower) context.closePath();
      if (isArea) lower = !lower;
    },
    point(x: number, y: number) {
      if (!previous) {
        if (lower) context.lineTo(x, y);
        else context.moveTo(x, y);
      } else {
        if (lower) context.lineTo(previous.x, y);
        else context.lineTo(x, previous.y);
        context.lineTo(x, y);
      }
      previous = { x, y, value: 0 };
    },
  };
};

export function AreaCatalog(props: Props) {
  const { variant, data, compact, demo = true } = props;
  const [state, setState] = useState<LoadingState>(variant === "area-loading" && !compact ? "Pulse" : "Loaded");
  const [active, setActive] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState(0);
  const multiples = variant === "area-small-multiples";
  const loading = state !== "Loaded";
  const panels = multiples ? data.series.map(item => ({
    name: item.name,
    total: totals.format(item.values.reduce<number>((sum, value) => sum + (value ?? 0), 0)),
    data: { ...data, series: [{ ...item, name: "Signups" }] },
  })) : [];
  return <div className="catalog-area" data-catalog-area={variant} data-area-compact={compact || undefined}>
    {variant === "area-loading" && !compact && <Choices label="Chart state" className="cartesian-choice-group catalog-area-controls"
      options={modes} value={state} onChange={value => { setState(value); setActive(null); }} />}
    {multiples ? <div className="catalog-area-panels">
      {panels.slice(0, compact ? 4 : panels.length).map((panel, index) => <div className="catalog-area-region" key={index}>
        {!compact && <header><span>{panel.name}</span><span>{panel.total}</span></header>}
        <AreaPlot {...props} data={panel.data} label={`${panel.name} weekly signups`} active={active} announce={index === activePanel}
          setActive={value => { setActivePanel(index); setActive(value); }} loading={state} demo={demo} />
      </div>)}
    </div> : <AreaPlot {...props} demo={demo} active={active} announce setActive={setActive} loading={state} />}
    {loading && !compact && <span className="catalog-area-hidden" role="status">Loading orders</span>}
  </div>;
}

function AreaPlot({ variant, label, data, compact, theme, demo, active, setActive, announce, loading }: Props & {
  active: number | null; setActive: (value: number | null) => void; announce: boolean; loading: LoadingState;
}) {
  const id = useId();
  const { plot, width, height } = usePlotSize<HTMLDivElement>(728, 364);
  const tip = useRef<HTMLDivElement>(null);
  const [measuredTipWidth, setMeasuredTipWidth] = useState(0);
  const drag = useRef<{ pointer: number; anchor: number } | null>(null);
  const [selection, setSelection] = useState<Range | null>(null);
  const [rangeAnchor, setRangeAnchor] = useState<number | null>(null);
  const [entranceDone, setEntranceDone] = useState(false);
  const spec: AreaSpec = variants[variant];
  const isMultiple = variant === "area-small-multiples";
  const dual = variant === "area-dual-axis";
  const steps = variant === "area-steps";
  const calendar = variant === "area-date-highlights";
  const canSelect = variant === "area-selection";
  const load = loading !== "Loaded";
  const mainInsets = dual ? [56, 56] : steps ? [48, 40] : [40, 40];
  const left = Math.min(isMultiple ? 6 : compact ? 12 : mainInsets[0], width / 4);
  const right = Math.max(left + 1, width - Math.min(isMultiple ? 6 : compact ? 12 : mainInsets[1], width / 4));
  const top = Math.min(isMultiple ? 6 : compact ? 9 : 40, height / 3);
  const bottom = Math.max(top + 1, height - Math.min(isMultiple ? 6 : compact ? 18 : 40, height / 3));
  const available = right - left;
  const count = data.categories.length;
  const times = useMemo(() => data.categories.map((category, index) => localTime(demo ? data.rows?.[index]?.date : category)), [data, demo]);
  const timeRange = times.every(Number.isFinite) ? (times.at(-1) ?? 0) - (times[0] ?? 0) : 0;
  const xAt = (index: number) => left + (timeRange > 0 ? (times[index] - times[0]) / timeRange : index / Math.max(1, count - 1)) * available;
  const mainExtent = recordExtents(data.series.filter((_, index) => !dual || index === 0).flatMap(item => item.values), spec.maximum);
  const conversionExtent = recordExtents(data.series[1]?.values ?? [], 5);
  const mainMax = load && demo ? 350 : mainExtent.maximum;
  const yAt = (value: number, index = 0) => {
    const minimum = dual && index === 1 ? conversionExtent.minimum : mainExtent.minimum;
    const maximum = dual && index === 1 ? conversionExtent.maximum : mainMax;
    return bottom - (value - minimum) / (maximum - minimum) * (bottom - top);
  };
  const grid = guideTicks(mainMax, mainExtent.minimum, load && demo ? 50 : spec.step);
  const indices = isMultiple ? [] : xTicks(variant, count, width, Boolean(demo));
  const colors = data.series.map((item, index) => demo && item.color === undefined
    ? rgb(index, theme.colors[index % theme.colors.length]) : colorFor(item, index, theme));
  const points = data.series.map((item, seriesIndex) => {
    const values = load && demo ? loadingOrders : item.values;
    return data.categories.map((_, index) => {
      const value = values[index];
      return typeof value === "number" && Number.isFinite(value) ? { x: xAt(index), y: yAt(value, seriesIndex), value } : null;
    });
  });
  const curve = steps ? (demo ? stepCurve : curveStepAfter) : calendar ? curveCatmullRom.alpha(.5) : curveMonotoneX;
  const strokePath = line<Position | null>().curve(curve).defined(p => p !== null).x(p => p!.x).y(p => p!.y);
  const fills = points.map((series, i) => area<Position | null>().curve(curve).defined(p => p !== null).x(p => p!.x).y0(yAt(0, i)).y1(p => p!.y)(series) ?? undefined);
  const strokes = points.map(series => strokePath(series) ?? undefined);
  const visible = active !== null && active < count && !load;
  const selected = visible ? active! : 0;
  const date = String(demo ? data.rows?.[selected]?.date ?? data.categories[selected] : data.categories[selected]);
  const pill = variant === "area-custom-labels" ? data.categories[selected] : day.format(Number.isFinite(times[selected]) ? times[selected] : 0);
  const labelText = Number.isFinite(times[selected]) || variant === "area-custom-labels" ? pill : data.categories[selected] ?? "";
  const pillWidth = cartesianPillWidth(labelText ?? "");
  const pillX = Math.max(pillWidth / 2, Math.min(width - pillWidth / 2, Math.round(xAt(selected))));
  const tipWidth = measuredTipWidth || Math.min(145, width - 8);
  const focusX = xAt(selected);
  const tipX = Math.max(4, Math.min(width - tipWidth - 4, focusX + tipWidth + 16 > width ? focusX - tipWidth - 16 : focusX + 16));
  const focusEntries = data.series.flatMap((item, index) => {
    const point = points[index][selected];
    return point ? [{ name: item.name, value: point.value, color: colors[index] }] : [];
  });
  useLayoutEffect(() => {
    if (tip.current) setMeasuredTipWidth(tip.current.offsetWidth);
  }, [visible, selected, width, data]);
  useLayoutEffect(() => {
    const panel = tip.current;
    if (!panel || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(() => setMeasuredTipWidth(panel.offsetWidth));
    observer.observe(panel);
    return () => observer.disconnect();
  }, [visible, focusEntries.length]);
  const from = selection ? Math.min(...selection) : null;
  const to = selection ? Math.max(...selection) : null;
  const rangeStart = from !== null && from < count ? xAt(from) : left;
  const rangeEnd = to !== null && to < count ? xAt(to) : right;
  const deadline = calendar ? data.rows?.findIndex(row => row.date === "2026-10-15" || row.deadline === true) ?? -1 : -1;
  const negative = `url(#${id}-deadline)`;

  function findPoint(event: PointerEvent<SVGSVGElement>, allowOutside = false) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (!count || !allowOutside && (x < left - 3 || x > right + 3 || y < top || y > bottom)) return null;
    let nearest = 0;
    for (let index = 1; index < count; index++) if (Math.abs(xAt(index) - x) < Math.abs(xAt(nearest) - x)) nearest = index;
    return nearest;
  }

  function onMove(event: PointerEvent<SVGSVGElement>) {
    if (compact || load) return;
    const current = drag.current?.pointer === event.pointerId ? drag.current : null;
    const index = findPoint(event, current !== null);
    setEntranceDone(true);
    if (current && index !== null) {
      setSelection([current.anchor, index]);
      return;
    }
    setActive(index);
  }

  function onDown(event: PointerEvent<SVGSVGElement>) {
    if (compact || load || event.button !== 0) return;
    const index = findPoint(event);
    if (index === null) return;
    setEntranceDone(true);
    setActive(index);
    if (!canSelect) return;
    drag.current = { pointer: event.pointerId, anchor: index };
    event.currentTarget.setPointerCapture(event.pointerId);
    setRangeAnchor(index);
    setSelection([index, index]);
  }

  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    if (compact || load || !count) return;
    if (event.key === "Escape" && (active !== null || selection !== null)) {
      event.preventDefault();
      event.stopPropagation();
      setSelection(null);
      setRangeAnchor(null);
      setActive(null);
      return;
    }
    const last = count - 1;
    const previous = Math.max(0, (active ?? last + 1) - 1);
    const next = Math.min(last, (active ?? -1) + 1);
    const index = { Home: 0, End: last, ArrowLeft: previous, ArrowUp: previous, ArrowRight: next, ArrowDown: next }[event.key];
    if (index === undefined) return;
    event.preventDefault();
    setEntranceDone(true);
    setActive(index);
    if (canSelect && event.shiftKey) {
      const anchor = rangeAnchor ?? active ?? index;
      setRangeAnchor(anchor);
      setSelection([anchor, index]);
    } else setRangeAnchor(null);
  }

  function fillStops(color: string, index: number) {
    if (variant === "area-gradient-fill") return [[0, color, .7], [.55, rgb(1, theme.colors[1]), .35], [1, rgb(2, theme.colors[2]), .05]] as const;
    if (variant === "area-fade-bottom") return [[0, color, .5], [.4, color, .5], [1, color, 0]] as const;
    const opacity = load || spec.texture === "dots" && index === 1 ? 0 : spec.topOpacity;
    return [[0, color, opacity], [1, color, spec.bottomOpacity ?? 0]] as const;
  }

  const textureIndex = spec.texture === "dots" ? 1 : 0;
  const textureBounds = (points[textureIndex] ?? []).reduce((bounds, point) => point ? {
    top: Math.min(bounds.top, point.y), bottom: Math.max(bounds.bottom, point.y),
  } : bounds, { top: yAt(0, textureIndex), bottom: yAt(0, textureIndex) });
  const diagonalTexture = spec.texture === "diagonal";
  const strokeWidth = spec.strokeWidth ?? 2;
  const background = variant === "area-background";
  const visibleRange = canSelect && selection !== null && rangeEnd > rangeStart;
  const loadingStroke = `url(#${id}-loading)`;
  const focusClipStart = xAt(Math.max(0, selected - 1));
  const focusClipEnd = xAt(Math.min(count - 1, selected + 1));
  const focusBottom = Math.round(bottom);
  const focusY = (point: Position, seriesIndex: number) => {
    const minimum = dual && seriesIndex === 1 ? conversionExtent.minimum : mainExtent.minimum;
    const maximum = dual && seriesIndex === 1 ? conversionExtent.maximum : mainMax;
    return focusBottom - (point.value - minimum) / (maximum - minimum) * (focusBottom - top);
  };

  return <div className="catalog-area-plot" ref={plot} data-area-load={load ? loading : undefined}
    style={{ "--area-plot-inset": `${left}px` } as CSSProperties} aria-busy={load || undefined}>
    <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart"
      aria-label={label} aria-describedby={compact ? undefined : `${id}-keys`} tabIndex={compact || load ? undefined : 0}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={event => {
        if (drag.current?.pointer === event.pointerId) {
          drag.current = null;
          setActive(null);
        }
      }} onLostPointerCapture={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; setActive(null); }}
      onPointerLeave={event => { if (!drag.current && event.pointerType !== "touch") setActive(null); }}
      onBlur={() => setActive(null)} onFocus={() => setEntranceDone(true)} onKeyDown={onKey}>
      {!compact && <desc id={`${id}-keys`}>Use the arrow keys to inspect dates. Home and End jump to the first and last dates. {canSelect && "Hold Shift to extend the selected range. "}Escape clears the selection.</desc>}
      <defs>
        {colors.map((color, index) => <linearGradient key={index} id={`${id}-fill-${index}`} x2="0%" y2="100%">
          {fillStops(color, index).map(([offset, stopColor, stopOpacity]) => <stop key={offset} offset={offset} stopColor={stopColor} stopOpacity={stopOpacity} />)}
        </linearGradient>)}
        {spec.fadeStroke && colors.map((color, index) => <linearGradient key={index} id={`${id}-line-${index}`}>
          {[0, .15, .85, 1].map(offset => <stop key={offset} offset={offset} stopColor={color} stopOpacity={offset === 0 || offset === 1 ? 0 : 1} />)}
        </linearGradient>)}
        <linearGradient id={`${id}-guide`} x2="0%" y2="100%">
          {[0, .1, .9, 1].map(offset => <stop key={offset} offset={offset} stopColor={theme.muted} stopOpacity={offset === 0 || offset === 1 ? 0 : .8} />)}
        </linearGradient>
        {calendar && <linearGradient id={`${id}-deadline`}><stop stopColor={red} /><stop offset="1" stopColor={red} stopOpacity="0" /></linearGradient>}
        {(spec.texture || background || calendar) && <pattern id={`${id}-tile`} x={left} y={top} width={calendar ? 9 : 6} height={calendar ? 9 : 6} viewBox="0 0 6 6" patternUnits="userSpaceOnUse">
          {spec.texture === "dots" ? <circle cx="2.5" cy="2.5" r="1.35" fill={colors[textureIndex]} />
            : <path d={diagonalTexture ? "M0 6l6-6M-1.5 1.5l3-3M4.5 7.5l3-3" : "M-2 1L1 -2M-1 6L6 -1M4 7L7 4"}
              shapeRendering={diagonalTexture ? "crispEdges" : undefined} fill="none" stroke={calendar ? theme.muted : background ? theme.grid : colors[textureIndex]} strokeWidth="1" />}
        </pattern>}
        {variant === "area-pattern-fade" && <mask id={`${id}-pattern-vertical`} style={{ maskType: "alpha" }}>
          <linearGradient id={`${id}-pattern-opacity`} gradientUnits="userSpaceOnUse" x2="0%"
            y1={Number(textureBounds.top.toFixed(3))} y2={Number(textureBounds.bottom.toFixed(3))}>
            <stop stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <rect x={left} y={top} width={available} height={bottom - top} fill={`url(#${id}-pattern-opacity)`} />
        </mask>}
        {load && <linearGradient id={`${id}-loading`}>
          <stop stopColor={theme.muted} stopOpacity=".3" /><stop offset=".5" stopColor={theme.muted} stopOpacity=".75" /><stop offset="1" stopColor={theme.muted} stopOpacity=".3" />
        </linearGradient>}
        <clipPath id={`${id}-focus`}><rect x={focusClipStart} y={top} width={Math.max(0, focusClipEnd - focusClipStart)} height={bottom - top} /></clipPath>
        {visibleRange && <clipPath id={`${id}-range`}><rect x={rangeStart} y={top} width={rangeEnd - rangeStart} height={bottom - top} /></clipPath>}
      </defs>
      <g aria-hidden="true">
        {background && <rect data-catalog-area-background="" x={left} y={top} width={available} height={bottom - top} fill={`url(#${id}-tile)`} className="catalog-area-fade" />}
        <g className="catalog-area-fade" data-catalog-area-grid="">
          {grid.map(value => <line key={value} x1={left} x2={right} y1={rounded(yAt(value))} y2={rounded(yAt(value))} stroke={theme.grid} strokeDasharray="4 4" />)}
        </g>
        {calendar && weekendRanges(data).map(([start, end]) => <rect key={start} data-catalog-area-weekend="" x={rounded(xAt(start))} y={top}
          width={rounded(xAt(end) - xAt(start))} height={bottom - top} fill={`url(#${id}-tile)`} opacity=".6" />)}
        {deadline >= 0 && <>
          <rect data-catalog-area-deadline="" x={xAt(deadline)} y={top} width={right - xAt(deadline)} height={bottom - top} fill={negative} opacity=".25" />
          <line x1={xAt(deadline)} x2={xAt(deadline)} y1={top} y2={bottom} stroke={red} />
        </>}
        {visible && <rect data-catalog-area-guide="" x={focusX - .5} y={top} width="1" height={Math.round(bottom - top)} fill={`url(#${id}-guide)`} />}
        <g className={compact || entranceDone || load ? undefined : "cartesian-area-detail-reveal"}>
          {spec.texture && <g mask={variant === "area-pattern-fade" ? `url(#${id}-pattern-vertical)` : undefined}>
            <path d={fills[textureIndex]} fill={`url(#${id}-tile)`}
              className={spec.fadeFill ? "catalog-area-fill-fade" : undefined} data-catalog-area-pattern="" />
          </g>}
          {fills.map((path, index) => <g key={index}>
            <path data-catalog-area-fill={index} d={path} fill={`url(#${id}-fill-${index})`} opacity={visible ? .6 : 1} className={spec.fadeFill ? "catalog-area-fill-fade" : undefined} />
            {spec.showStroke !== false && <path data-catalog-area-stroke={index} d={strokes[index]} fill="none"
              stroke={load ? loadingStroke : spec.fadeStroke ? `url(#${id}-line-${index})` : colors[index]} opacity={visible ? .6 : 1}
              strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={load ? "catalog-area-placeholder" : undefined} />}
            {spec.showStroke !== false && <path data-catalog-area-highlight="" d={strokes[index]} fill="none" stroke={colors[index]} strokeWidth={strokeWidth}
              opacity={visible ? 1 : 0} strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#${id}-focus)`} />}
          </g>)}
          {variant === "area-value-labels" && !compact && <AreaValueLabels points={points} colors={colors} left={left} right={right} top={top} bottom={bottom} />}
        </g>
        {visibleRange && <g>
          <rect data-catalog-area-range="" x={rangeStart + .75} y={top + .75} width={Math.max(0, rangeEnd - rangeStart - 1.5)} height={bottom - top - 1.5}
            fill={`color-mix(in srgb, ${colors[0]} 13%, transparent)`} />
          <path d={strokes[0]} fill="none" stroke={colors[0]} strokeWidth="2.8" clipPath={`url(#${id}-range)`} />
          {[rangeStart, rangeEnd].map((x, index) => <line key={index} x1={x} x2={x} y1={top} y2={bottom} stroke={theme.muted} strokeOpacity=".5" strokeDasharray="4 4" />)}
        </g>}
        <g fill={theme.muted} fontSize={compact ? 9 : 12}>
          {indices.filter(index => index >= 0 && index < count).map(index =>
            <text data-catalog-area-tick="" key={index} x={rounded(xAt(index))} y={bottom + (compact ? 13 : 24)} textAnchor="middle"
              opacity={visible && Math.abs(xAt(index) - pillX) < pillWidth / 2 + 15 ? 0 : 1}>{data.categories[index]}</text>)}
          {dual && !compact && guideTicks(conversionExtent.maximum, conversionExtent.minimum, 1).map(value =>
            <text data-catalog-area-axis="" key={value} x={right + 4} y={rounded(yAt(value, 1))} dominantBaseline="middle">{value}%</text>)}
          {(dual || steps) && !compact && grid.map(value =>
            <text data-catalog-area-axis="" key={value} x={left - 4} y={rounded(yAt(value))} textAnchor="end" dominantBaseline="middle">{compactAxis(value)}</text>)}
        </g>
        {visible && <>
          {points.map((series, index) => series[selected] && <CartesianFocusPoint key={index} x={focusX} y={focusY(series[selected], index)} color={colors[index]} />)}
          {!isMultiple && <CartesianDatePill x={pillX} y={focusBottom + 4} label={labelText ?? ""} text={theme.text} surface={theme.surface} width={pillWidth} />}
        </>}
      </g>
    </svg>
    {!compact && visible && focusEntries.length > 0 && <div className="cartesian-area-detail-panel" ref={tip} role={announce ? "status" : undefined}
      style={{ left: tipX, top }}><CartesianReadout label={lineDateLabel(date)} entries={focusEntries} live={false} /></div>}
    {load && <span className="catalog-area-loading" aria-hidden="true">Loading orders</span>}
    {!compact && visibleRange && <output className="catalog-area-range" aria-live="polite">
      {data.categories[from!]} – {data.categories[to!]}
    </output>}
  </div>;
}

function AreaValueLabels({ points, colors, left, right, top, bottom }: {
  points: (Position | null)[][]; colors: string[]; left: number; right: number; top: number; bottom: number;
}) {
  const boxWidth = right - left;
  const occupied: { x: number; y: number; half: number }[] = [];
  return <g className="catalog-area-values">
    {points.flatMap((series, seriesIndex) => {
      const last = series.length - 1;
      const intervals = boxWidth < 250 ? 3 : 4;
      return [0, last, ...Array.from({ length: intervals - 1 }, (_, index) => Math.round(last * (index + 1) / intervals))]
        .map(index => {
          const point = series[index];
          if (!point) return null;
          const label = valueFormat.format(point.value);
          const half = label.length * 2.7 + 2;
          const x = Math.max(left + half, Math.min(right - half, point.x));
          const choices = [point.y - 12, point.y + 12];
          const y = choices.find(y => y >= top + 12 && y <= bottom - 12 &&
            occupied.every(other => Math.abs(other.x - x) >= other.half + half + 4 || Math.abs(other.y - y) >= 16));
          if (y === undefined) return null;
          occupied.push({ x, y, half });
          return <text key={`${seriesIndex}/${index}`} x={rounded(x)} y={rounded(y)} fill={colors[seriesIndex]}
            dominantBaseline="middle" textAnchor="middle" fontSize="10" fontWeight="500" data-catalog-area-value="">{label}</text>;
        });
    })}
  </g>;
}
