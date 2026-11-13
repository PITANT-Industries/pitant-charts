import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { Button } from "@ui-sdk/react/button";
import { ChartScatter } from "lucide-react";
import { Choices } from "../../../ui/Choices";
import type { ChartPreviewProps } from "../../../types";
import { useChartTheme } from "../../theme";
import { CartesianReadout } from "../../cartesian/CartesianFocus";
import { day } from "./bounds";
import type { Bounds, ScatterFrame } from "./data";
import { axisDate, exact, exactTime, makeScatterPainter, number, plotInsets, project, referenceDate, referenceTooltipWidth, referenceXPadding } from "./plot";
import { useScatterFrame } from "./useScatterFrame";
import "../styles.css";
import "./scatter.css";

const counts = [10_000, 50_000, 500_000].map(value => ({ value: String(value), label: `${value / 1000}k`, ariaLabel: `${number.format(value)} points` }));
type Selection = { frame: ScatterFrame; index: number; keyboard?: boolean };

function scale(a: number, b: number, center: number, factor: number, lower: number, upper: number) {
  const span = Math.max((upper - lower) / 1e8, Math.min(upper - lower, (b - a) * factor));
  const start = Math.max(lower, Math.min(upper - span, center - (center - a) / (b - a) * span));
  return [start, start + span] as const;
}

