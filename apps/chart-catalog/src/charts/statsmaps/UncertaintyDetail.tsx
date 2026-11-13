import { Toggle } from "@ui-sdk/react/toggle";
import { area, curveMonotoneX, line } from "d3-shape";
import { useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { CartesianDatePill, CartesianFocusPoint, CartesianReadout } from "../cartesian/CartesianFocus";
import { useChartTheme } from "../theme";
import { usePlotSize } from "../usePlotSize";
import { errorBars, forecastSeam, ribbonSamples, sessionSkeleton } from "./uncertainty-detail-fixtures";
import type { DemoProps } from "./primitives";
import "./uncertainty-detail.css";

const summaries: Record<string, readonly [string, string]> = {
  "uncertainty-default": ["Social proof beats the control outright", "Its whole interval sits above the control's 4.1%"],
  "uncertainty-forest": ["Three changes clearly lift retention", "An interval crossing zero is no evidence either way"],
  "uncertainty-ribbon": ["The spread widened with the June 18 spike", "One request in ten took longer than the top of the outer band"],
  "uncertainty-forecast": ["$543k expected in December, $481k at worst", "The intervals widen as the forecast reaches further out"],
  "uncertainty-loading": ["Larger plans stay longer, with wider intervals", "Turn loading off to grow the intervals from the skeleton"],
};
export function isUncertaintyDetail(id: string) {
  return Object.hasOwn(summaries, id);
}
const day = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const month = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const round = (value: number) => Math.round(value * 100) / 100;
type Tick = { label: string; at: number };
type Row = { name: string; value: string; color: string };
type Point = { x: number; y: number };

function nearest(coordinates: number[], coordinate: number) {
  return coordinates.reduce((best, value, i) => Math.abs(value - coordinate) < Math.abs(coordinates[best] - coordinate) ? i : best, 0);
}

export function UncertaintyDetail({ example, compact }: DemoProps) {
  const id = useId();
  const theme = useChartTheme();
  const forest = example.id === "uncertainty-forest";
  const forecast = example.id === "uncertainty-forecast";
  const temporal = forecast || example.id === "uncertainty-ribbon";
  const loadingExample = example.id === "uncertainty-loading";
  const [loading, setLoading] = useState(loadingExample && !compact);
  const [index, setIndex] = useState<number | null>(null);
  const ratio = forest ? 1.5 : 2;
  const { plot, width, height: measuredHeight } = usePlotSize<HTMLDivElement>(577, 577 / ratio);
  const height = compact ? measuredHeight : width / ratio;
  const left = compact ? 12 : forest ? Math.min(128, width / 2) : 40;
  const right = Math.max(left + 1, width - (compact ? 12 : 40));
  const top = compact ? 10 : 40;
  const bottom = Math.max(top + 1, height - (compact ? 12 : 40));
  const [min, max] = forest ? [-4, 6] : forecast ? [400, 650] : temporal ? [100, 350] : loadingExample ? [2, 12] : [3, 6];
  const span = bottom - top;
  const available = right - left;
  const pointPaint = theme.colors[forest ? 1 : 0];
  const rangePaint = theme.colors[forecast ? 1 : 0];
  const scale = (value: number) => forest ? left + (value - min) / (max - min) * available : bottom - (value - min) / (max - min) * span;
  const intervals = errorBars(forest, loadingExample);
  const samples = ribbonSamples(forecast);
  const scaleTime = (time: number) => left + (time - samples[0].time) / (samples.at(-1)!.time - samples[0].time) * available;
  const slot = (forest ? span : available) / (intervals.length + .3);
  const category = (i: number) => (forest ? top : left) + (i + .65) * slot;
  const count = temporal ? samples.length : intervals.length;
  const reference = forest ? scale(0) : !loadingExample && !temporal ? scale(intervals[0].value) : null;
  const measure = (n: number) => forest ? `${n > 0 ? "+" : ""}${n.toFixed(1)} pts`
    : forecast ? `$${n}k` : temporal ? `${n} ms` : loadingExample ? `${n.toFixed(1)} min` : `${n.toFixed(1)}%`;
  const range = (lo: number, hi: number) => `${measure(lo)} – ${measure(hi)}`;
  const formatCategory = (i: number) => intervals[i].label;
  const intervalTicks: Tick[] = intervals.map((item, i) => ({ label: item.label, at: category(i) }));
  const xTicks: Tick[] = forest
    ? (width < 308 ? [0] : [0, 5]).map(value => ({ at: scale(value), label: measure(value) }))
    : temporal ? samples.flatMap(({ date, time }, i) => (forecast ? i % 3 === 0 : (i + 1) % 7 === 0)
      ? [{ at: scaleTime(time), label: (forecast ? month : day).format(date) }] : [])
      : intervalTicks.filter((_, i) => loadingExample ? width >= 392 || i % 2 === 0 : i === 0 || i === count - 1 || width >= 308 && i === 2);
  const yTicks = forest ? intervalTicks : Array.from({ length: !temporal && !loadingExample ? 7 : 6 }, (_, i) => {
    const value = min + i * (temporal ? 50 : loadingExample ? 2 : .5);
    return { at: scale(value), label: measure(value) };
  });
  const active = loading || compact ? null : index;
  const inspectSample = active === null ? undefined : samples[active];
  const inspectInterval = active === null ? undefined : intervals[active];
  const inspectPoint: Point | undefined = active === null ? undefined : temporal && inspectSample
    ? { x: scaleTime(inspectSample.time), y: scale(inspectSample.value) }
    : inspectInterval ? { x: forest ? scale(inspectInterval.high) : category(active), y: forest ? category(active) : scale(inspectInterval.value) } : undefined;
  const lines: Row[] = [];
  if (active !== null && temporal && inspectSample) {
    const { value, low, high, innerLow, innerHigh } = inspectSample;
    if (!forecast || active <= forecastSeam) lines.push({ name: forecast ? "Actual" : "Median", value: measure(value), color: pointPaint });
    if (forecast && active >= forecastSeam) lines.push({ name: "Forecast", value: measure(value), color: rangePaint });
    if (!forecast || active >= forecastSeam) lines.push(
      { name: forecast ? "95% interval" : "10th–90th", value: range(low, high), color: rangePaint },
      { name: forecast ? "80% interval" : "25th–75th", value: range(innerLow, innerHigh), color: rangePaint },
    );
  } else if (inspectInterval) {
    lines.push(
      { name: forest ? "Effect" : loadingExample ? "Session length" : "Conversion", value: measure(inspectInterval.value), color: pointPaint },
      { name: forest ? "90% interval" : "95% CI", value: range(inspectInterval.low, inspectInterval.high), color: pointPaint },
    );
  }
  const tipLabel = temporal && inspectSample ? longDay.format(inspectSample.date) : inspectInterval?.label;
  const tipWidth = Math.min(width - 16, forest ? 246 : forecast ? lines.length > 1 ? 217 : 140 : temporal ? 224 : loadingExample ? 225 : 174);
  const tipX = inspectPoint ? Math.max(8, Math.min(width - tipWidth - 8, inspectPoint.x + 16 + tipWidth > width ? inspectPoint.x - tipWidth - 16 : inspectPoint.x + 16)) : 8;
  const tipY = inspectPoint && forest ? Math.max(8, Math.min(height - 98, inspectPoint.y - 45)) : top;
  const curve = line<(typeof samples)[number]>().x(item => scaleTime(item.time)).y(item => scale(item.value)).curve(curveMonotoneX).digits(3);
  const region = (inner: boolean) => area<(typeof samples)[number]>().x(item => scaleTime(item.time))
    .y0(item => scale(inner ? item.innerLow : item.low)).y1(item => scale(inner ? item.innerHigh : item.high))
    .curve(curveMonotoneX).digits(3)(forecast ? samples.slice(forecastSeam) : samples) ?? "";

  function inspect(event: PointerEvent<SVGSVGElement>) {
    if (compact || loading) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = (event.clientY - rect.top) * height / rect.height;
    if (x < (forest ? 4 : left - 4) || x > right + 6 || y < top || y > bottom) {
      setIndex(null);
      return;
    }
    const offsets = temporal ? samples.map(item => scaleTime(item.time)) : intervals.map((_, i) => category(i));
    // The reference attaches forecast inspection to the actual series through the June seam.
    const inspected = nearest(forecast ? offsets.slice(0, forecastSeam + 1) : offsets, forest ? y : x);
    setIndex(inspected);
  }

  function inspectKey(event: KeyboardEvent<SVGSVGElement>) {
    if (compact || loading) return;
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      setIndex(null);
      return;
    }
    const last = (forecast ? forecastSeam + 1 : count) - 1;
    const prev = Math.max(0, (active ?? last + 1) - 1);
    const next = Math.min(last, (active ?? -1) + 1);
    const target = { Home: 0, End: last, ArrowLeft: prev, ArrowRight: next, ArrowUp: prev, ArrowDown: next }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    setIndex(target);
  }

  return <div className="uncertainty-detail" data-uncertainty={example.id} data-uncertainty-compact={compact || undefined}>
    {loadingExample && !compact && <div className="uncertainty-controls">
      <Toggle pressed={loading} onPressedChange={value => { setLoading(value); setIndex(null); }}><span aria-hidden="true" />Loading</Toggle>
    </div>}
    <div className="uncertainty-plot" ref={plot} style={{ aspectRatio: ratio }} aria-busy={loading || undefined}>
      <svg viewBox={`0 0 ${width} ${height}`} className="cartesian-focus-surface" role="img" aria-roledescription="chart"
        aria-label={example.title} aria-describedby={compact || loading ? undefined : `${id}-help`} tabIndex={compact || loading ? undefined : 0}
        onPointerMove={inspect} onPointerUp={event => { if (event.pointerType === "touch") inspect(event); }}
        onPointerLeave={event => { if (event.pointerType !== "touch") setIndex(null); }}
        onPointerCancel={() => setIndex(null)} onKeyDown={inspectKey} onBlur={() => setIndex(null)}>
        {!compact && !loading && <desc id={`${id}-help`}>Use the arrow keys to inspect estimates. Home and End jump to the first and last estimates. Escape clears the selection.</desc>}
        <g aria-hidden="true">
          {(forest ? xTicks : yTicks).map(({ label, at }) => <line key={label} data-uncertainty-grid=""
            x1={forest ? round(at) : left} x2={forest ? round(at) : right}
            y1={forest ? top : round(at)} y2={forest ? round(bottom) : round(at)} stroke={theme.grid} strokeDasharray="4 4" />)}
          {reference !== null && <line data-uncertainty-reference="" x1={forest ? round(reference) : left} x2={forest ? round(reference) : right}
            y1={forest ? top : round(reference)} y2={forest ? round(bottom) : round(reference)} stroke={theme.muted} strokeOpacity=".5" strokeDasharray="4 4" />}
          {loading && <g className="uncertainty-skeleton" fill={theme.text}>
            {sessionSkeleton.map(([a, b, p], i) => {
              const x = category(i), y1 = top + a * span, y2 = top + b * span;
              return <g key={i}>
                <rect data-uncertainty-skeleton="" x={round(x - 1)} y={round(y1)} width="2" height={round(y2 - y1)} rx="1" fillOpacity=".27" />
                {[y1, y2].map(y => <rect key={y} data-uncertainty-cap="" x={round(x - 7)} y={round(y - 1)} width="14" height="2" rx="1" fillOpacity=".27" />)}
                <circle data-uncertainty-point="" cx={round(x)} cy={round(top + p * span)} r="5" fillOpacity=".45" />
              </g>;
            })}
          </g>}
          {temporal && <>
            <path data-uncertainty-band="outer" d={region(false)} fill={rangePaint} fillOpacity=".14" />
            <path data-uncertainty-band="inner" d={region(true)} fill={rangePaint} fillOpacity={forecast ? .26 : .24} />
            <path data-uncertainty-line="actual" d={curve(forecast ? samples.slice(0, forecastSeam + 1) : samples) ?? ""} fill="none"
              stroke={pointPaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {forecast && <path data-uncertainty-line="forecast" d={curve(samples.slice(forecastSeam)) ?? ""} fill="none"
              stroke={rangePaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 5" />}
            {inspectPoint && active !== null && inspectSample && <>
              <defs><linearGradient id={`${id}-guide`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={top} y2={bottom}>
                <stop offset="0" stopColor={theme.muted} stopOpacity="0" />
                <stop offset=".35" stopColor={theme.muted} stopOpacity=".8" />
                <stop offset=".65" stopColor={theme.muted} stopOpacity=".8" />
                <stop offset="1" stopColor={theme.muted} stopOpacity="0" />
              </linearGradient></defs>
              <line x1={inspectPoint.x} x2={inspectPoint.x} y1={top} y2={bottom} stroke={`url(#${id}-guide)`} />
              <CartesianFocusPoint {...inspectPoint} color={pointPaint} surface="var(--background)" halo={false} />
              <CartesianDatePill x={inspectPoint.x} y={bottom + 4} label={day.format(inspectSample.date)} text={theme.text} surface={theme.surface} />
            </>}
          </>}
          {!temporal && !loading && intervals.map((item, i) => {
            const at = category(i), a = scale(item.low), b = scale(item.high), p = scale(item.value);
            const selected = active === i;
            const caps = [a, b].map(value => forest ? `M${value},${at - 7}L${value},${at + 7}` : `M${at - 7},${value}L${at + 7},${value}`);
            return <g key={formatCategory(i)} data-uncertainty-interval={item.label} opacity={active === null || selected ? 1 : .25}
              className={loadingExample ? "uncertainty-reveal" : undefined}
              style={{ transformOrigin: forest ? `${a}px ${at}px` : `${at}px ${a}px`, "--uncertainty-delay": `${i * 40}ms` } as CSSProperties}>
              <rect data-uncertainty-whisker="" x={forest ? round(a) : round(at - 1)} y={forest ? round(at - 1) : round(b)}
                width={forest ? round(b - a) : 2} height={forest ? 2 : round(a - b)} rx="1" fill={pointPaint} fillOpacity={selected ? 1 : .65} />
              {caps.map((d, i) => <path key={i} data-uncertainty-cap="" d={d} fill="none" stroke={pointPaint} strokeOpacity={selected ? 1 : .65}
                strokeWidth="2" strokeLinecap="round" />)}
              <circle data-uncertainty-point="" cx={round(forest ? p : at)} cy={round(forest ? at : p)} r="5"
                fill={pointPaint} stroke="var(--background)" strokeWidth="2" />
            </g>;
          })}
          {!compact && <g fill={theme.muted} fontSize="12">
            {xTicks.map(({ label, at }) => <text key={label} data-uncertainty-x="" x={round(at)} y={round(bottom + 24)} textAnchor="middle"
              opacity={temporal && inspectSample && Math.abs(scaleTime(inspectSample.time) - at) < 16 ? 0 : 1}>{label}</text>)}
            {yTicks.map(({ label, at }) => <text key={label} data-uncertainty-y="" x={left - (forest ? 10 : 8)} y={round(at)} dominantBaseline="middle"
              textAnchor="end">{label}</text>)}
          </g>}
        </g>
      </svg>
      {tipLabel && <div className="uncertainty-tip" style={{ inlineSize: tipWidth, insetInlineStart: tipX, insetBlockStart: tipY }}>
        <CartesianReadout label={tipLabel} entries={lines} />
      </div>}
    </div>
    {!compact && <div className="uncertainty-footer" role={loading ? "status" : undefined}>
      <strong>{loading ? "Fetching estimates…" : summaries[example.id][0]}</strong><span>{summaries[example.id][1]}</span>
    </div>}
  </div>;
}
