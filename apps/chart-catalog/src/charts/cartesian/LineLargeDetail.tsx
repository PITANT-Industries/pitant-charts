import { curveNatural, line } from "d3-shape";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { TrendingUp } from "lucide-react";
import type { ChartPreviewProps } from "../../types";
import { Choices } from "../../ui/Choices";
import { Canvas2DRenderContext } from "../pitant/renderer/canvas2d-render-context";
import { useChartTheme } from "../theme";
import { usePlotSize } from "../usePlotSize";
import { CartesianDatePill, CartesianFocusPoint, CartesianReadout, cartesianPillWidth } from "./CartesianFocus";
import { initialLargeCount, makeDenseLineData, minutesPerDay, sampleValue, type DenseLineData, type DenseLinePoint, type DenseLineRange } from "./dense-line/data";
import { useDenseLineFrame } from "./dense-line/useDenseLineFrame";
import { lineValueScale } from "./line-input";
import "./line-large-detail.css";

const emptyPoints: DenseLinePoint[][] = [];
const choices = [10, 50, 100, 250].map(count => ({ value: String(count * 1000), label: `${count}k`, ariaLabel: `${count}k points` }));
const number = new Intl.NumberFormat("en");
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function LineLargeDetail(props: ChartPreviewProps) {
  const caller = useMemo(() => props.data === undefined ? undefined : makeDenseLineData(0, props.data), [props.data]);
  if (caller && (!caller.count || !caller.series.length)) return <div className="chart-render-message" role="status">No data available.</div>;
  return <LineLargePlot {...props} caller={caller} />;
}

