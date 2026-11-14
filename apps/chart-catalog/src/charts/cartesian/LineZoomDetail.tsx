import { curveNatural, line } from "d3-shape";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { usePlotSize } from "../usePlotSize";
import { CartesianDatePill, CartesianFocusPoint, CartesianReadout, cartesianPillWidth } from "./CartesianFocus";
import { lineDateLabel } from "./line-format";
import { dailyUsers } from "./line-zoom-fixture";
import { selectLineSamples } from "./line-samples";
import type { ChartTheme } from "./options";
import type { CartesianData } from "./data";
import { LineCallerZoom } from "./LineCallerZoom";
import "./line-zoom-detail.css";

type Domain = readonly [start: number, end: number];
const day = 86_400_000;
const yearStart = Date.UTC(2026, 0, 1);
const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const labels = dailyUsers.map((_, index) => date.format(yearStart + index * day));
// Preserve the elapsed-time spacing in the reference calendar across daylight saving.
const dates = dailyUsers.map((_, index) => index - (index >= 88 && index < 298 ? 1 / 24 : 0));
const calendarDay = (time: number) => Math.floor(time + (time >= dates[88] && time < dates[298] ? 1 / 24 : 0));
const fullDomain: Domain = [0, dates.length - 1];
const ticks = Array.from({ length: 7 }, (_, index) => index * 2000);

function nearestDate(time: number) {
  const index = Math.max(0, Math.min(fullDomain[1], Math.round(time)));
  const next = Math.min(fullDomain[1], index + 1);
  const previous = Math.max(0, index - 1);
  const nearest = Math.abs(dates[next] - time) < Math.abs(dates[index] - time) ? next : index;
  return Math.abs(dates[previous] - time) < Math.abs(dates[nearest] - time) ? previous : nearest;
}

function clampDomain(start: number, span: number): Domain {
  const left = Math.max(0, Math.min(fullDomain[1] - span, start));
  return [left, left + span];
}

