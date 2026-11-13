import { curveNatural, line } from "d3-shape";
import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { TrendingUp } from "lucide-react";
import { Choices } from "../../ui/Choices";
import { usePlotSize } from "../usePlotSize";
import { CartesianDatePill, CartesianFocusPoint, CartesianReadout, cartesianPillWidth } from "./CartesianFocus";
import { selectLineSamples } from "./line-samples";
import type { ChartTheme } from "./options";
import "./line-large-detail.css";

const choices = [10, 50, 100].map(count => ({ value: String(count), label: `${count}k` }));
const number = new Intl.NumberFormat("en");
const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const dateWithDay = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const minute = 60_000;
const start = Date.UTC(2026, 6, 1);
const minutesPerDay = 24 * 60;

// Simulated reference latency. Typed arrays avoid allocating a date and object per minute.
function latency(count: number) {
  const p50 = new Float64Array(count), p95 = new Float64Array(count);
  const noise = (index: number) => {
    const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
  for (let index = 0; index < count; index++) {
    const daily = Math.sin(index / minutesPerDay * 2 * Math.PI - Math.PI / 2);
    const median = 48 + 9 * daily + 6 * Math.sin(index / 21_000) + 6 * noise(index);
    const spike = noise(index + 7) > .997 ? 90 * noise(index + 13) : 0;
    p50[index] = Math.round(median * 10) / 10;
    p95[index] = Math.round((median * 2.1 + 16 * noise(index + 3) + spike) * 10) / 10;
  }
  return { p50, p95 };
}

export function LineLargeDetail({ label, compact, theme }: { label: string; compact: boolean; theme: ChartTheme }) {
  const uid = useId();
  const { plot, width, height } = usePlotSize<HTMLDivElement>(728, 364);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [countChoice, setCount] = useState("50");
  const [selected, setSelected] = useState<number | null>(null);
  const count = compact ? 10_000 : Number(countChoice) * 1000;
  const data = useMemo(() => latency(count), [count]);
  const inset = Math.min(compact ? 15 : 40, width * .2, height * .29);
  const left = inset, right = width - inset, bottom = height - inset;
  const plotWidth = right - left;
  const plotHeight = bottom - inset;
  const ceiling = count === 10_000 ? 240 : 280;
  const samples = useMemo(() => selectLineSamples(count, plotWidth, index => (data.p50[index] + data.p95[index]) / 2), [count, data, plotWidth]);
  const last = count - 1;
  const x = (index: number) => left + index / last * plotWidth;
  const y = (value: number) => bottom - value / ceiling * plotHeight;
  const active = selected !== null && selected < count ? selected : null;
  const dateAt = (index: number) => start + index * minute;
  const labelAt = (index: number) => date.format(dateAt(index));
  let nTicks = compact ? 3 : 5;
  while (nTicks > 2) {
    const samples = Array.from({ length: nTicks }, (_, i) => Math.round(i * last / (nTicks - 1)));
    const longest = Math.max(...samples.map(index => labelAt(index).length));
    if (nTicks * (longest * 7.2 + 12) <= plotWidth) break;
    nTicks--;
  }
  const ticks = Array.from({ length: nTicks }, (_, i) => Math.round(i * last / (nTicks - 1)));
  const colors = [theme.colors[1], theme.colors[0]] as const;
  const focusX = active === null ? 0 : x(active);
  const dayLabel = active === null ? "" : date.format(dateAt(active));
  const pillWidth = cartesianPillWidth(dayLabel);
  const pillX = Math.min(width - pillWidth / 2, Math.max(pillWidth / 2, focusX));

  // Rasterize the dense traces once per layout, data, or palette change. Focus stays in SVG.
  useLayoutEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    const context = surface.getContext("2d");
    if (!context) return;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    surface.width = Math.max(1, Math.round(width * dpr));
    surface.height = Math.max(1, Math.round(height * dpr));
    context.setTransform(surface.width / width, 0, 0, surface.height / height, 0, 0);
    context.save();
    context.beginPath();
    context.rect(left, inset, plotWidth, plotHeight);
    context.clip();
    context.lineWidth = 1.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    const path = line<number>().x(index => left + index / (count - 1) * plotWidth).curve(curveNatural).context(context);
    [data.p95, data.p50].forEach((series, index) => {
      context.beginPath();
      path.y(sample => bottom - series[sample] / ceiling * plotHeight)(samples);
      context.strokeStyle = theme.colors[index === 0 ? 1 : 0];
      context.stroke();
    });
    context.restore();
  }, [bottom, ceiling, count, data, height, inset, left, plotHeight, plotWidth, samples, theme.colors, width]);

  function inspect(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const offset = event.clientX - bounds.left;
    const vertical = event.clientY - bounds.top;
    const sample = (offset - left) / plotWidth * last;
    setSelected(offset < left || offset > right || vertical < inset || vertical > bottom ? null : Math.ceil(sample - .5));
  }

  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      setSelected(null);
      return;
    }
    const keys: Record<string, number> = {
      Home: 0, End: last,
      ArrowLeft: Math.max(0, (active ?? 1) - 1), ArrowRight: Math.min(last, (active ?? -1) + 1),
      ArrowUp: Math.max(0, (active ?? 1) - 1), ArrowDown: Math.min(last, (active ?? -1) + 1),
    };
    if (!Object.hasOwn(keys, event.key)) return;
    event.preventDefault();
    setSelected(keys[event.key]);
  }

  return <div className="line-large-detail" data-compact={compact}>
    {!compact && <div className="line-large-controls"><Choices label="Points" options={choices} value={countChoice} onChange={value => { setSelected(null); setCount(value); }} /></div>}
    <div className="line-large-plot" ref={plot} data-line-large-active={active !== null}>
      <canvas ref={canvas} aria-hidden="true" />
      <svg className="cartesian-focus-surface" role="img" aria-roledescription="chart" aria-label={label}
        aria-describedby={compact ? undefined : `${uid}-keys`} tabIndex={compact ? undefined : 0} viewBox={`0 0 ${width} ${height}`}
        onKeyDown={compact ? undefined : keyboard} onPointerDown={compact ? undefined : inspect}
        onPointerMove={compact ? undefined : inspect} onPointerLeave={event => { if (event.pointerType !== "touch") setSelected(null); }}
        onPointerCancel={() => setSelected(null)} onBlur={() => setSelected(null)}>
        {!compact && <desc id={`${uid}-keys`}>Use the arrow keys to inspect each minute. Home and End select the first and last minutes. Escape clears the selection.</desc>}
        <g aria-hidden="true" fill={theme.muted} fontSize={compact ? 9 : 12} data-line-large-ticks="">
          {ticks.map(index => <text key={index} x={x(index)} y={bottom + (compact ? 12 : 24)} textAnchor="middle"
            opacity={active !== null && Math.abs(x(index) - pillX) < pillWidth / 2 + 20 ? 0 : 1}>{labelAt(index)}</text>)}
        </g>
        {active !== null && <g aria-hidden="true" pointerEvents="none">
          <line x1={focusX} x2={focusX} y1={inset} y2={bottom} stroke={theme.muted} strokeOpacity=".55" />
          <CartesianFocusPoint x={focusX} y={y(data.p95[active])} color={colors[0]} surface={theme.surface} />
          <CartesianFocusPoint x={focusX} y={y(data.p50[active])} color={colors[1]} surface={theme.surface} />
          <CartesianDatePill x={pillX} y={Math.min(height - 32, bottom + 5)} label={dayLabel} width={pillWidth} text={theme.text} surface={theme.surface} />
        </g>}
      </svg>
      {active !== null && <div className="line-large-tooltip" style={{ top: inset, ...(focusX > width / 2 ? { right: width - focusX + 8 } : { left: focusX + 8 }) }}>
        <CartesianReadout label={dateWithDay.format(dateAt(active))} entries={[
          { name: "p95", value: `${Math.round(data.p95[active])} ms`, color: colors[0] },
          { name: "p50", value: `${Math.round(data.p50[active])} ms`, color: colors[1] },
        ]} />
      </div>}
    </div>
    {!compact && <div className="line-large-summary"><strong>{number.format(count)} points per series <TrendingUp size={16} aria-hidden="true" /></strong>
      <span>{Math.round(count / minutesPerDay)} days of p50 and p95 latency, every minute</span></div>}
  </div>;
}