function LineLargePlot({ example, compact = false, data, caller }: ChartPreviewProps & { caller?: DenseLineData }) {
  const theme = useChartTheme();
  const uid = useId();
  const { plot, width, height } = usePlotSize<HTMLDivElement>(728, 364);
  const canvas = useRef<HTMLCanvasElement>(null);
  const backend = useRef<Canvas2DRenderContext>(undefined);
  const drag = useRef<{ x: number; range: DenseLineRange }>(undefined);
  const [count, setCount] = useState(initialLargeCount);
  const [selected, setSelected] = useState<number | null>(null);
  const [zoom, setZoom] = useState<{ data: DenseLineData; range: DenseLineRange }>();
  const source = useMemo(() => caller ?? makeDenseLineData(compact ? 10_000 : count), [compact, count, caller]);
  const fullRange = useMemo<DenseLineRange>(() => [0, Math.max(0, source.count - 1)], [source.count]);
  const range = zoom?.data === source ? zoom.range : fullRange;
  const inset = Math.min(compact ? 15 : 40, width * .2, height * .29);
  const left = inset, right = width - inset, bottom = height - inset;
  const plotWidth = right - left, plotHeight = bottom - inset;
  const sampledFrame = useDenseLineFrame(source, range, Math.max(1, Math.floor(plotWidth)));
  const frame = data !== undefined && sampledFrame?.data !== source ? undefined : sampledFrame;
  const displayed = frame?.data ?? source;
  const visible = frame?.range ?? range;
  const [start, end] = visible;
  const span = Math.max(1, end - start);
  const first = Math.ceil(start), last = Math.floor(end);
  const busy = !frame || frame.data !== source || frame.range !== range || frame.width !== Math.max(1, Math.floor(plotWidth));
  const [minimum, maximum] = useMemo(() => {
    let min = 0, max = data ? 0 : displayed.count === 10_000 ? 240 : 280;
    for (const series of frame?.points ?? []) for (const [, value] of series) {
      if (value === null) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    return [min, max > min ? max : min + 1];
  }, [data, displayed.count, frame]);
  const callerScale = useMemo(() => data === undefined ? undefined : lineValueScale((frame?.points ?? []).map(points => points.map(point => point[1]))), [data, frame]);
  const x = (index: number) => data !== undefined && start === end ? (left + right) / 2 : left + (index - start) / span * plotWidth;
  const y = (value: number) => callerScale ? callerScale.position(value, bottom, inset) : bottom - (value - minimum) / (maximum - minimum) * plotHeight;
  const active = !busy && selected !== null && selected >= first && selected <= last && displayed.count ? selected : null;
  const labelAt = displayed.label;
  const colors = useMemo(() => displayed.series.map((series, index) => series.color ??
    theme.colors[(data ? index : index ^ 1) % theme.colors.length]), [data, displayed, theme.colors]);
  const isolated = data === undefined ? [] : (frame?.points ?? []).flatMap((points, series) => {
    const seen = new Set<number>();
    return points.flatMap(([index, value]) => {
      if (value === null || seen.has(index) || sampleValue(displayed.series[series].values, index - 1) !== null
        || sampleValue(displayed.series[series].values, index + 1) !== null) return [];
      seen.add(index);
      return [{ index, value, series }];
    });
  });
  let nTicks = compact ? 3 : 5;
  const tickPositions = () => [...new Set(Array.from({ length: nTicks }, (_, i) => Math.round(first + i * (last - first) / (nTicks - 1))))];
  while (nTicks > 2 && nTicks * (Math.max(...tickPositions().map(index => labelAt(index).length)) * 7.2 + 12) > plotWidth) nTicks--;
  const ticks = displayed.count ? tickPositions() : [];
  const focusX = active === null ? 0 : x(active);
  const dayLabel = active === null ? "" : labelAt(active);
  const pillWidth = cartesianPillWidth(dayLabel);
  const pillX = clamp(focusX, pillWidth / 2, width - pillWidth / 2);

  useLayoutEffect(() => {
    if (!canvas.current) return;
    const renderer = new Canvas2DRenderContext(canvas.current);
    backend.current = renderer;
    return () => { renderer.dispose(); backend.current = undefined; };
  }, []);
  useLayoutEffect(() => {
    const renderer = backend.current;
    if (!renderer) return;
    const context = renderer.canvas.getContext("2d")!;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    if (renderer.width !== width || renderer.height !== height || renderer.dpr !== dpr) renderer.resize(width, height, dpr);
    const points = frame?.points ?? emptyPoints;
    renderer.beginFrame();
    try {
      context.beginPath();
      context.rect(left, inset, plotWidth, plotHeight);
      context.clip();
      // d3-shape only uses path methods shared by Path2D and Canvas2D.
      const path = line<DenseLinePoint>().defined(point => point[1] !== null).curve(curveNatural)
        .x(([index]) => data !== undefined && start === end ? (left + right) / 2 : left + (index - start) / span * plotWidth)
        .y(([, value]) => callerScale ? callerScale.position(value ?? 0, bottom, inset) : bottom - ((value ?? 0) - minimum) / (maximum - minimum) * plotHeight);
      for (let i = points.length - 1; i >= 0; i--) {
        const shape = new Path2D();
        path.context(shape as unknown as CanvasRenderingContext2D)(points[i]);
        renderer.paintPath(shape, colors[i], "stroke", 1.5);
      }
    } finally { renderer.endFrame(); }
  }, [bottom, callerScale, colors, data, end, frame, height, inset, left, maximum, minimum, plotHeight, plotWidth, right, span, start, width]);

  useEffect(() => {
    const element = plot.current;
    if (!element || compact) return;
    function wheel(event: WheelEvent) {
      if ((!event.ctrlKey && !event.metaKey) || !event.deltaY || fullRange[1] < 2 || !element) return;
      const rect = element.getBoundingClientRect();
      const px = event.clientX - rect.left, py = event.clientY - rect.top;
      if (px < left || px > right || py < inset || py > bottom) return;
      event.preventDefault();
      setSelected(null);
      const fraction = (px - left) / plotWidth;
      setZoom(previous => {
        const [a, b] = previous?.data === source ? previous.range : fullRange;
        const length = clamp((b - a) * (event.deltaY < 0 ? .8 : 1.25), 1, fullRange[1]);
        const begin = clamp(a + (b - a - length) * fraction, 0, fullRange[1] - length);
        return { data: source, range: [begin, begin + length] };
      });
    }
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [bottom, compact, fullRange, inset, left, plot, plotWidth, right, source]);

  function inspect(event: PointerEvent<SVGSVGElement>) {
    const held = drag.current;
    if (held && Math.abs(event.clientX - held.x) > 2) {
      const length = held.range[1] - held.range[0];
      const a = clamp(held.range[0] - (event.clientX - held.x) / plotWidth * length, 0, fullRange[1] - length);
      setSelected(null);
      setZoom({ data: source, range: [a, a + length] });
      return;
    }
    if (busy) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const offset = event.clientX - bounds.left, vertical = event.clientY - bounds.top;
    setSelected(offset < left || offset > right || vertical < inset || vertical > bottom ? null
      : clamp(Math.round(start + (offset - left) / plotWidth * span), first, last));
  }

  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      setSelected(null);
      return;
    }
    if (busy || !displayed.count) return;
    const keys: Record<string, number> = {
      Home: first, End: last,
      ArrowLeft: Math.max(first, (active ?? first + 1) - 1), ArrowRight: Math.min(last, (active ?? first - 1) + 1),
      ArrowUp: Math.max(first, (active ?? first + 1) - 1), ArrowDown: Math.min(last, (active ?? first - 1) + 1),
    };
    if (!Object.hasOwn(keys, event.key)) return;
    event.preventDefault();
    setSelected(keys[event.key]);
  }

  const readings = active === null ? [] : displayed.series.map((series, i) => ({
    name: data ? series.name : series.name.split(" ")[0], value: sampleValue(series.values, active), color: colors[i],
  }));
  if (!data) readings.reverse();

  return <div className="line-large-detail" data-compact={compact}>
    {!compact && !data && <div className="line-large-controls"><Choices label="Points" options={choices} value={String(count)}
      onChange={value => { setSelected(null); setZoom(undefined); setCount(Number(value)); }} /></div>}
    <div className="line-large-plot" ref={plot} data-line-large-active={active !== null} aria-busy={busy}>
      <canvas ref={canvas} aria-hidden="true" />
      <svg className="cartesian-focus-surface" role="img" aria-roledescription="chart" aria-label={example.title}
        aria-describedby={compact ? undefined : `${uid}-keys`} tabIndex={compact ? undefined : 0} viewBox={`0 0 ${width} ${height}`}
        onKeyDown={compact ? undefined : keyboard} onPointerDown={compact ? undefined : event => {
          inspect(event);
          if (event.button === 0 && event.pointerType === "mouse" && range[1] - range[0] < fullRange[1]) {
            drag.current = { x: event.clientX, range };
            event.currentTarget.setPointerCapture(event.pointerId);
          }
        }}
        onPointerMove={compact ? undefined : inspect} onPointerLeave={event => { if (event.pointerType !== "touch") setSelected(null); }}
        onLostPointerCapture={() => { drag.current = undefined; }} onPointerCancel={() => setSelected(null)} onBlur={() => setSelected(null)}
        onDoubleClick={compact ? undefined : () => { setZoom(undefined); setSelected(null); }}>
        {!compact && <desc id={`${uid}-keys`}>Use the arrow keys to inspect each sample. Home and End select the first and last visible samples. Escape clears the selection.</desc>}
        {isolated.map(point => <circle key={`${point.series}-${point.index}`} data-line-large-isolated={`${point.series}-${point.index}`} data-line-isolated-point={`${point.series}-${point.index}`}
          cx={x(point.index)} cy={y(point.value)} r={2} fill={colors[point.series]} />)}
        <g aria-hidden="true" fill={theme.muted} fontSize={compact ? 9 : 12} data-line-large-ticks="">
          {ticks.map(index => <text key={index} x={x(index)} y={bottom + (compact ? 12 : 24)} textAnchor="middle"
            opacity={active !== null && Math.abs(x(index) - pillX) < pillWidth / 2 + 20 ? 0 : 1}>{labelAt(index)}</text>)}
        </g>
        {active !== null && <g aria-hidden="true" pointerEvents="none">
          <line x1={focusX} x2={focusX} y1={inset} y2={bottom} stroke={theme.muted} strokeOpacity=".55" />
          {readings.map((item, i) => item.value !== null && <CartesianFocusPoint key={i} x={focusX} y={y(item.value)} color={item.color} surface={theme.surface} />)}
          <CartesianDatePill x={pillX} y={Math.min(height - 32, bottom + 5)} label={dayLabel} width={pillWidth} text={theme.text} surface={theme.surface} />
        </g>}
      </svg>
      {active !== null && <div className="line-large-tooltip" style={{ top: inset, ...(focusX > width / 2 ? { right: width - focusX + 8 } : { left: focusX + 8 }) }}>
        <CartesianReadout label={labelAt(active, true)} entries={readings.map(item => ({ ...item, value: item.value === null ? "—" : `${item.value}${data ? "" : " ms"}` }))} />
      </div>}
    </div>
    {!compact && <div className="line-large-summary"><strong>{number.format(displayed.count)} points per series <TrendingUp size={16} aria-hidden="true" /></strong>
      {!data && <span>{Math.round(displayed.count / minutesPerDay)} days of p50 and p95 latency, every minute</span>}</div>}
  </div>;
}
