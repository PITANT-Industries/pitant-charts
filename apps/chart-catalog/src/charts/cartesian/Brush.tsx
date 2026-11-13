import { useId, useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { CartesianData } from "./data";
import { colorFor, type ChartTheme } from "./options";

export type BrushRange = [number, number];
type Handle = "start" | "end" | "window";

const chartWidth = 720;
const chartHeight = 55;
const handles = { start: "Start of visible range", end: "End of visible range", window: "Visible date window" } as const;

export function clampBrush(range: BrushRange, last: number): BrushRange {
  const start = Math.max(0, Math.min(range[0], Math.max(0, last - 1)));
  return [start, Math.max(Math.min(start + 1, last), Math.min(range[1], last))];
}

export function RangeBrush({ data, range, change, theme, showLaunch }: {
  data: CartesianData;
  range: BrushRange;
  change: (range: BrushRange) => void;
  theme: ChartTheme;
  showLaunch: boolean;
}) {
  const element = useRef<HTMLDivElement>(null);
  const activeDrag = useRef<{ handle: Handle; pointer: number; x: number; initial: BrushRange } | null>(null);
  const id = useId();
  const last = data.categories.length - 1;
  if (last < 1) return null;

  const [start, end] = range;
  const startPct = start / last * 100;
  const endPct = end / last * 100;
  const selectionText = `${data.categories[start]} – ${data.categories[end]}`;

  function shift(handle: Handle, initial: BrushRange, delta: number): BrushRange {
    const [left, right] = initial;
    if (handle === "start") return [Math.min(right - 1, Math.max(0, left + delta)), right];
    if (handle === "end") return [left, Math.max(left + 1, Math.min(last, right + delta))];
    const offset = Math.min(last - right, Math.max(-left, delta));
    return [left + offset, right + offset];
  }

  function begin(event: PointerEvent<HTMLDivElement>, handle: Handle) {
    if (!event.isPrimary || event.button !== 0) return;
    const target = event.currentTarget;
    activeDrag.current = { handle, pointer: event.pointerId, x: event.clientX, initial: range };
    target.setPointerCapture(event.pointerId);
    target.focus();
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const drag = activeDrag.current;
    const width = element.current?.clientWidth;
    if (!drag || event.pointerId !== drag.pointer || !width) return;
    change(shift(drag.handle, drag.initial, Math.round((event.clientX - drag.x) / width * last)));
  }

  function endDrag(event: PointerEvent<HTMLDivElement>, cancel = false) {
    const drag = activeDrag.current;
    if (!drag || event.pointerId !== drag.pointer) return;
    activeDrag.current = null;
    if (cancel) change(drag.initial);
  }

  function key(event: KeyboardEvent<HTMLDivElement>, handle: Handle) {
    const drag = activeDrag.current;
    if (event.key === "Escape" && drag) {
      event.preventDefault();
      event.stopPropagation();
      activeDrag.current = null;
      if (event.currentTarget.hasPointerCapture(drag.pointer)) event.currentTarget.releasePointerCapture(drag.pointer);
      change(drag.initial);
      return;
    }
    const step = event.shiftKey ? 7 : 1;
    const offsets = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step, Home: -last, End: last };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    change(shift(handle, range, offsets[event.key as keyof typeof offsets]));
  }

  const control = (handle: Handle) => ({
    role: "slider",
    tabIndex: 0,
    "aria-label": handles[handle],
    "aria-valuemin": handle === "end" ? start + 1 : 0,
    "aria-valuemax": handle === "start" ? end - 1 : handle === "window" ? last - (end - start) : last,
    "aria-valuenow": handle === "end" ? end : start,
    "aria-valuetext": handle === "window" ? selectionText : data.categories[handle === "start" ? start : end],
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => key(event, handle),
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => begin(event, handle),
    onPointerMove: move,
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => endDrag(event),
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => endDrag(event, true),
    onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => endDrag(event, true),
  });

  const series = data.series[0];
  const values = series?.values ?? [];
  const minimum = values.reduce<number>((low, value) => value === null ? low : Math.min(low, value), Infinity);
  const maximum = values.reduce<number>((high, value) => value === null ? high : Math.max(high, value), -Infinity);
  const color = series ? colorFor(series, 0, theme) : theme.colors[0];
  let segmentStart = true;
  const overview = values.map((value, index) => {
    if (value === null) {
      segmentStart = true;
      return "";
    }
    const command = segmentStart ? "M" : "L";
    segmentStart = false;
    const height = maximum > minimum ? (value - minimum) / (maximum - minimum) : 0.5;
    return `${command}${index / last * chartWidth} ${chartHeight - 6 - height * (chartHeight - 12)}`;
  }).join(" ");

  return <div className="cartesian-brush" role="group" aria-label="Chart range overview">
    <div className="cartesian-brush-track" ref={element}>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id={id} width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="7" stroke={color} strokeWidth="1.5" opacity="0.37" />
          </pattern>
        </defs>
        <rect x={start / last * chartWidth} width={(end - start) / last * chartWidth} height={chartHeight} fill={`url(#${id})`} />
        {showLaunch && <path d={`M${Math.round(last * 0.69) / last * chartWidth} 0V${chartHeight}`} stroke="var(--destructive, #db5875)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        <path d={overview} stroke={color} strokeWidth="1.4" fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="cartesian-brush-window" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} {...control("window")} />
      <div className="cartesian-brush-handle" style={{ left: `${startPct}%` }} {...control("start")} />
      <div className="cartesian-brush-handle" style={{ left: `${endPct}%` }} {...control("end")} />
    </div>
    <div className="cartesian-brush-dates" aria-hidden="true">
      {[0, 0.25, 0.5, 0.75, 1].map(fraction => <span key={fraction}>{data.categories[Math.round(last * fraction)]}</span>)}
    </div>
    <output className="cartesian-brush-result" aria-live="polite">{selectionText}</output>
  </div>;
}
