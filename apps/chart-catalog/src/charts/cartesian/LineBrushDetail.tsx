import { Slider, SliderControl, SliderThumb, SliderTrack } from "@ui-sdk/react/slider";
import { Button } from "@ui-sdk/react/button";
import { area, curveNatural, line } from "d3-shape";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { usePlotSize } from "../usePlotSize";
import type { BrushRange } from "./Brush";
import { CartesianDatePill, CartesianFocusPoint, CartesianReadout, cartesianPillWidth } from "./CartesianFocus";
import { brushDates, brushDomain, brushLast, brushSignups, brushTicks, brushVisitors, firstSaturday, launchDay, moveBrushWindow, signupTicks, visitorTicks } from "./line-brush-data";
import { lineDateLabel } from "./line-format";
import type { ChartTheme } from "./options";
import "./line-brush-detail.css";

const variants = ["line-brush", "line-linked-brush", "line-date-highlights-brush"] as const;
type Variant = typeof variants[number];
export const isLineBrushVariant = (id: string): id is Variant => variants.some(variant => variant === id);

const allDates: BrushRange = [0, brushLast];
const linkedStart = brushDates.indexOf("Aug 29");
const negative = "var(--chart-negative, var(--destructive))";

type Point = { x: number; y: number };
const strokeLine = line<Point>().x(point => point.x).y(point => point.y).curve(curveNatural);
const overviewInsets = (linked: boolean) => linked ? { left: 48, right: 16 } : { left: 40, right: 40 };

