import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { Button } from "@ui-sdk/react/button";
import { Choices } from "../../../ui/Choices";
import type { ChartPreviewProps } from "../../../types";
import { useChartTheme } from "../../theme";
import type { Bounds, ScatterFrame } from "./data";
import { exact, exactTime, inset, makeScatterPainter, number, project } from "./plot";
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
  const [count, setCount] = useState(10_000);
  const [view, setView] = useState<Bounds>();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selection, setSelection] = useState<Selection>();
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; view: Bounds }>(undefined);
  const painter = useRef<ReturnType<typeof makeScatterPainter>>(undefined);
  const input = useMemo(() => ({ count: data || !compact ? count : 1600, data }), [compact, count, data]);
  const columns = size.width ? Math.max(8, Math.floor((size.width - inset.left - inset.right) / 5)) : 0;
  const rows = size.height ? Math.max(8, Math.floor((size.height - inset.top - inset.bottom) / 5)) : 0;
  const { frame, busy } = useScatterFrame(input, view, columns, rows);
  const plot = frame ? project(frame.view, size.width, size.height) : undefined;
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
      const width = element.clientWidth, height = element.clientHeight;
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
      const from = plot.at(x - 9, y)[0], to = plot.at(x + 9, y)[0];
      let lo = 0, hi = frame.points.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (frame.points[mid].x < from) lo = mid + 1; else hi = mid;
      }
      let distance = 81;
      for (let i = lo; i < frame.points.length && frame.points[i].x <= to; i++) {
        const point = frame.points[i];
        const next = (plot.x(point.x) - x) ** 2 + (plot.y(point.y) - y) ** 2;
        if (next < distance) { distance = next; index = i; }
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
      const index = event.key === "Home" ? 0 : event.key === "End" ? last : Math.max(0, Math.min(last, (current?.index ?? -1) + step));
      setSelection({ frame, index, keyboard: true });
    }
  }

  function zoomAt(event: MouseEvent<HTMLDivElement>) {
    if (!plot) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    if (x >= inset.left && x <= inset.left + plot.w && y >= inset.top && y <= inset.top + plot.h) zoom(.4, plot.at(x, y));
  }

  let tooltip: { heading: string; rows: [string, string][]; x: number; y: number } | undefined;
  if (frame && current && plot && !busy) {
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

  return <div className="stat-demo stat-canvas">
    {!compact && <div className="stat-controls scatter-controls">
      {!data && <><span>Points</span><Choices label="Request count" options={counts} value={String(count)} onChange={next => setCount(Number(next))} itemClassName="stat-control" /></>}
      <div className="scatter-zoom">
        <Button className="stat-control" aria-label="Zoom in" disabled={!frame?.count} onClick={() => zoom(.4)}>+</Button>
        <Button className="stat-control" aria-label="Zoom out" disabled={!view} onClick={() => zoom(2.5)}>−</Button>
        <Button className="stat-control" disabled={!view} onClick={() => { setSelection(undefined); setView(undefined); }}>Reset</Button>
      </div>
    </div>}
    <div className="chart-renderer scatter-plot" ref={host} role="img" aria-label={example.title}
      aria-roledescription="chart" tabIndex={compact ? undefined : 0} aria-busy={busy}
      data-scatter-mode={frame?.mode} data-visible-points={frame?.visible} data-total-points={frame?.count}
      onPointerDown={compact ? undefined : startDrag} onLostPointerCapture={() => { drag.current = undefined; }}
      onPointerMove={compact ? undefined : inspect} onPointerLeave={() => setSelection(undefined)}
      onDoubleClick={compact ? undefined : zoomAt} onKeyDown={compact ? undefined : key} onBlur={() => setSelection(undefined)}>
      <canvas ref={canvas} aria-hidden="true" />
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
    {!compact && <p className="stat-map-summary" role="status">{frame ? <>
      {number.format(frame.count)} {data ? "points" : "requests in one week"} · {frame.mode === "density" ? data ? "Density view · zoom in to inspect points" : "Density view · zoom in to inspect requests" : `${number.format(frame.visible)} visible points`}
    </> : "Loading points…"}</p>}
    {!compact && <output className="scatter-announcement" aria-live="polite">{current?.keyboard && tooltip ? [tooltip.heading, ...tooltip.rows.flat()].join(", ") : ""}</output>}
  </div>;
}