export default function DenseScatter({ example, compact = false, data }: ChartPreviewProps) {
  const theme = useChartTheme();
  const id = useId();
  const [count, setCount] = useState(10_000);
  const [view, setView] = useState<Bounds>();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selection, setSelection] = useState<Selection>();
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; view: Bounds }>(undefined);
  const painter = useRef<ReturnType<typeof makeScatterPainter>>(undefined);
  const inset = plotInsets(!data && !compact);
  const input = useMemo(() => ({ count: data || !compact ? count : 1600, data }), [compact, count, data]);
  const columns = size.width ? Math.max(8, Math.floor((size.width - inset.left - inset.right) / 5)) : 0;
  const rows = size.height ? Math.max(8, Math.floor((size.height - inset.top - inset.bottom) / 5)) : 0;
  const { frame, busy } = useScatterFrame(input, view, columns, rows);
  const reference = frame?.reference === true;
  const plot = frame ? project(frame.view, size.width, size.height, inset, reference ? referenceXPadding : 0) : undefined;
  const current = frame && selection?.frame === frame ? selection : undefined;

  useEffect(() => { setView(undefined); setSelection(undefined); }, [input]);
  useLayoutEffect(() => {
    const element = host.current;
    const surface = canvas.current;
    if (!element || !surface) return;
    const next = makeScatterPainter(surface);
    painter.current = next;
    function resize() {
      if (!element) return;
      const { width, height } = element.getBoundingClientRect();
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    }
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => { observer.disconnect(); painter.current = undefined; next.dispose(); };
  }, []);
  useLayoutEffect(() => { painter.current?.paint(frame, theme, !data, compact); }, [frame, theme, data, compact, size]);

  function zoom(factor: number, anchor?: readonly [number, number]) {
    if (!frame) return;
    setSelection(undefined);
    setView(previous => {
      const [left, right, low, high] = previous ?? frame.full;
      let center = anchor;
      if (!center && !previous && frame.mode === "density") {
        const peak = frame.counts.indexOf(frame.peak);
        if (peak >= 0 && frame.peak) center = [
          left + (peak % frame.columns + .5) / frame.columns * (right - left),
          low + (Math.floor(peak / frame.columns) + .5) / frame.rows * (high - low),
        ];
      }
      const [x, y] = center ?? [(left + right) / 2, (low + high) / 2];
      if (factor > 1 && (right - left) * factor >= frame.full[1] - frame.full[0] &&
          (high - low) * factor >= frame.full[3] - frame.full[2]) return undefined;
      return [...scale(left, right, x, factor, frame.full[0], frame.full[1]),
        ...scale(low, high, y, factor, frame.full[2], frame.full[3])];
    });
  }

  useEffect(() => {
    const element = host.current;
    if (!element || compact) return;
    function wheel(event: WheelEvent) {
      if (!element || !plot || !event.deltaY || (!event.ctrlKey && !event.metaKey)) return;
      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      if (x < inset.left || x > inset.left + plot.w || y < inset.top || y > inset.top + plot.h) return;
      event.preventDefault();
      zoom(event.deltaY < 0 ? .55 : 1 / .55, plot.at(x, y));
    }
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  });

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!frame || !view || !plot || event.button !== 0 || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    if (x < inset.left || x > inset.left + plot.w || y < inset.top || y > inset.top + plot.h) return;
    drag.current = { x: event.clientX, y: event.clientY, view };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function inspect(event: PointerEvent<HTMLDivElement>) {
    const activeDrag = drag.current;
    if (activeDrag && frame && plot) {
      const dx = event.clientX - activeDrag.x, dy = event.clientY - activeDrag.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) {
        const [left, right, low, high] = activeDrag.view;
        const xSpan = right - left, ySpan = high - low;
        const nextX = Math.max(frame.full[0], Math.min(frame.full[1] - xSpan, left - dx / plot.w * xSpan));
        const nextY = Math.max(frame.full[2], Math.min(frame.full[3] - ySpan, low + dy / plot.h * ySpan));
        setSelection(undefined);
        setView([nextX, nextX + xSpan, nextY, nextY + ySpan]);
      }
      return;
    }
    if (busy || !frame || !plot) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
    if (x < inset.left || x > inset.left + plot.w || y < inset.top || y > inset.top + plot.h) { setSelection(undefined); return; }
    let index = -1;
    if (frame.mode === "density") {
      const col = Math.min(frame.columns - 1, Math.floor((x - inset.left) / plot.w * frame.columns));
      const row = Math.min(frame.rows - 1, Math.floor((inset.top + plot.h - y) / plot.h * frame.rows));
      const bin = row * frame.columns + col;
      if (frame.counts[bin]) index = bin;
    } else {
      const target = plot.at(x, y)[0];
      const from = reference ? target : plot.at(x - 9, y)[0];
      const to = plot.at(x + 9, y)[0];
      let lo = 0, hi = frame.points.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (frame.points[mid].x < from) lo = mid + 1; else hi = mid;
      }
      if (reference && frame.points.length) {
        index = Math.min(lo, frame.points.length - 1);
        const previous = frame.points[index - 1];
        if (previous && target - previous.x <= frame.points[index].x - target) index--;
      } else {
        let distance = 81;
        for (let i = lo; i < frame.points.length && frame.points[i].x <= to; i++) {
          const point = frame.points[i];
          const next = (plot.x(point.x) - x) ** 2 + (plot.y(point.y) - y) ** 2;
          if (next < distance) { distance = next; index = i; }
        }
      }
    }
    setSelection(previous => index < 0 ? undefined : previous?.frame === frame && previous.index === index && !previous.keyboard ? previous : { frame, index });
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "+" || event.key === "=" || event.key === "-" || event.key === "0") {
      event.preventDefault();
      if (event.key === "0") { setSelection(undefined); setView(undefined); } else zoom(event.key === "-" ? 2.5 : .4);
    } else if (event.key === "Escape" && current) {
      event.preventDefault(); event.stopPropagation(); setSelection(undefined);
    } else if (!busy && frame?.mode === "points" && frame.points.length && ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const last = frame.points.length - 1;
      const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
      const start = reference && step < 0 ? frame.points.length : -1;
      const index = event.key === "Home" ? 0 : event.key === "End" ? last : Math.max(0, Math.min(last, (current?.index ?? start) + step));
      setSelection({ frame, index, keyboard: true });
    }
  }

  function zoomAt(event: MouseEvent<HTMLDivElement>) {
    if (!plot) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    if (x >= inset.left && x <= inset.left + plot.w && y >= inset.top && y <= inset.top + plot.h) zoom(.4, plot.at(x, y));
  }

  const referencePoint = reference && !busy && current && frame?.mode === "points" ? frame.points[current.index] : undefined;
  const referenceName = referencePoint && frame?.groups[referencePoint.group].name;
  const referenceReadout = referencePoint && referenceName && plot ? {
    label: referenceDate.format(referencePoint.x),
    name: referenceName,
    value: referencePoint.y,
    color: referenceName === "Web" ? "var(--chart-1)" : "var(--chart-2)",
    x: plot.x(referencePoint.x),
  } : undefined;
  let tooltip: { heading: string; rows: [string, string][]; x: number; y: number } | undefined;
  if (!reference && frame && current && plot && !busy) {
    if (frame.mode === "points") {
      const point = frame.points[current.index];
      tooltip = { heading: point.label ?? frame.groups[point.group].name,
        rows: data ? [["X", exact(point.x)], ["Y", exact(point.y)]] : [
          ["Request time", exactTime(point.x)], ["Epoch (ms)", exact(point.x)], ["Duration", `${point.y} ms`],
        ],
        x: plot.x(point.x), y: plot.y(point.y) };
    } else {
      const col = current.index % frame.columns, row = Math.floor(current.index / frame.columns);
      const x = inset.left + (col + .5) / frame.columns * plot.w;
      const y = inset.top + (1 - (row + .5) / frame.rows) * plot.h;
      tooltip = { heading: "Density bin", rows: [[data ? "Points" : "Requests", number.format(frame.counts[current.index])]], x, y };
    }
  }

  const zoomControls = <div className="scatter-zoom">
    <Button className="stat-control" aria-label="Zoom in" disabled={!frame?.count} onClick={() => zoom(.4)}>+</Button>
    <Button className="stat-control" aria-label="Zoom out" disabled={!view} onClick={() => zoom(2.5)}>−</Button>
    <Button className="stat-control" disabled={!view} onClick={() => { setSelection(undefined); setView(undefined); }}>Reset</Button>
  </div>;

  return <div className="stat-demo stat-canvas" data-scatter-demo={!data && !compact}>
    {!compact && (data ? <div className="stat-controls scatter-controls">{zoomControls}</div> : <header className="scatter-header">
      <div className="scatter-header-title">Scatter Chart - Large Data</div>
      <p>Checkout request durations, October 5 - 11, 2026</p>
      <Choices className="scatter-counts" label="Request count" options={counts} value={String(count)} onChange={next => setCount(Number(next))} itemClassName="stat-control" />
    </header>)}
    <div className="chart-renderer scatter-plot" ref={host} role="img" aria-label={example.title}
      aria-roledescription="chart" tabIndex={compact ? undefined : 0} aria-busy={busy}
      aria-description={reference ? "Checkout request durations over one week. Use the arrow keys to inspect each point." : undefined}
      data-scatter-mode={frame?.mode} data-visible-points={frame?.visible} data-total-points={frame?.count}
      onPointerDown={compact ? undefined : startDrag} onLostPointerCapture={() => { drag.current = undefined; }}
      onPointerMove={compact ? undefined : inspect}
      onPointerUp={event => { if (!compact && reference && event.pointerType === "touch") inspect(event); }}
      onPointerLeave={event => { if (!reference || event.pointerType !== "touch") setSelection(undefined); }}
      onDoubleClick={compact ? undefined : zoomAt} onKeyDown={compact ? undefined : key} onBlur={() => setSelection(undefined)}>
      {frame?.reference && plot && <svg aria-hidden="true" className="scatter-grid" viewBox={`0 0 ${size.width} ${size.height}`}>
        <defs><linearGradient id={id + "-grid"} gradientUnits="userSpaceOnUse" x1={inset.left} x2={inset.left + plot.w}>
          <stop stopColor="var(--chart-grid, var(--border))" stopOpacity={0} />
          <stop offset=".1" stopColor="var(--chart-grid, var(--border))" stopOpacity={.11} />
          <stop offset=".9" stopColor="var(--chart-grid, var(--border))" stopOpacity={.11} />
          <stop offset="1" stopColor="var(--chart-grid, var(--border))" stopOpacity={0} />
        </linearGradient></defs>
        {Array.from({ length: 6 }, (_, i) => {
          const value = frame.view[2] + (frame.view[3] - frame.view[2]) * i / 5;
          const y = plot.y(value);
          return <g key={i}>
            <line x1={inset.left} x2={inset.left + plot.w} y1={y} y2={y} stroke={`url(#${id}-grid)`} strokeDasharray="4 4" />
            <text x={inset.left - 4} y={y} textAnchor="end" dominantBaseline="middle">{value === 1000 ? "1k" : number.format(value)}</text>
          </g>;
        })}
        {(view ? [0, 1 / 3, 2 / 3, 1].map(part => frame.view[0] + (frame.view[1] - frame.view[0]) * part)
          : [1, 3, 5, 7].map(offset => frame.full[0] + offset * day)).map(value =>
          <text key={value} x={plot.x(value)} y={inset.top + plot.h + 24} textAnchor="middle">{axisDate.format(value)}</text>)}
      </svg>}
      <canvas ref={canvas} aria-hidden="true" data-reference-scatter={reference || undefined} />
      {referenceReadout && <div className="scatter-reference-readout" aria-hidden="true" style={{
        left: referenceReadout.x + referenceTooltipWidth + 16 <= size.width
          ? referenceReadout.x + 16 : referenceReadout.x - referenceTooltipWidth - 16,
        top: inset.top,
      }}>
        <CartesianReadout label={referenceReadout.label} entries={[referenceReadout]} live={false} />
      </div>}
      {frame && frame.visible === 0 && <span className="stat-loading-label">{frame.count ? "No points in this view" : "No data"}</span>}
      {tooltip && <>
        {frame?.mode === "points" && <span className="scatter-focus" aria-hidden="true" style={{ left: tooltip.x, top: tooltip.y }} />}
        <div className="cl-tooltip scatter-tooltip" aria-hidden="true" style={{
          [tooltip.x > size.width / 2 ? "right" : "left"]: (tooltip.x > size.width / 2 ? size.width - tooltip.x : tooltip.x) + 8,
          [tooltip.y > size.height / 2 ? "bottom" : "top"]: (tooltip.y > size.height / 2 ? size.height - tooltip.y : tooltip.y) + 8,
        }}>
          <div className="cl-tooltip-heading">{tooltip.heading}</div>
          <div className="cl-tooltip-rows">{tooltip.rows.map(([name, value]) => <div className="cl-tooltip-row" key={name}><span>{name}</span><strong>{value}</strong></div>)}</div>
        </div>
      </>}
    </div>
    {!compact && !data && <div className="scatter-extension">{zoomControls}</div>}
    {!compact && <div className={data ? undefined : "scatter-footer"}>
      <p className="stat-map-summary" role="status">{frame ? <>
        {!data && <ChartScatter size={16} aria-hidden="true" />}
        {number.format(frame.count)} {data ? "points" : "requests in one week"}
        {frame.mode === "density" ? ` · Density view · zoom in to inspect ${data ? "points" : "requests"}`
          : (view || data) && ` · ${number.format(frame.visible)} visible points`}
      </> : "Loading points…"}</p>
      {!data && <p className="scatter-summary">Each dot is one checkout request and how long it took, in ms</p>}
    </div>}
    {!compact && <output className="scatter-announcement" aria-live="polite">{current?.keyboard && (
      referenceReadout ? `${referenceReadout.label}: ${referenceReadout.name} ${referenceReadout.value}`
        : tooltip && [tooltip.heading, ...tooltip.rows.flat()].join(", ")
    )}</output>}
  </div>;
}