function DateHighlights({ id, start, end, top, bottom, left, right, x, overview, muted }: {
  id: string;
  start: number;
  end: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  x: (index: number) => number;
  overview?: boolean;
  muted: string;
}) {
  const visible = launchDay >= start && launchDay <= end;
  const launch = x(launchDay);
  const weekendWidth = (right - left) * 2 / (end - start);
  return <g aria-hidden="true" clipPath={`url(#${id}-clip)`}>
    <defs>
      <pattern id={`${id}-weekend`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0,0V5" stroke={muted} strokeWidth="1" strokeOpacity=".25" />
      </pattern>
      <pattern id={`${id}-launch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0,0V5" stroke={negative} strokeWidth="1" strokeOpacity=".45" />
      </pattern>
      <linearGradient id={`${id}-launch-fade`}><stop stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0" /></linearGradient>
      {visible && launch < right && <mask id={`${id}-launch-mask`}><rect x={launch} y={top} width={right - launch} height={bottom - top} fill={`url(#${id}-launch-fade)`} /></mask>}
    </defs>
    {!overview && weekendWidth >= 4 && <g data-brush-weekends="" opacity=".45">
      {Array.from({ length: Math.ceil((brushLast - firstSaturday) / 7) }, (_, index) => firstSaturday + index * 7)
        .filter(index => index <= end && index + 2 >= start)
        .map(index => <rect key={index} x={x(index)} y={top} width={weekendWidth} height={bottom - top} fill={`url(#${id}-weekend)`} />)}
    </g>}
    {visible && <>
      {launch < right && <rect x={launch} y={top} width={right - launch} height={bottom - top}
        fill={`url(#${id}-launch)`} opacity=".6" mask={`url(#${id}-launch-mask)`} />}
      <line data-brush-launch="" x1={launch} x2={launch} y1={top} y2={bottom} stroke={negative} />
      {!overview && <text x={launch + (launch + 48 > right ? -6 : 6)} y={top + 6} dominantBaseline="hanging"
        textAnchor={launch + 48 > right ? "end" : "start"} fill={negative} fontSize="11">Launch</text>}
    </>}
  </g>;
}

type Panel = "Visitors" | "Signups";
type Selection = { index: number; panel: Panel };

function BrushPlot({ label, name, range, active, compact, linked, highlights, theme, setActive }: {
  label: string;
  name: Panel;
  range: BrushRange;
  active: Selection | null;
  compact: boolean;
  linked: boolean;
  highlights: boolean;
  theme: ChartTheme;
  setActive: (selection: Selection | null) => void;
}) {
  const id = useId();
  const { plot, width, height } = usePlotSize<HTMLDivElement>(728, linked ? 182 : 300);
  const [start, end] = range;
  const signups = name === "Signups";
  const values = signups ? brushSignups : brushVisitors;
  const [left, right] = compact ? [16, width - 16] : linked ? [48, width - 16] : [40, width - 40];
  const top = compact ? 12 : linked ? 12 : 40;
  const bottom = Math.max(top + 1, height - (compact ? 18 : linked ? 8 : 40));
  const domain = brushDomain(values, range, signups);
  const x = (index: number) => left + (index - start) / (end - start) * (right - left);
  const y = (value: number) => bottom - value / domain * (bottom - top);
  const color = theme.colors[signups ? 1 : 0];
  const points = values.map((value, index) => ({ x: x(index), y: y(value) }));
  const tickValues = signups ? signupTicks : !linked && domain < 4000 ? Array.from({ length: domain / 500 + 1 }, (_, i) => i * 500) : visitorTicks;
  const tickDates = linked ? [] : brushTicks(range, Math.min(end - start + 1, width >= 356 ? 5 : width > 300 ? 4 : width > 245 ? 3 : 2));
  const activeIndex = active?.index ?? null;
  const activeDate = activeIndex === null ? null : brushDates[activeIndex];
  const activePoint = activeIndex === null ? null : points[activeIndex];
  const pillWidth = activeDate === null ? 0 : cartesianPillWidth(activeDate);
  const focusX = activePoint ? Math.max(pillWidth / 2, Math.min(width - pillWidth / 2, Math.round(activePoint.x))) : 0;

  function inspect(event: PointerEvent<SVGSVGElement>) {
    if (compact) return;
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    if (px < left || px > right || py < top || py > bottom) {
      setActive(null);
      return;
    }
    setActive({ panel: name, index: Math.round(start + (px - left) / (right - left) * (end - start)) });
  }

  function inspectKey(event: KeyboardEvent<SVGSVGElement>) {
    if (compact) return;
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      setActive(null);
      return;
    }
    const key = event.key;
    const index = key === "Home" ? start : key === "End" ? end
      : key === "ArrowRight" || key === "ArrowUp" ? Math.min(end, (activeIndex ?? start - 1) + 1)
      : key === "ArrowLeft" || key === "ArrowDown" ? Math.max(start, (activeIndex ?? end + 1) - 1) : null;
    if (index !== null) {
      event.preventDefault();
      setActive({ panel: name, index });
    }
  }

  return <div ref={plot} className="line-brush-plot" data-brush-panel={name}>
    <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart"
      aria-label={label} aria-describedby={compact ? undefined : `${id}-help`} tabIndex={compact ? undefined : 0}
      onPointerMove={inspect} onPointerDown={inspect} onPointerLeave={event => { if (event.pointerType !== "touch") setActive(null); }}
      onPointerCancel={() => setActive(null)} onFocus={() => { if (active === null) setActive({ panel: name, index: start }); }} onBlur={() => setActive(null)} onKeyDown={inspectKey}>
      {!compact && <desc id={`${id}-help`}>Use the arrow keys to inspect dates. Home and End move to the visible endpoints. Escape clears the date.</desc>}
      <defs>
        <clipPath id={`${id}-clip`}><rect x={left} y={top} width={Math.max(1, right - left)} height={bottom - top} /></clipPath>
        <linearGradient id={`${id}-stroke`} gradientUnits="userSpaceOnUse" x1={left} x2={right}>
          <stop stopColor={color} stopOpacity="0" /><stop offset=".15" stopColor={color} />
          <stop offset=".85" stopColor={color} /><stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor={color} stopOpacity=".4" /><stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-guide`} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor={theme.muted} stopOpacity="0" /><stop offset=".1" stopColor={theme.muted} stopOpacity=".8" />
          <stop offset=".9" stopColor={theme.muted} stopOpacity=".8" /><stop offset="1" stopColor={theme.muted} stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="line-brush-grid" aria-hidden="true">
        {tickValues.filter(value => value <= domain).map(value => <line key={value} data-brush-grid="" x1={left} x2={right} y1={y(value)} y2={y(value)}
          stroke={theme.grid} strokeDasharray="4 4" />)}
      </g>
      {highlights && <DateHighlights id={id} start={start} end={end} top={top} bottom={bottom} left={left} right={right} x={x} muted={theme.muted} />}
      <g clipPath={`url(#${id}-clip)`} aria-hidden="true">
        {activePoint && <line data-brush-crosshair="" x1={activePoint.x} x2={activePoint.x} y1={top} y2={bottom} stroke={`url(#${id}-guide)`} />}
        {signups && <path data-brush-area="" d={area<Point>().x(point => point.x).y0(bottom).y1(point => point.y).curve(curveNatural)(points) ?? undefined}
          fill={`url(#${id}-fill)`} />}
        <path data-brush-path="" d={strokeLine(points) ?? undefined} fill="none" stroke={signups ? color : `url(#${id}-stroke)`}
          strokeWidth={linked && !signups ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {!compact && <g aria-hidden="true" fill={theme.muted} fontSize="12">
        {tickDates.map(index => <text key={index} data-brush-tick="" x={x(index)} y={bottom + 24} textAnchor="middle"
          opacity={activeIndex === index ? 0 : 1}>{brushDates[index]}</text>)}
        {linked && tickValues.filter(value => value <= domain).map(value => <text key={value} data-brush-tick="" x={left - 4} y={y(value)}
          textAnchor="end" dominantBaseline="middle">{value < 1000 ? value : `${value / 1000}k`}</text>)}
      </g>}
      {activePoint && <CartesianFocusPoint x={activePoint.x} y={activePoint.y} color={color} surface={theme.surface} />}
      {!linked && activeDate !== null && <CartesianDatePill x={focusX} y={bottom + 4} label={activeDate} width={pillWidth} text={theme.text} surface={theme.surface} />}
    </svg>
    {activePoint && active?.panel === name && activeIndex !== null && activeDate !== null && <div className="line-brush-tooltip"
      style={{ top, left: activePoint.x + 170 < width ? activePoint.x + 16 : undefined, right: activePoint.x + 170 >= width ? width - activePoint.x + 16 : undefined }}>
      <CartesianReadout label={lineDateLabel(activeDate)} entries={[{ name, value: values[activeIndex], color }]} />
    </div>}
  </div>;
}

function BrushOverview({ linked, highlights, range, theme, setRange }: {
  linked: boolean;
  highlights: boolean;
  range: BrushRange;
  theme: ChartTheme;
  setRange: (range: BrushRange) => void;
}) {
  const id = useId();
  const { plot, width, height } = usePlotSize<HTMLDivElement>(728, linked ? 91 : 72);
  const [start, end] = range;
  const { left, right: endInset } = overviewInsets(linked);
  const right = width - endInset;
  const plotWidth = Math.max(1, right - left);
  const top = 4;
  const bottom = Math.max(top + 1, height - (linked ? 24 : 4));
  const x = (index: number) => left + index / brushLast * plotWidth;
  const y = (value: number) => bottom - value / 4000 * (bottom - top);
  const points = brushVisitors.map((value, index) => ({ x: x(index), y: y(value) }));
  const rangeText = `${brushDates[start]} – ${brushDates[end]}`;
  const drag = useRef<{ pointer: number; initial: BrushRange; canceled: boolean } | null>(null);
  const pan = useRef<{ pointer: number; x: number } | null>(null);

  useEffect(() => {
    function release(event: globalThis.PointerEvent) {
      const current = drag.current;
      if (current?.pointer !== event.pointerId) return;
      if (event.type === "pointercancel") setRange(current.initial);
      drag.current = null;
      pan.current = null;
    }
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [setRange]);

  function rememberRange(event: PointerEvent<HTMLDivElement>) {
    if (event.isPrimary && event.button === 0) drag.current = { pointer: event.pointerId, initial: range, canceled: false };
  }

  function restoreRange(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || !drag.current) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current.canceled = true;
    setRange(drag.current.initial);
  }

  function beginPan(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    pan.current = { pointer: event.pointerId, x: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updatePan(event: PointerEvent<HTMLButtonElement>) {
    const gesture = pan.current;
    const origin = drag.current;
    if (gesture?.pointer !== event.pointerId || !origin || origin.canceled) return;
    setRange(moveBrushWindow(origin.initial, Math.round((event.clientX - gesture.x) / plotWidth * brushLast)));
  }

  function panKey(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 7 : 1;
    const offsets = { ArrowLeft: -step, ArrowRight: step, ArrowDown: -step, ArrowUp: step, Home: -brushLast, End: brushLast };
    const days = offsets[event.key as keyof typeof offsets];
    if (typeof days !== "number") return;
    event.preventDefault();
    setRange(moveBrushWindow(range, days));
  }

  return <div ref={plot} className="line-brush-overview" onPointerDownCapture={rememberRange} onKeyDownCapture={restoreRange}>
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <clipPath id={`${id}-clip`}><rect x={left} y={top} width={plotWidth} height={bottom - top} /></clipPath>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor={theme.colors[0]} stopOpacity=".4" /><stop offset="1" stopColor={theme.colors[0]} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-stroke`}>
          <stop stopColor={theme.colors[0]} stopOpacity="0" /><stop offset=".15" stopColor={theme.colors[0]} />
          <stop offset=".85" stopColor={theme.colors[0]} /><stop offset="1" stopColor={theme.colors[0]} stopOpacity="0" />
        </linearGradient>
      </defs>
      {highlights && <DateHighlights id={id} start={0} end={brushLast} top={top} bottom={bottom} left={left} right={right} x={x} overview muted={theme.muted} />}
      {linked && <path data-brush-area="" d={area<Point>().x(point => point.x).y0(bottom).y1(point => point.y).curve(curveNatural)(points) ?? undefined}
        fill={`url(#${id}-fill)`} />}
      <path data-brush-path="" d={strokeLine(points) ?? undefined} fill="none" stroke={linked ? theme.colors[0] : `url(#${id}-stroke)`} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      <rect data-brush-selection="" x={x(start)} y={top} width={x(end) - x(start)} height={bottom - top}
        fill={theme.colors[0]} fillOpacity=".12" stroke="var(--line-brush-border, var(--border))" strokeWidth="1.5" shapeRendering="crispEdges" />
      {[start, end].map((index, edge) => <rect data-brush-handle={edge === 0 ? "start" : "end"} key={index}
        x={x(index) - 3} y={top - 3} width="6" height={bottom - top + 6} fill={theme.colors[0]} fillOpacity=".6" />)}
      {linked && brushTicks(allDates, width < 320 ? 4 : 5).map(index => <text data-brush-tick="" key={index} x={x(index)} y={height}
        textAnchor="middle" fill={theme.muted} fontSize="12">{brushDates[index]}</text>)}
    </svg>
    <div className="line-brush-pane" data-edge="start" style={{ left, top, width: x(start) - left, height: bottom - top }} />
    <div className="line-brush-pane" data-edge="end" style={{ left: x(end), top, width: right - x(end), height: bottom - top }} />
    <Slider className="line-brush-slider" aria-label="Chart range overview" dir="ltr" min={0} max={brushLast} minStepsBetweenThumbs={1}
      largeStep={7} value={range} format={index => brushDates[index]}
      onValueChange={(value, details) => {
        const [first, last] = value;
        if (drag.current?.canceled || !Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last > brushLast || first >= last) {
          details.cancel();
          return;
        }
        setRange([first, last]);
      }}
      style={{ left, right: endInset, top, height: bottom - top }}>
      <SliderControl className="line-brush-control">
        <SliderTrack className="line-brush-track">
          <SliderThumb className="line-brush-thumb" index={0} aria-label="Start of visible range" />
          <SliderThumb className="line-brush-thumb" index={1} aria-label="End of visible range" />
        </SliderTrack>
      </SliderControl>
      <Button type="button" className="line-brush-pan" aria-label="Pan visible date window" aria-describedby={`${id}-pan-description`}
        style={{ left: `${start / brushLast * 100}%`, right: `${(brushLast - end) / brushLast * 100}%` }}
        onPointerDown={beginPan} onPointerMove={updatePan} onKeyDown={panKey}
        onClick={event => { if (event.detail === 0) setRange(moveBrushWindow(range, end < brushLast ? 1 : -1)); }}
        disabled={end - start === brushLast} />
      <span className="line-brush-sr-only" id={`${id}-pan-description`}>Use the arrow keys to move the window, Shift for one week, and Home and End for either limit.</span>
    </Slider>
    <output className="line-brush-sr-only" aria-live="polite" data-brush-range="">{rangeText}</output>
  </div>;
}

export function LineBrushDetail({ variant, label, compact, theme }: { variant: Variant; label: string; compact: boolean; theme: ChartTheme }) {
  const linked = variant === "line-linked-brush";
  const highlights = variant === "line-date-highlights-brush";
  const [range, setRange] = useState<BrushRange>(() => linked ? [linkedStart, brushLast] : allDates);
  const [active, setActive] = useState<Selection | null>(null);
  const visible = active && active.index >= range[0] && active.index <= range[1] ? active : null;

  return <div className="line-brush-detail" data-line-brush={variant} data-compact={compact} data-linked={linked}>
    {linked && !compact && <div className="line-brush-caption">Visitors</div>}
    <BrushPlot label={linked ? `${label}, visitors` : label} name="Visitors" range={range} active={visible} compact={compact} linked={linked}
      highlights={highlights} theme={theme} setActive={setActive} />
    {linked && <>
      {!compact && <div className="line-brush-caption">Signups</div>}
      <BrushPlot label={`${label}, signups`} name="Signups" range={range} active={visible} compact={compact} linked
        highlights={false} theme={theme} setActive={setActive} />
    </>}
    {!compact && <BrushOverview linked={linked} highlights={highlights} range={range} theme={theme} setRange={setRange} />}
  </div>;
}