function DemoLineZoomDetail({ label, compact, theme }: { label: string; compact: boolean; theme: ChartTheme }) {
  const id = useId();
  const { plot, width, height } = usePlotSize<HTMLDivElement>(728, 364);
  const [domain, setDomain] = useState<Domain>(fullDomain);
  const [selected, setSelected] = useState<number | null>(null);
  const drag = useRef<{ pointer: number; from: number; domain: Domain; moved: boolean } | null>(null);
  const left = Math.min(compact ? 20 : 48, width * .2);
  const right = width - Math.min(compact ? 16 : 40, width * .2);
  const inset = Math.min(compact ? 16 : 40, height * .29);
  const bottom = height - inset;
  const plotWidth = right - left;
  const span = domain[1] - domain[0];
  const zoomed = span < fullDomain[1] - .001;
  const color = theme.colors[0];
  const x = (sample: number) => left + (dates[sample] - domain[0]) / span * plotWidth;
  const y = (value: number) => bottom - value / 13000 * (bottom - inset);
  const samples = useMemo(() => selectLineSamples(dailyUsers.length, plotWidth, index => dailyUsers[index]), [plotWidth]);
  const path = line<number>().x(x).y(index => y(dailyUsers[index])).curve(curveNatural)(samples) ?? undefined;
  const nTicks = width < 450 || compact ? 3 : 5;
  const firstVisible = Math.max(0, dates.findIndex(time => time >= domain[0]));
  const firstAfter = dates.findIndex(time => time > domain[1]);
  const lastVisible = firstAfter === -1 ? fullDomain[1] : firstAfter - 1;
  const xTicks = Array.from(new Set(Array.from({ length: nTicks }, (_, index) => Math.round(firstVisible + index / (nTicks - 1) * (lastVisible - firstVisible)))));
  const focus = selected !== null && x(selected) >= left - 1 && x(selected) <= right + 1 ? selected : null;
  const focusX = focus === null ? 0 : x(focus);
  const focusLabel = focus === null ? "" : labels[focus];
  const pillWidth = cartesianPillWidth(focusLabel);
  const pillX = Math.min(width - pillWidth / 2, Math.max(pillWidth / 2, focusX));

  useEffect(() => {
    const host = plot.current;
    if (!host || compact) return;
    function wheel(event: WheelEvent) {
      if ((!event.ctrlKey && !event.metaKey) || !event.deltaY) return;
      const bounds = host!.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      if (x < left || x > right || y < inset || y > bottom) return;
      event.preventDefault();
      const anchor = (x - left) / plotWidth;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1;
      const factor = 2 ** (Math.max(-400, Math.min(400, event.deltaY * unit)) / 250);
      setDomain(([start, end]) => {
        const nextSpan = Math.min(fullDomain[1], Math.max(3, (end - start) * factor));
        return clampDomain(start + ((end - start) - nextSpan) * anchor, nextSpan);
      });
    }
    host.addEventListener("wheel", wheel, { passive: false });
    return () => host.removeEventListener("wheel", wheel);
  }, [bottom, compact, inset, left, plot, plotWidth, right]);

  function pointAt(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (x < left || x > right || y < inset || y > bottom) return null;
    return nearestDate(domain[0] + (x - left) / plotWidth * span);
  }

  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    const point = pointAt(event);
    if (point === null) return;
    setSelected(point);
    if (!zoomed) return;
    drag.current = { pointer: event.pointerId, from: event.clientX, domain, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    const active = drag.current;
    if (active?.pointer === event.pointerId) {
      const delta = event.clientX - active.from;
      if (!active.moved && Math.abs(delta) < 3) return;
      active.moved = true;
      const span = active.domain[1] - active.domain[0];
      setDomain(clampDomain(active.domain[0] - delta / plotWidth * span, span));
      setSelected(null);
    } else setSelected(pointAt(event));
  }

  function reset() {
    setDomain(fullDomain);
    setSelected(null);
  }

  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && (selected !== null || zoomed)) {
      event.preventDefault();
      event.stopPropagation();
      if (selected !== null) setSelected(null);
      else reset();
      return;
    }
    if (event.key === "+" || event.key === "=" || event.key === "-") {
      event.preventDefault();
      const nextSpan = Math.min(fullDomain[1], Math.max(3, span * (event.key === "-" ? 1.25 : .8)));
      const anchor = focus === null ? (domain[0] + domain[1]) / 2 : dates[focus];
      setDomain(clampDomain(anchor - (anchor - domain[0]) * nextSpan / span, nextSpan));
      return;
    }
    const first = firstVisible;
    const last = lastVisible;
    const keys: Record<string, number> = {
      Home: first, End: last,
      ArrowLeft: Math.max(first, (focus ?? last + 1) - 1), ArrowRight: Math.min(last, (focus ?? first - 1) + 1),
      ArrowUp: Math.max(first, (focus ?? last + 1) - 1), ArrowDown: Math.min(last, (focus ?? first - 1) + 1),
    };
    if (!Object.hasOwn(keys, event.key)) return;
    event.preventDefault();
    setSelected(keys[event.key]);
  }

  return <div className="line-zoom-detail" data-compact={compact}>
    <div className="line-zoom-plot" ref={plot} data-zoomed={zoomed}>
      <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart"
        aria-label={label} aria-describedby={compact ? undefined : `${id}-instructions`} tabIndex={compact ? undefined : 0}
        onPointerMove={compact ? undefined : pointerMove} onPointerDown={compact ? undefined : pointerDown}
        onLostPointerCapture={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; setSelected(null); }}
        onPointerLeave={event => { if (!drag.current && event.pointerType !== "touch") setSelected(null); }}
        onBlur={() => setSelected(null)} onKeyDown={compact ? undefined : keyboard} onDoubleClick={compact ? undefined : reset}>
        <defs>
          <clipPath id={`${id}-clip`}><rect x={left} y={inset} width={plotWidth} height={bottom - inset} /></clipPath>
          <linearGradient id={`${id}-stroke`} gradientUnits="userSpaceOnUse" x1={left} x2={right}>
            <stop offset="0" stopColor={color} stopOpacity="0" /><stop offset=".15" stopColor={color} />
            <stop offset=".85" stopColor={color} /><stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <g aria-hidden="true" data-line-zoom-grid="">
          {ticks.map(value => <line key={value} x1={left} x2={right} y1={y(value)} y2={y(value)} stroke={theme.grid} strokeDasharray="4 4" />)}
        </g>
        <path data-line-zoom-path="" aria-hidden="true" d={path} clipPath={`url(#${id}-clip)`} fill="none"
          stroke={`url(#${id}-stroke)`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity={focus === null ? 1 : .48} />
        <g aria-hidden="true" fill={theme.muted} fontSize={compact ? 9 : 12} data-line-zoom-ticks="">
          {xTicks.map(index => <text key={index} x={x(index)} y={bottom + (compact ? 12 : 24)} textAnchor="middle"
            opacity={focus !== null && Math.abs(x(index) - pillX) < pillWidth / 2 + 20 ? 0 : 1}>{labels[index]}</text>)}
          {!compact && ticks.map(value => <text key={value} x={left - 4} y={y(value)} textAnchor="end" dominantBaseline="middle">{value ? `${value / 1000}k` : "0"}</text>)}
        </g>
        {focus !== null && <g aria-hidden="true" pointerEvents="none">
          <line x1={focusX} x2={focusX} y1={inset} y2={bottom} stroke={theme.muted} strokeOpacity=".55" />
          <CartesianFocusPoint x={focusX} y={y(dailyUsers[focus])} color={color} surface={theme.surface} />
          <CartesianDatePill x={pillX} y={Math.min(height - 32, bottom + 5)} label={focusLabel} width={pillWidth} text={theme.text} surface={theme.surface} />
        </g>}
      </svg>
      {focus !== null && <div className="line-zoom-tip" style={focusX > width / 2 ? { right: width - focusX + 8, top: inset } : { left: focusX + 8, top: inset }}>
        <CartesianReadout label={lineDateLabel(focusLabel)} entries={[{ name: "Users", value: dailyUsers[focus], color }]} />
      </div>}
    </div>
    {!compact && <div className="line-zoom-caption">
      <output>Showing {zoomed ? `${date.format(yearStart + calendarDay(domain[0]) * day)} to ${date.format(yearStart + calendarDay(domain[1]) * day)}` : "All of 2026"}</output>
      <span id={`${id}-instructions`}>Ctrl or Cmd and scroll to zoom, drag to pan, double-click to reset<span className="line-zoom-keyboard">. Use plus and minus to zoom, arrow keys to read values, and Escape to clear or reset.</span></span>
    </div>}
  </div>;
}

export function LineZoomDetail({ data, demo = true, ...props }: { label: string; compact: boolean; theme: ChartTheme; data?: CartesianData; demo?: boolean }) {
  return demo ? <DemoLineZoomDetail {...props} /> : <LineCallerZoom {...props} data={data ?? { categories: [], series: [] }} />;
}
